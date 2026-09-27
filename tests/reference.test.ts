import { describe, expect, it } from "vitest";
import { encode } from "fast-png";
import { unzipSync, zipSync } from "fflate";
import { createReference, fitReference } from "../src/core/reference";
import {
  loadProject,
  saveProject,
  validateProject,
  checkProjectSize,
} from "../src/core/archive";
import { newProject } from "../src/core/model";
import { renderSheet } from "../src/core/render";
import {
  duplicateResource,
  resizePositions,
  transformSheet,
} from "../src/core/resources";
const png = encode({
  width: 2,
  height: 1,
  channels: 4,
  depth: 8,
  data: new Uint8Array([123, 45, 67, 128, 76, 54, 32, 255]),
});
function fixture() {
  const p = newProject();
  p.sheets[0].reference = createReference(png, "concept.png", 32, 32);
  return p;
}
describe("drawing references", () => {
  it("fits proportionally, preserving PNG bytes and editor settings across archives", () => {
    expect(fitReference(2048, 1024, 128, 128)).toEqual({
      x: 0,
      y: 32,
      width: 128,
    });
    const p = fixture(),
      r = p.sheets[0].reference!;
    expect(r).toMatchObject({
      x: 0,
      y: 8,
      width: 32,
      opacity: 0.5,
      visible: true,
    });
    Object.assign(r, { x: -5.25, width: 100, opacity: 0.37, visible: false });
    const saved = saveProject(p);
    expect(unzipSync(saved)[`references/${p.sheets[0].id}.png`]).toEqual(png);
    expect(loadProject(saved).sheets[0].reference).toEqual(r);
    delete p.sheets[0].reference;
    expect(loadProject(saveProject(p)).sheets[0].reference).toBeUndefined();
  });
  it("does not change rendered graphics and survives duplication and tile rearrangement", () => {
    const p = newProject(),
      s = p.sheets[0];
    s.pixels[0] = 1;
    const before = renderSheet(p, s);
    s.reference = createReference(png, "concept.png", 32, 32);
    expect(renderSheet(p, s)).toEqual(before);
    const id = duplicateResource(p, "sheets", s.id);
    const copy = p.sheets.find((s) => s.id === id)!;
    expect(copy.reference).toEqual(s.reference);
    copy.reference!.x = 4;
    expect(s.reference!.x).toBe(0);
    const reference = structuredClone(s.reference);
    transformSheet(p, s.id, 40, 40, resizePositions(32, 32, 40, 40, 1, 1));
    expect(p.sheets[0].reference).toEqual(reference);
  });
  it("rejects malformed, missing, oversized PNGs and invalid settings", () => {
    expect(() => createReference(new Uint8Array(40), "bad", 32, 32)).toThrow();
    expect(() => createReference(png.slice(0, 33), "bad", 32, 32)).toThrow();
    const large = png.slice();
    new DataView(large.buffer).setUint32(16, 4097);
    expect(() => createReference(large, "large", 32, 32)).toThrow(/4096/);
    const p = fixture();
    p.sheets[0].reference!.opacity = NaN;
    expect(() => validateProject(p)).toThrow();
    const files = unzipSync(saveProject(fixture()));
    delete files[Object.keys(files).find((s) => s.startsWith("references/"))!];
    expect(() => loadProject(zipSync(files))).toThrow();
  });
  it("counts embedded PNGs toward the project size limit", () => {
    const p = fixture();
    p.sheets[0].reference!.png = new Uint8Array(128 * 1024 * 1024);
    expect(() => checkProjectSize(p)).toThrow(/128/);
  });
});
