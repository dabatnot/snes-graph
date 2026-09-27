# SNES Graph

A SNES graphics editor for Linux and Windows, built with Tauri 2, React, TypeScript and Canvas 2D. Projects stay local in standalone `.snesgraph` files.

[Download releases](https://github.com/dabatnot/snes-graph/releases) · User manual: [English](docs/guide/en.html) · [Français](docs/guide/index.html)

Both manuals work offline and include a language selector. English is the default on first launch; a previously selected French preference is preserved.

## Install

Tagged releases provide x86-64 packages: Windows NSIS `.exe`, Ubuntu `.deb`, Fedora `.rpm` and Linux `.AppImage`, with `SHA256SUMS`. Initial targets are Windows 11, Ubuntu 24.04 and Fedora 44; the AppImage uses an Ubuntu 24.04 baseline. Release availability and current validation are recorded in [status](docs/status.md); a workflow definition alone is not evidence of a successful platform run.

Download from GitHub Releases and verify the file against `SHA256SUMS`. Run the Windows installer, install the Ubuntu package with `sudo apt install ./<package>.deb`, or the Fedora package with `sudo dnf install ./<package>.rpm`. Make the AppImage executable before launching it. Windows installers are currently unsigned; no automatic in-app updater is provided.

## Develop

With Node.js 24 and npm:

```sh
npm ci
npm run dev
```

Open <http://127.0.0.1:1420>. The browser app edits and downloads projects, exports and ca65 sources. The desktop app adds native dialogs, atomic writes, file associations and ca65/Mesen execution.

With stable Rust and [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

```sh
npm run desktop
```

On Fedora, principal development dependencies are `webkit2gtk4.1-devel`, `gtk3-devel`, `openssl-devel`, `librsvg2-devel`, `libappindicator-gtk3-devel`, `patchelf` and C/C++ tools. On Windows, install the MSVC C++ tools and WebView2 described by Tauri.

```sh
npm run bundle:ubuntu     # DEB and AppImage, on Ubuntu
npm run bundle:fedora     # RPM, on Fedora
npm run bundle:linux      # RPM and AppImage, Linux convenience command
npm run bundle:windows    # NSIS installer, on Windows
```

Packages are written under `src-tauri/target/release/bundle`. To run the compiled Linux executable from the repository root:

```sh
./src-tauri/target/release/snes-graph
```

On Linux the executable disables WebKit DMA-BUF rendering by default and selects common system fonts (Liberation, DejaVu and Symbola when installed). These work around two observed Fedora problems: a Fontconfig loop and a Wayland protocol error leaving an empty window. No system settings change. Existing `FONTCONFIG_FILE` and `WEBKIT_DISABLE_DMABUF_RENDERER` values take priority. Limited font selection can exclude characters; set `FONTCONFIG_FILE=/etc/fonts/fonts.conf` to use the full system collection. See [Tauri Linux graphics troubleshooting](https://v2.tauri.app/develop/debug/linux-graphics/).

AppImage commands preserve bundled-library symbols with `NO_STRIP=1` to avoid linuxdeploy's strip incompatibility with recent Fedora libraries' `.relr.dyn` sections. This setting is [supported by linuxdeploy](https://github.com/linuxdeploy/linuxdeploy/issues/72).

## Use the editor

- **Drawings:** indexed pixels, pencil, eraser, shapes, fill, selections, lasso, movement, symmetry, layers, seamless preview, PNG and Aseprite.
- **Palettes:** names, SNES colors, entry names, locks, duplication, gradients, remapped reordering and cycles.
- **Sprites:** pieces, movement/groups, poses, animations, events, collisions, attachments and palette variants.
- **Maps:** painting, fill, palettes/attributes, captured metatiles, terrain connections and animated tiles.
- **Scenes:** modes 0–7, layers, camera, instances, OBJ sizes, priorities, color math, mosaic and per-line effects.
- **Export:** saved sets, deduplication, documented SNES data/metadata, scene memory and preview ROMs.

Sprite palettes contain **16 entries: transparency at index 0 and 15 visible colors**. Variants share drawings and animations. **Open football example** shows the stored Home/Away variants together; existing resource names such as Domicile and Extérieur remain unchanged.

`Ctrl+S` saves, `Ctrl+Shift+S` saves as, `Ctrl+O` opens, `Ctrl+Z` undoes and `Ctrl+Shift+Z` redoes. Double-click a piece to open its drawing; **Back to character** returns to assembly. Referenced resources cannot be deleted until their uses have been replaced.

Open the example projects in `examples`: `football.snesgraph`, `mode7.snesgraph` (rotation/perspective) and `hdma.snesgraph` (gradient, wave and iris).

## Command-line export

```sh
npm run example
npm run export -- examples/football.snesgraph artifacts/football --scene Match
npm run export -- examples/football.snesgraph artifacts/football --scene Match --rom
npm run export -- my-project.snesgraph output --set "Main export"
npm run export -- examples/football.snesgraph artifacts/gallery --gallery --rom
npm run export -- examples/football.snesgraph artifacts/gallery-fr --gallery --language fr
```

`--rom` uses ca65/ld65 on PATH. Their paths and the emulator path are configurable in the native Export workspace. Two modes are available: looping scene and interactive gallery of selected actors, maps and scenes. The gallery uses controller port 1, includes dependencies automatically and scrolls large maps. It provides no game logic. `--gallery` writes sources; `--gallery --rom` builds `gallery.sfc`. It cannot combine with `--scene`. Menus follow `--language fr|en`, defaulting to English.

CLI and worker share `exportProject`, `demoSources` and `gallerySources` according to the selected mode. Resource paths use stable IDs; readable names and mappings remain in `manifest.json`.

## Checks and documentation

```sh
npm test
npm run build
cargo check --locked --manifest-path src-tauri/Cargo.toml
```

- [Project and export formats](docs/formats.md)
- [Implementation, checks and limitations](docs/status.md)
- [Functional vision](docs/specs.md)
- [Release procedure](docs/releasing.md)

The editor is a working preview. ROMs permit separate emulator verification; no real-console validation is claimed.

## Organization

`src/core` contains data, codecs, importers, rendering and export without React/Tauri dependencies. `src/ui` contains workspaces. `src/App.tsx` manages projects, history and navigation. `src/platform.ts` handles I/O. The small Rust host under `src-tauri` handles native files and processes.

The football artwork and application icon were created for this project; no commercial-game assets are supplied.

Standalone ca65 examples: `npm run examples:integration` (cc65 required), see [instructions](examples/integration/README.md). Reproducible measurements: `npm run benchmark`, results under `artifacts/benchmark.json`.

## Help and versions

**Help** opens the offline English/French manual in an independent window, release notes, About and licenses. Click the project name in the top bar to rename it (Enter, Escape and history undo supported).

The application version comes from `package.json`, independently of the `.snesgraph` format:

```sh
npm run version:set -- 0.2.1
npm run version:check
npm run --silent release:notes -- --version 0.2.1
npm run --silent release:notes -- fr --version 0.2.1
```

Add bilingual text to `src/help/releases.ts` before delivery. Markdown is generated from that source. Omit `--version` for the complete history. Reconstructed historical entries are not published versions. Use patch versions for fixes and minor versions for feature sets. Builds and CI check npm, Rust, Tauri and lockfile agreement. Work on `develop`; annotated stable tags from `main` trigger automatic publication after all required packages pass.

SNES Graph and supplied assembly generators are [MIT licensed](LICENSE). User creations retain their own licenses. [Third-party notices](licenses/README.md) ship with the manuals. Inspect actual native package contents before redistribution; inventories of older binaries are not proof of current installer contents.
