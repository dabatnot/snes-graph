# Release procedure

## Contract

Develop on `develop`, integrate reviewed changes into `main`, then explicitly push an annotated `vMAJOR.MINOR.PATCH` tag. The tag is the decision to publish: GitHub automatically publishes after checks and all four packages succeed. Only stable x86-64 releases are supported. No tag is created by a build or version bump.

`package.json` owns the application version, independently of project format version 1. `scripts/version.ts` synchronizes npm, Rust, Tauri and lockfiles. `src/help/releases.ts` owns bilingual release notes; GitHub uses only the selected version's English notes.

## Prepare on develop

Inspect remote tags and releases before reserving a version:

```sh
git ls-remote --tags origin
gh release list --repo dabatnot/snes-graph --limit 100
npm run version:set -- 0.2.1
npm run version:check
npm run --silent release:notes -- --version 0.2.1
npm run --silent release:notes -- fr --version 0.2.1
npm test
npm run build
```

If the version already exists, stop version preparation and report the conflict. Add bilingual notes before exporting them. Omit `--version` for full history. An unknown requested version fails. Update the affected manuals and third-party inventories if dependencies changed.

Commit and push to `develop` when authorized. The `Desktop CI` workflow runs on pushes/PRs to develop/main, supports manual dispatch, and is reused by releases. Exercise it from develop without publishing a test tag. Inspect all jobs and download artifacts; a workflow file is not proof of success.

## Packages and checks

| Target         | Environment                                          | Local command            | Package             |
| -------------- | ---------------------------------------------------- | ------------------------ | ------------------- |
| Windows x86-64 | windows-2022 build runner; Windows 11 desktop target | `npm run bundle:windows` | NSIS `.exe`         |
| Ubuntu x86-64  | Ubuntu 24.04                                         | `npm run bundle:ubuntu`  | `.deb`, `.AppImage` |
| Fedora x86-64  | Fedora 44 container on Ubuntu                        | `npm run bundle:fedora`  | `.rpm`              |

Node.js 24, `npm ci` and locked Cargo dependency resolution are used. `bundle:linux` remains a Linux RPM/AppImage convenience command. Packages appear under `src-tauri/target/release/bundle`. Artifacts are named `snes-graph-<platform>-x86_64`.

Check package metadata, architecture, desktop/MIME registration, offline manuals, notices and the actual bundled-library payload. Existing inventories describe their recorded inputs, not every future AppImage. Install on clean matching systems with dependencies resolved; compiler libraries present on a build machine can conceal missing runtime dependencies.

CI performs Linux installation and bounded startup checks in fresh matching containers with runtime dependencies, separately from build jobs; Windows installation/startup runs on its hosted runner. A live process under Xvfb proves only headless startup, not correct rendering, Wayland behavior or native dialogs. Windows installers are unsigned; no in-app updater is supplied.

Before the first tag, check on Windows 11, Ubuntu 24.04 and Fedora 44: launch, create/save/reopen a project, switch English/French and open the offline manual. Record the actual environment and result. Do not substitute compilation or old screenshots for this desktop check.

## Publish from main

Once the exact delivery commit is on main and its checks passed, an authorized release operator creates and pushes the tag:

```sh
git switch main
git pull --ff-only origin main
git tag -a v0.2.1 -m "SNES Graph 0.2.1"
git push origin v0.2.1
```

These are publication commands, not validation commands. Review the intended commit before using them. The pipeline checks annotated tag type, stable tag syntax, HEAD equality, main ancestry, synchronized versions and matching release notes.

The release contains:

- `snes-graph-<version>-windows-x86_64.exe`
- `snes-graph-<version>-ubuntu-x86_64.deb`
- `snes-graph-<version>-fedora-x86_64.rpm`
- `snes-graph-<version>-linux-x86_64.AppImage`
- `SHA256SUMS`

The publisher assembles a draft and publishes only when every expected asset is uploaded. Download from [GitHub Releases](https://github.com/dabatnot/snes-graph/releases). Verify in the download directory with `sha256sum --check SHA256SUMS`, or compare Windows `Get-FileHash -Algorithm SHA256` output with the corresponding entry.

## Failure and retry

Runs serialize per tag. Failed checks/builds do not publish a release. A partially uploaded draft can be resumed by rerunning the same tagged workflow; draft assets are replaced as a complete set. Existing published releases are refused, never edited. Network/API failures fail delivery instead of being interpreted as absent releases.

Never move a release tag or overwrite published assets. If code changes are required, prepare a new version/commit/tag. An infrastructure-only failure can rerun the same commit. No public test tags are needed: release guard tests use temporary local repositories.

## Validation record — 0.2.1 preparation

Remote tags and releases were inspected on September 27, 2026; neither contained an existing version. No tag, merge into main or public release has been created during preparation.

Local checks: 67 tests passed; TypeScript/Vite build passed; actionlint 1.7.12 accepted both workflows. Both local skills passed the skill validator. Each manual has 108 matching anchors and 499 checked links. English and French installation sections were visually inspected in the browser. English startup and French preference persistence after reload were observed in the web app. Default CLI gallery output identifies English; version-specific English/French notes and missing-version rejection were checked. Asset staging, SHA-256 verification and duplicate-package rejection passed using temporary fixtures.

Hosted builds were started from develop; final results are recorded after completion. Automatic publication remains unverified until the first real tagged release. Windows 11, Ubuntu 24.04 and Fedora 44 desktop checks require accessible matching desktops and must not be inferred from the current Fedora workstation or CI configuration.
