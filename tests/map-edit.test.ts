import { it, expect } from "vitest";
import { clone, newProject, makeMap } from "../src/core/model";
import { captureMap, pasteMap } from "../src/core/map-edit";
import { renderMap } from "../src/core/render";
const project = () => {
  const p = newProject(),
    s = p.sheets[0];
  s.width = 16;
  s.height = 8;
  s.pixels = new Uint8Array(128);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 16; x++) s.pixels[y * 16 + x] = ((x + y) % 15) + 1;
  const m = makeMap(s, 2, 1);
  m.cells[1].tile = 1;
  p.maps = [m];
  return p;
};
it("rotates a rectangular region and keeps collision and palette attributes", () => {
  const p = project(),
    m = p.maps[0];
  m.cells[0].collision = 7;
  const before = renderMap(p, m.id),
    clip = captureMap(p, m.id, { x: 0, y: 0, width: 2, height: 1 });
  pasteMap(p, m.id, clip, 0, 0, "rotate", true);
  const result = renderMap(p, m.id);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 8; x++)
      for (let c = 0; c < 4; c++)
        expect(result.data[(y * result.width + x) * 4 + c]).toBe(
          before.data[((7 - x) * 16 + y) * 4 + c],
        );
  expect(p.maps[0].cells[0].collision).toBe(7);
});
it("does not partially modify a map on overflow and moves overlapping selections from their captured source", () => {
  const p = project(),
    m = p.maps[0],
    clip = captureMap(p, m.id, { x: 0, y: 0, width: 2, height: 1 }),
    before = clone(p);
  expect(() => pasteMap(p, m.id, clip, 1, 0, "copy", false)).toThrow();
  expect(p).toEqual(before);
  pasteMap(p, m.id, clip, 1, 0, "copy", true, {
    region: { x: 0, y: 0, width: 2, height: 1 },
    fill: { ...m.cells[0], tile: 1 },
  });
  expect(p.maps[0].cells.map((c) => c.tile)).toEqual([1, 0, 1]);
});
it("rotates animated frames without animating an existing static tile", () => {
  const p = project(),
    m = p.maps[0];
  m.animatedTiles = [{ tile: 0, frames: [0, 1], ticks: 8 }];
  const clip = captureMap(p, m.id, { x: 0, y: 0, width: 1, height: 1 });
  pasteMap(p, m.id, clip, 1, 0, "rotate", false);
  expect(p.maps[0].cells[1].tile).toBeGreaterThanOrEqual(2);
  expect(p.maps[0].animatedTiles).toHaveLength(2);
  const a = p.maps[0].animatedTiles[1];
  expect(a.frames).toHaveLength(2);
  expect(a.ticks).toBe(8);
  expect(p.maps[0].cells[0].tile).toBe(0);
});
