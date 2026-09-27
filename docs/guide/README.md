# Maintaining the user manual

Open the [English](en.html) or [French](index.html) manual in a browser. No server, build or dependency download is required. Keep `index.html`, `en.html`, `style.css`, `guide.js` and `assets/` together. The language selector preserves the chapter anchor with JavaScript and remains a normal link without it.

## Editing content

1. Edit affected chapters directly in **both editions**, `index.html` (FR) and `en.html` (EN). Chapters are `<section class="chapter" id="…">`; preserve IDs to keep shared links working.
2. Describe actual behavior, exact command labels in each language, field units, expected results and local limits. Do not infer features solely from the vision in `../specs.md`.
3. Add new chapter links to `#toc`. Search indexes chapter text automatically at load time.
4. Update version/date in headers, footers and provenance where appropriate.
5. Open the local file and check changed sections, links, images and relevant searches. Check narrow layout and print preview when layout changes.

CSS/JS provide presentation, chapter filtering and image magnification only. Content stays readable without JavaScript. Maintain no external library or documentation generator.

## Application source mapping

| Changed source                                                                           | Chapters to review                                                 |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `src/App.tsx`                                                                            | Getting started, interface, projects, resources, import, shortcuts |
| `src/platform.ts`, `src-tauri/src/main.rs`                                               | Desktop/web, files, recovery, launch, ROM                          |
| `src/ui/Drawing.tsx`, `src/core/pixels.ts`                                               | Drawings, layers, selections, transforms                           |
| `src/ui/Palettes.tsx`                                                                    | Palettes, locks, permutation, cycles                               |
| `src/ui/Sprites.tsx`, `src/core/model.ts`                                                | Pieces, variants, poses, animations, boxes, attachments            |
| `src/ui/Maps.tsx`, `src/core/terrain.ts`                                                 | Maps, stamps, terrain, animated tiles                              |
| `src/ui/Scenes.tsx`, `src/core/render.ts`                                                | Scenes, effects, preview scope/limits                              |
| `src/ui/Exports.tsx`, `src/core/snes.ts`, `src/core/scene-export.ts`, `src/core/demo.ts` | Exports, optimization, allocation, ROM, diagnostics                |
| `src/core/import.ts`, `src/core/aseprite.ts`                                             | PNG, Aseprite, conversion, dithering                               |
| `src/core/archive.ts`, `src/core/resources.ts`                                           | Project format, validation, duplication, usages, replacement       |
| `scripts/export.ts`, `docs/formats.md`, `docs/status.md`                                 | CLI, formats, validation limits                                    |

Paths in this table are relative to the repository root.

## Refreshing screenshots

- Use an example-project copy, ideally a 1440 × 920 window, French UI for `assets/` and English UI for `assets/en/`. Initial French captures date from September 26, 2026, English from September 27, under native Fedora/Wayland 0.1.0; later replacements are recorded below.
- Capture the real interface. Do not recreate windows in HTML or present the editor canvas as emulator output.
- Close unrelated dialogs and stop playback for reproducibility. State example changes in captions.
- Keep filenames when image roles remain unchanged. Update `width`, `height`, `alt` and captions when content or dimensions change.
- Keep original PNGs. Put educational annotations in captions or separate diagrams.
- Reopen PNGs/HTML to check readability, framing and absence of private data.

### Capture inventory

Stored resource names remain unchanged in English instructions.

| File                       | Project and route                                | State                                                                  |
| -------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `01-dessins.png`           | Football → Drawings → Joueur                     | Domicile palette, grid, 1000% zoom                                     |
| `02-palettes.png`          | Football → Palettes → Domicile                   | Entry 1 selected                                                       |
| `03-palette-exterieur.png` | Football → Palettes → Extérieur                  | Entry 1 selected                                                       |
| `04-sprites.png`           | Football → Sprites → Joueur                      | Initial pose, Marche, stopped                                          |
| `05-variantes.png`         | Same workspace → Compare                         | Original, Domicile, Extérieur                                          |
| `06-cartes.png`            | Football → Maps → Terrain                        | Inspector at top, 200% zoom                                            |
| `07-metatiles.png`         | Same workspace                                   | Inspector at bottom, no added resources                                |
| `08-scenes.png`            | Football → Scenes → Match                        | Frame 0, 200% zoom                                                     |
| `09-export.png`            | Football → Export                                | All resources; no scene                                                |
| `10-rom.png`               | Football → Export → Match scene                  | Temporary export set, tools expanded; then undo without saving example |
| `11-creation.png`          | Football → Maps → +                              | Dialog only, creation not confirmed                                    |
| `12-usages.png`            | Football → Maps → Terrain → Uses and replacement | Dialog only, no replacement                                            |
| `13-mode7.png`             | `examples/mode7.snesgraph` → Scenes              | Frame 0, inspector at top                                              |
| `14-hdma.png`              | `examples/hdma.snesgraph` → Scenes               | Frame 0, inspector at top                                              |
| `15-effets-reglages.png`   | Same HDMA project                                | Inspector at bottom, wave/iris parameters                              |
| `16-mode7-reglages.png`    | Mode 7 → Scenes                                  | Inspector at bottom, angle/scale/perspective/horizon                   |

Four inline SVG diagrams explain resource dependencies, the cost of 100 tiles, Marche timing and HDMA channel allocation. Values are calculated explanations, not measurements.

## Publication

The manual opens directly from disk. Hosting requires only static files. It uses no account, cookies, remote service or server-side search; search operates on already-loaded text.

Links to the root README, `docs/formats.md`, `docs/status.md` and `examples/` assume the existing tree. When publishing the guide alone, adapt links or supply linked documents alongside it. Manual text, screenshots, tables and diagrams are otherwise self-contained.

Print / PDF uses the browser dialog, not a versioned repository PDF. If a PDF is later distributed, record its date separately and inspect pages after updates.

## Initial-edition checks

September 26, 2026:

- 20 chapters, 33 tables, 16 native screenshots and four SVG diagrams; about 13,000 words.
- HTML structure, unique IDs, internal anchors, local linked files and alt text checked; no missing local links.
- JavaScript checked with `node --check`; documents formatted with project Prettier.
- Chrome `file://` reading: welcome, Palettes, resource diagram/table, “CGRAM” search (six chapters), reset, screenshot magnification/closure.
- Compact layout observed at 150% in a 921-pixel window with contents opened: CSS breakpoint verification, not physical-mobile testing.
- Print dialog opened after filtering: complete manual restored (52 pages with that session's settings), cover inspected. No distributed PDF or exhaustive printed-page visual audit claimed.

Commands were described from application source, supplemented by the recorded captures/actions. This documentation work is not exhaustive validation of all graphics, exports or platforms.

## Update: expanding a drawing

`17-ajouter-tiles.png` shows `examples/football.snesgraph`, Drawings → Terrain, after **+ Tile row** (16 × 16 pixels). Native Linux capture; changes undone without saving. The library button now says **+ New**; older images may show the previous icon.

Native check: add row, add column (24 × 16), undo twice to 16 × 8, then open the + New dialog. Web/native builds and 18 tests passed.

## Detailed interface pass — September 26, 2026

The manual then contained 20 chapters, 55 tables, 17 overviews, 197 focused captures and four SVG diagrams. Ten drawing tools and commands from six workspaces are illustrated with effects, scope and football examples. Creation/PNG import dialogs are also detailed.

Crops live in `assets/ui/`. `capture-regions.json` maps crop names to source images and `[left, top, right, bottom]` pixel rectangles. Additional sources use `source-`; other sources are overviews in `assets/`.

1. Reproduce the state on a football-project copy, native 1440 × 920 window, in each affected language.
2. Save and inspect the actual source screenshot. Adjust manifest rectangles if controls moved.
3. Crop without redrawing buttons, e.g. Pillow `Image.open(source).crop(box).save(destination)`.
4. Update `<img>` dimensions/alt text and `data-zoom` link `data-caption`.
5. Check the table and enlargement in a browser. Images load immediately for printing even in search-hidden chapters.

### Additional source-capture states

All routes used a Football copy; temporary additions were undone and dialogs closed without applying.

| Source in `assets/ui/`                                                                   | State to reproduce                                                                         |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `source-dessin-terrain.png`, `source-dessin-selection.png`                               | Drawings → Terrain, inspector top then bottom; 1000% zoom                                  |
| `source-calques.png`                                                                     | Terrain → + Layer; Base and layer 2, second selected                                       |
| `source-cycle.png`                                                                       | Palettes → Domicile → entry 1; enabled cycle 1–15, 8 ticks; inspector bottom               |
| `source-variante-piece.png`, `source-piece.png`                                          | Sprites → Joueur → Extérieur variant; first head piece selected; inspector top then center |
| `source-collision.png`, `source-attache.png`                                             | Add default collision (0, 0, 16, 16), then attachment (0, 0); inspector bottom             |
| `source-tile-animee.png`                                                                 | Maps → Terrain → Animate tile 0; sequence 0, 8 ticks                                       |
| `source-carte-remplir.png`, `source-carte-prelever.png`, `source-carte-selectionner.png` | Maps → Terrain; select fill, sample and selection tools without painting                   |
| `source-bg.png`                                                                          | Scenes → Match; BG1 inspector section                                                      |
| `source-instance.png`                                                                    | Match → first instance expanded; position 88, 130, zero speeds                             |
| `source-melange.png`                                                                     | Match → inspector bottom; no color math                                                    |
| `source-cgram.png`                                                                       | Match → add Domicile reservation, OBJ, slot 0                                              |
| `source-gradient.png`                                                                    | Match → add default gradient, channel 0                                                    |
| `source-import.png`                                                                      | Import PNG rendered from Joueur; new palette, no dithering/adjusted pixels; do not apply   |
| `source-creation-dessin.png`                                                             | Drawings → + New; empty name, 32 × 32, 4 bpp; do not apply                                 |

Overviews 01, 02, 04, 06, 07, 08 and 09 were refreshed with **+ New**. ROM, wave/iris and Mode 7 settings reuse older images of unchanged fields. Manifest rectangles are authoritative.

### Checks for that pass

- Linked files, anchors, IDs, alt text, dimensions, crop/source correspondence, JavaScript syntax and document formatting checked.
- Chrome disk reading: drawing tools, inspector, palettes and slicing; button enlargement opened/closed.
- Compact view at 300% in a 1878-pixel window with contents open; French “tramage” search returned two chapters.
- Print preview: cover and illustrated table page checked, not every page or a distributed PDF.

That pass did not change the application or add documentation dependencies.

## Initial review corrections — September 26, 2026

Targeted edits covered save/recovery, Shift shortcuts, map-selection bounds, tileset changes, poses after undo, palette permutation, indexed/grayscale PNG and color-key transparency. Export links to tile mappings in `../formats.md`. Commands/labels stayed unchanged, so existing screenshots were retained.

Validation: 32 automated tests and TypeScript/Vite build passed. Chrome workflows: Ctrl+Shift+Z, Ctrl+Shift+S, recovery then edit/undo with save warning, animation creation/undo then rename, pose duplication/undo then slicing, map reduction from 32 to 16 columns after selecting column 20 followed by stamp capture/save. Save interleavings also checked with controlled deferred writes; this was not real disk-failure testing.

## English edition — September 27, 2026

`en.html` reproduced 20 chapters, 55 tables, four SVG diagrams and 214 illustrations. Captions, alt text, manual commands and search results were translated. Stored project names (Joueur, Domicile, Extérieur, Terrain, etc.) remain unchanged and are explained in the English welcome.

The 17 overviews and sources of 197 crops were **recaptured in the rebuilt native English application**. Routes used copies of football, Mode 7 and HDMA without saving changes to repository examples. Additional sources are `assets/en/ui/source-*.png`. `capture-regions-en.json` has language-specific rectangles: English labels move controls, so do not blindly copy French rectangles. `bg-ajouter` uses `source-melange.png`, where the button is fully visible. Values/routes match the French inventory; sprite fields use the right half of the head (source X = 16).

Update both texts and affected images for each user-visible change. Preserve matching chapter/subsection IDs so language switching retains position. Edit both HTML files directly; no generator or intermediate translation dictionary. CSS/JS are shared. Linked technical documents are now maintained in English; they retained their previous languages at this historical checkpoint.

Checks: anchor/local-file integrity, chapter/table/diagram/illustration parity, alt text, dimensions, JS syntax and formatting. All 197 English crops inspected on contact sheets; native sources observed during capture. Firefox `file://`: welcome, palettes, tool table, FR↔EN switching preserving chapters, English “HDMA” search (five chapters), reset and button enlargement with English caption. Print preview after filtering restored the complete document; cover inspected, without physical printing or exhaustive page checking.

French “CGRAM” search also verified (six chapters). Compact menu/language selector opened at 260% in a 1878-pixel Firefox window (about 722 CSS pixels), then restored to 100%. This checks a breakpoint, not a physical mobile device.

## Improvement: workflows and resources

`18-resource-workflow.png` FR/EN: Chrome web, 1878 × 867. Built-in example → Maps → Create a tile → Back to map. Terrain grows from 16 × 8 to 16 × 16; brush selects tile 2. Browser-controlled route observed and both images inspected. Resource-management tests and web build passed.

## Improvement: dimensions

`19-sheet-layout.png` FR/EN: Chrome web, 1878 × 867; built-in example, Joueur → Dimensions and layout → five columns, six rows, bottom-right anchor. Reducing to one column rejected (fragmented piece); expansion applied then undone in one step, observed in UI. Remapping tests/build passed.

## Improvement: palettes and variants

`20-palette-compare.png` FR/EN: Chrome 1878 × 867, Palettes → Compare and remap → second example palette → drawing preview; center scrolled to show rendering and table start. Resource names unchanged. Captures inspected; pixel/layer/lock test and web build passed.

## Improvement: assembly and animation

`21-animation-edit.png` FR/EN: Chrome, example → Sprites → visible sequence. Duplicate second frame: duration 8 and `step` event retained; undo observed. Images inspected. Targeted tests: moving a sequence selection and validating all destination groups before mutation.

## Improvement: map regions

`22-map-region.png` FR/EN: Chrome 1878 × 867, Map, initial 2 × 2 selection, Copy and transform → Copy → Rotate 90° → Preview. Pattern already has a flipped equivalent (zero new tiles). Images inspected. Tests: rectangular pixel-exact rotation, independent animation, rejection without mutation and overlapping movement.

## Batch 6 — memory diagnostics

`23-scene-analysis.png` FR/EN: Chrome web, Football → Scenes → Memory and temporal analysis → Calculate memory at this frame. Two-frame analysis observed: 12 OBJ, four per line, eight slivers, VRAM extent 17,280 bytes. Captures 1878 × 867. Export-compiler comparison and overloaded-instance attribution covered by two targeted tests; build passed.

### 24 — Reimport review

Open a Football copy, select Joueur, reimport drawing using `examples/reimport-review.png`; keep dithering disabled. Capture FR then EN dialog: 64 adjusted alpha pixels, changed tile 5, Joueur usage. Input is an internal-example variant, no third-party resource.

### Integration examples

`integration-examples` section exists in both languages. Sources/Mesen recipe: `examples/integration/README.md`. Measurements and validation limits: `docs/evolution-validation.md`. Emulator captures remain test artifacts.

### Capture 25 — collision handles (FR and EN)

Football, Sprites, first pose: add 16 × 16 collision at (0, 0), select piece 1 underneath. Enable playback range and add a third frame. Capture yellow handles, outline and piece properties in each language (`25-collision-handles.png`). Local Chrome 1878 × 867, September 27, 2026 review.

## Interactive gallery — September 27, 2026 captures

Current workflow is documented under `#rom` and `#galerie-manette`, identical FR/EN anchors. `09-export.png`, `10-rom.png`, `11-gallery-export.png` and English equivalents came from the **then-current web version**, viewport 1440 × 920. Older native images do not prove gallery availability in an installed binary.

Recipe: open Football from Drawings, then Export. For 09, retain all resources and Interactive Gallery and show workspace top. For 11, scroll to ROM commands, keep Match checked in gallery scenes and duration 120. For 10, select Looping Scene with Match as reference; the web button becomes available. This creates a temporary export set (“Main export” in the English route). Undo afterward; no example file changed.

`12-gallery-rom.png` and `13-gallery-info.png` are real Mesen 256 × 224 captures of the home menu and actor Start panel. English images come from an English-generated ROM without retouching. Reproduce with `node --import tsx scripts/verify-gallery.ts /path/to/Mesen`; use `home.png` / `sprite-info.png` from `football` and `football-en` under `artifacts/gallery-validation/`.

UI checks: worker export reached “Export saved”; Looping Scene unavailable without a reference and available with Match. Native compilation settings were unchanged; no new native-binary screenshot was claimed.

Both manuals opened in a browser: new sections, enlargement and language switching preserving ROM anchor checked. Anchors/image paths checked in both editions.

### Logo and ASCII text — September 27, 2026

12/13 FR/EN refreshed from the same Mesen routes: four-square icon at bottom right, X marker and ASCII letters/digits/spaces. Images inspected; FR/EN links/anchors checked statically. HTML not visually reopened in that pass because the embedded browser rejected file URLs. Layout unchanged.

## Help and version 0.2.0 — September 27, 2026

Help/rename passages corrected in both editions, retaining `#aide` and `#raccourcis`. `01-dessins.png`, `26-help-menu.png`, `27-about.png` and `28-rename.png` FR/EN came from the **rebuilt native 0.2.0 binary**, window 1440 × 957 including a 37-pixel title bar. Built-in Football, no example-file changes. Recipe: open example, choose FR/EN, open Help, About, then click project title. Images inspected.

Observed native route: release notes (current expanded, history collapsed), About, version-copy confirmation, bundled notices; independent French manual with illustrated chapter, switch to Sprites while manual stays open, reopen preserving chapter, switch to English reusing the window, close independently. Native keyboard controller timed out; this did not validate native shortcuts. Dialog Cancel checked by mouse.

Vite copies manuals and local links into distribution. Project/compilation commands remain main-window-only. Project format version is independent of application version.

Additional checks: rename with Enter, cancel with Escape and undo observed in web UI. Tab reuse covered by targeted test; secondary tab unavailable for embedded-browser inspection. Both built manuals' 108 anchors and 498 links checked with FR/EN parity. New captures included in native rebuild.

New passages/images subsequently read in the bundled native 0.2.0 manual; Help screenshot enlargement/closure checked. Local evidence: `artifacts/help-validation/manual-fr.png` (not distributed).

## English defaults and delivery — 0.2.1

English is now the default on first launch; saved French preferences remain valid. Both manual URLs, anchors and screenshot directories remain unchanged. Installation/download and CLI-default instructions are updated in both editions. Historical screenshots above retain their recorded version and provenance; they do not prove 0.2.1 package validation. Release checks are recorded in `../releasing.md`.

Validation of this update: both Getting started sections were visually inspected in the browser. The default English UI and a saved French preference surviving reload were observed. Each manual retains 108 matching anchors; all 499 links in each edition resolve locally or are external URLs. No screenshot depicts a new control: the changed defaults and installation instructions are text, so historical screenshots were retained with their provenance.

## Blue gallery menu — September 27, 2026

Both `12-gallery-rom.png` captures were refreshed from the Football example in Mesen 2.2.1 at the native 256 × 224 resolution. The English and French gallery exports are in `artifacts/blue-gallery/` and `artifacts/blue-gallery-fr/`. Export the example with `scripts/export.ts --gallery --rom` and the corresponding `--language en` or `--language fr` option, then run `scripts/verify-gallery.lua` with Mesen's `--testrunner` and `SNES_GRAPH_TEST_OUTPUT` pointing to the export directory.

Both 520-frame controller journeys passed: sprites, information panels, maps, scenes and return to the menu. The new menu and category previews were inspected in real emulator captures; the English ROM was also opened in the native Mesen window. Preview quantization does not change the opened resources. No physical-console validation is claimed.

Manual QA: both new screenshots opened and closed in the browser lightbox; the French search found the new passage. Matching anchors and local links were checked in both editions.

## Resource cards (concept C) — September 27, 2026

English/French `13-gallery-info.png`, `29-gallery-card-sprite.png`, `30-gallery-card-map.png` and `31-gallery-card-scene.png` were captured from the Football gallery in Mesen 2.2.1 at 256 × 224. Reuse the gallery capture recipe above with output directories `artifacts/card-gallery` and `artifacts/card-gallery-fr`. Both 520-frame journeys passed, including a new assertion that map row 28 is present after scrolling across world row zero. Sprite pose/variant changes, map scrolling, scene pause and restoration after the information panel were inspected in the resulting captures. Original resources were not edited.

Cards use a separate Mode 1 BG3 where safe; unsupported scenes and large sprites retain the full-screen viewer. Scene bars mask pixels instead of scaling the scene. These are real emulator captures, not the earlier generated concept images. No physical-console validation is claimed.

Manual QA: both resource-card passages and sprite lightboxes were checked in the browser; chapter search remains functional. Each edition retains 108 matching anchors and 505 checked links. The native Mesen window was observed running `football-concept-c.sfc`.

## Controller pictograms — September 27, 2026

The five ROM captures (12, 13, 29, 30, 31) in each language were refreshed from `artifacts/button-gallery` and `artifacts/button-gallery-fr`, using the same Football/Mesen capture recipe. Button letters occupy original 12 × 12 pixel faces, the D-pad uses 16 × 16 pixels and Start a 32-pixel-wide capsule. These are native ROM tiles; the generated concept illustrations are not used. Both 520-frame journeys passed. Captures confirm readable menu and resource hints, information panels and unchanged navigation.

Pictogram QA: the English/French information captures were opened in the browser lightbox, and the new paragraph was found by chapter search. Each edition retains 108 matching anchors and 505 valid links. The native Mesen window was observed running `football-buttons.sfc`.

## Shared gallery frames — September 27, 2026

The five ROM captures in both editions were refreshed from `artifacts/thin-frame-gallery` and `artifacts/thin-frame-gallery-fr`, using the Football/Mesen recipe above. Resource cards and information panels now reuse the home menu's thin outline and square-corner geometry. BG3 uses a reduced border palette. Controller pictograms remain unchanged. Both 520-frame emulator journeys passed; 69 tests and the TypeScript/Vite build passed. No physical-console validation is claimed.

Frame QA: English/French map lightboxes opened and closed successfully; French chapter search found the updated text. Both editions retain matching anchors and valid local links. The native Mesen window was observed running football-thin-frames.sfc.

## Information-panel alignment — September 27, 2026

The English/French 13-gallery-info.png captures were refreshed from artifacts/aligned-gallery and artifacts/aligned-gallery-fr with the existing Football/Mesen recipe. Information-panel labels now start four pixels below the top of their 16-pixel pictograms, aligned with the letters inside the buttons. Sprite, map and scene information captures were inspected. Both 520-frame Mesen journeys, 69 tests and the TypeScript/Vite build passed. Frames and controller behavior remain unchanged. No hardware validation is claimed.

The updated information captures were inspected in both browser lightboxes; opening and closing succeeded. Native Mesen was observed with football-aligned.sfc loaded.

## Sprite preview bounds — September 27, 2026

Gallery thumbnails now rasterize the complete first pose, independently of the editor origin. Existing editor rendering retains its 128 × 128 canvas. Preview rasterization follows gallery resource validation. A regression test covers shifted origins and a 176-pixel-wide pose. All 70 tests and the build passed; the English Football ROM completed the existing Mesen journey in artifacts/review-gallery. Compared home, sprite, information, map, scrolled-map and scene PNGs are byte-identical to artifacts/aligned-gallery, so the current manual captures remain valid. Both editions retain 108 matching anchors and 505 checked links. No console validation is claimed.

## Update: drawing reference images — September 27, 2026

`assets/32-reference.png` (FR) and `assets/en/32-reference.png` (EN) show the web editor in Chromium at 1440 × 920, route `/`, Graphics → Tiles. A temporary project uses a 128 × 128 drawing (16 × 16 tiles), the repository icon `src-tauri/icons/128x128@2x.png` as reference, X/Y 0, displayed width 70 pixels, opacity 65%, grid enabled and zoom 600%. A white rectangle is painted on Layer 2 above the reference. Scroll the right panel to the Reference image heading before capturing. No existing example project was modified. Both captures were visually inspected.

### Reference overflow correction

`assets/33-reference-overflow.png` and `assets/en/33-reference-overflow.png` show the corrected workspace in Chromium at 1440 × 920, route `/`, Graphics → Tiles. Temporary 32 × 32 drawing; same icon PNG; reference width 64, X/Y −16, opacity 50%, zoom 1000%, grid on, one white painted pixel. The full reference remains visible outside the tile grid. Both captures were visually inspected. Browser checks also exercise outside clicks (no painting), painting inside, dragging from outside the grid, resizing with the outside handle, and single-step undo.
