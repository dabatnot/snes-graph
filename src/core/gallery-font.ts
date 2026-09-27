import { encodeTiles } from "./snes";
// Original 5x7 bitmap alphabet; no system font or external asset dependency.
const patterns: Record<string, string> = {
  A: "0e11111f111111",
  B: "1e11111e11111e",
  C: "0e11101010110e",
  D: "1e11111111111e",
  E: "1f10101e10101f",
  F: "1f10101e101010",
  G: "0e11101711110f",
  H: "1111111f111111",
  I: "0e04040404040e",
  J: "0702020212120c",
  K: "11121418141211",
  L: "1010101010101f",
  M: "111b1515111111",
  N: "11191513111111",
  O: "0e11111111110e",
  P: "1e11111e101010",
  Q: "0e11111115120d",
  R: "1e11111e141211",
  S: "0f10100e01011e",
  T: "1f040404040404",
  U: "1111111111110e",
  V: "11111111110a04",
  W: "11111115151b11",
  X: "11110a040a1111",
  Y: "11110a04040404",
  Z: "1f01020408101f",
  "0": "0e11131519110e",
  "1": "040c040404040e",
  "2": "0e11010204081f",
  "3": "1e01010e01011e",
  "4": "02060a121f0202",
  "5": "1f10101e01011e",
  "6": "0e10101e11110e",
  "7": "1f010204080808",
  "8": "0e11110e11110e",
  "9": "0e11110f01010e",
  " ": "00000000000000",
};
export function galleryFont() {
  const chars =
    " " +
    Object.keys(patterns)
      .filter((c) => c !== " ")
      .join("") +
    "abcdefghijklmnopqrstuvwxyz";
  const pixels = new Uint8Array(chars.length * 64);
  [...chars].forEach((char, tile) => {
    const rows = patterns[char.toUpperCase()]
      .match(/../g)!
      .map((v) => parseInt(v, 16));
    rows.forEach((bits, y) => {
      for (let x = 0; x < 5; x++)
        pixels[tile * 64 + y * 8 + x + 1] = (bits >> (4 - x)) & 1;
    });
  });
  return { chars, data: encodeTiles(pixels, 2) };
}
export function galleryText(text: string, chars: string, width = 28) {
  const letters = [...text.normalize("NFC")]
    .map((char) => (/^[A-Za-z0-9]$/.test(char) ? char : " "))
    .slice(0, width);
  return Uint8Array.from([
    ...letters.map((char) => Math.max(0, chars.indexOf(char))),
    255,
  ]);
}
