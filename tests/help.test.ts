import { describe, expect, it, vi } from "vitest";
import {
  readFileSync,
  mkdtempSync,
  mkdirSync,
  cpSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkVersion, setVersion } from "../scripts/version";
import { offlineFiles } from "../scripts/offline-docs";
import { releaseMarkdown, releases } from "../src/help/releases";
import { MIT_LICENSE } from "../src/core/license";
import { demoSources } from "../src/core/demo";
import { gallerySources } from "../src/core/gallery";
import { footballProject } from "../src/core/model";
import { version } from "../package.json";

describe("Help and distribution", () => {
  it("synchronizes distribution versions without touching the project format", () => {
    expect(checkVersion()).toBe(version);
    const dir = mkdtempSync(join(tmpdir(), "snes-version-"));
    try {
      mkdirSync(join(dir, "src-tauri"));
      for (const file of [
        "package.json",
        "package-lock.json",
        "src-tauri/Cargo.toml",
        "src-tauri/Cargo.lock",
        "src-tauri/tauri.conf.json",
      ])
        cpSync(file, join(dir, file));
      for (const file of ["src-tauri/Cargo.toml", "src-tauri/Cargo.lock"]) {
        const path = join(dir, file);
        writeFileSync(
          path,
          readFileSync(path, "utf8").replace(/\r?\n/g, "\r\n"),
        );
      }
      expect(checkVersion(dir)).toBe(version);
      setVersion("0.2.1", dir);
      expect(checkVersion(dir)).toBe("0.2.1");
      expect(() => setVersion("invalid", dir)).toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("keeps bilingual notes with reconstructed history separate from releases", () => {
    expect(releases[0].version).toBe(version);
    expect(
      releases
        .slice(1)
        .every((r) => r.version === undefined && r.commits.length),
    ).toBe(true);
    for (const language of ["fr", "en"] as const) {
      expect(
        releases.every((r) => r[language].title && r[language].summary),
      ).toBe(true);
      expect(releaseMarkdown(language)).toContain(version);
      expect(releaseMarkdown(language)).toContain("9726792");
    }
  });
  it("packages the manual link graph and keeps its window unprivileged", () => {
    const files = offlineFiles();
    expect(files).toContain("docs/guide/en.html");
    expect(files).toContain("docs/guide/assets/12-gallery-rom.png");
    expect(files).toContain("licenses/third-party.json");
    const capability = JSON.parse(
      readFileSync("src-tauri/capabilities/default.json", "utf8"),
    );
    expect(capability.windows).toEqual(["main"]);
    expect(capability.permissions).toContain("allow-open-manual");
    expect(capability.permissions).toContain("allow-atomic-write");
    expect(readFileSync("src-tauri/build.rs", "utf8")).toContain(
      "AppManifest::new().commands",
    );
  });
  it("reuses the web manual tab, preserves its anchor and changes language on demand", async () => {
    const tab = { closed: false, location: { href: "" }, focus: vi.fn() };
    const open = vi.fn((url: URL) => {
      tab.location.href = url.href;
      return tab;
    });
    vi.stubGlobal("window", { open });
    vi.stubGlobal("document", { baseURI: "https://example.test/editor/" });
    try {
      const { openManual } = await import("../src/platform");
      await openManual("fr");
      expect(open).toHaveBeenCalledWith(
        new URL("https://example.test/editor/docs/guide/index.html"),
        "snes-graph-manual",
      );
      tab.location.href += "#reperes";
      await openManual("fr");
      expect(open).toHaveBeenCalledTimes(1);
      expect(tab.location.href).toContain("#reperes");
      await openManual("en");
      expect(tab.location.href).toBe(
        "https://example.test/editor/docs/guide/en.html",
      );
      tab.closed = true;
      await openManual("fr");
      expect(open).toHaveBeenCalledTimes(2);
      open.mockReturnValueOnce(null as never);
      await expect(openManual("en")).rejects.toThrow("Allow the manual tab");
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it("licenses both ROM source exports without claiming ownership of user assets", () => {
    expect(MIT_LICENSE).toBe(
      readFileSync("LICENSE", "utf8").replace(/\r\n/g, "\n"),
    );
    const p = footballProject();
    for (const files of [
      demoSources(p, p.scenes[0], 1),
      gallerySources(p, undefined, 1),
    ]) {
      expect(new TextDecoder().decode(files["LICENSE.txt"])).toBe(MIT_LICENSE);
      expect(new TextDecoder().decode(files["README.txt"])).toContain(
        "User graphics and project assets",
      );
      expect(new TextDecoder().decode(files["main.s"])).toContain(
        "SPDX-License-Identifier: MIT",
      );
    }
  });
});
