# Licences et composants / Licenses and components

SNES Graph is MIT licensed (see ../LICENSE). User projects and artwork retain their own ownership and licensing. Generated assembly templates are MIT licensed; generated source archives contain LICENSE.txt and a scope notice.

`third-party.json` contains the original notices and versioned source locations of runtime dependencies, including the Linux and Windows Cargo graphs and production npm packages. MPL source is available through each exact crate download URL; no third-party source has been modified. Build dependencies and procedural macros are listed separately in `build-tools.json` and are not described as shipped runtime code.

Refresh explicitly after dependency changes with `python3 scripts/licenses.py` (requires installed npm dependencies, Cargo sources for both target graphs, and RPM tools on Fedora to inventory the local native runtime). Compilation consumes the checked-in inventory without network access. This inventory is tied to the lockfiles.

## Native distribution boundary

The local Linux executable dynamically links system libraries. Entries labelled `Linux system (not bundled)` identify the observed Fedora runtime and preserve its available notices; they are not claims about every Linux installation. Their packages and source packages remain supplied by the distribution. Retain LGPL relinking and source availability obligations if these libraries are redistributed.

The Windows WebView2 loader distributed by webview2-com-sys uses SDK 1.0.3650.58. Its Microsoft BSD license and third-party notice are included. The WebView2 Runtime is a separate Microsoft component installed by the platform/installer, not covered by SNES Graph's MIT license.

Before publishing an AppImage, RPM or Windows installer, inspect its actual payload and retain notices and corresponding source availability for any additional bundled libraries. An old 0.1.0 AppDir is not evidence of the contents of a future 0.2.0 package. This task rebuilds the local executable; installer publication is separate.

## Original notices absent from crate archives

The files under `upstream/` were recovered from the repositories and revisions recorded in `.cargo_vcs_info.json`:

- alloc-stdlib: dropbox/rust-alloc-no-stdlib, ae42d22078b98549e987d2f03d12df7b984fde47, LICENSE.
- unic-* : open-i18n/rust-unic, 8a6ce83063d90b91ae2ce59eddb803edd393fca9, COPYRIGHT.md, LICENSE-MIT and LICENSE-APACHE.
- dlopen2: OpenByteDev/dlopen2, cc80e4a0a90d499b677fdf7743699b4b3a43a989, LICENSE.
- webview2-com and webview2-com-sys: wravery/webview2-rs, b74dc5e2b394044bea5191052868ce7a106c202c, LICENSE.
- selectors 0.36.1 declares MPL-2.0 in its file headers. The unmodified MPL-2.0 text is also shipped in cssparser 0.36.0 and retained here.
- libappindicator-sys 0.9.0 shares its repository/revision and licensing with libappindicator 0.9.0; the parent crate's original MIT/Apache notices are retained.
- Microsoft WebView2: LICENSE.txt and NOTICE.txt from the official Microsoft.Web.WebView2 1.0.3650.58 NuGet archive.

Additional original system notices were retained from upstream release archives:
hyphen v2.8.8 (github.com/hunspell/hyphen), libX11 1.8.13
(www.x.org/releases/individual/lib), libdrm 2.4.134
(dri.freedesktop.org/libdrm), and libglvnd v1.7.0 (github.com/NVIDIA/libglvnd).
For libdrm and libglvnd, the notice files also collect the original copyright/license
comment blocks from source files because those releases lack a single top-level license file.

En français : la licence MIT concerne SNES Graph et ses modèles assembleur, pas les
créations de l’utilisateur. Chaque composant tiers conserve sa licence et ses notices
originales. Les bibliothèques Linux listées comme système sont fournies par Fedora,
non embarquées dans le binaire local. L’inventaire des outils de compilation est séparé.
Avant publication d’un installateur, vérifier ses fichiers réellement embarqués et les
obligations de redistribution correspondantes ; cet inventaire ne certifie pas un paquet
qui n’a pas encore été construit.
