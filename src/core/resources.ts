import { clone, uid, uses, type Project } from "./model";
import { validateProject } from "./archive";
import { extractTile } from "./pixels";
export function tileUses(p: Project, sheetId: string, tile: number) {
  const s = p.sheets.find((s) => s.id === sheetId)!;
  const x = (tile % (s.width / 8)) * 8,
    y = Math.floor(tile / (s.width / 8)) * 8;
  return [
    ...p.maps
      .filter((m) => m.sheetId === sheetId)
      .map((m) => ({
        name: m.name,
        count: m.cells.filter((c) => c.tile === tile).length,
      })),
    ...p.actors.map((a) => ({
      name: a.name,
      count: a.poses.reduce(
        (n, pose) =>
          n +
          pose.pieces.filter(
            (c) =>
              c.sheetId === sheetId &&
              c.sx < x + 8 &&
              c.sx + c.size > x &&
              c.sy < y + 8 &&
              c.sy + c.size > y,
          ).length,
        0,
      ),
    })),
  ].filter((a) => a.count);
}
/** Extend the canvas at the right/bottom, preserving pixel coordinates and tile uses. */
export function growSheet(
  p: Project,
  sheetId: string,
  width: number,
  height: number,
) {
  const s = p.sheets.find((s) => s.id === sheetId)!;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < s.width ||
    height < s.height ||
    width > 4096 ||
    height > 4096 ||
    width % 8 ||
    height % 8
  )
    throw new Error("Invalid drawing dimensions");
  const oldWidth = s.width;
  const grow = (pixels: Uint8Array) => {
    const result = new Uint8Array(width * height);
    for (let y = 0; y < s.height; y++)
      result.set(pixels.subarray(y * oldWidth, (y + 1) * oldWidth), y * width);
    return result;
  };
  s.pixels = grow(s.pixels);
  for (const layer of s.layers ?? []) layer.pixels = grow(layer.pixels);
  if (width !== oldWidth) {
    const remap = (tile: number) =>
      Math.floor(tile / (oldWidth / 8)) * (width / 8) + (tile % (oldWidth / 8));
    for (const map of p.maps.filter((m) => m.sheetId === sheetId)) {
      for (const cell of [...map.cells, ...map.stamps.flatMap((s) => s.cells)])
        cell.tile = remap(cell.tile);
      for (const terrain of map.terrains ?? [])
        terrain.tiles = terrain.tiles.map(remap);
      for (const animation of map.animatedTiles) {
        animation.tile = remap(animation.tile);
        animation.frames = animation.frames.map(remap);
      }
    }
  }
  s.width = width;
  s.height = height;
}
export function makeLocalTile(p: Project, mapId: string, cellIndex: number) {
  const m = p.maps.find((m) => m.id === mapId)!,
    s = p.sheets.find((s) => s.id === m.sheetId)!,
    c = m.cells[cellIndex];
  if (s.height >= 4096) throw new Error("Tileset reached maximum height");
  const source = extractTile(s, c.tile),
    next = s.pixels.length / 64,
    oldLength = s.pixels.length;
  const grow = (data: Uint8Array) => {
    const result = new Uint8Array(oldLength + s.width * 8);
    result.set(data);
    return result;
  };
  s.pixels = grow(s.pixels);
  if (s.layers) for (const l of s.layers) l.pixels = grow(l.pixels);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++)
      s.pixels[oldLength + y * s.width + x] = source[y * 8 + x];
  if (s.layers) {
    const top = s.layers[s.layers.length - 1];
    if (top.locked || !top.visible)
      throw new Error(
        "Activate an unlocked top layer before creating a local tile",
      );
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++)
        top.pixels[oldLength + y * s.width + x] = source[y * 8 + x];
  }
  s.height += 8;
  c.tile = next;
  delete c.terrain;
  return next;
}
export type ResourceKind = "sheets" | "palettes" | "actors" | "maps" | "scenes";
export function duplicateResource(
  p: Project,
  kind: ResourceKind,
  id: string,
): string {
  const original = p[kind].find((r) => r.id === id);
  if (!original) throw new Error("Resource missing");
  const copy = clone(original);
  copy.id = uid();
  copy.name += " (copy)";
  // Internal IDs stay local to the copied resource; external references remain shared.
  (p[kind] as (typeof original)[]).push(copy);
  return copy.id;
}
export function removeResource(p: Project, kind: ResourceKind, id: string) {
  const refs = uses(p, id);
  if (refs.length)
    throw new Error("Used by / Utilisée par : " + refs.join(", "));
  if (kind === "palettes" && p.palettes.length === 1)
    throw new Error("Keep at least one palette / Conservez une palette");
  if (kind === "sheets" && p.sheets.length === 1)
    throw new Error("Keep at least one drawing / Conservez un dessin");
  const list = p[kind],
    index = list.findIndex((r) => r.id === id);
  if (index >= 0) list.splice(index, 1);
  for (const set of p.exports) {
    for (const key of ["sheetIds", "paletteIds", "actorIds", "mapIds"] as const)
      set[key] = set[key].filter((v) => v !== id);
    if (set.sceneId === id) set.sceneId = "";
  }
}
export function replaceReferences(
  p: Project,
  kind: ResourceKind,
  old: string,
  next: string,
) {
  if (old === next) return;
  if (!p[kind].some((r) => r.id === next))
    throw new Error("Replacement missing");
  if (kind === "palettes") {
    for (const scene of p.scenes)
      for (const slot of scene.paletteSlots ?? [])
        if (slot.paletteId === old) slot.paletteId = next;
    for (const s of p.sheets) if (s.paletteId === old) s.paletteId = next;
    for (const a of p.actors) {
      for (const pose of a.poses)
        for (const c of pose.pieces)
          if (c.paletteId === old) c.paletteId = next;
      for (const v of a.variants) {
        if (v.palettes[old] !== undefined) {
          v.palettes[next] = v.palettes[old];
          delete v.palettes[old];
        }
        for (const k in v.palettes)
          if (v.palettes[k] === old) v.palettes[k] = next;
      }
    }
    for (const m of p.maps) {
      for (const c of [...m.cells, ...m.stamps.flatMap((s) => s.cells)])
        if (c.paletteId === old) c.paletteId = next;
    }
  }
  if (kind === "sheets") {
    for (const a of p.actors)
      for (const pose of a.poses)
        for (const c of pose.pieces) if (c.sheetId === old) c.sheetId = next;
    for (const m of p.maps) if (m.sheetId === old) m.sheetId = next;
  }
  if (kind === "maps")
    for (const s of p.scenes)
      for (const l of s.layers) if (l.mapId === old) l.mapId = next;
  if (kind === "actors")
    for (const s of p.scenes)
      for (const i of s.instances)
        if (i.actorId === old) {
          const a = p.actors.find((a) => a.id === next)!;
          i.actorId = next;
          i.animationId = a.animations[0].id;
          i.variantId = "";
        }
  for (const e of p.exports) {
    for (const k of ["sheetIds", "paletteIds", "actorIds", "mapIds"] as const)
      e[k] = [...new Set(e[k].map((id) => (id === old ? next : id)))];
    if (e.sceneId === old) e.sceneId = next;
  }
  validateProject(p);
}
