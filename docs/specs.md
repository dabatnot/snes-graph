# Functional specifications — SNES graphics editor

This document records the editor vision and named-palette variants discussed on September 26, 2026. It describes the intended product, not the current implementation status.

## 1. Vision and principles

The editor promises to **create SNES game graphics, assemble and animate them, and produce usable game data while making the consequences of each choice immediately understandable**.

Its strength comes from continuity between tools:

- Change a color and see the affected characters and backgrounds.
- Edit a tile and see its uses update.
- Assign another named palette to a character and immediately see its appearance across all animations.
- Add enemies to a scene and see where display limits become problematic.
- Export resources with documented formats and predictable results.

The priority is **palette → tiles → metasprite → animation → scene → export**. Additional tools must enrich an already usable environment.

Follow KISS and YAGNI: meet current needs with the simplest solution, avoiding premature abstractions and components without immediate value. The full vision does not require implementing everything in the first version.

The interface presents what helps users understand, decide and act. Hardware details appear when they explain a choice or problem.

## 2. Workflows and project resources

The editor supports three complementary activities: drawing, composing game graphics and preparing technical integration. Users should move easily between them.

| Resource        | Role                                                                 |
| --------------- | -------------------------------------------------------------------- |
| Palette         | Associate colors with pixel indices.                                 |
| Tileset         | Group reusable graphic tiles.                                        |
| Metatile        | Assemble tiles into scenery motifs: floor, wall, door, etc.          |
| Tilemap         | Place tiles or metatiles to build a background.                      |
| Metasprite      | Assemble hardware sprites into a character or object.                |
| Animation       | Define poses and their durations.                                    |
| Palette variant | Associate shared graphics and animations with another named palette. |
| Scene           | Combine backgrounds, characters, palettes and display settings.      |
| Export set      | Define resources supplied to the game and their organization.        |

A scene represents what must work together at one moment. Projects may contain hundreds of palettes or characters; constraints apply to resources actually used together, not the entire library.

## 3. Named palettes and appearance variants

### 3.1. Palette editing

Palettes are named, shared, reusable resources. Their assignment to a character is independent of its graphics and animations.

Editing includes:

- Color selection, numeric input and eyedropper.
- Gradients and shadow/highlight ramps.
- Copying color groups.
- Locking entries.
- Palette and color names such as skin, outline and light metal.
- Viewing every resource using a palette.
- Comparing palettes on one resource.
- Preparing day, night, poison, ice and costume variants.
- Identifying unused or nearly identical colors.
- Reserving slots for HUD, characters or effects.
- Previewing palette animations.

Users work with SNES-representable colors: 5-bit components, or 32,768 possible values. Palette memory holds 256 entries; usage depends on layers and graphics mode. See the [Fullsnes hardware reference](https://problemkaputt.de/fullsnes.htm#snesppucolorpalettememorycgramanddirectcolors).

### 3.2. Reordering, recoloring and transparency

Reordering and recoloring are distinct:

- **Reorder while preserving appearance:** remap affected pixel indices to preserve rendering exactly.
- **Recolor:** retain indices and change their associated colors.

Transparency and background color are clearly distinguished. Drawing black must never accidentally become transparent.

Palette allocation to console memory happens at scene level, with resource conflict detection.

### 3.3. Switching palettes, creating variants and duplicating palettes

1. **Switch palette:** select another named palette and immediately see the character and all animations update.
2. **Create variant:** create a named character variant sharing graphics and animations, with its own palette assignment.
3. **Duplicate palette:** create a palette from an existing one and edit colors without changing the original.

Palette variants do not unnecessarily duplicate pixels. Drawing or animation corrections benefit all variants sharing those resources.

Editing a palette updates its users. Assigning a different palette to one variant or instance does not change others. The action's scope must be clear: shared palette editing, variant assignment or scene-instance assignment.

### 3.4. Example: football players

| Variant     | Graphics and animations | Palette                     |
| ----------- | ----------------------- | --------------------------- |
| Home player | Football player         | `Équipe France — Domicile`  |
| Away player | The same                | `Équipe France — Extérieur` |
| Goalkeeper  | Goalkeeper graphics     | `Équipe France — Gardien`   |

Home and away players can coexist within the scene's hardware limits. Compatible palettes keep the same role at each index:

| Named slot    | Home        | Away      |
| ------------- | ----------- | --------- |
| Main shirt    | Blue        | White     |
| Shirt shadow  | Dark blue   | Gray      |
| Shirt details | White       | Blue      |
| Skin          | Chosen tone | Same tone |
| Outline       | Black       | Black     |

Changing outfits therefore does not accidentally recolor the face. Names aid understanding; index correspondence determines rendering. Users can compare variants side by side with the same animation.

## 4. Drawing and tile editing

### 4.1. Drawing tools

The foundation includes familiar pixel-art tools:

- Pencil, eraser, fill, eyedropper, lines and basic shapes.
- Rectangular and freehand selections.
- Move, flip, rotate and copy.
- Symmetric drawing.
- Configurable grid, crisp zoom and actual-size preview.
- Color or index replacement.
- Repeated preview for checking background seams.

Users can draw an entire character without working tile by tile; a grid exposes the division when needed.

Standard SNES tiles support 2, 4 and 8 bits per pixel according to their destination. Mode 7 requires special handling. See [graphics memory organization](https://problemkaputt.de/fullsnes.htm#snesppuvideomemoryvram).

### 4.2. Shared resources

When a tile appears in several places, users can **edit the shared tile** and update every use, or **create a local variant** and change only that occurrence. They can locate uses before editing.

Drawing layers may aid creation. Conversion to exportable resources remains explicit: an artistic layer does not necessarily correspond to a SNES hardware layer.

## 5. Sprite assembly

### 5.1. Metasprite composition

A character is a coherent assembly of pieces. Users can:

- Drag tiles or graphic blocks into an assembly area.
- Position pieces precisely or with snapping.
- Assign each piece a palette.
- Set flips and priorities.
- Define the character origin, for example at its feet.
- Group pieces to move a head, arm or weapon together.
- Create attachment points for swords, projectiles or effects.

Hardware sprite decomposition is available on demand. Sizes depend on a shared setting and cannot be chosen independently for every piece. See the [sprite-size register](https://wiki.superfamicom.org/registers#obsel---object-size-and-character-address).

A 32 × 48 character could use six 16 × 16 sprites. Users see the complete character and can show its six constituent rectangles.

### 5.2. Slicing assistance

Assistance presents alternatives and their costs:

| Criterion          | Question                                         |
| ------------------ | ------------------------------------------------ |
| Sprite count       | How many hardware entries are required?          |
| Graphics footprint | How many tiles must be stored?                   |
| Reuse              | Which pieces are shared with other poses?        |
| Scanline load      | Where does the character contribute to overflow? |
| Animation          | How much data changes between poses?             |

Do not call a solution optimal based on one criterion: fewer sprites may require transferring more graphics.

## 6. Animations

The timeline supports named animations such as idle, walk, run, attack and damage:

- Adjustable frame duration.
- Looping, ping-pong and frame stepping.
- Onion skinning.
- Pose duplication and linking.
- Origin synchronization.
- Direction and variant comparison.
- Coordinated palette animation.

A pose can change pieces, positions and attributes while preserving shared elements. A palette variant applies to the entire animation without copying or recoloring every pose.

Collision boxes and event markers such as impact, projectile spawn or footstep aid integration. They are exported; the game defines their meaning.

Durations can use console frames, with 50/60 Hz previews. Conversion preserving elapsed time is explicit.

## 7. Backgrounds, metatiles and tilemaps

The tilemap editor provides painting, stamps, selections, fill and global replacement. Metatiles represent recognizable elements such as platform sections, wall corners, windows and stairs.

Advanced functions include automatic terrain connections, pattern variants to reduce repetition, animated water/lava/vegetation tiles, palette and priority settings per placement, scrolling multilayer previews, optional collision data and map-edge seam previews.

The complete level map is distinct from the portion loaded for display. Users can create large backgrounds; the editor shows resources needed as the camera moves and prepares loading data for the chosen format. The game remains responsible for actual loading.

## 8. Scene composition

Scenes combine backgrounds and layers, character/object instances with variants and palettes, HUD elements, active palettes, animations, simple preview trajectories and display settings.

Users can move a camera, scroll backgrounds and duplicate enemies to inspect the result.

Changing graphics mode explains compatible resources, layer reassignment, required conversion and information loss. Graphics are not silently modified.

Pixel-accurate previews and target-display-aspect previews complement each other. Television effects remain optional and explicitly simulated.

## 9. Graphics modes and advanced effects

The full vision covers modes 0–7: high resolution, direct color, offset-per-tile, Mode 7 transforms, windows and color math. See [PPU documentation](https://problemkaputt.de/fullsnes.htm#snespictureprocessingunitppu).

| Desired effect   | Proposed controls                     |
| ---------------- | ------------------------------------- |
| Gradient sky     | Colors and vertical positions.        |
| Rippling water   | Distortion amplitude and speed.       |
| Parallax         | Relative layer motion.                |
| Iris opening     | Draw and animate a visibility window. |
| Fog or lighting  | Supported color operations.           |
| Mode 7 map       | Center, angle and scale.              |
| Perspective road | Horizon and per-line transformation.  |

Controls produce a preview, required data and integration conditions, especially for HDMA effects. The editor shows shared resources, incompatible settings and occupied channels. Impossible combinations are reported during composition.

## 10. Diagnostics and hardware constraints

Design constraints include 64 KiB VRAM, 128 hardware sprites and two separate per-line limits: 32 sprites and 34 eight-pixel sprite slivers. See [Fullsnes](https://problemkaputt.de/fullsnes.htm) and [overflow flags](https://wiki.superfamicom.org/registers#stat77---ppu-status-flag-and-version).

| Problem                      | Expected response                            |
| ---------------------------- | -------------------------------------------- |
| Incompatible palette         | Select affected pixels or pieces.            |
| Too many sprites on a line   | Highlight the line and contributing objects. |
| Excessive resource size      | Show allocation and largest consumers.       |
| Palette conflict             | Show competing scene resources.              |
| Excessive animation transfer | Identify the transition and changed data.    |
| Missing reference            | Navigate directly to the item to repair.     |

Three statuses suffice: **definite error**, **game-dependent risk**, **optimization suggestion**.

Transfer estimates state their assumptions. The editor calculates known resource costs; available time also depends on the game. Editing and saving remain possible with errors; console exports explain remaining incompatibilities precisely.

## 11. Import and reimport

### 11.1. Formats and conversion

PNG is the first import format, preserving indices for indexed images. Sprite sheets allow grid slicing and animation assignment.

Aseprite integration could preserve frames, durations and animation names using its [documented format](https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md).

For incompatible images, import offers destination palette, colors to preserve, color reduction, optional dithering, slicing and before/after comparison. Color reduction is never silent. Import stays predictable and reversible.

### 11.2. Updating sources

Reimport replaces source drawings while retaining names, origins and assemblies where possible. Uncertain correspondences are presented to the user.

## 12. Export and game integration

Export is part of the product from its first version. Essential outputs are tile, palette and tilemap data. Assemblies, animations and metadata require documented formats suited to their consumers.

[SuperFamiconv](https://github.com/Optiroc/SuperFamiconv) provides a functional reference for conversion, remapping and deduplication.

An export set defines included resources, formats and filenames, data ordering and reservations, code symbols, allowed optimizations, and animation/assembly conventions.

Named palettes and variants remain identifiable in exported data or symbols. The format explains palette selection for shared graphics.

Identical projects/settings produce identical data. Unrelated resource additions must not arbitrarily reorganize existing exports.

A ca65 assembly export is the initial target for the discussed SNES workflow; local tool availability was not verified during this analysis. CLI exports enable game-build integration with the same results as the interface.

## 13. Optimization

The editor can find identical tiles, reusable flipped duplicates where supported, unused resources, redundant colors, shared pose data and layouts reducing transfers. Each operation presents savings, affected elements and consequences.

Two currently identical tiles are not necessarily intended to remain linked during future editing. Distinguish **merging project resources**, which changes editing relationships, from **deduplicating exported data**, which reduces files while preserving independent sources. Optimization preserves author intent and predictable editing.

## 14. Interface and usability

The interface follows the current work object:

| Area                | Purpose                                      |
| ------------------- | -------------------------------------------- |
| Left                | Searchable resource library with thumbnails. |
| Center              | Drawing, assembly, map or scene.             |
| Right               | Selection properties.                        |
| Bottom, when needed | Palette or timeline.                         |

Hardware details are accessible in a contextual inspector and appear automatically when they explain a problem.

Priority interactions: double-click a piece to edit its drawing; return to assembly; find resource uses; replace resources in a selection or project; select a named palette and see immediate results; create a variant from the current resource; compare variants side by side; undo a bulk operation in one step.

History, autosave and recovery after unexpected closure are priorities so users can experiment safely. Omit components unrelated to the current task; the interface must not become a technical demonstration dashboard.

## 15. Verifying exported rendering

The preview uses export-generated data where possible to avoid discrepancies with game assets. Eventually, a command can generate a small scene ROM and open a configured emulator.

Clearly distinguish editor preview, emulator verification and real-console observation. A demo ROM verifies assets in its own context, not the performance of the complete game.

## 16. Implementation order

All three groups below belong to the intended V1 scope; they describe internal sequencing, not a reduction of V1 to the first group. Target Linux and Windows with Tauri 2, TypeScript, React and Canvas 2D, standalone project files and French/English UI. Actual implementation and verification are tracked in [status.md](status.md).

| Stage                     | Contents                                                                                                                                            | Outcome                                                                                       |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Create and export**     | Projects, named palettes, palette switching and simple variants, tile drawing, metasprite assembly, simple animations/tilemaps, documented exports. | Produce animated characters with outfit variants and a background ready for game integration. |
| **Compose and control**   | Scenes, shared resources, metatiles, reimport, diagnostics, memory usage and optimization.                                                          | Prepare coherent graphics and fix problems in context.                                        |
| **Use the whole console** | Advanced modes, Mode 7, per-line effects, color operations, loading scenarios and demo ROM.                                                         | Design complex scenes with data and integration constraints.                                  |

Named palettes and simple variants belong to the functional foundation.

## 17. Reference workflows

1. Recolor a character using a named palette without changing graphics or animations.
2. Create home/away football variants sharing graphics and display both in a scene.
3. Duplicate a palette, recolor the shirt and preserve skin/outline colors.
4. Edit a shared palette and observe its users update without affecting other palettes' users.
5. Fix a tile and locate every affected use.
6. Import an updated character without rebuilding assemblies where correspondence is preserved.
7. Compose multiple enemies and locate display overflow.
8. Export a scene and reproduce its appearance in a demo ROM.

Use these complete workflows for focused checks of useful behavior, without redundant procedures or tests.
