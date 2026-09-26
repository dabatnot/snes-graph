import { it, expect } from "vitest";
import { clone, footballProject } from "../src/core/model";
import {
  transformSheet,
  resizePositions,
  exchangeTileBlocks,
} from "../src/core/resources";
import { renderActor, renderMap } from "../src/core/render";
import { saveProject, loadProject } from "../src/core/archive";
it("preserves sprite sources and hidden layers when adding space at top and left", () => {
  const p = footballProject(),
    s = p.sheets[0],
    a = p.actors[0];
  s.layers = [
    {
      id: "hidden",
      name: "hidden",
      visible: false,
      locked: true,
      pixels: s.pixels.slice(),
    },
  ];
  const before = renderActor(p, a, a.poses[0]);
  const pos = resizePositions(
    s.width,
    s.height,
    s.width + 8,
    s.height + 8,
    1,
    1,
  );
  transformSheet(p, s.id, s.width + 8, s.height + 8, pos);
  expect(renderActor(p, p.actors[0], p.actors[0].poses[0])).toEqual(before);
  expect(p.sheets[0].layers![0].pixels[8 * p.sheets[0].width + 8]).toBe(
    s.pixels[0],
  );
  expect(() => loadProject(saveProject(p))).not.toThrow();
});
it("preserves maps, stamps, terrains and animations when exchanging tiles", () => {
  const p = footballProject(),
    m = p.maps[0],
    s = p.sheets.find((s) => s.id === m.sheetId)!;
  m.stamps = [
    {
      id: "stamp",
      name: "stamp",
      width: 1,
      height: 1,
      cells: [clone(m.cells[0])],
    },
  ];
  m.terrains = [{ id: "terrain", name: "terrain", tiles: Array(16).fill(0) }];
  m.animatedTiles = [{ tile: 0, frames: [0, 1], ticks: 8 }];
  const before = renderMap(p, m.id, 8);
  transformSheet(
    p,
    s.id,
    s.width,
    s.height,
    exchangeTileBlocks(
      s.width / 8,
      s.height / 8,
      { x: 0, y: 0, width: 1, height: 1 },
      1,
      0,
    ),
  );
  expect(renderMap(p, m.id, 8)).toEqual(before);
  expect(p.maps[0].terrains![0].tiles[0]).toBe(1);
  expect(p.maps[0].stamps[0].cells[0].tile).toBe(1);
});
it("rejects missing replacements and fragmented pieces atomically", () => {
  const p = footballProject(),
    s = p.sheets[0],
    before = clone(p);
  expect(() =>
    transformSheet(
      p,
      s.id,
      8,
      8,
      resizePositions(s.width, s.height, 8, 8, 0, 0),
    ),
  ).toThrow();
  expect(p).toEqual(before);
  expect(() =>
    transformSheet(
      p,
      s.id,
      s.width,
      s.height,
      exchangeTileBlocks(
        s.width / 8,
        s.height / 8,
        { x: 0, y: 0, width: 1, height: 1 },
        3,
        5,
      ),
    ),
  ).toThrow(/fragmented/);
  expect(p).toEqual(before);
});
