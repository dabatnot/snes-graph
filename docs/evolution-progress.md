# Editor improvements

Accepted plan: eight usable batches, documented in French and English.

- [x] 1. Contextual navigation, library and secondary resource management.
- [x] 2. Resize, crop and reorganize while preserving references.
- [x] 3. Compare, remap and bulk-apply palettes and variants.
- [x] 4. Group assembly, visual attachments and sequence editing.
- [x] 5. Map regions, flips, rotations and seams.
- [x] 6. Navigable diagnostics, memory and temporal analysis.
- [x] 7. Import-loss and reimport-change previews.
- [x] 8. ca65 examples, native Linux checks and performance measurements.
      Native Windows validation remains pending; see `evolution-validation.md`.

Keep format version 1, with optional tile-animation names. No hidden copies to
resolve conflicts: users replace references or repair uses before validation.
Search and sorting, without folders or tags. Preview newly created tiles for map
rotations. Small standalone ca65 ROMs. Each bulk operation is one history entry.
No automatic push or merge.
