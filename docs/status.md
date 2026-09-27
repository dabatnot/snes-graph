# Implementation status

Initial status: September 26, 2026. The vision in `specs.md` is broader than a list of controls: a setting's presence alone does not prove console accuracy. Historical validation below retains its original scope; see the final section for the release-pipeline migration.

## Implemented

Tauri/React/TypeScript application, workspaces linked by a shared model, French/English UI, history, recovery, standalone ZIP projects and worker exports. Named 4/16/256-entry palettes; variants sharing pixels and animations. Indexed drawings with layers, selections, transforms and tile-row/column expansion; sprite assembly, animation, collisions and attachments. Maps, metatiles, 16-rule terrains, animated tiles, scenes and effects. PNG and raster Aseprite import, PNG reimport preserving references at unchanged dimensions/depth. Documented binary exports, CLI, ca65 sources and demo ROM.

Modes 0–7 expose settings and memory export. High resolution, direct color, EXTBG, BG1 offsets and HDMA tables have initial implementations. Their verification coverage is detailed below; this is not exhaustive PPU emulation.

## Checks performed

- TypeScript and Vite compilation succeeded.
- `cargo check`, native development build, RPM and AppImage builds succeeded on Fedora/Linux x86-64. Missing development libraries were extracted into a temporary SDK; no system installation was performed. AppImage uses `NO_STRIP=1` for recent Fedora libraries.
- 32 targeted automated tests: bitplanes, archives/references, variants, 64-column tilemaps, deduplication/flips, PNG transparency, CGRAM conflicts, OBJ overflow, ca65 generation, layers, Aseprite import, terrain connections, local occurrences, animated palette reservation/stability, export dependencies and VRAM agreement between export and ROM. These include layer/reference preservation on drawing expansion, indexed/grayscale PNG and color-key transparency, palette permutation, Mode 7 animation and post-optimization references.
- Chrome UI: drawing and undoing a stroke, football loading, assembly, simultaneous variant comparison, instance movement/undo, 50/60 Hz conversion, language switching, worker export, project recovery after reload and saving.
- Native Fedora/Wayland UI: direct launch of rebuilt release binary, opening `examples/football.snesgraph` by argument, drawing display and scene navigation with both outfits visible. Startup uses limited Fontconfig settings and disables DMA-BUF to work around a font-search loop observed in GDB and a Wayland protocol error. These are process-local settings; see README.
- Football ROM assembled with ca65/ld65 and run in Mesen. Frame 40 showed the field and two differently dressed players: emulator evidence for this workflow.
- Two more ROMs assembled and observed in Mesen: rotating/perspective Mode 7 pattern and a scene combining gradient, wave and iris. Mid-first-frame HDMA activation was fixed by waiting for vblank; subsequent runs no longer reported the initial uninitialized reads. Projects are in `examples`.

## Initial review fixes

Review of `develop` against an empty base fixed packed-sample/color-key PNG imports, in-flight/recovered save tracking, Shift shortcuts, pose/animation edit references after undo, selections after map reduction and palette/tileset dependencies. Mode 7 animated tiles resolve at export; the manifest exposes optimized tile mappings and animated occurrences.

No new project format was introduced. Added export-manifest fields are documented in `formats.md`. Observed web regression workflows are recorded in `guide/README.md`. Native binaries and installers were not rebuilt in that pass.

## Known limits

- **Windows:** the initial import `9726792` GitHub Actions workflow succeeded; review fixes were built for the web on Linux. No Windows user workflow was observed here.
- **Native UI:** startup/navigation visually checked on Fedora/Wayland; package installation and native file dialogs need separate checks. Restricted fonts may reduce character coverage.
- **Physical console:** no verification performed.
- **PPU preview:** does not reproduce all timing, interlace or sprite-loss behavior under overload. Priorities and advanced effects need more emulator comparisons. OBJ limits are diagnosed, but exact disappearance order under overload is not guaranteed.
- **Aseprite:** raster layers with normal blending only. Flatten/rasterize groups, special blend modes, Z-order and tilemaps in the source application first. Durations round to console frames; colors convert to the chosen palette.
- **Reimport:** PNG with unchanged dimensions/depth. Flatten layers first. No automatic assembly matching when the source grid changes.
- **Rotation:** drawing rotations require square selections to preserve tile dimensions/references. Flips and movement support rectangular selections.
- **CGRAM:** automatic placement and forced palette/BG/OBJ slots. Conflicts block export; 8 bpp modes use colors that OBJ may also need.
- **Optimization:** export deduplication/flips, regular-slice cost comparison and independent occurrences. No solver guarantees a global memory/OAM/transfer optimum.
- **Large maps:** gallery streams rows/columns and supports controller exploration. Generic exports retain blocks; game streaming remains the game's responsibility. Preview ROMs may reject transitions exceeding DMA budgets. Large maps combined with per-line/per-tile offsets are rejected by scene export; standalone map export remains available.
- **History:** snapshots, up to 50 operations with an estimated 128 MiB retention limit (at least one operation retained). Very large projects still need real memory profiling.

## Check a ROM in Mesen

```sh
npm run export -- examples/football.snesgraph artifacts/football --scene Match --rom
SNES_GRAPH_TEST_OUTPUT="$PWD/artifacts/football" Mesen --testrunner --timeout=15 --enableStdout --debug.scriptWindow.allowIoOsAccess=true artifacts/football/demo/demo.sfc scripts/verify-rom.lua
```

The script needs Lua I/O solely to write its capture/status to the test directory. Mesen test mode does not save that setting. `artifacts/football/mesen.png` is emulated output, not the editor's preview renderer.

## Improvements: navigation and resources

Map → source drawing → return navigation, contextual tile creation, drawing use in maps/sprites, sorting/use filters and navigable usages. Stamps and terrains can be renamed, duplicated and deleted; tile animations named/deleted. Deleting terrain preserves painted pixels or explicitly applies replacement terrain. Creation/return workflow and FR/EN captures verified in Chrome.

Resize with nine anchors, crop, row/column insertion/removal and tile-block swapping. References remap; fragmented pieces or removed references without replacement block the operation. Targeted tests cover rendering/layers, secondary references and rejection without mutation. Expansion/undo observed in Chrome.

Palette comparison and synchronized previews, explicit index remapping, palette application to map regions/piece selections, variant duplication and application to multiple instances of one actor.

Multiple/rectangular piece selection, bulk transforms, draggable origin/attachment/collision markers and group-placement copying. Sequences support selection, duplication/deletion, reordering, common duration, cursor and temporary playback range. Duplication/undo observed in Chrome.

Map regions: copy/move, flips, 90° rotation with preview/deduplication, attribute preservation and explicit map expansion. Transformed cells lose terrain associations. New animated tiles use independent bases. Rotation preview observed in Chrome.

- Batch 6: compiler-derived memory diagnostics, resource links, OBJ lines/contributing instances and cancellable 1–600-frame analysis. FR/EN web UI observed; two targeted tests and build passed.
- Import: original/conversion/loss mask, alpha and padding; reimport shows changed tiles and uses, preserving the palette.

## Interactive gallery — September 27, 2026

Added Interactive Gallery / Looping Scene modes, independent scene selection, per-view dependency closure, port-1 controller and Start panel. Maps are fully explorable through streaming; characters retain animations and variants. CLI accepts `--gallery`, `--rom` and `--language fr|en`.

Reproducible Mesen workflow:

```sh
node --import tsx scripts/verify-gallery.ts /path/to/Mesen
```

Captures/ROMs go under `artifacts/gallery-validation/`. Observed checks cover FR/EN menus, three categories, pause/step, variants, looping/ping-pong/non-looping animations, restarting a finished animation and changing actors without repeating while R is held. A 129 × 97-tile map was explored at all four corners with VRAM-cell checks. Returning from panels for sprites, Football, Mode 7 and HDMA restored captures identical to the paused view. Final runs reported no uninitialized reads.

Web UI: both modes, reference-scene selection and gallery-source worker export verified; “Export saved” observed. FR/EN captures refreshed. Targeted tests also assemble 50/60 Hz sources, small maps and animated maps. No physical-console test; native package was not rebuilt for this feature.

Final validation: 53 tests and TypeScript/Vite build passed; Football Looping Scene CLI export was rebuilt and observed in Mesen (field and two players). A 32 × 24-pixel map was observed centered with an empty border.

After these checks, `src-tauri/target/release/snes-graph` was rebuilt successfully using `tauri build --no-bundle` for local trials. RPM/AppImage installers were not regenerated.

### ROM logo and text

Gallery text restricted to A–Z/a–z/0–9, other characters replaced with spaces; project names unchanged. A 16 × 16 SNES Graph icon overlays both ROM modes and remains subject to scene effects. Existing allocations are respected, nearest colors reused if CGRAM is full, and insufficient VRAM/OBJ diagnosed.

54 tests passed, five Mesen workflows repeated with refreshed FR/EN captures, Looping Scene compiled and run in Mesen. Native release binary rebuilt successfully; installers not rebuilt and no physical-console validation.

## Help, versions and licenses — 0.2.0

- Help menu: independent offline manual, bilingual release notes, About with version/copy, MIT license and third-party notices.
- Rename from project title: confirm, cancel and history undo. Old short help replaced; shortcuts retained in the manual.
- npm version synchronized to Rust, Tauri and lockfiles, checked during build/CI. Reconstructed September 26–27, 2026 commit history does not invent published versions. FR/EN Markdown export.
- Both manuals and all local linked files bundled. Manual window cannot write projects or compile ROMs.
- MIT notices in both ROM generators and assembly examples. User creations retain their own licenses.

Validation: 59 tests passed across 11 files, then targeted Windows-line-ending checks; TypeScript/Vite and Linux release builds succeeded. Targeted version, bilingual-note, offline-file, tab-reuse and license tests passed. ca65/ld65 assembly succeeded for Looping Scene, Gallery and all three integration examples. Checked 108 anchors and 498 links in each built manual; refreshed native FR/EN menu, About, rename and overview captures.

Native workflow: release notes, licenses and notices loaded offline; version copied; independent illustrated manual, reuse preserving reading position, language switching and independent closure observed. Native keyboard control timed out: Enter, Escape and rename undo were observed in the web app. Web tab reuse has a targeted test; the embedded browser did not expose the secondary tab for real observation.

Inventory: production npm dependencies, Linux/Windows Cargo graphs and identified native notices; build tools listed separately. Fedora system libraries are distinguished from bundled components. The inventory does not certify future AppImage/RPM/Windows installers: actual package inspection is required before publication, which was outside that delivery. No Windows or physical-console testing is claimed.

## English defaults and release pipelines — 0.2.1

English is now the first-launch and fallback language; a saved French preference remains supported. CLI and gallery defaults are English. Both manuals remain available at their existing URLs. Project-authored Markdown and repository-local skills are in English; original third-party notices remain unchanged.

CI defines Windows x86-64 NSIS, Ubuntu 24.04 DEB/AppImage and Fedora 44 RPM builds. An annotated stable tag matching a commit on `main` triggers checks and automatic publication of the complete asset set, with English version-specific notes and SHA-256 checksums. See [releasing.md](releasing.md).

Validation for this migration is recorded in the release procedure. Workflow definitions are not evidence of green hosted builds. No public release or tag is created by preparing these changes. Actual publication remains unverified until the first authorized tagged release; Windows 11, Ubuntu 24.04 and Fedora 44 desktop acceptance must be recorded separately.
