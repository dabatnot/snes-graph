/** Reproduce the controller journeys and keep real Mesen captures in artifacts/. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { footballProject, type Project } from "../src/core/model";
import { defaultExport } from "../src/core/snes";
import { gallerySources } from "../src/core/gallery";
import { fixRomChecksum } from "../src/core/demo";
import { loadProject } from "../src/core/archive";

const emulator = process.argv[2];
if (!emulator)
  throw new Error(
    "Usage: node --import tsx scripts/verify-gallery.ts /path/to/Mesen",
  );
const root = resolve("artifacts/gallery-validation");
function command(exe: string, args: string[], cwd: string, env = process.env) {
  const r = spawnSync(exe, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout: 60000,
  });
  if (
    r.error ||
    r.status !== 0 ||
    /Uninitialized memory read|Script error|assertion failed/i.test(
      r.stdout + r.stderr,
    )
  )
    throw new Error(`${exe}: ${r.error?.message ?? r.stdout + r.stderr}`);
}
function run(
  name: string,
  p: Project,
  options: ReturnType<typeof defaultExport>,
  script: string,
  ticks = p.fps * 2,
  language: "fr" | "en" = "fr",
) {
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, bytes] of Object.entries(
    gallerySources(p, options, ticks, language),
  ))
    writeFileSync(join(dir, file), bytes);
  command("ca65", ["main.s", "-o", "main.o"], dir);
  command("ld65", ["-C", "lorom.cfg", "main.o", "-o", "gallery.sfc"], dir);
  writeFileSync(
    join(dir, "gallery.sfc"),
    fixRomChecksum(new Uint8Array(readFileSync(join(dir, "gallery.sfc")))),
  );
  command(
    emulator,
    [
      "--testrunner",
      "--timeout=30",
      "--enableStdout",
      "--debug.scriptWindow.allowIoOsAccess=true",
      join(dir, "gallery.sfc"),
      resolve("scripts", script),
    ],
    dir,
    { ...process.env, SNES_GRAPH_TEST_OUTPUT: dir },
  );
  console.log(`Verified ${name}: ${dir}`);
  return dir;
}
function same(dir: string, a: string, b: string) {
  if (
    !readFileSync(join(dir, a + ".png")).equals(
      readFileSync(join(dir, b + ".png")),
    )
  )
    throw new Error(`${a} differs from ${b}`);
}
const football = footballProject();
const dir = run(
  "football",
  football,
  defaultExport(football),
  "verify-gallery.lua",
);
same(dir, "scene-paused", "scene-restored");
run(
  "football-en",
  football,
  defaultExport(football),
  "verify-gallery.lua",
  120,
  "en",
);
const large = footballProject(),
  map = large.maps[0],
  cell = map.cells[0];
map.name = "Grande carte 129 × 97";
map.width = 129;
map.height = 97;
map.cells = Array.from({ length: 129 * 97 }, (_, i) => ({
  ...cell,
  tile: ((i % 129) + Math.floor(i / 129) * 3) % 2,
}));
map.animatedTiles = [{ tile: 0, frames: [0, 1], ticks: 3 }];
run(
  "large-map",
  large,
  { ...defaultExport(large), actorIds: [], gallerySceneIds: [] },
  "verify-gallery-maps.lua",
);
const effects = loadProject(
    new Uint8Array(readFileSync("examples/mode7.snesgraph")),
  ),
  hdma = loadProject(new Uint8Array(readFileSync("examples/hdma.snesgraph")));
for (const kind of [
  "palettes",
  "sheets",
  "actors",
  "maps",
  "scenes",
] as const) {
  const combined = new Map(
    [...effects[kind], ...hdma[kind]].map((resource) => [
      resource.id,
      resource,
    ]),
  );
  (effects[kind] as { id: string }[]) = [...combined.values()];
}
effects.exports = [];
const effectsDir = run(
  "effects",
  effects,
  { ...defaultExport(effects), actorIds: [], mapIds: [] },
  "verify-gallery-scenes.lua",
  40,
);
same(effectsDir, "mode7-paused", "mode7-restored");
same(effectsDir, "hdma-paused", "hdma-restored");

const sprites = footballProject();
const actor = sprites.actors[0];
// Distinct crops expose pose tables that accidentally address another pose's tiles.
actor.poses[0].pieces = [actor.poses[0].pieces[0]];
actor.poses[1].pieces = [actor.poses[1].pieces[1]];
actor.poses.push({ ...actor.poses[0], id: "third-pose", name: "Third pose" });
const frames = actor.poses.map((pose) => ({
  poseId: pose.id,
  ticks: 2,
  event: "",
}));
actor.animations = [
  { id: "loop", name: "Loop", loop: true, pingPong: false, frames },
  { id: "ping", name: "Ping pong", loop: true, pingPong: true, frames },
  { id: "once", name: "Once", loop: false, pingPong: false, frames },
];
sprites.scenes = [];
sprites.actors.push({
  ...actor,
  id: "second-character",
  name: "Second character",
});
const spriteDir = run(
  "sprites",
  sprites,
  { ...defaultExport(sprites), mapIds: [], gallerySceneIds: [] },
  "verify-gallery-sprites.lua",
);
same(spriteDir, "sprite-245", "sprite-290");
