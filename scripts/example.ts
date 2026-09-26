import { mkdir, writeFile } from "node:fs/promises";
import { footballProject } from "../src/core/model";
import { saveProject } from "../src/core/archive";
await mkdir("examples", { recursive: true });
await writeFile("examples/football.snesgraph", saveProject(footballProject()));
console.log("examples/football.snesgraph");
