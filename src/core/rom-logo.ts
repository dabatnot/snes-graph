import { encodeTiles } from "./snes";
import { OBJ_SIZES, type Project } from "./model";
import type { SceneMemory } from "./scene-export";

// 16px indexed conversion of src-tauri/icons/32x32.png (app-icon.svg).
const pixels = Uint8Array.from([
  0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2,
  2, 2, 2, 1, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 3, 3, 3, 3, 3, 1,
  1, 1, 1, 1, 1, 2, 2, 2, 2, 1, 3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 1,
  3, 3, 3, 3, 3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 4, 4, 4, 4, 1, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 1, 5, 5, 5, 5,
  5, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 1, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 4, 4, 4,
  4, 1, 5, 5, 5, 5, 5, 1, 1, 1, 1, 1, 1, 4, 4, 4, 4, 1, 5, 5, 5, 5, 5, 1, 1, 1,
  1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
  1, 1, 1, 1, 1, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0,
]);
const colors = [0, 5219, 32373, 23342, 14110, 20028];

export const ROM_LOGO = "SNES Graph logo";
const distance = (a: number, b: number) =>
  [0, 5, 10].reduce(
    (sum, shift) => sum + (((a >> shift) & 31) - ((b >> shift) & 31)) ** 2,
    0,
  );

/** Overlay only on ROM snapshots; project assets and their palettes stay intact. */
export function stampRomLogo(m: SceneMemory, project: Project, height: number) {
  const register = (address: number) =>
    m.registers.filter(([a]) => a === address).at(-1)?.[1] ?? 0;
  const write = (address: number, value: number) =>
    m.registers.push([address, value]);
  const fail = (cause: string): never => {
    throw new Error(`${ROM_LOGO}: ${cause}`);
  };
  const size = OBJ_SIZES[register(0x2101) >> 5][0];
  const pieces = size === 8 ? 4 : 1;
  const freeObjects = Array.from({ length: 128 }, (_, n) => n).filter(
    (n) =>
      m.oam[n * 4] === 0 &&
      m.oam[n * 4 + 1] === 240 &&
      ((m.oam[512 + (n >> 2)] >> ((n & 3) * 2)) & 1) === 1,
  );
  if (freeObjects.length < pieces) fail("not enough free OBJ entries");
  const usedColors = new Set<number>();
  for (const p of m.palettes) {
    const palette = project.palettes.find((v) => v.id === p.id)!;
    for (let i = 0; i < palette.colors.length; i++)
      usedColors.add(p.address + i);
  }
  let slot = Array.from({ length: 8 }, (_, i) => i).find((i) =>
    Array.from({ length: 16 }, (_, c) => 128 + i * 16 + c).every(
      (c) => !usedColors.has(c),
    ),
  );
  let indices = colors.map((_, i) => i);
  if (slot !== undefined) {
    colors.forEach((c, i) => {
      const address = (128 + slot! * 16 + i) * 2;
      m.cgram[address] = c & 255;
      m.cgram[address + 1] = c >> 8;
    });
  } else {
    // A full 8bpp background may own all CGRAM. Reuse its closest colors;
    // never replace any resource color to make room for the preview mark.
    let best = Infinity;
    for (let s = 0; s < 8; s++) {
      const candidates = Array.from({ length: 16 }, (_, i) => {
        const address = (128 + s * 16 + i) * 2;
        return m.cgram[address] | (m.cgram[address + 1] << 8);
      });
      const mapping = colors.map((color, n) =>
        n === 0
          ? 0
          : candidates
              .map((c, i) => ({ i, cost: i ? distance(c, color) : Infinity }))
              .reduce((a, b) => (a.cost <= b.cost ? a : b)).i,
      );
      const cost = colors
        .slice(1)
        .reduce(
          (sum, color, n) => sum + distance(color, candidates[mapping[n + 1]]),
          0,
        );
      if (cost < best) {
        best = cost;
        slot = s;
        indices = mapping;
      }
    }
  }
  const obj = m.allocations.find((a) => a.name === "OBJ");
  const span =
    (Math.max(16, size) / 8 - 1) * 512 + (Math.max(16, size) / 8) * 32;
  let base = obj?.address ?? -1,
    address = -1;
  for (const candidate of obj ? [obj.address] : [0, 16384, 32768, 49152]) {
    const start = obj ? Math.ceil(obj.bytes / 512) * 512 : 0;
    for (let offset = start; offset + span <= 16384; offset += 512) {
      if ((offset % 8192) + span > 8192) continue;
      const at = candidate + offset;
      if (
        at + span > 65536 ||
        m.allocations.some(
          (a) => at < a.address + a.bytes && at + span > a.address,
        )
      )
        continue;
      base = candidate;
      address = at;
      break;
    }
    if (address >= 0) break;
  }
  if (address < 0) fail("not enough free OBJ tile memory");
  const tile = (address - base) / 32;
  const bitmap = new Uint8Array(span);
  for (let ty = 0; ty < 2; ty++)
    for (let tx = 0; tx < 2; tx++) {
      const tilePixels = Uint8Array.from(
        { length: 64 },
        (_, n) => indices[pixels[(ty * 8 + (n >> 3)) * 16 + tx * 8 + (n & 7)]],
      );
      bitmap.set(encodeTiles(tilePixels, 4), ty * 512 + tx * 32);
    }
  m.vram.set(bitmap, address);
  m.allocations.push({ name: ROM_LOGO, address, bytes: span });
  write(0x2101, (register(0x2101) & 0xe0) | (base / 16384));
  write(0x212c, register(0x212c) | 16);
  for (let i = 0; i < pieces; i++) {
    const n = freeObjects[i],
      t = tile + (size === 8 ? (i & 1) + (i >> 1) * 16 : 0);
    m.oam[n * 4] = 236 + (size === 8 ? (i & 1) * 8 : 0);
    m.oam[n * 4 + 1] = height - 21 + (size === 8 ? (i >> 1) * 8 : 0);
    m.oam[n * 4 + 2] = t & 255;
    m.oam[n * 4 + 3] = (t >> 8) | (slot! << 1) | 0x30;
    m.oam[512 + (n >> 2)] &= ~(3 << ((n & 3) * 2));
  }
  // Include the overlay in the actual hardware scanline budget.
  for (let y = 0; y < height; y++) {
    let objects = 0,
      slivers = 0;
    for (let n = 0; n < 128; n++) {
      const high = (m.oam[512 + (n >> 2)] >> ((n & 3) * 2)) & 3;
      const x = m.oam[n * 4] - (high & 1 ? 256 : 0);
      const side = OBJ_SIZES[register(0x2101) >> 5][high >> 1];
      if (
        ((y - m.oam[n * 4 + 1] - 1) & 255) >= side ||
        x + side <= 0 ||
        x >= 256
      )
        continue;
      objects++;
      slivers += Math.ceil((Math.min(256, x + side) - Math.max(0, x)) / 8);
    }
    if (objects > 32 || slivers > 34) fail(`OBJ scanline limit at line ${y}`);
  }
  return m;
}
