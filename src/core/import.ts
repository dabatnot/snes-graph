import { decode, encode } from "fast-png";
import {
  makePalette,
  makeSheet,
  rgb555,
  rgb,
  type Palette,
  type Sheet,
} from "./model";
import { raster, type Raster } from "./render";
export function importPng(
  bytes: Uint8Array,
  name: string,
  target?: Palette,
  dither = false,
): { sheet: Sheet; palette: Palette; changed: number } {
  if (bytes.length < 24 || bytes.length > 128 * 1024 * 1024)
    throw new Error("Invalid PNG size");
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (header.getUint32(16) > 4096 || header.getUint32(20) > 4096)
    throw new Error("PNG exceeds 4096 × 4096");
  const png = decode(bytes);
  if (png.width > 4096 || png.height > 4096)
    throw new Error("PNG exceeds 4096 × 4096");
  const w = Math.ceil(png.width / 8) * 8,
    h = Math.ceil(png.height / 8) * 8;
  let changed = 0;
  const source: number[] = [];
  const quantized: boolean[] = [];
  // Sub-byte PNG samples are packed separately on each scanline.
  const sample = (n: number) => {
    if (png.depth >= 8) return Number(png.data[n]);
    const x = n % png.width,
      row = Math.floor(n / png.width),
      stride = Math.ceil((png.width * png.depth) / 8);
    return (
      (Number(png.data[row * stride + Math.floor((x * png.depth) / 8)]) >>
        (8 - png.depth - ((x * png.depth) % 8))) &
      ((1 << png.depth) - 1)
    );
  };
  for (let i = 0; i < png.width * png.height; i++) {
    if (png.palette) {
      const col = png.palette[sample(i)];
      source.push(col[3] === 0 ? -1 : rgb555(col[0], col[1], col[2]));
      const converted = rgb(rgb555(col[0], col[1], col[2]));
      quantized.push(col[3] !== 0 && converted.some((v, n) => v !== col[n]));
    } else {
      const factor = ((1 << png.depth) - 1) / 255;
      const n = i * png.channels,
        gray = png.channels <= 2,
        r = sample(n) / factor,
        g = gray ? r : sample(n + 1) / factor,
        b = gray ? r : sample(n + 2) / factor,
        transparent =
          png.transparency?.length === png.channels &&
          png.transparency.every((value, c) => value === sample(n + c)),
        alpha =
          png.channels === 2 || png.channels === 4
            ? sample(n + png.channels - 1) / factor
            : transparent
              ? 0
              : 255;
      source.push(alpha < 128 ? -1 : rgb555(r, g, b));
      const converted = rgb(rgb555(r, g, b));
      quantized.push(
        alpha >= 128 &&
          (converted[0] !== r ||
            converted[1] !== g ||
            converted[2] !== b ||
            alpha !== 255),
      );
    }
  }
  const palette = target ?? makePalette(name, 16);
  if (!target) {
    const unique = [...new Set(source.filter((v) => v >= 0))];
    if (
      png.palette &&
      png.palette.length <= 16 &&
      (!png.palette[0] || png.palette[0][3] === 0)
    ) {
      palette.colors = Array.from({ length: 16 }, (_, i) =>
        png.palette![i]
          ? rgb555(...(png.palette![i].slice(0, 3) as [number, number, number]))
          : 0,
      );
    } else {
      const counts = new Map<number, number>();
      source.forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
      palette.colors = [
        0,
        ...unique
          .sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0))
          .slice(0, 15),
      ];
      while (palette.colors.length < 16) palette.colors.push(0);
    }
  }
  const bpp =
      palette.colors.length === 4 ? 2 : palette.colors.length === 16 ? 4 : 8,
    sheet = makeSheet(palette.id, w, h, bpp, name);
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const v = source[y * png.width + x];
      if (v < 0) continue;
      let best = 1,
        dist = Infinity;
      const a = rgb(v);
      if (dither) {
        const d =
          [
            [-4, 2],
            [4, -2],
          ][y % 2][x % 2] * 3;
        a[0] += d;
        a[1] += d;
        a[2] += d;
      }
      for (let i = 1; i < palette.colors.length; i++) {
        const c = rgb(palette.colors[i]),
          dd = (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2 + (c[2] - a[2]) ** 2;
        if (dd < dist) {
          dist = dd;
          best = i;
        }
      }
      if (
        !target &&
        png.palette &&
        png.palette.length <= 16 &&
        png.palette[0]?.[3] === 0
      )
        best = sample(y * png.width + x);
      sheet.pixels[y * w + x] = best;
      if (palette.colors[best] !== v || quantized[y * png.width + x]) changed++;
    }
  return { sheet, palette, changed };
}
export const exportPng = (image: Raster) =>
  encode({
    width: image.width,
    height: image.height,
    data: new Uint8Array(image.data),
    channels: 4,
    depth: 8,
  });
export function pngRaster(bytes: Uint8Array): Raster {
  const { sheet, palette } = importPng(bytes, "");
  const out = raster(sheet.width, sheet.height);
  for (let i = 0; i < sheet.pixels.length; i++)
    if (sheet.pixels[i])
      out.data.set([...rgb(palette.colors[sheet.pixels[i]]), 255], i * 4);
  return out;
}
