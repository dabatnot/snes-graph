/** Shared pixel geometry for the gallery's thin ivory frames and square corners. */
export function galleryFrame(
  plot: (x: number, y: number, color: number) => void,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const rect = (x: number, y: number, w: number, h: number, color: number) => {
    for (let py = y; py < y + h; py++)
      for (let px = x; px < x + w; px++) plot(px, py, color);
  };
  rect(x + 2, y + 2, w, h, 15);
  rect(x, y, w, h, 5);
  rect(x, y, w - 1, h - 1, 3);
  rect(x + 1, y + 1, w - 3, h - 3, 4);
  rect(x + 3, y + 3, w - 6, h - 6, 1);
  rect(x + 4, y + 4, w - 8, h - 8, 2);
  for (const px of [x, x + w - 5])
    for (const py of [y, y + h - 5]) {
      rect(px, py, 5, 5, 3);
      rect(px + 1, py + 1, 3, 3, 5);
      plot(px + 1, py + 1, 10);
    }
}
