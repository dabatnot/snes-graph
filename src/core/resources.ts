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

/** Reorder a palette family and its pixels without changing any saved use. */
export function swapPaletteColors(
  p: Project,
  paletteId: string,
  index: number,
) {
  const palette = p.palettes.find((pal) => pal.id === paletteId)!;
  if (index <= 0 || index >= palette.colors.length - 1) return;
  const ids = new Set([paletteId]);
  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const actor of p.actors)
      for (const variant of actor.variants)
        for (const [base, replacement] of Object.entries(variant.palettes))
          if (ids.has(base) || ids.has(replacement))
            for (const id of [base, replacement])
              if (!ids.has(id)) {
                ids.add(id);
                expanded = true;
              }
  }
  const palettes = p.palettes.filter((pal) => ids.has(pal.id));
  for (const pal of palettes)
    if (pal.locked[index] || pal.locked[index + 1])
      throw new Error(
        "Une couleur liée est verrouillée / A linked color is locked",
      );
  const sheets = p.sheets.filter((sheet) => {
    const usedPalettes = new Set([sheet.paletteId]);
    for (const actor of p.actors)
      for (const pose of actor.poses)
        for (const piece of pose.pieces)
          if (piece.sheetId === sheet.id) usedPalettes.add(piece.paletteId);
    for (const map of p.maps)
      if (map.sheetId === sheet.id)
        for (const cell of [
          ...map.cells,
          ...map.stamps.flatMap((s) => s.cells),
        ])
          usedPalettes.add(cell.paletteId);
    if (![...usedPalettes].some((id) => ids.has(id))) return false;
    if ([...usedPalettes].some((id) => !ids.has(id)))
      throw new Error(
        "Dupliquez le dessin avant de réordonner : il utilise aussi une autre famille de palettes. / Duplicate these graphics before reordering: they also use an unrelated palette family.",
      );
    if (index < 1 << sheet.bpp && index + 1 >= 1 << sheet.bpp)
      throw new Error(
        "Cet échange dépasse les indices du dessin. / This swap exceeds the drawing's color indices.",
      );
    return true;
  });
  for (const pal of palettes) {
    [pal.colors[index], pal.colors[index + 1]] = [
      pal.colors[index + 1],
      pal.colors[index],
    ];
    [pal.labels[index], pal.labels[index + 1]] = [
      pal.labels[index + 1],
      pal.labels[index],
    ];
    [pal.locked[index], pal.locked[index + 1]] = [
      pal.locked[index + 1],
      pal.locked[index],
    ];
  }
  const remap = (pixels: Uint8Array) =>
    pixels.map((v) => (v === index ? index + 1 : v === index + 1 ? index : v));
  for (const sheet of sheets) {
    sheet.pixels = remap(sheet.pixels);
    for (const layer of sheet.layers ?? []) layer.pixels = remap(layer.pixels);
  }
}

/** Resource targets for the library, without relying on potentially duplicate names. */
export function resourceUses(p: Project, id: string) {
  const targets: { kind: ResourceKind; id: string; name: string }[] = [];
  for (const kind of [
    "sheets",
    "palettes",
    "actors",
    "maps",
    "scenes",
  ] as const) {
    for (const resource of p[kind]) {
      const subset = {
        ...p,
        sheets: [],
        palettes: [],
        actors: [],
        maps: [],
        scenes: [],
        [kind]: [resource],
      } as Project;
      if (uses(subset, id).length)
        targets.push({ kind, id: resource.id, name: resource.name });
    }
  }
  return targets;
}
export function removeTerrain(
  p: Project,
  mapId: string,
  id: string,
  replacement = "",
) {
  const m = p.maps.find((m) => m.id === mapId)!;
  if (
    replacement &&
    (replacement === id || !m.terrains?.some((t) => t.id === replacement))
  )
    throw new Error(
      "Terrain de remplacement invalide / Invalid replacement terrain",
    );
  for (const c of [...m.cells, ...m.stamps.flatMap((s) => s.cells)]) {
    if (c.terrain === id) {
      if (replacement) c.terrain = replacement;
      else delete c.terrain;
    }
  }
  m.terrains = m.terrains?.filter((t) => t.id !== id);
}

/** Map old tile positions to new ones. Removed pixels never overwrite replacements. */
export function transformSheet(
  p: Project,
  id: string,
  width: number,
  height: number,
  positions: number[],
  replacements: Record<number, number> = {},
) {
  const original = p.sheets.find((s) => s.id === id)!;
  if (
    ![width, height].every(
      (n) => Number.isInteger(n) && n >= 8 && n <= 4096 && n % 8 === 0,
    ) ||
    positions.length !== (original.width * original.height) / 64
  )
    throw new Error("Dimensions invalides / Invalid dimensions");
  const count = (width * height) / 64;
  const retained = positions.filter((n) => n >= 0);
  if (
    new Set(retained).size !== retained.length ||
    positions.some((n) => !Number.isInteger(n) || n < -1 || n >= count)
  )
    throw new Error("Placement de tiles invalide / Invalid tile placement");
  const next = clone(p),
    sheet = next.sheets.find((s) => s.id === id)!;
  const mapRef = (tile: number, usage: string) => {
    const mapped =
      positions[tile] === -1 ? replacements[tile] : positions[tile];
    if (!Number.isInteger(mapped) || mapped < 0 || mapped >= count)
      throw new Error(
        `${usage} : tile ${tile} — choisissez un remplacement / choose a replacement`,
      );
    return mapped;
  };
  for (const m of next.maps.filter((m) => m.sheetId === id)) {
    for (const c of [...m.cells, ...m.stamps.flatMap((s) => s.cells)])
      c.tile = mapRef(c.tile, m.name);
    for (const t of m.terrains ?? [])
      t.tiles = t.tiles.map((n) => mapRef(n, `${m.name} / ${t.name}`));
    for (const a of m.animatedTiles) {
      a.tile = mapRef(a.tile, m.name);
      a.frames = a.frames.map((n) => mapRef(n, m.name));
    }
    if (
      new Set(m.animatedTiles.map((a) => a.tile)).size !==
      m.animatedTiles.length
    )
      throw new Error(
        `${m.name} : plusieurs animations sur la même tile / duplicate animated tile`,
      );
  }
  for (const a of next.actors)
    for (const pose of a.poses)
      for (const c of pose.pieces.filter((c) => c.sheetId === id)) {
        const old = (c.sy / 8) * (original.width / 8) + c.sx / 8;
        const first = mapRef(old, `${a.name} / ${pose.name}`),
          x = first % (width / 8),
          y = Math.floor(first / (width / 8));
        for (let dy = 0; dy < c.size / 8; dy++)
          for (let dx = 0; dx < c.size / 8; dx++) {
            if (
              x + dx >= width / 8 ||
              y + dy >= height / 8 ||
              mapRef(old + (dy * original.width) / 8 + dx, a.name) !==
                first + (dy * width) / 8 + dx
            )
              throw new Error(
                `${a.name} / ${pose.name} : pièce fragmentée — corrigez sa source / fragmented piece — edit its source`,
              );
          }
        c.sx = x * 8;
        c.sy = y * 8;
      }
  const relocate = (data: Uint8Array) => {
    const out = new Uint8Array(width * height);
    positions.forEach((dest, tile) => {
      if (dest < 0) return;
      const sx = (tile % (original.width / 8)) * 8,
        sy = Math.floor(tile / (original.width / 8)) * 8;
      const tx = (dest % (width / 8)) * 8,
        ty = Math.floor(dest / (width / 8)) * 8;
      for (let y = 0; y < 8; y++)
        out.set(
          data.subarray(
            (sy + y) * original.width + sx,
            (sy + y) * original.width + sx + 8,
          ),
          (ty + y) * width + tx,
        );
    });
    return out;
  };
  sheet.pixels = relocate(sheet.pixels);
  for (const layer of sheet.layers ?? []) layer.pixels = relocate(layer.pixels);
  sheet.width = width;
  sheet.height = height;
  validateProject(next);
  Object.assign(p, next);
}
export function resizePositions(
  oldWidth: number,
  oldHeight: number,
  width: number,
  height: number,
  dx: number,
  dy: number,
) {
  return Array.from({ length: (oldWidth * oldHeight) / 64 }, (_, i) => {
    const x = (i % (oldWidth / 8)) + dx,
      y = Math.floor(i / (oldWidth / 8)) + dy;
    return x < 0 || y < 0 || x >= width / 8 || y >= height / 8
      ? -1
      : (y * width) / 8 + x;
  });
}
export function exchangeTileBlocks(
  columns: number,
  rows: number,
  source: { x: number; y: number; width: number; height: number },
  x: number,
  y: number,
) {
  const { width, height } = source;
  if (
    ![source.x, source.y, width, height, x, y].every(Number.isInteger) ||
    width < 1 ||
    height < 1 ||
    source.x < 0 ||
    source.y < 0 ||
    x < 0 ||
    y < 0 ||
    source.x + width > columns ||
    source.y + height > rows ||
    x + width > columns ||
    y + height > rows
  )
    throw new Error("Bloc hors du dessin / Block outside drawing");
  if (
    x < source.x + width &&
    x + width > source.x &&
    y < source.y + height &&
    y + height > source.y
  )
    throw new Error(
      "Les blocs doivent être disjoints / Blocks must not overlap",
    );
  const positions = Array.from({ length: columns * rows }, (_, i) => i);
  for (let dy = 0; dy < height; dy++)
    for (let dx = 0; dx < width; dx++) {
      const a = (source.y + dy) * columns + source.x + dx,
        b = (y + dy) * columns + x + dx;
      positions[a] = b;
      positions[b] = a;
    }
  return positions;
}
