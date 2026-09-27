---
name: snes-graph-docs
description: Maintain the bilingual static SNES Graph manual and related documents after user-visible feature or command changes. Applies only to SNES Graph.
---

# SNES Graph documentation

Read `docs/guide/README.md` from the repository root for source mappings and capture
recipes. Actual code and UI establish behavior; `docs/specs.md` is a broader vision.
Update affected chapters in both `docs/guide/index.html` (French) and
`docs/guide/en.html` (English), preserving anchors, URLs and the language selector.
Use exact labels in each language and describe defaults, results, undo and limits.
Correct existing instructions rather than only appending release notes.
Update README, status and format documents only when affected. English is the
working-document language and default product language. Keep HTML static/offline.

Use a copy of an example, ideally at 1440 × 920. Capture current real UI in French
for `assets/` and English for `assets/en/`; preserve original example projects.
Inspect each new image, keep meaningful filenames, update captions/alt text and
record settings, route and web/native provenance in the guide README.
If capture is unavailable, finish the text and report the precise missing image.

Inspect changed HTML sections, images, links, anchors and search. Test image
magnification for new captures; check narrow/print views when layout changes.
Format only changed documents. Reuse feature checks; do not rebuild native apps
for text-only work or invent platform validation. Report the manual links and any
remaining checks. Publishing requires authorization in the current task.
