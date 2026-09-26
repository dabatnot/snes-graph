import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { loadProject } from "../src/core/archive";
import { defaultExport, exportProject } from "../src/core/snes";
import { demoSources, fixRomChecksum } from "../src/core/demo";

const [input, destination, ...args] = process.argv.slice(2);
if (!input || !destination) {
  console.error(
    "Usage: npm run export -- project.snesgraph output-dir [--set name-or-id] [--scene name-or-id] [--rom]",
  );
  process.exit(1);
}
try {
  const p = loadProject(new Uint8Array(await readFile(input))),
    sceneArg = args[args.indexOf("--scene") + 1],
    setArg = args[args.indexOf("--set") + 1];
  const scene = args.includes("--scene")
    ? p.scenes.find((s) => s.id === sceneArg || s.name === sceneArg)
    : undefined;
  if (args.includes("--scene") && !scene)
    throw new Error("Unknown scene: " + sceneArg);
  const opt = args.includes("--set")
    ? p.exports.find((s) => s.id === setArg || s.name === setArg)
    : defaultExport(p, scene?.id);
  if (!opt) throw new Error("Unknown export set: " + setArg);
  if (scene) opt.sceneId = scene.id;
  const files = exportProject(p, opt),
    root = resolve(destination);
  for (const [name, data] of Object.entries(files)) {
    const path = join(root, name);
    await mkdir(resolve(path, ".."), { recursive: true });
    await writeFile(path, data);
  }
  if (args.includes("--rom")) {
    const s = scene ?? p.scenes.find((s) => s.id === opt.sceneId);
    if (!s) throw new Error("--rom requires --scene");
    const dir = join(root, "demo");
    await mkdir(dir, { recursive: true });
    for (const [name, data] of Object.entries(
      demoSources(p, s, p.fps * 2, opt),
    ))
      await writeFile(join(dir, name), data);
    for (const [exe, params] of [
      ["ca65", ["main.s", "-o", "main.o"]],
      ["ld65", ["-C", "lorom.cfg", "main.o", "-o", "demo.sfc"]],
    ] as const) {
      const r = spawnSync(exe, params, { cwd: dir, encoding: "utf8" });
      if (r.error || r.status !== 0)
        throw new Error(r.error?.message ?? r.stderr);
    }
    await writeFile(
      join(dir, "demo.sfc"),
      fixRomChecksum(new Uint8Array(await readFile(join(dir, "demo.sfc")))),
    );
  }
  console.log(`Exported ${Object.keys(files).length} files to ${root}`);
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
}
