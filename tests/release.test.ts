import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkRelease } from "../scripts/release-check";
import { version } from "../package.json";

describe("Release guard", () => {
  it("requires an annotated matching tag checked out on main history", () => {
    const root = mkdtempSync(join(tmpdir(), "snes-release-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, stdio: "pipe" });
    try {
      mkdirSync(join(root, "src-tauri"));
      for (const file of [
        "package.json",
        "package-lock.json",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
        "src-tauri/tauri.conf.json",
      ])
        cpSync(file, join(root, file));
      git("init", "-b", "main");
      git("config", "user.name", "Release test");
      git("config", "user.email", "test@example.invalid");
      git("config", "commit.gpgsign", "false");
      git("config", "tag.gpgsign", "false");
      git("add", ".");
      git("commit", "-m", "Fixture");
      git("update-ref", "refs/remotes/origin/main", "HEAD");
      git("tag", "-a", `v${version}`, "-m", "Release");
      expect(checkRelease(`v${version}`, root)).toBe(version);
      expect(() => checkRelease(`v${version}-rc.1`, root)).toThrow("stable");
      git("tag", "v9.0.0");
      expect(() => checkRelease("v9.0.0", root)).toThrow("annotated");
      git("tag", "-a", "v8.0.0", "-m", "Wrong version");
      expect(() => checkRelease("v8.0.0", root)).toThrow("does not match");
      git("switch", "-c", "develop");
      writeFileSync(join(root, "change.txt"), "unreleased");
      git("add", ".");
      git("commit", "-m", "Not on main");
      expect(() => checkRelease(`v${version}`, root)).toThrow(
        "Checkout must match",
      );
      git("tag", "-a", "v7.0.0", "-m", "Off main");
      expect(() => checkRelease("v7.0.0", root)).toThrow();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
