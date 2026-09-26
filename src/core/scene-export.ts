import { strToU8 } from "fflate";
import {
  MODES,
  OBJ_SIZES,
  frameAt,
  tileAt,
  paletteAt,
  type Project,
  type Scene,
  type Piece,
} from "./model";

export type SceneMemory = {
  vram: Uint8Array;
  cgram: Uint8Array;
  oam: Uint8Array;
  registers: [number, number][];
  allocations: {
    name: string;
    address: number;
    bytes: number;
    resource?: string;
  }[];
  palettes: { id: string; layer: number; slot: number; address: number }[];
  hdma: { channel: number; mode: number; register: number; data: Uint8Array }[];
};
type Tiles = {
  pixels: Uint8Array;
  refs: { tile: number; flipX: boolean; flipY: boolean }[];
};
type Packed = { data: Uint8Array; starts: Record<string, number> };
const key = (c: Piece) => [c.sheetId, c.sx, c.sy, c.size].join(":");
const word = (a: Uint8Array, n: number, v: number) => {
  a[n] = v & 255;
  a[n + 1] = (v >> 8) & 255;
};

/** Compile the actual shared PPU memories. Addresses in allocations are bytes. */
export function compileScene(
  p: Project,
  s: Scene,
  files: Record<string, Uint8Array>,
  packed: Packed,
  built: Map<string, Tiles>,
  tick = 0,
): SceneMemory {
  const out: SceneMemory = {
    vram: new Uint8Array(65536),
    cgram: new Uint8Array(512),
    oam: new Uint8Array(544),
    registers: [],
    allocations: [],
    palettes: [],
    hdma: [],
  };
  const reg = (address: number, value: number) =>
    out.registers.push([address, value & 255]);
  const reg16 = (address: number, value: number) => {
    reg(address, value);
    reg(address, value >> 8);
  };
  const colors = new Int32Array(256).fill(-1);
  const reservations = new Set<string>();
  for (const a of s.paletteSlots ?? []) {
    const key = a.layer + ":" + a.paletteId;
    if (reservations.has(key))
      throw new Error(
        "One reservation per palette and destination / Une réservation par palette et destination",
      );
    reservations.add(key);
  }
  // Allocate against the complete cycle, so colors matching on frame zero do
  // not alias and unexpectedly move to another slot later in the animation.
  const signatures: (string | undefined)[] = new Array(256);
  colors[0] = s.backdrop;
  let cursor = 0;
  const put = (
    name: string,
    bytes: Uint8Array,
    alignment: number,
    resource?: string,
  ) => {
    const address = Math.ceil(cursor / alignment) * alignment;
    if (address + bytes.length > 65536)
      throw new Error("VRAM: " + name + " exceeds 64 KiB including alignment");
    out.vram.set(bytes, address);
    out.allocations.push({ name, address, bytes: bytes.length, resource });
    cursor = address + bytes.length;
    return address;
  };
  const assignPalette = (id: string, layer: number, bpp: number) => {
    const found = out.palettes.find((a) => a.id === id && a.layer === layer);
    if (found) return found.slot;
    const pal = p.palettes.find((a) => a.id === id);
    if (!pal) throw new Error("Missing palette " + id);
    const c = paletteAt(pal, tick),
      size = 1 << bpp;
    const signature = (index: number) => {
      const a = pal.cycle;
      if (!a || index < a.start || index > a.end)
        return String(pal.colors[index]);
      const len = a.end - a.start + 1;
      const values = Array.from(
        { length: len },
        (_, n) => pal.colors[a.start + ((index - a.start - n + len) % len)],
      );
      return values.every((v) => v === values[0])
        ? String(values[0])
        : a.ticks + ":" + values.join(",");
    };
    if (c.length < size) throw new Error("Palette too small: " + pal.name);
    const start = layer === 4 ? 128 : s.mode === 0 ? layer * 32 : 0;
    const first = layer === 4 && s.objMath ? 4 : 0,
      max = bpp === 8 ? 1 : 8;
    const forced = s.paletteSlots?.find(
      (a) => a.paletteId === id && a.layer === layer,
    )?.slot;
    const candidates =
      forced === undefined
        ? Array.from({ length: max - first }, (_, n) => n + first)
        : [forced];
    for (const slot of candidates) {
      if (slot < first || slot >= max)
        throw new Error(
          "Reserved palette slot incompatible with color mode / Emplacement de palette incompatible",
        );
      const base = start + slot * size;
      if (base + size > 256) continue;
      if (
        s.paletteSlots?.some(
          (a) => a.paletteId !== id && a.layer === layer && a.slot === slot,
        )
      )
        continue;
      if (
        c
          .slice(1, size)
          .some(
            (_, i) =>
              signatures[base + i + 1] !== undefined &&
              signatures[base + i + 1] !== signature(i + 1),
          )
      )
        continue;
      for (let i = 1; i < size; i++) {
        colors[base + i] = c[i];
        signatures[base + i] = signature(i);
      }
      out.palettes.push({ id, layer, slot, address: base });
      return slot;
    }
    throw new Error("CGRAM conflict / Conflit de palettes : " + pal.name);
  };
  for (const slot of s.paletteSlots ?? []) {
    const bpp = slot.layer === 4 ? 4 : MODES[s.mode][slot.layer];
    if (!bpp) throw new Error("Reserved palette has no BG in this mode");
    assignPalette(slot.paletteId, slot.layer, bpp);
  }
  // Reserve all palettes used by all poses so that an animation never silently changes slots.
  for (const i of s.instances) {
    const a = p.actors.find((a) => a.id === i.actorId)!;
    const v = a.variants.find((v) => v.id === i.variantId);
    for (const pose of a.poses)
      for (const c of pose.pieces)
        assignPalette(v?.palettes[c.paletteId] ?? c.paletteId, 4, 4);
  }
  // Reserve palettes from the entire map, including cells outside the camera.
  s.layers.forEach((l, li) => {
    if (
      !l.enabled ||
      (s.directColor &&
        li === 0 &&
        ([3, 4].includes(s.mode) || (s.mode === 7 && !s.extbg)))
    )
      return;
    const bpp = MODES[s.mode][li];
    if (!bpp) return;
    const m = p.maps.find((m) => m.id === l.mapId)!;
    for (const id of new Set(m.cells.map((c) => c.paletteId)))
      assignPalette(id, li, bpp);
  });
  const bases: number[] = [0, 0, 0, 0];
  let tm = s.instances.length ? 16 : 0,
    ts = 0,
    math = s.objMath ? 16 : 0,
    mosaic = 0,
    mosaicSize = 1;
  const tileBases = new Map<string, number>();
  if (s.mode === 7) {
    const m = p.maps.find((m) => m.id === s.layers[0]?.mapId),
      sh = p.sheets.find((sh) => sh.id === m?.sheetId);
    if (m && sh) {
      if (m.width !== 128 || m.height !== 128)
        throw new Error("Mode 7 requires a 128 × 128 map");
      if (m.cells.some((c) => c.flipX || c.flipY))
        throw new Error("Mode 7 has no per-tile flip attributes");
      const b = built.get(sh.id);
      if (!b || b.pixels.length / 64 > 256)
        throw new Error("Mode 7: at most 256 exported tiles");
      const data = new Uint8Array(32768);
      m.cells.forEach((c, n) => {
        const ref = b.refs[tileAt(m, c.tile, tick)];
        if (ref.flipX || ref.flipY)
          throw new Error("Disable flipped tile deduplication for Mode 7");
        data[n * 2] = ref.tile;
        if (!s.directColor || s.extbg) assignPalette(c.paletteId, 0, 8);
      });
      for (let n = 0; n < b.pixels.length; n++) data[n * 2 + 1] = b.pixels[n];
      put("Mode 7", data, 1);
      const angle = (s.angle * Math.PI) / 180,
        cos = Math.round(Math.cos(angle) * s.scale * 256),
        sin = Math.round(Math.sin(angle) * s.scale * 256);
      reg(0x211a, 0);
      reg16(0x211b, cos);
      reg16(0x211c, -sin);
      reg16(0x211d, sin);
      reg16(0x211e, cos);
      reg16(0x211f, 512 + s.cameraX);
      reg16(0x2120, 512 + s.cameraY);
      reg16(0x210d, 512 + s.cameraX - 128);
      reg16(0x210e, 512 + s.cameraY - s.height / 2 - 1);
    }
  }
  for (let li = 0; li < s.layers.length; li++) {
    const l = s.layers[li];
    if (!l.enabled) continue;
    const m = p.maps.find((m) => m.id === l.mapId)!,
      sh = p.sheets.find((sh) => sh.id === m.sheetId)!,
      bpp = MODES[s.mode][li];
    if (!bpp || bpp !== sh.bpp)
      throw new Error("Incompatible BG" + (li + 1) + " depth");
    if (
      s.mode !== 7 &&
      (m.width > 64 || m.height > 64) &&
      (s.effects.some(
        (e) => e.enabled && e.kind === "wave" && e.layer === li,
      ) ||
        (li === 0 &&
          [2, 4, 6].includes(s.mode) &&
          (s.offsetX.length || s.offsetY.length)))
    )
      throw new Error(
        "Large maps with line/tile offsets require game-specific streaming; export the map without a reference scene / Les grandes cartes avec décalages nécessitent un streaming propre au jeu. Exporter la carte sans scène de référence.",
      );
    if (l.main) tm |= 1 << li;
    if (l.sub) ts |= 1 << li;
    if (l.math) math |= 1 << li;
    if (l.mosaic > 1) {
      if (mosaicSize !== 1 && mosaicSize !== l.mosaic)
        throw new Error("All mosaic layers share one mosaic size");
      mosaicSize = l.mosaic;
      mosaic |= 1 << li;
    }
    if (s.mode === 7) continue;
    let base = tileBases.get(sh.id);
    if (base === undefined) {
      const bytes = files["tiles/" + sh.id + ".chr"];
      if (!bytes) throw new Error("Missing exported graphics " + sh.name);
      base = put(sh.name, bytes, 8192, sh.id);
      tileBases.set(sh.id, base);
    }
    bases[li] = base / 8192;
    const b = built.get(sh.id)!;
    // Large level maps remain in the generic export. The initial PPU image contains a 32/64-cell window.
    const width = m.width > 32 ? 64 : 32,
      height = m.height > 32 ? 64 : 32,
      data = new Uint8Array(width * height * 2);
    const offsetX =
        m.width > 64
          ? Math.floor((s.cameraX + l.x + (l.speedX * tick) / p.fps) / 8)
          : 0,
      offsetY =
        m.height > 64
          ? Math.floor((s.cameraY + l.y + (l.speedY * tick) / p.fps) / 8)
          : 0;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const c =
          m.cells[
            ((((y + offsetY) % m.height) + m.height) % m.height) * m.width +
              ((((x + offsetX) % m.width) + m.width) % m.width)
          ];
        const source = tileAt(m, c.tile, tick);
        const ref = b.refs[source];
        if (!ref || ref.tile > 1023) throw new Error("BG tile outside 0…1023");
        const slot =
            s.directColor && li === 0 && [3, 4].includes(s.mode)
              ? (c.directColor ?? 0)
              : assignPalette(c.paletteId, li, bpp),
          value =
            ref.tile |
            (slot << 10) |
            (+c.priority << 13) |
            (+(c.flipX !== ref.flipX) << 14) |
            (+(c.flipY !== ref.flipY) << 15);
        const n =
          (Math.floor(y / 32) * Math.ceil(width / 32) + Math.floor(x / 32)) *
            1024 +
          (y % 32) * 32 +
          (x % 32);
        word(data, n * 2, value);
      }
    const address = put(m.name, data, 2048, m.id);
    reg(
      0x2107 + li,
      ((address / 2048) << 2) |
        (width === 64 ? 1 : 0) |
        (height === 64 ? 2 : 0),
    );
    reg16(
      0x210d + li * 2,
      Math.round(s.cameraX + l.x + (l.speedX * tick) / p.fps - offsetX * 8),
    );
    reg16(
      0x210e + li * 2,
      Math.round(s.cameraY + l.y + (l.speedY * tick) / p.fps - offsetY * 8) - 1,
    );
  }
  if ([2, 4, 6].includes(s.mode) && (s.offsetX.length || s.offsetY.length)) {
    const l = s.layers[0];
    if (!l) throw new Error("BG1 is required for offset tables");
    const data = new Uint8Array(2048),
      hx = Math.round(s.cameraX + l.x + (l.speedX * tick) / p.fps),
      vy = Math.round(s.cameraY + l.y + (l.speedY * tick) / p.fps) - 1;
    for (let col = 0; col < 32; col++) {
      const dx = s.offsetX[col] ?? 0,
        dy = s.offsetY[col] ?? 0;
      if (s.mode === 4 && dx && dy)
        throw new Error(
          "Mode 4: choose horizontal OR vertical offset per column",
        );
      if (dx) word(data, col * 2, 0x2000 | ((hx + dx) & 0x3f8));
      if (dy)
        word(
          data,
          (s.mode === 4 ? col : 32 + col) * 2,
          0x2000 | (s.mode === 4 ? 0x8000 : 0) | ((vy + dy) & 1023),
        );
    }
    const address = put("BG1 offsets", data, 2048);
    reg(0x2109, (address / 2048) << 2);
    reg16(0x2111, 0);
    reg16(0x2112, 0);
  }
  const objBase = packed.data.length ? put("OBJ", packed.data, 16384) : 0;
  reg(0x2101, (s.objSize << 5) | (objBase / 16384));
  reg(0x2105, s.mode | (+s.bg3Priority << 3));
  reg(0x2106, ((mosaicSize - 1) << 4) | mosaic);
  reg(0x210b, bases[0] | (bases[1] << 4));
  reg(0x210c, bases[2] | (bases[3] << 4));
  if (s.mode === 7 && s.extbg) {
    if (tm & 1) tm |= 2;
    if (ts & 1) ts |= 2;
  }
  reg(0x212c, tm);
  reg(0x212d, ts);
  reg(0x2130, +s.directColor | (ts ? 2 : 0));
  reg(
    0x2131,
    s.math === "none"
      ? 0
      : math | (s.half ? 64 : 0) | (s.math === "subtract" ? 128 : 0),
  );
  for (let c = 0; c < 3; c++)
    reg(0x2132, (32 << c) | ((s.fixedColor >> (c * 5)) & 31));
  reg(0x2133, +s.interlace | (s.height === 239 ? 4 : 0) | (s.extbg ? 64 : 0));
  // Hide unused OBJs to the left, including large 64x64 objects whose Y would wrap.
  for (let n = 0; n < 128; n++) {
    out.oam[n * 4] = 0;
    out.oam[n * 4 + 1] = 240;
    out.oam[512 + (n >> 2)] |= 1 << ((n & 3) * 2);
  }
  let n = 0;
  for (const i of s.instances) {
    const a = p.actors.find((a) => a.id === i.actorId)!,
      v = a.variants.find((v) => v.id === i.variantId),
      pose = frameAt(a, i.animationId, tick);
    if (!pose) continue;
    for (const c of pose.pieces) {
      if (n >= 128) throw new Error("More than 128 OBJs");
      const x = Math.round(
          i.x +
            (i.vx * tick) / p.fps -
            a.originX +
            (i.flipX ? 2 * a.originX - c.x - c.size : c.x),
        ),
        y = Math.round(i.y + (i.vy * tick) / p.fps - a.originY + c.y),
        tile = packed.starts[key(c)],
        slot = assignPalette(v?.palettes[c.paletteId] ?? c.paletteId, 4, 4);
      if (tile === undefined)
        throw new Error("Missing exported actor " + a.name);
      if (!OBJ_SIZES[s.objSize].includes(c.size))
        throw new Error("Incompatible OBJ size: " + c.size);
      out.oam[n * 4] = x & 255;
      out.oam[n * 4 + 1] = (y - 1) & 255;
      out.oam[n * 4 + 2] = tile & 255;
      out.oam[n * 4 + 3] =
        (tile >> 8) |
        (slot << 1) |
        (c.priority << 4) |
        (+(c.flipX !== i.flipX) << 6) |
        (+c.flipY << 7);
      const shift = (n & 3) * 2;
      out.oam[512 + (n >> 2)] &= ~(3 << shift);
      out.oam[512 + (n >> 2)] |=
        (((x >> 8) & 1) | (c.size === OBJ_SIZES[s.objSize][1] ? 2 : 0)) <<
        shift;
      n++;
    }
  }
  for (let i = 0; i < 256; i++) word(out.cgram, i * 2, Math.max(0, colors[i]));
  const channels = new Set<number>();
  const hdma = (
    channel: number,
    mode: number,
    register: number,
    rows: number[][],
  ) => {
    if (channel > 7 || channels.has(channel))
      throw new Error("HDMA channel conflict: " + channel);
    channels.add(channel);
    const data: number[] = [];
    for (let y = 0; y < rows.length; y += 127) {
      const count = Math.min(127, rows.length - y);
      data.push(128 | count);
      for (let j = 0; j < count; j++) data.push(...rows[y + j]);
    }
    data.push(0);
    out.hdma.push({ channel, mode, register, data: Uint8Array.from(data) });
  };
  for (const e of s.effects.filter((e) => e.enabled)) {
    if (e.kind === "wave") {
      if (s.mode === 7) throw new Error("Wave effect needs a tile-based BG");
      const l = s.layers[e.layer];
      if (!l) throw new Error("Wave layer missing");
      hdma(
        e.channel,
        2,
        0x0d + e.layer * 2,
        Array.from({ length: s.height }, (_, y) => {
          const x = Math.round(
            s.cameraX +
              l.x +
              (l.speedX * tick) / p.fps +
              Math.sin(
                (y * Math.PI * 2) / e.period + (tick * e.speed) / p.fps,
              ) *
                e.amplitude,
          );
          return [x & 255, (x >> 8) & 255];
        }),
      );
    } else if (e.kind === "gradient") {
      if (s.math !== "none" || ts)
        throw new Error(
          "Sky gradient uses fixed color math; disable other color math/sub-screen layers.",
        );
      reg(0x2130, +s.directColor);
      reg(0x2131, 32);
      word(out.cgram, 0, 0);
      for (let component = 0; component < 3; component++)
        hdma(
          e.channel + component,
          0,
          0x32,
          Array.from({ length: s.height }, (_, y) => {
            const a = (e.color >> (component * 5)) & 31,
              b = (e.endColor >> (component * 5)) & 31;
            return [
              (32 << component) |
                Math.round(a + ((b - a) * y) / (s.height - 1)),
            ];
          }),
        );
    } else {
      reg(0x2123, 0x33);
      reg(0x2124, 0x33);
      reg(0x2125, 0x03);
      reg(0x212e, tm);
      reg(0x212f, ts);
      hdma(
        e.channel,
        1,
        0x26,
        Array.from({ length: s.height }, (_, y) => {
          const d = e.radius ** 2 - (y - e.centerY) ** 2;
          if (d < 0) return [255, 0];
          const x = Math.floor(Math.sqrt(d));
          return [Math.max(0, e.centerX - x), Math.min(255, e.centerX + x)];
        }),
      );
    }
  }
  if (s.mode === 7 && s.perspective) {
    const free = Array.from({ length: 8 }, (_, i) => i).filter(
      (i) => !channels.has(i),
    );
    if (free.length < 2)
      throw new Error("Mode 7 perspective needs two free HDMA channels");
    const angle = (s.angle * Math.PI) / 180;
    const coefficients = Array.from({ length: s.height }, (_, y) => {
      const scale = s.scale * (1 + s.perspective / Math.max(1, y - s.horizon));
      const a = Math.max(
          -32768,
          Math.min(32767, Math.round(Math.cos(angle) * scale * 256)),
        ),
        b = Math.max(
          -32768,
          Math.min(32767, Math.round(Math.sin(angle) * scale * 256)),
        );
      return [a, -b, b, a];
    });
    for (let n = 0; n < 2; n++)
      hdma(
        free[n],
        3,
        0x1b + n * 2,
        coefficients.map((c) => [
          c[n * 2] & 255,
          (c[n * 2] >> 8) & 255,
          c[n * 2 + 1] & 255,
          (c[n * 2 + 1] >> 8) & 255,
        ]),
      );
  }
  return out;
}
export function addSceneFiles(
  files: Record<string, Uint8Array>,
  memory: SceneMemory,
) {
  files["scene/vram.bin"] = memory.vram;
  files["scene/cgram.bin"] = memory.cgram;
  files["scene/oam.bin"] = memory.oam;
  memory.hdma.forEach((h) => {
    files[`scene/hdma-${h.channel}.bin`] = h.data;
  });
  files["scene/layout.json"] = strToU8(
    JSON.stringify(
      {
        ...memory,
        vram: undefined,
        cgram: undefined,
        oam: undefined,
        hdma: memory.hdma.map(({ data, ...h }) => ({
          ...h,
          file: `hdma-${h.channel}.bin`,
          bytes: data.length,
        })),
      },
      null,
      2,
    ),
  );
}
