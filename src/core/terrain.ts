import type { Tilemap } from "./model";
// Four neighbours: north=1, east=2, south=4, west=8. Diagonals do not affect the mask.
export function connectTerrain(map: Tilemap, id: string) {
  const terrain = map.terrains?.find((t) => t.id === id);
  if (!terrain) return;
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      const c = map.cells[y * map.width + x];
      if (c.terrain !== id) continue;
      let mask = 0;
      for (const [dx, dy, bit] of [
        [0, -1, 1],
        [1, 0, 2],
        [0, 1, 4],
        [-1, 0, 8],
      ]) {
        const xx = x + dx,
          yy = y + dy;
        if (
          xx >= 0 &&
          yy >= 0 &&
          xx < map.width &&
          yy < map.height &&
          map.cells[yy * map.width + xx].terrain === id
        )
          mask |= bit;
      }
      c.tile = terrain.tiles[mask];
    }
}
