import type { Sheet } from "./model";
export type Point = { x: number; y: number };
export const pixel = (s: Sheet, x: number, y: number) =>
  x >= 0 && y >= 0 && x < s.width && y < s.height
    ? s.pixels[y * s.width + x]
    : 0;
export function put(s: Sheet, x: number, y: number, color: number) {
  if (x >= 0 && y >= 0 && x < s.width && y < s.height)
    s.pixels[y * s.width + x] = color;
}
export function line(
  a: Point,
  b: Point,
  visit: (x: number, y: number) => void,
) {
  let x = a.x,
    y = a.y;
  const dx = Math.abs(b.x - x),
    dy = -Math.abs(b.y - y),
    sx = x < b.x ? 1 : -1,
    sy = y < b.y ? 1 : -1;
  let e = dx + dy;
  for (;;) {
    visit(x, y);
    if (x === b.x && y === b.y) break;
    const e2 = e * 2;
    if (e2 >= dy) {
      e += dy;
      x += sx;
    }
    if (e2 <= dx) {
      e += dx;
      y += sy;
    }
  }
}
export function fill(s: Sheet, x: number, y: number, color: number) {
  const target = pixel(s, x, y);
  if (target === color) return;
  const queue = [{ x, y }];
  while (queue.length) {
    const p = queue.pop()!;
    if (
      p.x < 0 ||
      p.y < 0 ||
      p.x >= s.width ||
      p.y >= s.height ||
      pixel(s, p.x, p.y) !== target
    )
      continue;
    put(s, p.x, p.y, color);
    queue.push(
      { x: p.x + 1, y: p.y },
      { x: p.x - 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x, y: p.y - 1 },
    );
  }
}
export function transform(s: Sheet, op: "flipX" | "flipY" | "rotate") {
  const old = s.pixels.slice(),
    w = s.width,
    h = s.height;
  if (op === "rotate") {
    s.width = h;
    s.height = w;
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = op === "flipX" ? w - 1 - x : op === "rotate" ? h - 1 - y : x;
      const ny = op === "flipY" ? h - 1 - y : op === "rotate" ? x : y;
      s.pixels[ny * s.width + nx] = old[y * w + x];
    }
}
export function extractTile(s: Sheet, tile: number): Uint8Array {
  const out = new Uint8Array(64),
    cols = s.width / 8;
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      out[y * 8 + x] = pixel(
        s,
        (tile % cols) * 8 + x,
        Math.floor(tile / cols) * 8 + y,
      );
  return out;
}
