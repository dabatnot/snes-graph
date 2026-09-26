import { describe, expect, it } from "vitest";
import { strFromU8 } from "fflate";
import {
  makeCell,
  makeLayer,
  makeMap,
  makePalette,
  makeScene,
  makeSheet,
  newProject,
} from "../src/core/model";
import { extractTile } from "../src/core/pixels";
import { renderScene } from "../src/core/render";
import { compileScene } from "../src/core/scene-export";
import {
  buildTiles,
  decodeTiles,
  defaultExport,
  exportProject,
  packSprites,
} from "../src/core/snes";

function animatedMode7() {
  const p = newProject(),
    palette = makePalette("Colors", 256),
    sheet = makeSheet(palette.id, 16, 8, 8),
    map = makeMap(sheet, 128, 128),
    scene = makeScene();
  palette.colors[1] = 31;
  palette.colors[2] = 31 << 5;
  for (let y = 0; y < 8; y++) {
    sheet.pixels.fill(1, y * 16, y * 16 + 8);
    sheet.pixels.fill(2, y * 16 + 8, y * 16 + 16);
  }
  map.animatedTiles = [{ tile: 0, frames: [0, 1], ticks: 2 }];
  scene.mode = 7;
  scene.layers = [makeLayer(map.id)];
  p.palettes = [palette];
  p.sheets = [sheet];
  p.maps = [map];
  p.scenes = [scene];
  return { p, sheet, map, scene };
}

describe("Exported tile references", () => {
  it("compiles Mode 7 animated cells at the same frame as the preview", () => {
    const { p, sheet, scene } = animatedMode7(),
      options = { ...defaultExport(p, scene.id), reservedTiles: 3 },
      files = exportProject(p, options),
      built = new Map([[sheet.id, buildTiles(p, sheet.id, options)]]),
      packed = packSprites(p, []);
    for (const [tick, tile, color] of [
      [0, 3, [255, 0, 0, 255]],
      [1, 3, [255, 0, 0, 255]],
      [2, 4, [0, 255, 0, 255]],
      [4, 3, [255, 0, 0, 255]],
    ] as const) {
      const memory = compileScene(p, scene, files, packed, built, tick);
      expect(memory.vram[0]).toBe(tile);
      expect(Array.from(renderScene(p, scene, tick).data.slice(0, 4))).toEqual(
        color,
      );
    }
  });

  it("rejects an animated Mode 7 frame needing a hardware tile flip", () => {
    const { p, sheet, scene } = animatedMode7();
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        sheet.pixels[y * 16 + x] = x < 2 ? 1 : 2;
        sheet.pixels[y * 16 + 8 + x] = x >= 6 ? 1 : 2;
      }
    const options = {
        ...defaultExport(p, scene.id),
        deduplicate: true,
        flips: true,
      },
      files = exportProject(p, options),
      built = new Map([[sheet.id, buildTiles(p, sheet.id, options)]]);
    expect(() =>
      compileScene(p, scene, files, packSprites(p, []), built, 2),
    ).toThrow("Disable flipped tile deduplication for Mode 7");
  });

  it("exposes source-to-export refs for stamps and animations after optimization", () => {
    const p = newProject(),
      sheet = makeSheet(p.palettes[0].id, 24, 8),
      map = makeMap(sheet);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        sheet.pixels[y * 24 + x] = x < 2 && y < 3 ? 1 : 2;
        sheet.pixels[y * 24 + 8 + x] = x >= 6 && y < 3 ? 1 : 2;
        sheet.pixels[y * 24 + 16 + x] = x < 2 && y < 3 ? 1 : 2;
      }
    map.stamps = [
      {
        id: "stamp",
        name: "Stamp",
        width: 3,
        height: 1,
        cells: [0, 1, 2].map((tile) => makeCell(sheet.paletteId, tile)),
      },
    ];
    map.animatedTiles = [{ tile: 0, frames: [0, 1, 2], ticks: 1 }];
    map.cells = map.cells.map(() => makeCell(sheet.paletteId, 2));
    map.cells[0].tile = 0;
    map.cells[5].tile = 0;
    p.sheets = [sheet];
    p.maps = [map];
    const files = exportProject(p, {
        ...defaultExport(p),
        reservedTiles: 3,
        deduplicate: true,
        flips: true,
      }),
      manifest = JSON.parse(strFromU8(files["manifest.json"])),
      exported = manifest.maps[map.id],
      refs = manifest.sheets[0].refs as {
        tile: number;
        flipX: boolean;
        flipY: boolean;
      }[],
      pixels = decodeTiles(files[`tiles/${sheet.id}.chr`], 4);
    expect(exported.stamps).toEqual(map.stamps);
    expect(exported.animatedTiles).toEqual([
      { ...map.animatedTiles[0], cellIndices: [0, 5] },
    ]);
    const mapWords = new DataView(files[`maps/${map.id}.map`].buffer);
    expect(mapWords.getUint16(0, true)).toBe(mapWords.getUint16(2, true));
    expect(refs.map((r) => r.tile)).toEqual([3, 3, 3]);
    expect(refs[1].flipX).toBe(true);
    for (const tile of exported.animatedTiles[0].frames) {
      const ref = refs[tile],
        source = extractTile(sheet, tile),
        reconstructed = new Uint8Array(64);
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++)
          reconstructed[y * 8 + x] =
            pixels[
              ref.tile * 64 +
                (ref.flipY ? 7 - y : y) * 8 +
                (ref.flipX ? 7 - x : x)
            ];
      expect(reconstructed).toEqual(source);
    }
  });
});
