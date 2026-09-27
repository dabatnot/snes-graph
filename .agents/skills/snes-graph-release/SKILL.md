---
name: snes-graph-release
description: Prepare SNES Graph versions, validate desktop packages, diagnose release failures and publish explicitly authorized stable releases from main.
---

# SNES Graph releases

Read `docs/releasing.md` and `.github/workflows/ci.yml` / `release.yml` before acting.
The procedure and workflows own commands and artifact contracts; do not recreate
parallel release logic. Inspect remote tags and releases before reserving a version.
Keep application versions synchronized with the existing version command and add
bilingual notes to `src/help/releases.ts`; GitHub notes default to English.

Work on develop. Merging to main and pushing an annotated tag require task scope
that authorizes those actions. The tag triggers automatic publication, so do not
push a test tag to validate the workflow. Run local guard tests instead.
Never move a published tag or replace published assets. A failed draft can be
resumed by rerunning the same tagged workflow; diagnose the failure first. Code
changes require a new commit/version, not retargeting an existing release tag.

Check all four packages and checksums. Distinguish compilation, package installation,
headless startup, real desktop behavior and SNES hardware validation. Record missing
platform access and checks honestly. Preserve third-party notices and inspect actual
bundled libraries before redistribution. Do not claim a platform passed from YAML alone.
