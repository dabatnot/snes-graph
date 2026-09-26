import { describe, expect, it } from "vitest";
import { encode } from "fast-png";
import { importPng } from "../src/core/import";
import { rgb555 } from "../src/core/model";

describe("PNG sample decoding", () => {
  it.each([
    { depth: 1 as const, data: [0xa0, 0x40], indices: [1, 0, 1, 0, 1, 0] },
    { depth: 2 as const, data: [0x6c, 0xc4], indices: [1, 2, 3, 3, 0, 1] },
    {
      depth: 4 as const,
      data: [0x12, 0x30, 0x30, 0x10],
      indices: [1, 2, 3, 3, 0, 1],
    },
  ])(
    "preserves $depth-bit indices across padded scanlines",
    ({ depth, data, indices }) => {
      const palette = Array.from({ length: 1 << depth }, (_, i) => [
        i * 8,
        i * 8,
        i * 8,
        i === 0 ? 0 : 255,
      ]);
      const bytes = encode({
        width: 3,
        height: 2,
        depth,
        channels: 1,
        data: new Uint8Array(data),
        palette,
      });
      const { sheet } = importPng(bytes, "Indexed");
      expect([
        ...sheet.pixels.slice(0, 3),
        ...sheet.pixels.slice(8, 11),
      ]).toEqual(indices);
      expect(sheet.pixels.slice(3, 8).every((v) => v === 0)).toBe(true);
    },
  );

  it("scales packed grayscale samples to their full intensity", () => {
    const bytes = encode({
      width: 3,
      height: 2,
      depth: 2,
      channels: 1,
      data: new Uint8Array([0x18, 0xe4]),
    });
    const { sheet, palette } = importPng(bytes, "Gray");
    const pixels = [...sheet.pixels.slice(0, 3), ...sheet.pixels.slice(8, 11)];
    expect(pixels.every((v) => v !== 0)).toBe(true);
    expect(pixels.map((v) => palette.colors[v])).toEqual(
      [0, 85, 170, 255, 170, 85].map((v) => rgb555(v, v, v)),
    );
  });

  // Independent PNG fixtures: transparent key, a sample differing by one,
  // then the transparent key again. Compare before RGB555 quantization.
  it.each([
    [
      "gray8",
      "iVBORw0KGgoAAAANSUhEUgAAAAMAAAABCAAAAAA+i0toAAAAAnRSTlMAVW2SaEMAAAAMSURBVHicYwgNCwUAAgQBATAs3uUAAAAASUVORK5CYII=",
    ],
    [
      "rgb8",
      "iVBORw0KGgoAAAANSUhEUgAAAAMAAAABCAIAAACUgoPjAAAABnRSTlMAVQBVAFXvIw4KAAAAD0lEQVR4nGMIBYGw0NBQAA7/Av9d7RzRAAAAAElFTkSuQmCC",
    ],
    [
      "gray16",
      "iVBORw0KGgoAAAANSUhEUgAAAAMAAAABEAAAAABuG5crAAAAAnRSTlNVVapewVIAAAAPSURBVHicYwgNDQ0LDQUABwMCAIPIiOkAAAAASUVORK5CYII=",
    ],
    [
      "rgb16",
      "iVBORw0KGgoAAAANSUhEUgAAAAMAAAABEAIAAADEEl+gAAAABnRSTlNVVVVVVVWIf8HPAAAADklEQVR4nGMIRYAwCAUAOOEF/JEsq5AAAAAASUVORK5CYII=",
    ],
  ])("honors the exact %s transparency key", (_, fixture) => {
    const { sheet } = importPng(
      new Uint8Array(Buffer.from(fixture, "base64")),
      "Transparent",
    );
    expect(sheet.pixels[0]).toBe(0);
    expect(sheet.pixels[1]).not.toBe(0);
    expect(sheet.pixels[2]).toBe(0);
  });
});
