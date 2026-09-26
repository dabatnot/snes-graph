import { describe, it, expect } from "vitest";
import {
  clone,
  footballProject,
  makePalette,
  makeSheet,
  newProject,
} from "../src/core/model";
import { loadProject, saveProject } from "../src/core/archive";
import { renderActor, renderSheet } from "../src/core/render";
import { swapPaletteColors } from "../src/core/resources";

describe("palette reordering", () => {
  it("preserves the drawing and every linked football variant across save/load", () => {
    const p = footballProject();
    const actor = p.actors[0];
    const variants = [undefined, ...actor.variants];
    const before = variants.map((v) =>
      renderActor(p, actor, actor.poses[0], v),
    );
    const drawing = renderSheet(p, p.sheets[0]);
    swapPaletteColors(p, p.palettes[0].id, 1);
    const restored = loadProject(saveProject(p));
    expect(renderSheet(restored, restored.sheets[0])).toEqual(drawing);
    for (let i = 0; i < variants.length; i++)
      expect(
        renderActor(
          restored,
          restored.actors[0],
          restored.actors[0].poses[0],
          variants[i],
        ),
      ).toEqual(before[i]);
  });

  it("rejects unrelated default palettes and captured stamps without changing the project", () => {
    for (const use of ["default", "stamp"] as const) {
      const p = footballProject();
      p.actors[0].variants = [];
      if (use === "default") p.sheets[0].paletteId = p.palettes[1].id;
      else
        p.maps[0].stamps.push({
          id: "other-family",
          name: "Away kit",
          width: 1,
          height: 1,
          cells: [{ ...p.maps[0].cells[0], paletteId: p.palettes[1].id }],
        });
      const before = clone(p);
      expect(() => swapPaletteColors(p, p.palettes[0].id, 1)).toThrow(
        /unrelated palette/,
      );
      expect(p).toEqual(before);
    }
  });

  it("does not remap a 2bpp drawing to index four when using a larger palette", () => {
    const p = newProject();
    const palette = makePalette("Shared", 16);
    const sheet = makeSheet(palette.id, 8, 8, 2, "2bpp");
    sheet.pixels.fill(3);
    p.palettes = [palette];
    p.sheets = [sheet];
    const before = clone(p);
    expect(() => swapPaletteColors(p, palette.id, 3)).toThrow(/color indices/);
    expect(p).toEqual(before);
    expect(() => saveProject(p)).not.toThrow();
  });
});
