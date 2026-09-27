import { galleryFont } from "./gallery-font";
import { decodeTiles } from "./snes";

export type GalleryButton =
  "A" | "B" | "X" | "Y" | "L" | "R" | "LR" | "START" | "DPAD";
export type GalleryControl = [GalleryButton, string];
const font = galleryFont();
const glyphs = decodeTiles(font.data, 2);
/** Original 12px button faces and a 16px D-pad, using blue/ivory indices 1/2. */
export function controlPixels(button: GalleryButton) {
  const width = button === "START" || button === "LR" ? 32 : 16;
  const pixels = new Uint8Array(width * 16).fill(1);
  const plot = (x: number, y: number, color = 2) => {
    pixels[y * width + x] = color;
  };
  const letter = (char: string, x: number, y: number) => {
    const tile = Math.max(0, font.chars.indexOf(char));
    for (let py = 0; py < 7; py++)
      for (let px = 0; px < 5; px++)
        if (glyphs[tile * 64 + py * 8 + px + 1]) plot(x + px, y + py);
  };
  const box = (left: number, right: number) => {
    for (let x = left + 1; x < right; x++) {
      plot(x, 2);
      plot(x, 13);
    }
    for (let y = 3; y < 13; y++) {
      plot(left, y);
      plot(right, y);
    }
  };
  if (button === "DPAD") {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if ((x >= 5 && x <= 10) || (y >= 5 && y <= 10)) plot(x, y);
    for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) plot(x, y, 1);
  } else if (button === "LR") {
    box(2, 13);
    box(18, 29);
    letter("L", 5, 4);
    letter("R", 21, 4);
  } else if (button === "START") {
    box(0, 31);
    [...button].forEach((c, i) => letter(c, 2 + i * 6, 4));
  } else {
    box(2, 13);
    letter(button, 5, 4);
  }
  return { width, pixels };
}
