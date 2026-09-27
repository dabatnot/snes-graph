import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { checkVersion } from "./version";
import { releaseMarkdown } from "../src/help/releases";

export function checkRelease(tag: string, root = process.cwd()) {
  const git = (...args: string[]) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  if (!/^v\d+\.\d+\.\d+$/.test(tag))
    throw new Error("Expected a stable vMAJOR.MINOR.PATCH tag");
  if (git("cat-file", "-t", `refs/tags/${tag}`) !== "tag")
    throw new Error("Release tags must be annotated");
  if (git("rev-parse", `${tag}^{commit}`) !== git("rev-parse", "HEAD"))
    throw new Error("Checkout must match the release tag");
  git(
    "merge-base",
    "--is-ancestor",
    `${tag}^{commit}`,
    "refs/remotes/origin/main",
  );
  const version = checkVersion(root);
  if (tag !== `v${version}`)
    throw new Error("Tag does not match the application version");
  releaseMarkdown("en", version);
  return version;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(import.meta.dirname, "release-check.ts")
)
  console.log(checkRelease(process.argv[2] ?? ""));
