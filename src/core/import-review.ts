import type { Sheet } from "./model";
export function changedTiles(before: Sheet, after: Sheet): number[] {
  if (
    before.width !== after.width ||
    before.height !== after.height ||
    before.bpp !== after.bpp
  )
    throw new Error("Reimport must preserve drawing dimensions and depth");
  const tiles: number[] = [];
  for (let ty = 0; ty < before.height / 8; ty++)
    for (let tx = 0; tx < before.width / 8; tx++) {
      let changed = false;
      for (let y = 0; y < 8 && !changed; y++)
        for (let x = 0; x < 8; x++) {
          const i = (ty * 8 + y) * before.width + tx * 8 + x;
          if (before.pixels[i] !== after.pixels[i]) {
            changed = true;
            break;
          }
        }
      if (changed) tiles.push(ty * (before.width / 8) + tx);
    }
  return tiles;
}
