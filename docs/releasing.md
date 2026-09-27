# Release procedure

## Contract

Develop on `develop`, integrate reviewed changes into `main`, then explicitly push an annotated `vMAJOR.MINOR.PATCH` tag. The tag is the decision to publish: GitHub automatically publishes after checks and all four packages succeed. Only stable x86-64 releases are supported. No tag is created by a build or version bump.

`package.json` owns the application version, independently of project format version 1. `scripts/version.ts` synchronizes npm, Rust, Tauri and lockfiles. `src/help/releases.ts` owns bilingual release notes; GitHub uses only the selected version's English notes.

## Prepare on develop

Inspect remote tags and releases before reserving a version:

```sh
git ls-remote --tags origin
gh release list --repo dabatnot/snes-graph --limit 100
npm run version:set -- 0.2.2
npm run version:check
npm run --silent release:notes -- --version 0.2.2
npm run --silent release:notes -- fr --version 0.2.2
npm test
npm run build
```

If the version already exists, stop version preparation and report the conflict. Add bilingual notes before exporting them. Omit `--version` for full history. An unknown requested version fails. Update the affected manuals and third-party inventories if dependencies changed.

Commit and push to `develop` when authorized. The `Desktop CI` workflow runs shared tests, version checks and the TypeScript/Vite build on pushes to develop and pull requests targeting develop or main. A push to main does not start another CI run.

Desktop packaging and installation/startup checks run only on manual dispatch or when the release workflow calls CI with `build_packages: true`. Manually exercise the full build from develop before merging changes to dependencies, Tauri or packaging:

```sh
gh workflow run ci.yml --ref develop
```

Manual runs build all platforms without publishing. Inspect the jobs and download artifacts; a workflow file is not proof of success. Tagged releases always rebuild and validate the exact tagged commit before publication.

## Packages and checks

| Target         | Environment                                          | Local command            | Package             |
| -------------- | ---------------------------------------------------- | ------------------------ | ------------------- |
| Windows x86-64 | windows-2022 build runner; Windows 11 desktop target | `npm run bundle:windows` | NSIS `.exe`         |
| Ubuntu x86-64  | Ubuntu 24.04                                         | `npm run bundle:ubuntu`  | `.deb`, `.AppImage` |
| Fedora x86-64  | Fedora 44 container on Ubuntu                        | `npm run bundle:fedora`  | `.rpm`              |

Node.js 24, `npm ci` and locked Cargo dependency resolution are used. `bundle:linux` remains a Linux RPM/AppImage convenience command. Packages appear under `src-tauri/target/release/bundle`. Artifacts are named `snes-graph-<platform>-x86_64`.

Check package metadata, architecture, desktop/MIME registration, offline manuals, notices and the actual bundled-library payload. Existing inventories describe their recorded inputs, not every future AppImage. Install on clean matching systems with dependencies resolved; compiler libraries present on a build machine can conceal missing runtime dependencies.

CI performs Linux installation and bounded startup checks in fresh matching containers with runtime dependencies, separately from build jobs; Windows installation/startup runs on its hosted runner. A live process under Xvfb proves only headless startup, not correct rendering, Wayland behavior or native dialogs. Windows installers are unsigned; no in-app updater is supplied.

Before the first tag, check on Fedora 44: launch, create/save/reopen a project, switch English/French and open the offline manual. Windows 11 and Ubuntu 24.04 graphical checks are optional bonus checks for this delivery, as explicitly accepted by the maintainer; their absence or graphical failures do not block publication. Keep the automated platform builds and installation/startup checks. Record actual environments and results without substituting compilation or old screenshots for desktop observations.

## Publish from main

Once the delivery commit is on main and the develop or pull-request checks passed, an authorized release operator creates and pushes the tag:

```sh
git switch main
git pull --ff-only origin main
git tag -a v0.2.2 -m "SNES Graph 0.2.2"
git push origin v0.2.2
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

Platform-specific failures may first appear during the tagged release when no manual package build was requested. They block publication. Never move a release tag or overwrite published assets. If code changes are required, prepare a new version/commit/tag. An infrastructure-only failure can rerun the same commit. No public test tags are needed: release guard tests use temporary local repositories.

## Validation record — 0.2.1 preparation

Remote tags and releases were inspected on September 27, 2026; neither contained an existing version. No tag, merge into main or public release has been created during preparation.

Local checks: 67 tests passed; TypeScript/Vite build passed; actionlint 1.7.12 accepted both workflows. Both local skills passed the skill validator. Each manual has 108 matching anchors and 499 checked links. English and French installation sections were visually inspected in the browser. English startup and French preference persistence after reload were observed in the web app. Default CLI gallery output identifies English; version-specific English/French notes and missing-version rejection were checked. Asset staging, SHA-256 verification and duplicate-package rejection passed using temporary fixtures.

Hosted validation passed on develop at `bb851c6`: [Desktop CI run 36317092349](https://github.com/dabatnot/snes-graph/actions/runs/36317092349). All six jobs passed: shared checks, three platform builds, and installation/startup in fresh Ubuntu 24.04 and Fedora 44 containers. Windows NSIS silent installation and a ten-second executable startup passed on windows-2022. Linux DEB/RPM and AppImage startup passed under Xvfb; this is not graphical or Wayland validation.

All four artifacts were downloaded and staged with the release script; their expected filenames and SHA-256 checks passed. DEB/RPM metadata reports 0.2.1 and x86-64, with desktop entries and MIME registration. The NSIS payload contains an x86-64 executable with 0.2.1 version resources. Both manual paths and the bundled notice inventory are embedded in the inspected Windows and Linux executables. The AppImage payload was extracted and inspected, including its desktop/MIME files, bundled shared libraries, distribution copyright files and runtime license references. The dependency inventory retains its recorded scope; it does not claim every bundled Ubuntu library has the same version as the earlier Fedora inventory.

On the local Fedora 44 Workstation desktop, the rebuilt native 0.2.1 executable was observed starting in English with isolated fresh preferences. A test project was saved and reopened through native dialogs, the interface switched to French and back to English, and the bundled English manual opened in its own native window. This checks the local executable, not installation of the CI RPM on a graphical desktop. Windows 11 and Ubuntu 24.04 graphical desktops were unavailable; these optional checks remain unverified and are not release blockers.

Automatic publication remains unverified until the first real tagged release. No public tag, release or merge into main was used for these checks. Downloadable build artifacts are attached to the CI run; GitHub Releases will receive the stable assets only after the authorized main/tag delivery.


## First tagged run and correction

The annotated `v0.2.1` tag at `559c7cb` triggered [run 36319912414](https://github.com/dabatnot/snes-graph/actions/runs/36319912414). It failed before packaging: actions/checkout rewrote the local tag reference to the event commit, hiding its annotation. The remote tag remains annotated and unchanged; no 0.2.1 release was published. Version 0.2.2 restores the original remote tag object locally before validation. A regression test reproduces the local rewrite and verifies that fetching the original tag restores the guard.
