import { galleryFrame } from "./gallery-frame";
import {
  controlPixels,
  type GalleryButton,
  type GalleryControl,
} from "./gallery-controls";
import { galleryFont, galleryText } from "./gallery-font";
import { decodeTiles, encodeTiles, words } from "./snes";
import type { Project, Scene } from "./model";
import type { SceneMemory } from "./scene-export";

// BG3 in Mode 1 supplies an independent 2bpp UI. Index zero stays transparent.
const font = galleryFont();
const glyphs = decodeTiles(font.data, 2);
const pixels = new Uint8Array((font.chars.length + 5) * 64);
for (let i = 0; i < glyphs.length; i++) pixels[i] = glyphs[i] ? 2 : 1;
const transparent = font.chars.length;
const gold = transparent + 4;
pixels.fill(1, gold * 64, (gold + 1) * 64);
for (let y = 0; y < 8; y++)
  for (let x = 1; x <= 5; x++)
    if (Math.abs(y - 3) <= 5 - x) pixels[gold * 64 + y * 8 + x] = 3;
const allPixels = [...pixels];
// Nine reusable frame tiles, sampled from the same geometry as the home page.
const framePixels = new Uint8Array(24 * 24).fill(1);
const frameColor = (color: number) =>
  color === 3 || color === 10 ? 2 : color === 4 || color === 5 ? 3 : 1;
galleryFrame(
  (x, y, color) => {
    if (x < 24 && y < 24) framePixels[y * 24 + x] = frameColor(color);
  },
  0,
  0,
  24,
  24,
);
const frameTiles: number[] = [];
for (let ty = 0; ty < 3; ty++)
  for (let tx = 0; tx < 3; tx++) {
    frameTiles.push(allPixels.length / 64);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        allPixels.push(framePixels[(ty * 8 + y) * 24 + tx * 8 + x]);
  }
const buttons: GalleryButton[] = [
  "A",
  "B",
  "X",
  "Y",
  "L",
  "R",
  "LR",
  "START",
  "DPAD",
];
const controlTiles = new Map<string, number[]>();
for (const button of buttons)
  for (const footer of [false, true]) {
    const icon = controlPixels(button),
      height = footer ? 24 : 16;
    const tiles: number[] = [];
    for (let ty = 0; ty < height / 8; ty++)
      for (let tx = 0; tx < icon.width / 8; tx++) {
        tiles.push(allPixels.length / 64);
        for (let y = 0; y < 8; y++)
          for (let x = 0; x < 8; x++) {
            const py = ty * 8 + y,
              iy = py - (footer ? 4 : 0);
            allPixels.push(
              footer && (py < 4 || py >= 20)
                ? framePixels[py * 24 + 8]
                : iy >= 0 && iy < 16
                  ? icon.pixels[iy * icon.width + tx * 8 + x]
                  : 1,
            );
          }
      }
    controlTiles.set(button + footer, tiles);
  }
// Information labels occupy two tile rows, with the 7px letters starting at y=4.
const controlTextStart = allPixels.length / 64;
for (let char = 0; char < font.chars.length; char++)
  for (let half = 0; half < 2; half++)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const sourceY = half * 8 + y - 4;
        allPixels.push(
          sourceY >= 0 && sourceY < 8 ? pixels[char * 64 + sourceY * 8 + x] : 1,
        );
      }
export function controlTextCells(label: string, width: number) {
  const chars = [...galleryText(label, font.chars, width)].slice(0, -1);
  return [0, 1].flatMap((half) =>
    chars.map((char) => controlTextStart + char * 2 + half),
  );
}
export const cardTiles = encodeTiles(Uint8Array.from(allPixels), 2);
export function controlCells(button: GalleryButton, footer = false) {
  return {
    width: controlPixels(button).width / 8,
    tiles: controlTiles.get(button + footer)!,
  };
}
export const cardPalette = words([
  0x0c41, 0x3482, 0x67be, 0x72d4, 0x0c41, 0x3482, 0x67be, 0x2b3e,
]);
export function cardMap(
  title: string,
  footer: GalleryControl[],
  details?: [string, string, string, string],
  panel = false,
) {
  const cells = new Uint16Array(1024).fill(panel ? 0 : transparent);
  const rect = (x: number, y: number, w: number, h: number) => {
    for (let row = y; row < y + h; row++)
      for (let col = x; col < x + w; col++)
        cells[row * 32 + col] =
          frameTiles[
            (row === y ? 0 : row === y + h - 1 ? 2 : 1) * 3 +
              (col === x ? 0 : col === x + w - 1 ? 2 : 1)
          ];
  };
  const text = (value: string, x: number, y: number, width: number) => {
    const clean = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase();
    [...clean].slice(0, width).forEach((c, i) => {
      cells[y * 32 + x + i] = Math.max(0, font.chars.indexOf(c));
    });
  };
  if (panel) {
    rect(0, 0, 32, 6);
    rect(0, 6, 32, 21);
  } else {
    rect(0, 0, 32, 4);
    rect(0, 25, 32, 3);
    text(title, 2, 1, 28);
    let column = 2;
    for (const [button, label] of footer) {
      const icon = controlCells(button, true);
      for (let i = 0; i < icon.tiles.length; i++)
        cells[
          (25 + Math.floor(i / icon.width)) * 32 + column + (i % icon.width)
        ] = icon.tiles[i];
      text(label, column + icon.width + 1, 26, label.length);
      column += icon.width + 1 + label.length + 2;
    }
    if (details) {
      rect(20, 4, 12, 21);
      text(details[0], 22, 7, 9);
      text(details[1], 22, 9, 9);
      text(details[2], 22, 14, 9);
      text(details[3], 22, 16, 9);
      cells[9 * 32 + 21] = gold | 0x400;
      cells[16 * 32 + 21] = gold | 0x400;
    }
  }
  return words([...cells]);
}

export function supportsCard(scene: Scene) {
  return (
    scene.mode === 1 &&
    scene.height === 224 &&
    !scene.interlace &&
    scene.layers.length < 3 &&
    scene.math === "none" &&
    !scene.effects.some((e) => e.enabled)
  );
}

/** Returns undefined without touching memory when the resource has no safe UI space. */
export function stampCard(m: SceneMemory, p: Project, map: Uint8Array) {
  const ranges = [...m.allocations];
  const free = (bytes: number, alignment: number) => {
    for (let address = 0; address + bytes <= 65536; address += alignment)
      if (
        !ranges.some(
          (a) => address < a.address + a.bytes && address + bytes > a.address,
        )
      ) {
        ranges.push({ name: "Gallery card", address, bytes });
        return address;
      }
    return -1;
  };
  const tilesAt = free(cardTiles.length, 8192),
    mapAt = free(2048, 2048);
  const paletteAt = Array.from({ length: 6 }, (_, i) => (i + 1) * 4).find(
    (address) =>
      !m.palettes.some(
        (a) =>
          address <
            a.address +
              (p.palettes.find((pal) => pal.id === a.id)?.colors.length ??
                16) && address + 8 > a.address,
      ),
  );
  if (tilesAt < 0 || mapAt < 0 || paletteAt === undefined) return undefined;
  const mapped = map.slice();
  const view = new DataView(mapped.buffer);
  for (let i = 0; i < 1024; i++)
    view.setUint16(
      i * 2,
      (view.getUint16(i * 2, true) + ((paletteAt / 4) << 10)) | 0x2000,
      true,
    );
  m.vram.set(cardTiles, tilesAt);
  m.vram.set(mapped, mapAt);
  m.cgram.set(cardPalette, paletteAt * 2);
  m.allocations = ranges;
  const get = (address: number) =>
    m.registers.find(([a]) => a === address)?.[1] ?? 0;
  const set = (address: number, value: number) => {
    m.registers = m.registers.filter(([a]) => a !== address);
    m.registers.push([address, value]);
  };
  set(0x2105, 9);
  set(0x2109, mapAt / 512);
  set(0x210c, (get(0x210c) & 0xf0) | (tilesAt / 8192));
  set(0x212c, get(0x212c) | 4);
  m.registers.push([0x2111, 0], [0x2111, 0], [0x2112, 255], [0x2112, 255]);
  return { mapAt, map: mapped };
}
