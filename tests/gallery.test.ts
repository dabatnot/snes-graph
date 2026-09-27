import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { gallerySelection, gallerySources } from "../src/core/gallery";
import { galleryFont, galleryText } from "../src/core/gallery-font";
import { stampRomLogo, ROM_LOGO } from "../src/core/rom-logo";
import { compileScene } from "../src/core/scene-export";
import { defaultExport, packSprites, pieceKey } from "../src/core/snes";
import {
  footballProject,
  makeMap,
  newProject,
  makeScene,
  makePalette,
} from "../src/core/model";
import { loadProject, saveProject } from "../src/core/archive";
import {
  duplicateResource,
  removeResource,
  replaceReferences,
} from "../src/core/resources";

const directories: string[] = [];
afterEach(() => {
  for (const d of directories.splice(0))
    rmSync(d, { recursive: true, force: true });
});
const compiler =
  spawnSync("ca65", ["--version"]).status === 0 &&
  spawnSync("ld65", ["--version"]).status === 0;
function assemble(files: Record<string, Uint8Array>) {
  const dir = mkdtempSync(join(tmpdir(), "gallery-test-"));
  directories.push(dir);
  for (const [name, bytes] of Object.entries(files))
    writeFileSync(join(dir, name), bytes);
  for (const [command, args] of [
    ["ca65", ["main.s", "-o", "main.o"]],
    ["ld65", ["-C", "lorom.cfg", "main.o", "-o", "gallery.sfc"]],
  ] as const) {
    const r = spawnSync(command, args, { cwd: dir, encoding: "utf8" });
    expect(r.stderr).toBe("");
    expect(r.status).toBe(0);
  }
  const rom = readFileSync(join(dir, "gallery.sfc"));
  expect(rom.length).toBeLessThanOrEqual(4 * 1024 * 1024);
  expect(rom.subarray(0x7fc0, 0x7fd5).toString()).toContain(
    "SNES GRAPH GALLERY",
  );
  return rom;
}
describe("interactive gallery", () => {
  it("keeps distinct pose crops addressed in the shared sprite VRAM across variants", () => {
    const p = footballProject(),
      actor = p.actors[0];
    p.scenes = [];
    p.exports = [];
    actor.poses = actor.poses.map((pose, i) => ({
      ...pose,
      pieces: [pose.pieces[i]],
    }));
    actor.variants = [{ id: "variant", name: "Variant", palettes: {} }];
    const packed = packSprites(p, [actor.id]),
      expected = actor.poses.map(
        (pose) => packed.starts[pieceKey(pose.pieces[0])],
      ),
      files = gallerySources(p, {
        ...defaultExport(p),
        actorIds: [actor.id],
        mapIds: [],
        gallerySceneIds: [],
      });
    expect(new Set(expected).size).toBe(2);
    const oams = Object.values(files).filter(
      (bytes) => bytes.length === 544 && bytes[0] !== 236,
    );
    const tiles = oams.map((bytes) => bytes[2] | ((bytes[3] & 1) << 8));
    // Both palettes contain the second pose; initial loading adds only the first.
    expect(tiles.filter((tile) => tile === expected[1])).toHaveLength(2);
    expect(new Set(tiles)).toEqual(new Set(expected));
    const vram = Object.values(files).find((bytes) => bytes.length === 32768)!;
    expect(vram.slice(0, packed.data.length)).toEqual(packed.data);
    if (compiler) assemble(files);
  });
  it("preserves legacy/all versus explicit empty scene selection through save and resource replacement", () => {
    const p = footballProject(),
      opt = defaultExport(p);
    delete opt.gallerySceneIds;
    p.exports = [opt];
    const loaded = loadProject(saveProject(p));
    expect(gallerySelection(loaded, loaded.exports[0]).scenes).toHaveLength(1);
    opt.gallerySceneIds = [];
    expect(loadProject(saveProject(p)).exports[0].gallerySceneIds).toEqual([]);
    const id = duplicateResource(p, "scenes", p.scenes[0].id);
    opt.gallerySceneIds = [p.scenes[0].id];
    replaceReferences(p, "scenes", p.scenes[0].id, id);
    expect(opt.gallerySceneIds).toEqual([id]);
    removeResource(p, "scenes", id);
    expect(opt.gallerySceneIds).toEqual([]);
  });
  it("includes dependencies without adding them as views and rejects empty or missing selections", () => {
    const p = footballProject(),
      opt = {
        ...defaultExport(p),
        sheetIds: [],
        paletteIds: [],
        mapIds: [],
        actorIds: [],
        gallerySceneIds: [p.scenes[0].id],
      };
    expect(gallerySelection(p, opt).actors).toHaveLength(0);
    expect(() => gallerySources(p, opt, 2)).not.toThrow();
    expect(() => gallerySources(p, { ...opt, gallerySceneIds: [] })).toThrow(
      /Empty gallery/,
    );
    expect(() => gallerySources(p, { ...opt, actorIds: ["missing"] })).toThrow(
      /missing resource/,
    );
  });
  it("names incompatible resources, preserves input and handles unsupported letters and spaces", () => {
    const p = footballProject(),
      opt = { ...defaultExport(p), gallerySceneIds: [] };
    const before = saveProject(p);
    gallerySources(p, opt, 2, "en");
    expect(saveProject(p)).toEqual(before);
    p.actors[0].poses.forEach((p) => (p.pieces = []));
    expect(() => gallerySources(p, opt, 2)).toThrow(
      /Joueur.*No displayable pose/,
    );
    const font = galleryFont();
    expect(galleryText("A B", font.chars)[1]).toBe(0);
    expect(galleryText("éÉàçœ!?😊_-/", font.chars)).toEqual(
      Uint8Array.from([...Array(11).fill(0), 255]),
    );
    expect(galleryText("e\u0301 A9", font.chars)).toEqual(
      Uint8Array.from([
        0,
        0,
        font.chars.indexOf("A"),
        font.chars.indexOf("9"),
        255,
      ]),
    );
    expect(galleryText("abcdef", font.chars, 3)).toEqual(
      Uint8Array.from([
        font.chars.indexOf("a"),
        font.chars.indexOf("b"),
        font.chars.indexOf("c"),
        255,
      ]),
    );
  });
  it("prepares pose-only characters and omits empty animation records without editing them", () => {
    const p = footballProject();
    p.scenes = [];
    p.exports = [];
    p.actors[0].animations = [];
    expect(() => gallerySources(p, defaultExport(p), 2)).not.toThrow();
    expect(p.actors[0].animations).toEqual([]);
    p.actors[0].animations = [
      { id: "empty", name: "Empty", frames: [], loop: false, pingPong: false },
    ];
    expect(() => gallerySources(p, defaultExport(p), 2)).not.toThrow();
    expect(p.actors[0].animations[0].frames).toEqual([]);
  });
  it.skipIf(!compiler)(
    "assembles all categories, 50/60 Hz, animation modes and banked large maps",
    () => {
      const p = footballProject();
      const actor = p.actors[0];
      actor.animations.push({
        ...actor.animations[0],
        id: "oneshot",
        loop: false,
        pingPong: true,
        frames: [...actor.animations[0].frames, actor.animations[0].frames[0]],
      });
      assemble(gallerySources(p, defaultExport(p), 3));
      p.fps = 50;
      const m = p.maps[0],
        cell = m.cells[0];
      m.width = 129;
      m.height = 97;
      m.cells = Array.from({ length: m.width * m.height }, (_, i) => ({
        ...cell,
        tile: i % 2,
      }));
      m.animatedTiles = [{ tile: 0, frames: [0, 1], ticks: 3 }];
      assemble(
        gallerySources(
          p,
          { ...defaultExport(p), gallerySceneIds: [] },
          3,
          "en",
        ),
      );
      const small = newProject();
      small.maps = [makeMap(small.sheets[0], 3, 2)];
      assemble(gallerySources(small));
    },
  );
});

it("keeps scene memory and full 8bpp palettes intact when adding the ROM logo", () => {
  const p = newProject();
  const palette = makePalette("Full BG", 256);
  p.palettes.push(palette);
  for (const objSize of [0, 1, 2, 3, 4, 5]) {
    const m = compileScene(
      p,
      { ...makeScene(), objSize },
      {},
      { data: new Uint8Array(), starts: {} },
      new Map(),
    );
    m.vram.fill(77, 0, 32768);
    m.allocations.push({ name: "Mode 7", address: 0, bytes: 32768 });
    m.palettes.push({ id: palette.id, layer: 0, slot: 0, address: 0 });
    m.cgram.set(Uint8Array.from({ length: 512 }, (_, i) => i & 127));
    const before = m.cgram.slice();
    stampRomLogo(m, p, 224);
    expect(m.cgram).toEqual(before);
    expect(m.vram.slice(0, 32768)).toEqual(new Uint8Array(32768).fill(77));
    const logo = m.allocations.find((a) => a.name === ROM_LOGO)!;
    expect(logo.address).toBeGreaterThanOrEqual(32768);
    expect(
      m.vram
        .slice(logo.address, logo.address + logo.bytes)
        .some((v) => v !== 0),
    ).toBe(true);
    expect(m.oam[0]).toBe(236);
    expect(m.oam[1]).toBe(203);
  }
  const m = compileScene(
    p,
    makeScene(),
    {},
    { data: new Uint8Array(), starts: {} },
    new Map(),
  );
  m.allocations.push({ name: "Full VRAM", address: 0, bytes: 65536 });
  expect(() => stampRomLogo(m, p, 224)).toThrow(/SNES Graph logo.*memory/);
});
