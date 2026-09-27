# CI and releases

Read [the release procedure](../docs/releasing.md). Keep two workflows: read-only
CI and tag-triggered delivery. Build Windows x86-64 NSIS, Ubuntu 24.04 x86-64
DEB/AppImage and Fedora 44 x86-64 RPM. Keep expected artifacts mandatory.
Only the release publication job may write repository contents. Require an
annotated stable tag matching the application version and belonging to `main`.
Publish only complete releases. Never overwrite published assets or move tags.
Reuse CI from the release workflow; do not duplicate build recipes.
