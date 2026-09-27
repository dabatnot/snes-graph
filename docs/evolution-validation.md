# Improvement validation

Measurements from September 27, 2026, Linux, Node v24.14.0, AMD Ryzen 5 2600 Six-Core Processor.
One warm-up followed by ten measurements; p95 is the maximum of those ten.
128 × 128-cell map, 256 × 256-pixel drawing / 1024 tiles; 50,835-byte archive.

| Operation               | Median (ms) | p95 (ms) |
| ----------------------- | ----------: | -------: |
| save 16,384 cells       |       60.07 |    65.97 |
| load 16,384 cells       |       24.07 |    33.01 |
| render 1024x1024 pixels |      210.36 |   220.32 |
| object load 120 frames  |        3.11 |     4.09 |

These measure the core under Node, not input latency or React rendering. Full large-map rendering takes about 210 ms; this does not support a 60 fps claim. No speculative cache was added. Run `npm run benchmark` to compare on another machine.

## Verified workflows

- Linux Chrome: new interfaces for batches 1–7 exercised; FR/EN captures 18–24 taken. Reimport tile 5, apply, then Undo restored the unchanged state.
- TypeScript/Vite build succeeded; 46 tests passed.
- ca65 examples assembled. Mesen 2.2.1: background observed, two distinct animation positions, palette changed on B press, retained on release and restored on the second press. Captures in `artifacts/integration`.
- Native Linux: release build succeeded, Football opened, field expanded from 16 × 8 to 24 × 8 by adding a column, then Undo restored 16 × 8. Capture: `artifacts/native-linux.png`. This workflow did not validate save/reopen dialogs.

## Native workflows to reproduce

On Linux and Windows: open a project copy, edit a tile, save under a new name, close/reopen and compare; resize then Undo; reimport and check uses; export and open the ROM in Mesen. On Windows, also check paths with spaces and accented characters. No Windows machine was accessible in that session; Windows validation was not performed.
