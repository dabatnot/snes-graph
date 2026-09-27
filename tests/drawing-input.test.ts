import { describe, expect, it } from "vitest";
import { newProject } from "../src/core/model";
import {
  paletteKey,
  constrain,
  copyPixels,
  pastePixels,
  movePixels,
} from "../src/ui/drawing-input";

describe("drawing keyboard and selections", () => {
  it("selects hexadecimal indices on AZERTY and the keypad without stealing modified keys", () => {
    const event = {
      key: "é",
      code: "Digit2",
      ctrlKey: false,
      metaKey: false,
      altKey: false,
    };
    expect(paletteKey(event, 16)).toBe(2);
    expect(paletteKey({ ...event, key: "-", code: "Digit6" }, 16)).toBe(6);
    expect(paletteKey({ ...event, key: "End", code: "Numpad1" }, 16)).toBe(1);
    expect(paletteKey({ ...event, key: "F", code: "KeyF" }, 16)).toBe(15);
    expect(paletteKey({ ...event, key: "a", code: "KeyA" }, 4)).toBeNull();
    for (const modifier of ["ctrlKey", "metaKey", "altKey"])
      expect(paletteKey({ ...event, [modifier]: true }, 16)).toBeNull();
  });
  it("constrains lines to axes and diagonals and shapes to squares in every direction", () => {
    const a = { x: 10, y: 10 };
    expect(constrain(a, { x: 18, y: 11 }, "line")).toEqual({ x: 18, y: 10 });
    const diagonal = constrain(a, { x: 17, y: 15 }, "line");
    expect(diagonal.x - a.x).toBe(diagonal.y - a.y);
    expect(constrain(a, { x: 7, y: 16 }, "rect")).toEqual({ x: 4, y: 16 });
    expect(constrain(a, { x: 14, y: 8 }, "ellipse")).toEqual({ x: 14, y: 6 });
  });
  it("pastes selected transparent pixels while preserving pixels outside a lasso", () => {
    const s = newProject().sheets[0];
    s.pixels.fill(3);
    s.pixels[0] = 0;
    s.pixels[1] = 2;
    const mask = new Uint8Array(s.pixels.length);
    mask[0] = 1;
    const c = copyPixels(s, { x: 0, y: 0, width: 2, height: 1 }, mask);
    pastePixels(s, c, 4, 4);
    expect(s.pixels[4 * s.width + 4]).toBe(0);
    expect(s.pixels[4 * s.width + 5]).toBe(3);
    expect(() => pastePixels(s, c, s.width - 1, s.height - 1)).not.toThrow();
  });
  it("moves overlapping selections from their original pixels, carries the mask and rejects overflow", () => {
    const s = newProject().sheets[0];
    s.pixels.fill(0);
    s.pixels[0] = 1;
    s.pixels[1] = 2;
    s.pixels[2] = 3;
    const r = { x: 0, y: 0, width: 3, height: 1 };
    const mask = new Uint8Array(s.pixels.length);
    mask[0] = mask[1] = 1;
    const moved = movePixels(s, r, mask, 1, 0)!;
    expect([...moved.sheet.pixels.slice(0, 4)]).toEqual([0, 1, 2, 0]);
    expect([...moved.mask!.slice(0, 4)]).toEqual([0, 1, 1, 0]);
    expect(moved.selection.x).toBe(1);
    expect([...s.pixels.slice(0, 3)]).toEqual([1, 2, 3]);
    expect(movePixels(s, r, mask, -1, 0)).toBeNull();
    expect(movePixels(s, r, mask, s.width - 2, 0)).toBeNull();
  });
});
