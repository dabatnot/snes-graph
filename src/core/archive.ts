import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { Project } from "./model";
const MAX = 128 * 1024 * 1024;
export function validateProject(p: Project): void {
  if (!p || p.format !== "snes-graph" || p.version !== 1)
    throw new Error(
      "Unsupported project format / Format de projet incompatible",
    );
  if (typeof p.name !== "string" || ![50, 60].includes(p.fps))
    throw new Error("Invalid project");
  for (const key of [
    "palettes",
    "sheets",
    "actors",
    "maps",
    "scenes",
    "exports",
  ] as const)
    if (!Array.isArray(p[key])) throw new Error(`Invalid ${key}`);
  const ids = new Set<string>();
  const identifier = (id: string) => {
    if (
      typeof id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(id) ||
      ["__proto__", "constructor", "prototype"].includes(id)
    )
      throw new Error("Invalid resource identifier");
  };
  const named = (items: { id: string; name?: string }[]) => {
    if (!Array.isArray(items)) throw new Error("Invalid resource list");
    const seen = new Set<string>();
    for (const item of items) {
      identifier(item.id);
      if (seen.has(item.id)) throw new Error("Duplicate identifier");
      seen.add(item.id);
      if (item.name !== undefined && typeof item.name !== "string")
        throw new Error("Invalid name");
    }
  };
  const finite = (...values: number[]) => {
    if (
      values.some(
        (n) =>
          typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1e7,
      )
    )
      throw new Error("Invalid numeric property");
  };
  for (const a of [
    ...p.palettes,
    ...p.sheets,
    ...p.actors,
    ...p.maps,
    ...p.scenes,
    ...p.exports,
  ]) {
    identifier(a.id);
    if (
      typeof a.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(a.id) ||
      ids.has(a.id) ||
      typeof a.name !== "string"
    )
      throw new Error("Invalid or duplicate resource");
    ids.add(a.id);
  }
  const integer = (n: number, min: number, max: number) => {
    if (!Number.isInteger(n) || n < min || n > max)
      throw new Error(`Value outside ${min}…${max}: ${n}`);
  };
  const pal = (id: string) => {
    if (!p.palettes.some((v) => v.id === id))
      throw new Error("Missing palette");
  };
  for (const a of p.palettes) {
    if (
      !Array.isArray(a.colors) ||
      !Array.isArray(a.labels) ||
      !Array.isArray(a.locked)
    )
      throw new Error("Invalid palette");
    if (
      ![4, 16, 256].includes(a.colors.length) ||
      a.labels.length !== a.colors.length ||
      a.locked.length !== a.colors.length
    )
      throw new Error("Invalid palette");
    a.colors.forEach((c) => integer(c, 0, 32767));
    if (a.cycle) {
      integer(a.cycle.start, 1, a.colors.length - 1);
      integer(a.cycle.end, a.cycle.start, a.colors.length - 1);
      integer(a.cycle.ticks, 1, 65535);
    }
  }
  for (const s of p.sheets) {
    integer(s.width, 8, 4096);
    integer(s.height, 8, 4096);
    if (
      s.width % 8 ||
      s.height % 8 ||
      ![2, 4, 8].includes(s.bpp) ||
      !(s.pixels instanceof Uint8Array) ||
      s.pixels.length !== s.width * s.height
    )
      throw new Error("Invalid tiles");
    pal(s.paletteId);
    for (const v of s.pixels) integer(v, 0, (1 << s.bpp) - 1);
    if (s.layers) {
      named(s.layers);
      if (!Array.isArray(s.layers) || !s.layers.length || s.layers.length > 64)
        throw new Error("Invalid layers");
      for (const l of s.layers) {
        if (
          !(l.pixels instanceof Uint8Array) ||
          l.pixels.length !== s.pixels.length
        )
          throw new Error("Invalid layer pixels");
        for (const v of l.pixels) integer(v, 0, (1 << s.bpp) - 1);
      }
    }
  }
  for (const a of p.actors) {
    named(a.poses);
    named(a.animations);
    named(a.variants);
    if (!a.poses.length || !a.animations.length)
      throw new Error("An actor needs a pose and animation");
    integer(a.originX, -32768, 32767);
    integer(a.originY, -32768, 32767);
    for (const pose of a.poses) {
      named(pose.pieces);
      if (!Array.isArray(pose.boxes) || !Array.isArray(pose.anchors))
        throw new Error("Invalid pose");
      for (const box of pose.boxes) {
        finite(box.x, box.y, box.width, box.height);
        if (box.width < 1 || box.height < 1)
          throw new Error("Invalid collision box");
      }
      for (const anchor of pose.anchors) finite(anchor.x, anchor.y);
      for (const c of pose.pieces) {
        const s = p.sheets.find((s) => s.id === c.sheetId);
        if (!s || s.bpp !== 4) throw new Error("Sprite graphics must be 4bpp");
        integer(c.x, -32768, 32767);
        integer(c.y, -32768, 32767);
        integer(c.sx, 0, s.width - 1);
        integer(c.sy, 0, s.height - 1);
        if (
          ![8, 16, 32, 64].includes(c.size) ||
          c.sx + c.size > s.width ||
          c.sy + c.size > s.height
        )
          throw new Error("Invalid sprite crop");
        integer(c.priority, 0, 3);
        pal(c.paletteId);
        if (p.palettes.find((p) => p.id === c.paletteId)!.colors.length !== 16)
          throw new Error("Sprites need a 16-entry palette");
      }
    }
    for (const v of a.variants)
      for (const [source, target] of Object.entries(v.palettes)) {
        pal(source);
        pal(target);
        if (p.palettes.find((p) => p.id === target)!.colors.length !== 16)
          throw new Error("Invalid variant palette");
      }
    for (const anim of a.animations) {
      if (!Array.isArray(anim.frames) || !anim.frames.length)
        throw new Error("An animation needs at least one frame");
      for (const f of anim.frames) {
        integer(f.ticks, 1, 65535);
        if (!a.poses.some((v) => v.id === f.poseId))
          throw new Error("Missing pose");
      }
    }
  }
  for (const m of p.maps) {
    const s = p.sheets.find((s) => s.id === m.sheetId);
    if (!s) throw new Error("Missing tileset");
    integer(m.width, 1, 512);
    integer(m.height, 1, 512);
    if (m.cells.length !== m.width * m.height)
      throw new Error("Invalid map dimensions");
    named(m.stamps);
    if (m.terrains) named(m.terrains);
    for (const t of m.terrains ?? []) {
      if (t.tiles.length !== 16) throw new Error("Terrain needs 16 rules");
      for (const v of t.tiles) integer(v, 0, s.pixels.length / 64 - 1);
    }
    for (const stamp of m.stamps) {
      integer(stamp.width, 1, 512);
      integer(stamp.height, 1, 512);
      if (stamp.cells.length !== stamp.width * stamp.height)
        throw new Error("Invalid metatile");
    }
    for (const a of m.animatedTiles) {
      if (a.name !== undefined && typeof a.name !== "string")
        throw new Error("Invalid animation name");
      integer(a.tile, 0, s.pixels.length / 64 - 1);
      integer(a.ticks, 1, 65535);
      a.frames.forEach((v) => integer(v, 0, s.pixels.length / 64 - 1));
    }
    for (const c of [...m.cells, ...m.stamps.flatMap((t) => t.cells)]) {
      integer(c.tile, 0, (s.width * s.height) / 64 - 1);
      pal(c.paletteId);
      integer(c.collision, 0, 255);
      integer(c.directColor ?? 0, 0, 7);
    }
  }
  for (const s of p.scenes) {
    for (const slot of s.paletteSlots ?? []) {
      pal(slot.paletteId);
      integer(slot.layer, 0, 4);
      integer(slot.slot, 0, 7);
    }
    named(s.instances);
    named(s.effects);
    finite(s.cameraX, s.cameraY, s.angle, s.scale, s.perspective, s.horizon);
    if (s.scale <= 0) throw new Error("Invalid Mode 7 scale");
    if (!["none", "add", "subtract"].includes(s.math))
      throw new Error("Invalid color math");
    integer(s.backdrop, 0, 32767);
    integer(s.fixedColor, 0, 32767);
    s.offsetX.forEach((n) => integer(n, -32768, 32767));
    s.offsetY.forEach((n) => integer(n, -32768, 32767));
    integer(s.mode, 0, 7);
    integer(s.objSize, 0, 5);
    if (![224, 239].includes(s.height) || s.layers.length > 4)
      throw new Error("Invalid scene");
    for (const l of s.layers) {
      finite(l.x, l.y, l.speedX, l.speedY);
      integer(l.mosaic, 1, 16);
      if (!p.maps.some((m) => m.id === l.mapId)) throw new Error("Missing map");
    }
    for (const i of s.instances) {
      finite(i.x, i.y, i.vx, i.vy);
      const a = p.actors.find((a) => a.id === i.actorId);
      if (
        !a ||
        !a.animations.some((a) => a.id === i.animationId) ||
        (i.variantId && !a.variants.some((v) => v.id === i.variantId))
      )
        throw new Error("Missing actor/animation/variant");
    }
    for (const e of s.effects) {
      finite(e.amplitude, e.speed, e.centerX, e.centerY, e.radius);
      integer(e.period, 1, 65535);
      integer(e.layer, 0, 3);
      integer(e.radius, 0, 4096);
      integer(e.color, 0, 32767);
      integer(e.endColor, 0, 32767);
      integer(e.channel, 0, 7);
      if (!["gradient", "wave", "iris"].includes(e.kind))
        throw new Error("Invalid effect");
    }
  }
  for (const e of p.exports) {
    integer(e.reservedTiles, 0, 1023);
    for (const [key, resources] of [
      ["sheetIds", p.sheets],
      ["actorIds", p.actors],
      ["mapIds", p.maps],
      ["paletteIds", p.palettes],
    ] as const) {
      if (
        !Array.isArray(e[key]) ||
        e[key].some((id) => !resources.some((r) => r.id === id))
      )
        throw new Error("Missing export resource");
    }
    if (e.sceneId && !p.scenes.some((s) => s.id === e.sceneId))
      throw new Error("Missing export scene");
  }
}
export function saveProject(p: Project): Uint8Array {
  validateProject(p);
  const files: Record<string, Uint8Array> = {};
  const sheets = p.sheets.map(({ pixels, layers, ...s }) => {
    files[`pixels/${s.id}.bin`] = pixels;
    return {
      ...s,
      layers: layers?.map(({ pixels, ...l }) => {
        files[`layers/${s.id}/${l.id}.bin`] = pixels;
        return l;
      }),
    };
  });
  files["project.json"] = strToU8(JSON.stringify({ ...p, sheets }, null, 2));
  return zipSync(files, { level: 6, mtime: new Date("2000-01-01T00:00:00Z") });
}
export function loadProject(bytes: Uint8Array): Project {
  if (bytes.length > MAX) throw new Error("Project exceeds 128 MiB");
  let total = 0,
    count = 0;
  const files = unzipSync(bytes, {
    filter: (f) => {
      total += f.originalSize;
      count++;
      if (total > MAX || count > 10000)
        throw new Error("Project exceeds 128 MiB / 10000 entries");
      return true;
    },
  });
  if (!files["project.json"]) throw new Error("Missing project.json");
  const data = JSON.parse(strFromU8(files["project.json"]));
  if (!Array.isArray(data.sheets)) throw new Error("Missing tiles");
  data.sheets = data.sheets.map((s: Record<string, unknown>) => ({
    ...s,
    pixels: files[`pixels/${s.id}.bin`],
    layers: Array.isArray(s.layers)
      ? s.layers.map((l: Record<string, unknown>) => ({
          ...l,
          pixels: files[`layers/${s.id}/${l.id}.bin`],
        }))
      : undefined,
  }));
  validateProject(data);
  return data;
}
