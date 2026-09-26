import { describe, it, expect } from "vitest";
import { encode } from "fast-png";
import { unzipSync, zipSync, strFromU8, strToU8 } from "fflate";
import {
  footballProject,
  newProject,
  clone,
  makeMap,
  makeSheet,
  makePalette,
  makeLayer,
  frameAt,
  type Bpp,
} from "../src/core/model";
import { saveProject, loadProject } from "../src/core/archive";
import {
  encodeTiles,
  decodeTiles,
  exportProject,
  defaultExport,
  diagnose,
} from "../src/core/snes";
import { renderActor } from "../src/core/render";
import { importPng } from "../src/core/import";
import { demoSources } from "../src/core/demo";
import { importAseprite } from "../src/core/aseprite";
import { flattenSheet } from "../src/core/model";
import { connectTerrain } from "../src/core/terrain";
import { growSheet, makeLocalTile } from "../src/core/resources";

describe("SNES data and editing contract", () => {
  it("previews the same optimized VRAM layout as the selected export", () => {
    const p = footballProject(),
      s = p.scenes[0],
      opt = {
        ...defaultExport(p, s.id),
        deduplicate: true,
        flips: true,
        reservedTiles: 3,
      };
    const exported = exportProject(p, opt),
      demo = demoSources(p, s, 2, opt);
    expect(demo["vram0.bin"]).toEqual(
      exported["scene/vram.bin"].slice(0, 32768),
    );
    expect(demo["vram1.bin"]).toEqual(exported["scene/vram.bin"].slice(32768));
  });
  it("keeps cyclic and static palettes in stable separate slots", () => {
    const p = footballProject(),
      [home, away] = p.palettes;
    away.colors = home.colors.slice();
    home.cycle = { start: 2, end: 3, ticks: 1 };
    const files = demoSources(p, p.scenes[0], 2),
      a = files["Frame0Oam.bin"],
      b = files["Frame1Oam.bin"];
    expect((a[3] >> 1) & 7).not.toBe((a[27] >> 1) & 7);
    expect(a).toEqual(b);
  });
  it("exports palette indices in manifest order and requires variant dependencies", () => {
    const p = footballProject(),
      opt = defaultExport(p);
    opt.paletteIds.reverse();
    const files = exportProject(p, opt),
      manifest = JSON.parse(strFromU8(files["manifest.json"]));
    const a = p.actors[0],
      pose = a.poses[0],
      data = files[`actors/${a.id}/${pose.id}.meta`];
    expect(manifest.palettes[data[8] | (data[9] << 8)].id).toBe(
      pose.pieces[0].paletteId,
    );
    opt.paletteIds = opt.paletteIds.filter((id) => id !== p.palettes[1].id);
    expect(() => exportProject(p, opt)).toThrow("Inclure la ressource");
  });
  it("creates a local tile without changing other occurrences", () => {
    const p = footballProject(),
      map = p.maps[0],
      sheet = p.sheets.find((s) => s.id === map.sheetId)!,
      old = sheet.pixels.slice(),
      first = map.cells[0].tile;
    makeLocalTile(p, map.id, 0);
    expect(map.cells[1].tile).toBe(first);
    expect(map.cells[0].tile).not.toBe(first);
    expect(sheet.pixels.slice(0, old.length)).toEqual(old);
    expect(() => saveProject(p)).not.toThrow();
  });
  it("honors reserved OBJ palettes and refuses unsafe archive identifiers", () => {
    const p = footballProject(),
      scene = p.scenes[0];
    scene.paletteSlots = [{ paletteId: p.palettes[0].id, layer: 4, slot: 6 }];
    const files = exportProject(p, defaultExport(p, scene.id));
    expect((files["scene/oam.bin"][3] >> 1) & 7).toBe(6);
    p.actors[0].poses[0].id = "../../escape";
    expect(() => saveProject(p)).toThrow("identifier");
  });
  it("preserves editable drawing layers through the project archive", () => {
    const p = newProject(),
      s = p.sheets[0];
    s.layers = [
      {
        id: "base",
        name: "Base",
        visible: true,
        locked: false,
        pixels: s.pixels.slice(),
      },
      {
        id: "ink",
        name: "Ink",
        visible: true,
        locked: false,
        pixels: s.pixels.slice(),
      },
    ];
    s.layers[0].pixels[0] = 1;
    s.layers[1].pixels[0] = 2;
    s.layers[1].pixels[1] = 3;
    flattenSheet(s);
    expect(s.pixels[0]).toBe(2);
    expect(loadProject(saveProject(p))).toEqual(p);
  });
  it("connects terrain tiles by neighbour masks", () => {
    const p = newProject(),
      m = makeMap(p.sheets[0], 3, 1);
    m.terrains = [
      {
        id: "grass",
        name: "Grass",
        tiles: Array.from({ length: 16 }, (_, i) => i),
      },
    ];
    m.cells.forEach((c) => (c.terrain = "grass"));
    connectTerrain(m, "grass");
    expect(m.cells.map((c) => c.tile)).toEqual([2, 10, 8]);
  });
  it("imports Aseprite frame pixels and durations using its binary file layout", () => {
    const layer = new Uint8Array(24),
      lv = new DataView(layer.buffer);
    lv.setUint32(0, 24, true);
    lv.setUint16(4, 0x2004, true);
    lv.setUint16(6, 3, true);
    layer[18] = 255;
    lv.setUint16(22, 0, true);
    const cel = new Uint8Array(6 + 20 + 8 * 8 * 4),
      cv = new DataView(cel.buffer);
    cv.setUint32(0, cel.length, true);
    cv.setUint16(4, 0x2005, true);
    cel[12] = 255;
    cv.setUint16(22, 8, true);
    cv.setUint16(24, 8, true);
    for (let n = 26; n < cel.length; n += 4) {
      cel[n] = 255;
      cel[n + 3] = 255;
    }
    const bytes = new Uint8Array(128 + 16 + layer.length + cel.length),
      v = new DataView(bytes.buffer);
    v.setUint32(0, bytes.length, true);
    v.setUint16(4, 0xa5e0, true);
    v.setUint16(6, 1, true);
    v.setUint16(8, 8, true);
    v.setUint16(10, 8, true);
    v.setUint16(12, 32, true);
    v.setUint32(128, bytes.length - 128, true);
    v.setUint16(132, 0xf1fa, true);
    v.setUint16(134, 2, true);
    v.setUint16(136, 100, true);
    bytes.set(layer, 144);
    bytes.set(cel, 168);
    const imported = importAseprite(bytes, "Test", 60);
    expect(imported.actor.animations[0].frames[0].ticks).toBe(6);
    expect(imported.sheet.pixels.every((v) => v === 1)).toBe(true);
    expect(imported.actor.poses[0].pieces.length).toBe(1);
  });
  it("encodes planar bit order from an independent 4bpp example", () => {
    const pixels = new Uint8Array(64);
    pixels.set([0, 1, 2, 3, 4, 5, 6, 15]);
    const bytes = encodeTiles(pixels, 4),
      expected = new Uint8Array(32);
    expected[0] = 0x55;
    expected[1] = 0x33;
    expected[16] = 0x0f;
    expected[17] = 0x01;
    expect(bytes).toEqual(expected);
    for (const depth of [2, 4, 8] as Bpp[]) {
      const source = Uint8Array.from(
        { length: 256 },
        (_, i) => i % (1 << depth),
      );
      expect(decodeTiles(encodeTiles(source, depth), depth)).toEqual(source);
    }
  });
  it("round trips projects and rejects dangling references before opening", () => {
    const p = footballProject();
    expect(loadProject(saveProject(p))).toEqual(p);
    const entries = unzipSync(saveProject(p));
    const json = JSON.parse(strFromU8(entries["project.json"]));
    json.actors[0].poses[0].pieces[0].sheetId = "missing";
    entries["project.json"] = strToU8(JSON.stringify(json));
    expect(() => loadProject(zipSync(entries))).toThrow("4bpp");
  });
  it("changes a named variant without duplicating pixels or animations", () => {
    const p = footballProject(),
      a = p.actors[0],
      before = clone(p.sheets),
      home = renderActor(p, a, a.poses[0], a.variants[0]),
      away = renderActor(p, a, a.poses[0], a.variants[1]);
    expect(home.data).not.toEqual(away.data);
    expect(p.sheets).toEqual(before);
    expect(frameAt(a, a.animations[0].id, 8)?.id).toBe(a.poses[1].id);
    const file = exportProject(p, defaultExport(p, p.scenes[0].id));
    const oam = file["scene/oam.bin"];
    expect(oam[2]).toBe(oam[6 * 4 + 2]);
    expect((oam[3] >> 1) & 7).not.toBe((oam[6 * 4 + 3] >> 1) & 7);
    expect(file["scene/cgram.bin"].length).toBe(512);
    expect(file["scene/vram.bin"].length).toBe(65536);
  });
  it("writes 64-wide tilemaps in 32x32 screen blocks", () => {
    const p = newProject(),
      s = p.sheets[0];
    p.maps = [makeMap(s, 64, 32)];
    p.maps[0].cells[32].tile = 1;
    p.maps[0].cells[64].tile = 2;
    const bytes = exportProject(p)["maps/" + p.maps[0].id + ".map"];
    expect(bytes[2048]).toBe(1);
    expect(bytes[64]).toBe(2);
  });
  it("deduplicates flipped tiles while preserving map attributes and source pixels", () => {
    const p = newProject(),
      s = makeSheet(p.palettes[0].id, 16, 8);
    s.pixels[0] = 1;
    s.pixels[15] = 1;
    p.sheets = [s];
    p.maps = [makeMap(s, 32, 32)];
    p.maps[0].cells[1].tile = 1;
    const settings = { ...defaultExport(p), deduplicate: true, flips: true },
      files = exportProject(p, settings);
    expect(files["tiles/" + s.id + ".chr"].length).toBe(32);
    const map = files["maps/" + p.maps[0].id + ".map"];
    expect(map[3] & 0x40).toBe(0x40);
    expect(s.pixels[15]).toBe(1);
    expect(exportProject(p, settings)).toEqual(files);
  });
  it("imports opaque black distinctly from transparent pixels and reports reduction", () => {
    const image = encode({
      width: 2,
      height: 1,
      data: Uint8Array.of(0, 0, 0, 255, 0, 0, 0, 0),
      channels: 4,
      depth: 8,
    });
    const result = importPng(image, "Black");
    expect(result.sheet.pixels[0]).not.toBe(0);
    expect(result.sheet.pixels[1]).toBe(0);
    const palette = makePalette("Red");
    palette.colors.fill(31);
    const reduced = importPng(image, "Black", palette);
    expect(reduced.changed).toBe(1);
  });
  it("rejects simultaneous 8bpp BG and incompatible OBJ CGRAM allocations", () => {
    const p = footballProject(),
      pal = makePalette("Full", 256);
    pal.colors.fill(32767);
    p.palettes.push(pal);
    const sheet = makeSheet(pal.id, 8, 8, 8);
    sheet.pixels.fill(1);
    p.sheets.push(sheet);
    const map = makeMap(sheet);
    p.maps = [map];
    p.scenes[0].layers = [makeLayer(map.id)];
    p.scenes[0].mode = 3;
    expect(() => exportProject(p, defaultExport(p, p.scenes[0].id))).toThrow(
      "CGRAM",
    );
  });
  it("finds sprite scanline overflow and generates a self-contained ca65 demo", () => {
    const p = footballProject(),
      s = p.scenes[0];
    const sources = demoSources(p, s, 2);
    expect(strFromU8(sources["main.s"])).toContain("FramePointers");
    expect(sources["Frame0Oam.bin"].length).toBe(544);
    s.instances = Array.from({ length: 20 }, () => clone(s.instances[0]));
    expect(diagnose(p, s).some((d) => d.code === "scanline")).toBe(true);
  });
});

describe("drawing canvas growth", () => {
  it("adds transparent rows, preserves all layers, and survives saving", () => {
    const p = footballProject(),
      s = p.sheets[0];
    const original = s.pixels.slice(),
      width = s.width,
      height = s.height;
    s.layers = [
      {
        id: "base",
        name: "Base",
        visible: true,
        locked: true,
        pixels: original.slice(),
      },
      {
        id: "hidden",
        name: "Hidden",
        visible: false,
        locked: false,
        pixels: original.slice(),
      },
    ];
    growSheet(p, s.id, width, height + 8);
    for (const pixels of [s.pixels, ...s.layers.map((l) => l.pixels)]) {
      expect(pixels.slice(0, original.length)).toEqual(original);
      expect(pixels.slice(original.length)).toEqual(new Uint8Array(width * 8));
    }
    expect(loadProject(saveProject(p)).sheets[0]).toEqual(s);
  });
  it("keeps map, stamp, terrain, animation and sprite graphics when widening", () => {
    const p = footballProject(),
      s = p.sheets[0],
      m = p.maps[0];
    m.sheetId = s.id;
    const oldColumns = s.width / 8;
    m.cells.forEach((c) => (c.tile = oldColumns + 1));
    m.stamps = [
      {
        id: "stamp",
        name: "Stamp",
        width: 1,
        height: 1,
        cells: [clone(m.cells[0])],
      },
    ];
    m.terrains = [
      { id: "terrain", name: "Terrain", tiles: Array(16).fill(oldColumns + 1) },
    ];
    m.animatedTiles = [
      { tile: oldColumns + 1, frames: [0, oldColumns + 2], ticks: 8 },
    ];
    const original = s.pixels.slice(),
      width = s.width,
      height = s.height;
    const actor = renderActor(p, p.actors[0], p.actors[0].poses[0]);
    growSheet(p, s.id, width + 8, height);
    for (let y = 0; y < height; y++) {
      expect(s.pixels.slice(y * s.width, y * s.width + width)).toEqual(
        original.slice(y * width, (y + 1) * width),
      );
      expect(s.pixels.slice(y * s.width + width, (y + 1) * s.width)).toEqual(
        new Uint8Array(8),
      );
    }
    expect(m.cells[0].tile).toBe(oldColumns + 2);
    expect(m.stamps[0].cells[0].tile).toBe(oldColumns + 2);
    expect(m.terrains[0].tiles).toEqual(Array(16).fill(oldColumns + 2));
    expect(m.animatedTiles[0]).toEqual({
      tile: oldColumns + 2,
      frames: [0, oldColumns + 3],
      ticks: 8,
    });
    expect(renderActor(p, p.actors[0], p.actors[0].poses[0])).toEqual(actor);
  });
});
