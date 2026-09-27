import { strToU8 } from "fflate";
import { compileScene, addSceneFiles } from "./scene-export";
import { validateProject } from "./archive";
import {
  MODES,
  OBJ_SIZES,
  frameAt,
  type Project,
  type Scene,
  type Piece,
  type ExportSet,
} from "./model";
import { extractTile, pixel } from "./pixels";
export type Diagnostic = {
  level: "error" | "warning" | "info";
  code: string;
  resource: string;
  values: Record<string, string | number>;
};
export function encodeTiles(pixels: Uint8Array, bpp: 2 | 4 | 8): Uint8Array {
  if (pixels.length % 64) throw new Error("Tiles must contain 64 pixels");
  const out = new Uint8Array((pixels.length * bpp) / 8);
  for (let t = 0; t < pixels.length / 64; t++)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        for (let b = 0; b < bpp; b++)
          out[t * 8 * bpp + (b >> 1) * 16 + y * 2 + (b & 1)] |=
            ((pixels[t * 64 + y * 8 + x] >> b) & 1) << (7 - x);
  return out;
}
export function decodeTiles(bytes: Uint8Array, bpp: 2 | 4 | 8): Uint8Array {
  const out = new Uint8Array((bytes.length * 8) / bpp);
  for (let t = 0; t < out.length / 64; t++)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        for (let b = 0; b < bpp; b++)
          out[t * 64 + y * 8 + x] |=
            ((bytes[t * 8 * bpp + (b >> 1) * 16 + y * 2 + (b & 1)] >> (7 - x)) &
              1) <<
            b;
  return out;
}
export function words(values: number[]): Uint8Array {
  const out = new Uint8Array(values.length * 2);
  values.forEach((v, i) => {
    out[i * 2] = v & 255;
    out[i * 2 + 1] = (v >> 8) & 255;
  });
  return out;
}
export function objectPalettes(p: Project, s: Scene): string[] {
  const used = new Set<string>();
  for (const i of s.instances) {
    const a = p.actors.find((a) => a.id === i.actorId);
    if (!a) continue;
    const v = a.variants.find((v) => v.id === i.variantId);
    for (const pose of a.poses)
      for (const c of pose.pieces)
        used.add(v?.palettes[c.paletteId] ?? c.paletteId);
  }
  return [...used];
}
export function diagnose(p: Project, s?: Scene, tick = 0): Diagnostic[] {
  const out: Diagnostic[] = [];
  const add = (
    code: string,
    resource: string,
    values: Diagnostic["values"] = {},
    level: Diagnostic["level"] = "error",
  ) => out.push({ code, resource, values, level });
  for (const sheet of p.sheets) {
    const pal = p.palettes.find((a) => a.id === sheet.paletteId);
    if (!pal || sheet.pixels.some((v) => v >= pal.colors.length))
      add("palette", sheet.id);
  }
  if (!s) return out;
  const op = objectPalettes(p, s);
  if (op.length > 8) add("objPalettes", s.id, { count: op.length });
  let bytes = 0;
  for (let n = 0; n < s.layers.length; n++) {
    const l = s.layers[n];
    if (!l.enabled) continue;
    const m = p.maps.find((m) => m.id === l.mapId)!;
    const sh = p.sheets.find((sh) => sh.id === m.sheetId)!;
    const bpp = MODES[s.mode][n];
    if (!bpp || sh.bpp !== bpp)
      add("mode", m.id, { layer: n + 1, bpp: bpp ?? 0 });
    const pals = [...new Set(m.cells.map((c) => c.paletteId))];
    if (pals.length > (sh.bpp === 8 ? 1 : 8))
      add("bgPalettes", m.id, { count: pals.length });
    if ((sh.width * sh.height) / 64 > (s.mode === 7 ? 256 : 1024))
      add("tiles", sh.id, {}, "warning");
    if (s.mode === 7 && (m.width !== 128 || m.height !== 128))
      add("mode7map", m.id);
    bytes +=
      (sh.width * sh.height * sh.bpp) / 8 +
      m.width * m.height * (s.mode === 7 ? 1 : 2);
  }
  const load = objectLoad(p, s, tick),
    counts = load.rows.map((r) => r.sprites),
    slivers = load.rows.map((r) => r.slivers);
  const total = load.total;
  const seen = new Set<string>();
  for (const i of s.instances) {
    const a = p.actors.find((a) => a.id === i.actorId)!;
    const pose = frameAt(a, i.animationId, tick);
    if (!pose) continue;
    for (const c of pose.pieces) {
      if (!OBJ_SIZES[s.objSize].includes(c.size))
        add("objSize", a.id, { size: c.size });
      for (const pos of a.poses)
        for (const pc of pos.pieces) {
          const key = [pc.sheetId, pc.sx, pc.sy, pc.size].join(":");
          if (!seen.has(key)) {
            seen.add(key);
            bytes += (pc.size * pc.size) / 2;
          }
        }
    }
  }
  if (total > 128) add("objCount", s.id, { count: total });
  for (let y = 0; y < s.height; y++)
    if (counts[y] > 32 || slivers[y] > 34) {
      add("scanline", s.id, {
        line: y,
        sprites: counts[y],
        slivers: slivers[y],
      });
      break;
    }
  if (bytes > 65536) add("vram", s.id, { bytes }, "warning");
  else add("memory", s.id, { bytes }, "info");
  const channels = new Set<number>();
  for (const e of s.effects.filter((e) => e.enabled)) {
    for (
      let c = e.channel;
      c < e.channel + (e.kind === "gradient" ? 3 : 1);
      c++
    ) {
      if (c > 7 || channels.has(c)) add("channel", e.id, { channel: c });
      channels.add(c);
    }
  }
  if (s.mode === 7 && s.perspective && channels.size > 6)
    add("perspectiveChannels", s.id);
  return out;
}
export function packSprites(p: Project, actorIds: string[]) {
  const pixels = new Uint8Array(512 * 64),
    occupied = new Uint8Array(512),
    starts: Record<string, number> = {};
  for (const id of actorIds) {
    const a = p.actors.find((a) => a.id === id)!;
    for (const pose of a.poses)
      for (const c of pose.pieces) {
        const key = pieceKey(c);
        if (starts[key] !== undefined) continue;
        const side = c.size / 8;
        let base = -1;
        for (let n = 0; n < 512; n++) {
          if ((n % 16) + side > 16 || (Math.floor(n / 16) % 16) + side > 16)
            continue;
          let free = true;
          for (let y = 0; y < side; y++)
            for (let x = 0; x < side; x++)
              if (occupied[n + y * 16 + x]) free = false;
          if (free) {
            base = n;
            break;
          }
        }
        if (base < 0) throw new Error("OBJ tiles exceed 512 slots");
        starts[key] = base;
        const sh = p.sheets.find((s) => s.id === c.sheetId)!;
        for (let y = 0; y < side; y++)
          for (let x = 0; x < side; x++) {
            const n = base + y * 16 + x;
            occupied[n] = 1;
            for (let py = 0; py < 8; py++)
              for (let px = 0; px < 8; px++)
                pixels[n * 64 + py * 8 + px] = pixel(
                  sh,
                  c.sx + x * 8 + px,
                  c.sy + y * 8 + py,
                );
          }
      }
  }
  const last = occupied.lastIndexOf(1) + 1;
  return { data: encodeTiles(pixels.slice(0, last * 64), 4), starts };
}
export const pieceKey = (c: Piece) => [c.sheetId, c.sx, c.sy, c.size].join(":");
export function defaultExport(p: Project, sceneId = ""): ExportSet {
  return {
    id: "all",
    name: "All",
    sceneId,
    gallerySceneIds: p.scenes.map((s) => s.id),
    sheetIds: p.sheets.map((v) => v.id),
    actorIds: p.actors.map((v) => v.id),
    mapIds: p.maps.map((v) => v.id),
    paletteIds: p.palettes.map((v) => v.id),
    deduplicate: false,
    flips: false,
    reservedTiles: 0,
  };
}
function tileKey(t: Uint8Array, fx = false, fy = false) {
  let k = "";
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      k += String.fromCharCode(t[(fy ? 7 - y : y) * 8 + (fx ? 7 - x : x)]);
  return k;
}
export function buildTiles(p: Project, id: string, opt: ExportSet) {
  const s = p.sheets.find((s) => s.id === id)!;
  const all: number[] = Array(opt.reservedTiles * 64).fill(0),
    lookup = new Map<
      string,
      { tile: number; flipX: boolean; flipY: boolean }
    >(),
    refs: { tile: number; flipX: boolean; flipY: boolean }[] = [];
  for (let n = 0; n < (s.width * s.height) / 64; n++) {
    const t = extractTile(s, n),
      key = tileKey(t);
    let hit = opt.deduplicate ? lookup.get(key) : undefined;
    if (!hit) {
      hit = { tile: all.length / 64, flipX: false, flipY: false };
      all.push(...t);
      lookup.set(key, hit);
      if (opt.flips)
        for (const [fx, fy] of [
          [true, false],
          [false, true],
          [true, true],
        ])
          lookup.set(tileKey(t, fx, fy), {
            tile: hit.tile,
            flipX: fx,
            flipY: fy,
          });
    }
    refs.push(hit);
  }
  return { pixels: Uint8Array.from(all), refs };
}
export function exportProject(
  p: Project,
  opt = defaultExport(p),
): Record<string, Uint8Array> {
  validateProject(p);
  const files: Record<string, Uint8Array> = {},
    manifest: Record<string, unknown> = {
      format: "snes-graph-export",
      version: 1,
      fps: p.fps,
    };
  const symbol = (id: string) => "asset_" + id.replace(/-/g, "_");
  const constants: string[] = [
    "; Generated by SNES Graph. VRAM addresses are WORD addresses.",
  ];
  const scene = p.scenes.find((s) => s.id === opt.sceneId);
  const required = (ids: string[], id: string, label: string) => {
    if (!ids.includes(id))
      throw new Error(
        "Include resource in export / Inclure la ressource dans cet export : " +
          label,
      );
  };
  for (const [key, group] of [
    ["paletteIds", "palettes"],
    ["sheetIds", "sheets"],
    ["actorIds", "actors"],
    ["mapIds", "maps"],
  ] as const) {
    if (
      new Set(opt[key]).size !== opt[key].length ||
      opt[key].some((id) => !p[group].some((r) => r.id === id))
    )
      throw new Error("Invalid export selection");
  }
  if (opt.sceneId && !scene) throw new Error("Missing exported scene");
  for (const a of p.actors.filter((a) => opt.actorIds.includes(a.id))) {
    for (const pose of a.poses)
      for (const c of pose.pieces) {
        required(
          opt.sheetIds,
          c.sheetId,
          p.sheets.find((s) => s.id === c.sheetId)!.name,
        );
        required(
          opt.paletteIds,
          c.paletteId,
          p.palettes.find((p) => p.id === c.paletteId)!.name,
        );
      }
    for (const v of a.variants)
      for (const id of Object.values(v.palettes))
        required(opt.paletteIds, id, p.palettes.find((p) => p.id === id)!.name);
  }
  for (const m of p.maps.filter((m) => opt.mapIds.includes(m.id)))
    for (const c of [...m.cells, ...m.stamps.flatMap((s) => s.cells)])
      required(
        opt.paletteIds,
        c.paletteId,
        p.palettes.find((p) => p.id === c.paletteId)!.name,
      );
  if (scene) {
    for (const l of scene.layers.filter((l) => l.enabled))
      required(opt.mapIds, l.mapId, p.maps.find((m) => m.id === l.mapId)!.name);
    for (const i of scene.instances)
      required(
        opt.actorIds,
        i.actorId,
        p.actors.find((a) => a.id === i.actorId)!.name,
      );
    for (const a of scene.paletteSlots ?? [])
      required(
        opt.paletteIds,
        a.paletteId,
        p.palettes.find((p) => p.id === a.paletteId)!.name,
      );
    if ([5, 6].includes(scene.mode) && (opt.deduplicate || opt.flips))
      throw new Error(
        "High-resolution BG tiles use consecutive pairs: disable deduplication for this export.",
      );
    const errors = diagnose(p, scene).filter((d) => d.level === "error");
    if (errors.length)
      throw new Error(
        errors.map((d) => `${d.code}: ${JSON.stringify(d.values)}`).join("\n"),
      );
  }
  for (const id of opt.paletteIds) {
    const a = p.palettes.find((a) => a.id === id)!;
    files[`palettes/${id}.pal`] = words(a.colors);
    constants.push(`${symbol(id)}_COLORS = ${a.colors.length}`);
  }
  const built = new Map<string, ReturnType<typeof buildTiles>>();
  for (const id of opt.sheetIds) {
    const s = p.sheets.find((s) => s.id === id)!;
    const b = buildTiles(p, id, opt);
    built.set(id, b);
    files[`tiles/${id}.chr`] = encodeTiles(b.pixels, s.bpp);
    constants.push(`${symbol(id)}_BYTES = ${files[`tiles/${id}.chr`].length}`);
  }
  const maps: Record<string, unknown> = {};
  for (const id of opt.mapIds) {
    const m = p.maps.find((m) => m.id === id)!,
      s = p.sheets.find((s) => s.id === m.sheetId)!;
    const b = built.get(s.id);
    if (!b) throw new Error(`Missing exported sheet: ${s.name}`);
    const palettes = [...new Set(m.cells.map((c) => c.paletteId))];
    if (palettes.length > (s.bpp === 8 ? 1 : 8))
      throw new Error("Too many map palettes");
    const mapped = m.cells.map((c) => {
      const ref = b.refs[c.tile];
      if (ref.tile > 1023) throw new Error("BG tile index > 1023");
      return (
        ref.tile |
        (palettes.indexOf(c.paletteId) << 10) |
        (c.priority ? 0x2000 : 0) |
        (c.flipX !== ref.flipX ? 0x4000 : 0) |
        (c.flipY !== ref.flipY ? 0x8000 : 0)
      );
    });
    // SNES maps are arranged in 32x32 screen blocks, not a linear 64-wide bitmap.
    const ordered: number[] = [];
    for (let by = 0; by < Math.ceil(m.height / 32); by++)
      for (let bx = 0; bx < Math.ceil(m.width / 32); bx++)
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 32; x++)
            ordered.push(
              bx * 32 + x < m.width && by * 32 + y < m.height
                ? mapped[(by * 32 + y) * m.width + bx * 32 + x]
                : 0,
            );
    files[`maps/${id}.map`] = words(ordered);
    files[`maps/${id}.collision`] = Uint8Array.from(
      m.cells.map((c) => c.collision),
    );
    maps[id] = {
      name: m.name,
      width: m.width,
      height: m.height,
      sheetId: m.sheetId,
      palettes,
      stamps: m.stamps,
      animatedTiles: m.animatedTiles.map((animation) => ({
        ...animation,
        cellIndices: m.cells.flatMap((cell, index) =>
          cell.tile === animation.tile ? [index] : [],
        ),
      })),
    };
  }
  const packed = packSprites(p, opt.actorIds);
  files["sprites.chr"] = packed.data;
  const actors = p.actors
    .filter((a) => opt.actorIds.includes(a.id))
    .map((a) => ({
      ...a,
      poses: a.poses.map((pos) => ({
        ...pos,
        pieces: pos.pieces.map((c) => ({
          ...c,
          tile: packed.starts[pieceKey(c)],
        })),
      })),
    }));
  manifest.palettes = opt.paletteIds.map((id) =>
    p.palettes.find((a) => a.id === id)!,
  );
  manifest.sheets = p.sheets
    .filter((s) => opt.sheetIds.includes(s.id))
    .map(({ pixels, layers, ...s }) => ({ ...s, refs: built.get(s.id)!.refs }));
  manifest.maps = maps;
  manifest.actors = actors;
  manifest.scene = scene;
  manifest.objPalettes = scene ? objectPalettes(p, scene) : [];
  if (scene) {
    const memory = compileScene(p, scene, files, packed, built);
    addSceneFiles(files, memory);
    if (scene.mode === 7) files["mode7.vram"] = memory.vram.slice(0, 32768);
    manifest.memory = {
      allocations: memory.allocations,
      palettes: memory.palettes,
    };
    for (const a of memory.palettes) {
      const palette = p.palettes.find((p) => p.id === a.id)!;
      constants.push(
        `; ${palette.name.replace(/[\r\n]/g, " ")} / ${a.layer === 4 ? "OBJ" : "BG" + (a.layer + 1)}`,
      );
      constants.push(
        `${symbol(a.id)}_${a.layer === 4 ? "OBJ" : "BG" + (a.layer + 1)} = ${a.slot}`,
      );
    }
  }
  for (const a of actors) {
    for (const pose of a.poses) {
      const bytes = new Uint8Array(2 + pose.pieces.length * 10),
        v = new DataView(bytes.buffer);
      v.setUint16(0, pose.pieces.length, true);
      pose.pieces.forEach((c, n) => {
        const at = 2 + n * 10;
        if (
          c.x - a.originX < -32768 ||
          c.x - a.originX > 32767 ||
          c.y - a.originY < -32768 ||
          c.y - a.originY > 32767
        )
          throw new Error(
            "Relative sprite position exceeds signed 16-bit coordinates",
          );
        v.setInt16(at, c.x - a.originX, true);
        v.setInt16(at + 2, c.y - a.originY, true);
        v.setUint16(at + 4, c.tile, true);
        v.setUint16(at + 6, opt.paletteIds.indexOf(c.paletteId), true);
        if (!opt.paletteIds.includes(c.paletteId))
          throw new Error("Missing exported palette " + c.paletteId);
        bytes[at + 8] = (c.priority << 4) | (+c.flipX << 6) | (+c.flipY << 7);
        bytes[at + 9] = c.size;
      });
      files[`actors/${a.id}/${pose.id}.meta`] = bytes;
    }
    for (const animation of a.animations) {
      const bytes = new Uint8Array(4 + animation.frames.length * 4),
        v = new DataView(bytes.buffer);
      bytes[0] = +animation.loop | (+animation.pingPong << 1);
      v.setUint16(2, animation.frames.length, true);
      animation.frames.forEach((f, n) => {
        v.setUint16(
          4 + n * 4,
          a.poses.findIndex((p) => p.id === f.poseId),
          true,
        );
        v.setUint16(6 + n * 4, f.ticks, true);
      });
      files[`actors/${a.id}/${animation.id}.anim`] = bytes;
    }
  }
  files["assets.inc"] = strToU8(constants.join("\n") + "\n");
  files["manifest.json"] = strToU8(JSON.stringify(manifest, null, 2));
  return files;
}

export function objectLoad(p: Project, s: Scene, tick: number) {
  const rows = Array.from({ length: s.height }, () => ({
    sprites: 0,
    slivers: 0,
    instances: [] as string[],
  }));
  let total = 0;
  for (const i of s.instances) {
    const a = p.actors.find((a) => a.id === i.actorId)!;
    const pose = frameAt(a, i.animationId, tick);
    if (!pose) continue;
    for (const c of pose.pieces) {
      total++;
      const x = Math.round(
          i.x +
            (i.vx * tick) / p.fps -
            a.originX +
            (i.flipX ? -c.x - c.size + 2 * a.originX : c.x),
        ),
        y = Math.round(i.y + (i.vy * tick) / p.fps - a.originY + c.y);
      if (x <= -c.size || x >= 256) continue;
      for (
        let row = Math.max(0, y);
        row < Math.min(s.height, y + c.size);
        row++
      ) {
        rows[row].sprites++;
        rows[row].slivers += Math.ceil(
          (Math.min(256, x + c.size) - Math.max(0, x)) / 8,
        );
        if (!rows[row].instances.includes(i.id)) rows[row].instances.push(i.id);
      }
    }
  }
  return { rows, total };
}
