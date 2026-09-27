import { clone, flattenSheet, uid, type Project, type Cell } from "./model";
import { extractTile } from "./pixels";
import { growSheet } from "./resources";
import { validateProject } from "./archive";
import { connectTerrain } from "./terrain";
export type Region = { x: number; y: number; width: number; height: number };
export type MapClip = {
  sheetId: string;
  width: number;
  height: number;
  cells: Cell[];
  animations: Project["maps"][number]["animatedTiles"];
};
export function captureMap(p: Project, id: string, r: Region): MapClip {
  const m = p.maps.find((m) => m.id === id)!;
  if (
    ![r.x, r.y, r.width, r.height].every(Number.isInteger) ||
    r.x < 0 ||
    r.y < 0 ||
    r.width < 1 ||
    r.height < 1 ||
    r.x + r.width > m.width ||
    r.y + r.height > m.height
  )
    throw new Error("Région invalide / Invalid region");
  return {
    sheetId: m.sheetId,
    width: r.width,
    height: r.height,
    cells: Array.from({ length: r.width * r.height }, (_, i) =>
      clone(
        m.cells[
          (r.y + Math.floor(i / r.width)) * m.width + r.x + (i % r.width)
        ],
      ),
    ),
    animations: clone(m.animatedTiles),
  };
}
const flipPixels = (data: Uint8Array, x: boolean, y: boolean) =>
  Uint8Array.from(
    { length: 64 },
    (_, i) =>
      data[
        (y ? 7 - Math.floor(i / 8) : Math.floor(i / 8)) * 8 +
          (x ? 7 - (i % 8) : i % 8)
      ],
  );
const rotatePixels = (data: Uint8Array) =>
  Uint8Array.from(
    { length: 64 },
    (_, i) => data[(7 - (i % 8)) * 8 + Math.floor(i / 8)],
  );
/** Entire edit is prepared on a copy; failures cannot partially paint or append tiles. */
export function pasteMap(
  p: Project,
  id: string,
  clip: MapClip,
  x: number,
  y: number,
  operation: "copy" | "flipX" | "flipY" | "rotate",
  grow: boolean,
  move?: { region: Region; fill: Cell },
) {
  const next = clone(p),
    m = next.maps.find((m) => m.id === id)!;
  if (m.sheetId !== clip.sheetId)
    throw new Error(
      "Le dessin source doit être identique / Source drawings must match",
    );
  const s = next.sheets.find((s) => s.id === m.sheetId)!;
  const width = operation === "rotate" ? clip.height : clip.width,
    height = operation === "rotate" ? clip.width : clip.height;
  if (
    ![x, y].every(Number.isInteger) ||
    x < 0 ||
    y < 0 ||
    x + width > 512 ||
    y + height > 512
  )
    throw new Error("Destination hors limites / Destination outside limits");
  if ((x + width > m.width || y + height > m.height) && !grow)
    throw new Error(
      "Agrandissez la carte pour coller sans tronquer / Enlarge map to paste without clipping",
    );
  if (x + width > m.width || y + height > m.height) {
    const old = clone(m);
    m.width = Math.max(m.width, x + width);
    m.height = Math.max(m.height, y + height);
    m.cells = Array.from({ length: m.width * m.height }, (_, i) => {
      const xx = i % m.width,
        yy = Math.floor(i / m.width);
      return xx < old.width && yy < old.height
        ? old.cells[yy * old.width + xx]
        : {
            tile: 0,
            paletteId: s.paletteId,
            flipX: false,
            flipY: false,
            priority: false,
            collision: 0,
          };
    });
  }
  const initialCount = (s.width * s.height) / 64;
  const generated: Uint8Array[] = [];
  const originals = Array.from({ length: initialCount }, (_, i) =>
    extractTile(s, i),
  );
  const generatedAnimations = new Map<string, number>();
  const append = (pixels: Uint8Array) => {
    const id = initialCount + generated.length;
    generated.push(pixels);
    return id;
  };
  const matching = (pixels: Uint8Array, flips: boolean) => {
    const candidates = [...originals, ...generated];
    for (let index = 0; index < candidates.length; index++) {
      // Never reuse a tile which this map animates as a static frame.
      if (m.animatedTiles.some((a) => a.tile === index)) continue;
      for (const [fx, fy] of flips
        ? [
            [false, false],
            [true, false],
            [false, true],
            [true, true],
          ]
        : [[false, false]]) {
        const test = flipPixels(candidates[index], fx, fy);
        if (test.every((v, i) => v === pixels[i]))
          return { tile: index, flipX: fx, flipY: fy };
      }
    }
    return { tile: append(pixels), flipX: false, flipY: false };
  };
  const transformed = Array.from({ length: width * height }, (_, i) => {
    const tx = i % width,
      ty = Math.floor(i / width);
    const sx =
      operation === "rotate"
        ? ty
        : operation === "flipX"
          ? clip.width - 1 - tx
          : tx;
    const sy =
      operation === "rotate"
        ? clip.height - 1 - tx
        : operation === "flipY"
          ? clip.height - 1 - ty
          : ty;
    const c = clone(clip.cells[sy * clip.width + sx]);
    delete c.terrain;
    if (operation === "flipX") c.flipX = !c.flipX;
    if (operation === "flipY") c.flipY = !c.flipY;
    if (operation === "rotate") {
      const rotate = (tile: number) => {
        if (!originals[tile])
          throw new Error("Tile source absente / Missing source tile");
        return rotatePixels(flipPixels(originals[tile], c.flipX, c.flipY));
      };
      const animation = clip.animations.find((a) => a.tile === c.tile);
      if (animation) {
        const key = [c.tile, c.flipX, c.flipY].join(":");
        let base = generatedAnimations.get(key);
        if (base === undefined) {
          base = append(rotate(c.tile));
          generatedAnimations.set(key, base);
          m.animatedTiles.push({
            ...clone(animation),
            tile: base,
            frames: animation.frames.map(
              (n) => matching(rotate(n), false).tile,
            ),
          });
        }
        c.tile = base;
        c.flipX = false;
        c.flipY = false;
      } else Object.assign(c, matching(rotate(c.tile), true));
    }
    return c;
  });
  if (move) {
    const r = move.region;
    if (r.x + r.width > m.width || r.y + r.height > m.height)
      throw new Error("Source hors limites / Source outside limits");
    for (let yy = 0; yy < r.height; yy++)
      for (let xx = 0; xx < r.width; xx++) {
        const cell = clone(move.fill);
        delete cell.terrain;
        m.cells[(r.y + yy) * m.width + r.x + xx] = cell;
      }
  }
  for (let yy = 0; yy < height; yy++)
    for (let xx = 0; xx < width; xx++)
      m.cells[(y + yy) * m.width + x + xx] = transformed[yy * width + xx];
  for (const terrain of m.terrains ?? []) connectTerrain(m, terrain.id);
  if (generated.length) {
    const columns = s.width / 8,
      newHeight = Math.ceil((initialCount + generated.length) / columns) * 8;
    growSheet(next, s.id, s.width, newHeight);
    let pixels = s.pixels;
    if (s.layers) {
      const layer = {
        id: uid(),
        name: "Rotation",
        visible: true,
        locked: false,
        pixels: new Uint8Array(s.width * s.height),
      };
      s.layers.push(layer);
      pixels = layer.pixels;
    }
    generated.forEach((tile, n) => {
      const index = initialCount + n,
        x = (index % columns) * 8,
        y = Math.floor(index / columns) * 8;
      for (let yy = 0; yy < 8; yy++)
        pixels.set(tile.subarray(yy * 8, yy * 8 + 8), (y + yy) * s.width + x);
    });
    if (s.layers) flattenSheet(s);
  }
  validateProject(next);
  Object.assign(p, next);
  return { addedTiles: generated.length, width, height };
}
