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
  "?": "0e110102040004",
  "!": "04040404040004",
  ".": "00000000000c0c",
  ",": "00000000000c08",
  ":": "000c0c000c0c00",
  ";": "000c0c000c0800",
  "-": "0000001f000000",
  "+": "0004041f040400",
  "/": "01010204081010",
  "'": "04040800000000",
  "(": "02040808080402",
  ")": "08040202020408",
  "[": "0e08080808080e",
  "]": "0e02020202020e",
  "<": "01020408040201",
  ">": "10080402040810",
  "=": "00001f001f0000",
  _: "0000000000001f",
  "×": "0000110a040a11",
  "…": "00000000001500",
  " ": "00000000000000",
};
export function galleryFont() {
  const chars =
    " " +
    Object.keys(patterns)
      .filter((c) => c !== " ")
      .join("") +
    "abcdefghijklmnopqrstuvwxyzàâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ";
  const pixels = new Uint8Array(chars.length * 64);
  [...chars].forEach((char, tile) => {
    const base = char.normalize("NFD")[0].toUpperCase();
    const rows = (patterns[base] ?? patterns[char] ?? patterns["?"])
      .match(/../g)!
      .map((v) => parseInt(v, 16));
    const accent = char.normalize("NFD").slice(1);
    if (accent) {
      rows.pop();
      rows.unshift(
        accent === "\u0301"
          ? 2
          : accent === "\u0300"
            ? 8
            : accent === "\u0308"
              ? 10
              : 4,
      );
    }
    rows.forEach((bits, y) => {
      for (let x = 0; x < 5; x++)
        pixels[tile * 64 + y * 8 + x + 1] = (bits >> (4 - x)) & 1;
    });
  });
  return { chars, data: encodeTiles(pixels, 2) };
}
export function galleryText(text: string, chars: string, width = 28) {
  let letters = [...text.normalize("NFC")];
  if (letters.length > width) letters = [...letters.slice(0, width - 1), "…"];
  return Uint8Array.from([
    ...letters.map((c) =>
      Math.max(0, chars.indexOf(c) < 0 ? chars.indexOf("?") : chars.indexOf(c)),
    ),
    255,
  ]);
}
