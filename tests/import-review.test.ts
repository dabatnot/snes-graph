import { expect, it } from "vitest";
import { makeSheet } from "../src/core/model";
import { changedTiles } from "../src/core/import-review";
it("locates changed tile indices and rejects incompatible layouts", () => {
  const a = makeSheet("palette", 16, 16, 4, "Drawing"),
    b = structuredClone(a);
  b.pixels[9] = 1;
  b.pixels[15 * 16] = 2;
  expect(changedTiles(a, b)).toEqual([1, 2]);
  b.width = 8;
  expect(() => changedTiles(a, b)).toThrow("dimensions");
});
