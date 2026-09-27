import { galleryFrame } from "./gallery-frame";
import { controlPixels } from "./gallery-controls";
import { galleryFont } from "./gallery-font";
import { decodeTiles, encodeTiles, words } from "./snes";
import type { Raster } from "./render";

// Original, fixed 16-color menu artwork. Resource previews are thumbnails only;
// opening an entry still loads the resource's original palette and graphics.
const colors = [
  [8, 16, 49],
  [16, 24, 74],
  [16, 32, 107],
  [247, 239, 206],
  [165, 181, 231],
  [57, 74, 132],
  [41, 74, 173],
  [247, 206, 82],
  [140, 99, 33],
  [206, 140, 90],
  [255, 255, 255],
  [33, 99, 49],
  [99, 165, 74],
  [57, 41, 41],
  [189, 57, 49],
  [0, 0, 0],
];
export function galleryTitle(name: string): string[] {
  const clean =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "UNTITLED";
  if (clean.length <= 28) return [clean];
  const space = clean.lastIndexOf(" ", 28);
  const split = space > 0 ? space : 28;
  const rest = clean.slice(split).trim();
  return [
    clean.slice(0, split),
    rest.length <= 28 ? rest : rest.slice(0, 25).trimEnd() + "...",
  ];
}
export function galleryMenu(
  title: string,
  categories: string[],
  selected: number,
  preview: Raster | undefined,
  french: boolean,
) {
  const pixels = new Uint8Array(256 * 224);
  const plot = (x: number, y: number, color: number) => {
    if (x >= 0 && x < 256 && y >= 0 && y < 224) pixels[y * 256 + x] = color;
  };
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) plot(px, py, color);
  };
  const frame = (x: number, y: number, w: number, h: number) =>
    galleryFrame(plot, x, y, w, h);
  const font = galleryFont(),
    glyphs = decodeTiles(font.data, 2);
  const text = (value: string, x: number, y: number, color = 3) => {
    for (const char of value.toUpperCase()) {
      if (char === ".") rect(x + 3, y + 5, 2, 2, color);
      const tile = Math.max(0, font.chars.indexOf(char));
      for (let py = 0; py < 8; py++)
        for (let px = 0; px < 8; px++)
          if (glyphs[tile * 64 + py * 8 + px]) plot(x + px + 1, y + py + 1, 1);
      for (let py = 0; py < 8; py++)
        for (let px = 0; px < 8; px++)
          if (glyphs[tile * 64 + py * 8 + px]) plot(x + px, y + py, color);
      x += 8;
    }
  };
  for (let y = 0; y < 224; y += 16)
    for (let x = 0; x < 256; x += 16) {
      plot(x + 7, y + 6, 1);
      plot(x + 6, y + 7, 1);
      plot(x + 8, y + 7, 1);
      plot(x + 7, y + 8, 1);
    }
  frame(8, 8, 240, 52);
  const lines = galleryTitle(title);
  lines.forEach((line, i) =>
    text(
      line,
      (256 - line.length * 8) / 2,
      (lines.length === 1 ? 23 : 17) + i * 11,
    ),
  );
  text("SNES GRAPH", 88, 44, 4);
  frame(8, 72, 128, 112);
  frame(144, 72, 104, 112);
  text(french ? "APERCU" : "PREVIEW", french ? 172 : 168, 83, 4);
  categories.forEach((category, i) => {
    const y = 96 + i * 28;
    if (i === selected) {
      rect(16, y - 5, 112, 19, 5);
      rect(17, y - 4, 110, 17, 6);
      for (let x = 0; x < 6; x++) rect(23 + x, y - 1 + x, 1, 11 - x * 2, 7);
    }
    text(category, 40, y);
  });
  if (preview) {
    let left = preview.width,
      top = preview.height,
      right = -1,
      bottom = -1;
    for (let y = 0; y < preview.height; y++)
      for (let x = 0; x < preview.width; x++)
        if (preview.data[(y * preview.width + x) * 4 + 3]) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
    if (right >= left) {
      const w = right - left + 1,
        h = bottom - top + 1;
      const scale = Math.min(2, 80 / w, 72 / h);
      const dw = Math.max(1, Math.floor(w * scale)),
        dh = Math.max(1, Math.floor(h * scale));
      for (let y = 0; y < dh; y++)
        for (let x = 0; x < dw; x++) {
          const offset =
            ((top + Math.floor(y / scale)) * preview.width +
              left +
              Math.floor(x / scale)) *
            4;
          if (!preview.data[offset + 3]) continue;
          let best = 0,
            distance = Infinity;
          colors.forEach((rgb, index) => {
            const d = rgb.reduce(
              (n, c, channel) => n + (c - preview.data[offset + channel]) ** 2,
              0,
            );
            if (d < distance) {
              best = index;
              distance = d;
            }
          });
          plot(
            196 - Math.floor(dw / 2) + x,
            137 - Math.floor(dh / 2) + y,
            best,
          );
        }
    }
  }
  frame(8, 194, 240, 22);
  for (const [button, left] of [
    ["DPAD", 16],
    ["A", 160],
  ] as const) {
    const icon = controlPixels(button);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < icon.width; x++)
        plot(left + x, 197 + y, icon.pixels[y * icon.width + x] === 2 ? 3 : 2);
  }
  text(french ? "CHOISIR" : "SELECT", 40, 202, 4);
  text(french ? "OUVRIR" : "OPEN", 184, 202);
  const tiles = new Uint8Array(32 * 28 * 64);
  for (let y = 0; y < 224; y++)
    for (let x = 0; x < 256; x++)
      tiles[
        (Math.floor(y / 8) * 32 + Math.floor(x / 8)) * 64 +
          (y % 8) * 8 +
          (x % 8)
      ] = pixels[y * 256 + x];
  return {
    tiles: encodeTiles(tiles, 4),
    map: words(Array.from({ length: 1024 }, (_, i) => (i < 896 ? i : 0))),
    palette: words(
      colors.map(([r, g, b]) => (r >> 3) | ((g >> 3) << 5) | ((b >> 3) << 10)),
    ),
  };
}
