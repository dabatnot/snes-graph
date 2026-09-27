import { pixel, put, type Point } from "../core/pixels";
import type { Sheet } from "../core/model";

export type Selection = { x: number; y: number; width: number; height: number };
export type PixelClip = {
  width: number;
  height: number;
  pixels: Uint8Array;
  mask: Uint8Array;
};

export function paletteKey(
  e: Pick<KeyboardEvent, "key" | "code" | "ctrlKey" | "metaKey" | "altKey">,
  count: number,
) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const digit = /^(?:Digit|Numpad)([0-9])$/.exec(e.code);
  const index = digit
    ? Number(digit[1])
    : /^[0-9a-f]$/i.test(e.key)
      ? parseInt(e.key, 16)
      : -1;
  return index >= 0 && index < count ? index : null;
}
export function textInput(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
    )
  );
}
export function constrain(a: Point, b: Point, tool: string): Point {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  if (tool === "line") {
    const angle =
      (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI) / 4;
    const length = Math.hypot(dx, dy);
    return {
      x: a.x + Math.round(Math.cos(angle) * length),
      y: a.y + Math.round(Math.sin(angle) * length),
    };
  }
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return { x: a.x + (dx < 0 ? -size : size), y: a.y + (dy < 0 ? -size : size) };
}
export function copyPixels(
  s: Sheet,
  r: Selection,
  mask: Uint8Array | null,
): PixelClip {
  const pixels = new Uint8Array(r.width * r.height),
    selected = new Uint8Array(pixels.length);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++) {
      const n = y * r.width + x;
      selected[n] = mask ? mask[(r.y + y) * s.width + r.x + x] : 1;
      pixels[n] = pixel(s, r.x + x, r.y + y);
    }
  return { width: r.width, height: r.height, pixels, mask: selected };
}
export function pastePixels(s: Sheet, c: PixelClip, x: number, y: number) {
  for (let j = 0; j < c.height; j++)
    for (let i = 0; i < c.width; i++)
      if (c.mask[j * c.width + i])
        put(s, x + i, y + j, c.pixels[j * c.width + i]);
}
export function movePixels(
  source: Sheet,
  r: Selection,
  mask: Uint8Array | null,
  dx: number,
  dy: number,
) {
  if (
    r.x + dx < 0 ||
    r.y + dy < 0 ||
    r.x + dx + r.width > source.width ||
    r.y + dy + r.height > source.height
  )
    return null;
  const s = { ...source, pixels: source.pixels.slice() },
    clip = copyPixels(source, r, mask);
  for (let y = 0; y < r.height; y++)
    for (let x = 0; x < r.width; x++)
      if (clip.mask[y * r.width + x]) put(s, r.x + x, r.y + y, 0);
  pastePixels(s, clip, r.x + dx, r.y + dy);
  const movedMask = mask ? new Uint8Array(mask.length) : null;
  if (movedMask)
    for (let y = 0; y < r.height; y++)
      for (let x = 0; x < r.width; x++)
        movedMask[(r.y + dy + y) * s.width + r.x + dx + x] =
          clip.mask[y * r.width + x];
  return {
    sheet: s,
    selection: { ...r, x: r.x + dx, y: r.y + dy },
    mask: movedMask,
  };
}
