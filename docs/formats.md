# SNES Graph formats, version 1

## `.snesgraph` project

Standalone ZIP archive; reopening requires no source path:

```text
project.json
pixels/<sheet-id>.bin
layers/<sheet-id>/<layer-id>.bin  # when the drawing has layers
references/<sheet-id>.png        # optional original reference image
```

`project.json` carries `format: "snes-graph"`, `version: 1`, name, 50/60 Hz rate and lists of palettes, drawings, actors, maps, scenes and export sets. References use IDs. Unknown versions are rejected.

Pixels are byte indices in row-major order, without planar compression inside `.bin` files. Drawings retain a flattened image and optional artistic layers. Layers run back to front; index 0 reveals the layer underneath. Their pixels and visibility are preserved in the archive.

Palettes contain 4, 16 or 256 RGB555 words `rrrrr | ggggg << 5 | bbbbb << 10`, entry names and locks. Locks protect editing, not fixed CGRAM assignments. Variants map base palette IDs to replacement IDs.

Imported files are checked before opening: at most 128 MiB uncompressed and 10,000 entries. Native saves use a temporary file on the same volume, synchronized then renamed. Recovery uses the application data directory, or IndexedDB in the browser.

Export sets accept `gallerySceneIds?: string[]`, independently of `sceneId`. An absent field means all scenes for backward compatibility; an empty list means none. New sets select every existing scene by default. Scene deletion/replacement updates these references. The format remains version 1.

## Generic export

All multibyte binary numbers are **little-endian**. Names and IDs are available in `manifest.json`. Allocation API addresses are specified below to avoid byte/word confusion.

Selected resources' dependencies must be checked in the export set, including variant palettes. Missing dependencies produce a named error. Manifest palette order matches logical palette indices in metasprites. CGRAM allocation considers complete palette cycles and off-camera map cells to remain stable during playback.

| File                              | Contents                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `palettes/<id>.pal`               | RGB555 words, including entry 0.                                                                      |
| `tiles/<id>.chr`                  | SNES planar 8 × 8 tiles, 16/32/64 bytes per tile at 2/4/8 bpp.                                        |
| `maps/<id>.map`                   | Tilemap words in 32 × 32 blocks, ordered left to right then top to bottom.                            |
| `maps/<id>.collision`             | One byte per cell, row-major order; game-defined interpretation.                                      |
| `sprites.chr`                     | OBJ 4 bpp tiles on two 16 × 16-tile pages; multitile pieces have a 16-tile row stride.                |
| `actors/<actor>/<pose>.meta`      | Metasprite pieces relative to the origin.                                                             |
| `actors/<actor>/<animation>.anim` | Sequence and durations in console frames.                                                             |
| `assets.inc`                      | ca65 size constants and scene palette slots.                                                          |
| `manifest.json`                   | Names, references, poses, variants, animations, events, boxes, attachments, settings and assignments. |

Tilemap words contain a 10-bit tile index, 3-bit palette, 1-bit priority and horizontal/vertical flips at bits 14/15. Generic maps have their own manifest palette lists. **Shared palette allocation across BG layers belongs to `scene/vram.bin`, not separately exported maps.**

For large maps, generic blocks are the available loading units. Initial scene memory contains a 32- or 64-cell window per axis. The game handles scrolling and streaming.

Deduplication changes only exported files and references, not editable drawings. High-resolution tiles use consecutive pairs; deduplication is rejected to preserve that relationship.

### Tile correspondence after optimization

`manifest.sheets[*].refs` has one entry per source drawing tile in row-major order. `refs[sourceTile]` gives `{tile, flipX, flipY}`: the index in `tiles/<sheet-id>.chr` and flips needed to recover source pixels. This includes reserved tiles and deduplication. For stamp cells, combine their flips with reference flips using XOR.

Manifest `stamps[*].cells[*].tile`, `animatedTiles[*].tile` and `animatedTiles[*].frames` remain **source indices**. Each animation also provides `cellIndices`, positions of map cells using its source tile, calculated as `y * width + x` before optimization. This distinguishes animated occurrences from identical static tiles merged in CHR. Positions refer to the source map, not offsets inside 32 × 32 binary blocks.

Scene memory applies tile animations at the requested tick, including Mode 7. Mode 7 frames requiring tile flips are rejected: disable flip reuse for that mode.

### Metasprite `.meta`

Header: `u16 pieceCount`. Then **10 bytes per piece**, in OAM order:

| Offset | Type | Data                                          |
| ------ | ---- | --------------------------------------------- |
| 0      | i16  | X relative to origin                          |
| 2      | i16  | Y relative to origin                          |
| 4      | u16  | OBJ tile index 0…511                          |
| 6      | u16  | Logical palette index in the manifest list    |
| 8      | u8   | Priority bits 4–5, X flip bit 6, Y flip bit 7 |
| 9      | u8   | Square size in pixels: 8, 16, 32 or 64        |

Logical palette numbers are not hardware slots. The game first applies variant mapping, then the scene-assigned OBJ slot. The tile index high bit becomes OAM attribute bit 0; the palette slot becomes bits 1–3. Size goes into high OAM according to the globally selected size pair.

### Animation `.anim`

Four-byte header: flags `u8` (bit 0 loop, bit 1 ping-pong), reserved `u8=0`, frame count `u16`. Each frame stores a `u16` pose index in the actor's pose list, then a `u16` duration in console frames. Events, names, collisions and attachments stay in the manifest. Ping-pong does not repeat endpoints twice.

## Scene memory

| File                       | Usage                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `scene/vram.bin`           | Complete 65,536-byte image, transfer to VRAM word address `$0000` during forced blank. |
| `scene/cgram.bin`          | 512 CGRAM bytes.                                                                       |
| `scene/oam.bin`            | 544 bytes: 512 low-table and 32 high-table bytes.                                      |
| `scene/layout.json`        | Allocations, palettes, ordered register writes and HDMA settings.                      |
| `scene/hdma-<channel>.bin` | Zero-terminated direct HDMA table.                                                     |
| `mode7.vram`               | 32 KiB of Mode 7 map/pixels interleaved in VRAM words' low/high bytes.                 |

`allocations[].address` is a **byte address** in the VRAM image; divide by two for `$2116`. `palettes[].address` is a CGRAM color index; `slot` is the BG/OBJ attribute slot. `layer=4` means OBJ; 0…3 mean BG1…BG4.

`registers` contains `[cpuAddress, byte]` pairs. Double-write registers appear twice, low byte then high. Sprite sizes, data bases, mosaic, main/subscreens and color math are scene-wide. CGRAM, VRAM or HDMA-channel conflicts block export with a message.

Sky gradients use three channels targeting COLDATA and backdrop color math; this compiler does not combine them with other color math. Waves write BG horizontal scrolling twice. Iris effects use window 1 left/right limits. Mode 7 perspective reserves two channels for matrix coefficients. Offset-per-tile uses BG3 as BG1's offset table; the first left segment follows hardware behavior without an offset. In mode 4, each column selects a horizontal or vertical offset.

## Demo ROM

The generator produces standalone ca65 sources and a LoROM configuration. A 1–600-frame loop updates OAM, CGRAM, registers, HDMA and VRAM differences within the available vertical period. It enforces **4096 DMA bytes per frame** and a conservative instruction/transfer cost estimate, with a shorter window at 239 lines. Excessive transitions are rejected with their frame number. Complete game execution time is not modeled. Initial HDMA activation waits for vblank.

The demo includes build instructions. CLI and native host fix the checksum after assembly. Sources need no engine library; game integration requires a loading strategy of its own.

## Interactive gallery

`gallerySources(project, options, ticks, language)` produces standalone ca65 sources: `main.s`, `lorom.cfg`, internal binary blocks and `README.txt`. Language defaults to English; pass `fr` explicitly for French. Blocks are specific to the gallery program; use generic export for game integration. The worker selects `assets | scene | gallery` explicitly and transfers each ArrayBuffer once even when files share a buffer.

The gallery automatically closes dependencies per entry without adding views for those dependencies. Resources reload separately during forced blank. Sprites use pose/duration tables; maps use a 64 × 32 circular cell window, transferring incoming rows/columns. Animated tiles have separate slots from static tiles even after deduplication. Scenes share the preview transfer compiler with 1–600-frame sequences. The Start panel pauses playback and restores previous state on closing; HDMA resumes only at vblank.

Limit: 4 MiB LoROM, with blocks and DMA sources not crossing banks. Final ROM banks use high addresses to avoid WRAM banks $7E/$7F. Scenes retain the 4096-byte DMA limit and cost checks; maps reserve a conservative animated-transfer budget. 50/60 Hz controls region and vertical budget. CLI and native app fix the checksum after assembly.

## Format references

- [Official Aseprite format](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md): frames, cels, palettes and tags.
- [bsnes PPU registers](https://github.com/bsnes-emu/bsnes/blob/master/bsnes/sfc/ppu/io.cpp): OBJ sizes, VRAM addresses, windows, color math and priority order.
- [bsnes BG rendering](https://github.com/bsnes-emu/bsnes/blob/master/bsnes/sfc/ppu/background.cpp): high-resolution pairs and offset-per-tile.
- [Mesen Lua API](https://github.com/SourMesen/Mesen2/blob/master/Core/Debugger/LuaApi.cpp): capturing emulated ROM output.

`animatedTiles` entries may contain an optional string `name`. Projects without it remain valid; the UI displays the tile number.

Scene-memory `allocations` may include `resource`, the owning drawing/map ID. Global allocations (OBJ, Mode 7 data) need not have one owner. VRAM addresses are bytes; `palettes` addresses remain CGRAM indices (2 bytes per entry).

### Preview ROM branding

Both generators add the 16 × 16 SNES Graph icon, derived from the application icon, to PPU snapshots using free OBJ/VRAM slots. Generic exports and projects are unchanged. OBJ checks include the logo; insufficient memory produces diagnostics. A free palette receives logo colors; otherwise the nearest existing colors are reused. Scene effects still apply.

Gallery text retains only ASCII A–Z, a–z and 0–9. Every other Unicode character becomes a space after NFC normalization. Names truncate at 28 characters without ellipsis. Built-in French labels omit accents; project names remain unchanged. The menu selection marker is X.

## ROM source notices — 0.2.0

Looping Scene and Interactive Gallery ca65 sources include `LICENSE.txt` (MIT), SPDX headers in assembly files and a scope statement in `README.txt`. This licenses the program supplied by SNES Graph, not user graphics or assets. Application version 0.2.0 did not change the `.snesgraph` format.

## Drawing reference images

A drawing may carry an optional `reference` object: `id` (image identity), `name`, `nativeWidth`, `nativeHeight`, `x`, `y`, `width`, `opacity` (0–1), and `visible`. Coordinates and displayed width use drawing pixels, including fractions; height follows the native aspect ratio. The original PNG is stored at `references/<sheet-id>.png`, not in JSON. References retain full color and alpha, are limited to 4096 × 4096, and count toward the 128 MiB project/archive and undo memory limits. Decoded display images are not persisted.

Reference images belong only to the drawing editor. They are omitted from shared rendering, layer flattening and all exports. Drawing duplication includes them; tile arrangement changes leave their placement unchanged. This optional extension keeps format version 1 and reads existing projects without references. Older application versions do not guarantee preservation of references when resaving.
