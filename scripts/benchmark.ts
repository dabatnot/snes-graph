import { cpus, platform } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import {
  newProject,
  makeSheet,
  makeMap,
  footballProject,
} from "../src/core/model";
import { saveProject, loadProject } from "../src/core/archive";
import { renderMap } from "../src/core/render";
import { objectLoad } from "../src/core/snes";
const p = newProject();
p.sheets = [makeSheet(p.palettes[0].id, 256, 256)];
for (let i = 0; i < p.sheets[0].pixels.length; i++)
  p.sheets[0].pixels[i] = (i * 17 + (i >> 5)) % 16;
p.maps = [makeMap(p.sheets[0], 128, 128)];
p.maps[0].cells.forEach((c, i) => (c.tile = i % 1024));
const archive = saveProject(p);
const sceneProject = footballProject();
const results = [];
for (const [name, action] of [
  ["save 16,384 cells", () => saveProject(p)],
  ["load 16,384 cells", () => loadProject(archive)],
  ["render 1024x1024 pixels", () => renderMap(p, p.maps[0].id)],
  [
    "object load 120 frames",
    () => {
      for (let i = 0; i < 120; i++)
        objectLoad(sceneProject, sceneProject.scenes[0], i);
    },
  ],
] as const) {
  action();
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    action();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  results.push({
    name,
    medianMs: +times[5].toFixed(2),
    p95Ms: +times[9].toFixed(2),
  });
}
const report = {
  date: new Date().toISOString(),
  node: process.version,
  os: platform(),
  cpu: cpus()[0].model,
  archiveBytes: archive.length,
  results,
};
await mkdir("artifacts", { recursive: true });
await writeFile("artifacts/benchmark.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
