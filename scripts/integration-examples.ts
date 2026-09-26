import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  newProject,
  makeSheet,
  makeMap,
  makeLayer,
  makeActor,
  makeScene,
  clone,
  uid,
  fromHex,
} from "../src/core/model";
import { saveProject } from "../src/core/archive";
import { sceneMemory } from "../src/core/scene-analysis";
import { defaultExport, exportProject } from "../src/core/snes";
import { fixRomChecksum } from "../src/core/demo";
const root = resolve(process.argv[2] ?? "artifacts/integration");
for (const [mode, name] of [
  "background",
  "animated-sprite",
  "palette-swap",
].entries()) {
  const p = newProject();
  p.name = name;
  const pal = p.palettes[0];
  pal.name = "Azure";
  pal.colors = [
    "#000000",
    "#182840",
    "#2878d8",
    "#88d8f8",
    "#ffffff",
    ...Array(11).fill("#000000"),
  ].map(fromHex);
  const alternate = clone(pal);
  alternate.id = uid();
  alternate.name = "Amber";
  alternate.colors[2] = fromHex("#d88028");
  alternate.colors[3] = fromHex("#f8d888");
  p.palettes.push(alternate);
  const sheet = makeSheet(pal.id, 16, 16, 4, "Crystal");
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
      sheet.pixels[y * 16 + x] = d < 7 ? (x < 7 ? 3 : 2) : d < 9 ? 1 : 0;
    }
  sheet.pixels[5 * 16 + 6] = 4;
  p.sheets = [sheet];
  const s = makeScene();
  s.name = name;
  p.scenes.push(s);
  if (mode === 0) {
    const map = makeMap(sheet);
    map.name = "Mosaic";
    map.cells.forEach(
      (c, i) => (c.tile = (Math.floor(i / 32) % 2) * 2 + (i % 2)),
    );
    p.maps.push(map);
    s.layers.push(makeLayer(map.id));
  } else {
    const actor = makeActor("Crystal");
    actor.originX = 8;
    actor.originY = 8;
    actor.poses[0].pieces.push({
      id: uid(),
      sheetId: sheet.id,
      paletteId: pal.id,
      sx: 0,
      sy: 0,
      size: 16,
      x: 0,
      y: 0,
      flipX: false,
      flipY: false,
      priority: 2,
      group: "",
    });
    const pose = clone(actor.poses[0]);
    pose.id = uid();
    pose.name = "Raised";
    pose.pieces[0].id = uid();
    pose.pieces[0].y = -6;
    actor.poses.push(pose);
    actor.animations[0].frames = actor.poses.map((pose) => ({
      poseId: pose.id,
      ticks: 16,
      event: "",
    }));
    actor.variants.push({
      id: uid(),
      name: "Amber",
      palettes: { [pal.id]: alternate.id },
    });
    p.actors.push(actor);
    s.instances.push({
      id: uid(),
      actorId: actor.id,
      animationId: actor.animations[0].id,
      variantId: "",
      x: 128,
      y: 112,
      vx: 0,
      vy: 0,
      flipX: false,
    });
  }
  const first = sceneMemory(p, s, 0),
    second = sceneMemory(p, s, 16);
  const alt = clone(p);
  alt.palettes[0].colors = alternate.colors;
  const amber = sceneMemory(alt, alt.scenes[0], 0);
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  const files = {
    "project.snesgraph": saveProject(p),
    "vram0.bin": first.vram.slice(0, 32768),
    "vram1.bin": first.vram.slice(32768),
    "cgram0.bin": first.cgram,
    "cgram1.bin": amber.cgram,
    "oam0.bin": first.oam,
    "oam1.bin": second.oam,
  };
  for (const [file, data] of Object.entries(files))
    await writeFile(join(dir, file), data);
  for (const [file, data] of Object.entries(
    exportProject(p, defaultExport(p, s.id)),
  )) {
    const path = join(dir, "export", file);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, data);
  }
  await writeFile(join(dir, "settings.inc"), `MODE = ${mode}\n`);
  await writeFile(
    join(dir, "registers.inc"),
    first.registers
      .map(([r, v]) => `  lda #$${v.toString(16)}\n  sta $${r.toString(16)}\n`)
      .join(""),
  );
  for (const file of ["runtime.s", "lorom.cfg"])
    await copyFile(resolve("examples/integration", file), join(dir, file));
  for (const [exe, args] of [
    ["ca65", ["runtime.s", "-o", "main.o"]],
    ["ld65", ["-C", "lorom.cfg", "main.o", "-o", "example.sfc"]],
  ] as const) {
    const r = spawnSync(exe, args, { cwd: dir, encoding: "utf8" });
    if (r.error || r.status !== 0)
      throw new Error(r.error?.message ?? r.stderr);
  }
  const rom = join(dir, "example.sfc");
  await writeFile(rom, fixRomChecksum(new Uint8Array(await readFile(rom))));
  console.log(`${name}: ${rom}`);
}
