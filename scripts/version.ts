import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function versionFiles(root = process.cwd()) {
  const read = (file: string) =>
    readFileSync(resolve(root, file), "utf8").replace(/\r\n/g, "\n");
  const pkg = JSON.parse(read("package.json"));
  const lock = JSON.parse(read("package-lock.json"));
  const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
  const cargo = read("src-tauri/Cargo.toml");
  const cargoLock = read("src-tauri/Cargo.lock");
  return { pkg, lock, tauri, cargo, cargoLock };
}
export function checkVersion(root = process.cwd()) {
  const { pkg, lock, tauri, cargo, cargoLock } = versionFiles(root);
  const versions = [
    lock.version,
    lock.packages[""].version,
    tauri.version,
    cargo.match(/\[package\][\s\S]*?\nversion = "([^"]+)"/)?.[1],
    cargoLock.match(
      /\[\[package\]\]\nname = "snes-graph"\nversion = "([^"]+)"/,
    )?.[1],
  ];
  if (!versions.every((v) => v === pkg.version))
    throw new Error(
      `Version mismatch: package.json=${pkg.version}, others=${versions.join(", ")}`,
    );
  return pkg.version as string;
}
export function setVersion(version: string, root = process.cwd()) {
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version))
    throw new Error("Expected a version such as 0.2.0");
  const { pkg, lock, tauri, cargo, cargoLock } = versionFiles(root);
  const write = (file: string, value: string) =>
    writeFileSync(resolve(root, file), value);
  pkg.version =
    lock.version =
    lock.packages[""].version =
    tauri.version =
      version;
  for (const [file, value] of [
    ["package.json", pkg],
    ["package-lock.json", lock],
    ["src-tauri/tauri.conf.json", tauri],
  ] as const)
    write(file, JSON.stringify(value, null, 2) + "\n");
  write(
    "src-tauri/Cargo.toml",
    cargo.replace(/(\[package\][\s\S]*?\nversion = ")[^"]+"/, `$1${version}"`),
  );
  write(
    "src-tauri/Cargo.lock",
    cargoLock.replace(
      /(\[\[package\]\]\nname = "snes-graph"\nversion = ")[^"]+"/,
      `$1${version}"`,
    ),
  );
  checkVersion(root);
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.dirname, "version.ts")
) {
  if (process.argv[2] !== "--check") setVersion(process.argv[2] ?? "");
  console.log(`SNES Graph ${checkVersion()}`);
}
