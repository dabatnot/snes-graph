import { cpSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve, relative, isAbsolute, sep } from "node:path";
import type { Plugin } from "vite";

/** Copy the manual's local link graph, preserving its existing relative URLs. */
export function offlineFiles(root = process.cwd()) {
  const seen = new Set<string>();
  const visit = (file: string) => {
    file = resolve(root, file);
    if (seen.has(file)) return;
    const local = relative(root, file);
    if (
      isAbsolute(local) ||
      local === ".." ||
      local.startsWith("../") ||
      local.startsWith("..\\") ||
      !existsSync(file)
    )
      throw new Error(`Missing offline documentation: ${file}`);
    seen.add(file);
    if (!/\.(html|css)$/.test(file)) return;
    const text = readFileSync(file, "utf8");
    const links = file.endsWith(".html")
      ? [...text.matchAll(/\b(?:href|src)=["']([^"']+)["']/g)].map((m) => m[1])
      : [...text.matchAll(/url\(["']?([^)'"\s]+)/g)].map((m) => m[1]);
    for (const link of links) {
      if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(link)) continue;
      const path = decodeURIComponent(link.split(/[?#]/)[0]);
      if (path) visit(resolve(dirname(file), path));
    }
  };
  visit("docs/guide/index.html");
  visit("docs/guide/en.html");
  for (const file of [
    "LICENSE",
    "licenses/third-party.json",
    "licenses/build-tools.json",
    "licenses/README.md",
  ])
    visit(file);
  return [...seen].map((file) => relative(root, file).split(sep).join("/"));
}
export function offlineDocs(): Plugin {
  let outDir = "dist";
  return {
    name: "offline-manual",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      for (const file of offlineFiles()) {
        const target = resolve(outDir, file);
        mkdirSync(dirname(target), { recursive: true });
        cpSync(file, target);
      }
    },
  };
}
