import { type Project, type Scene } from "./model";
import { buildTiles, defaultExport, encodeTiles, packSprites } from "./snes";
import { compileScene } from "./scene-export";
export function sceneMemory(p: Project, s: Scene, tick = 0) {
  const opt = defaultExport(p, s.id),
    built = new Map(p.sheets.map((s) => [s.id, buildTiles(p, s.id, opt)]));
  const files: Record<string, Uint8Array> = {};
  for (const sh of p.sheets)
    files[`tiles/${sh.id}.chr`] = encodeTiles(built.get(sh.id)!.pixels, sh.bpp);
  return compileScene(p, s, files, packSprites(p, opt.actorIds), built, tick);
}
