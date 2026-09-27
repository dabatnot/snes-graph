"""Stage exactly one package of each type and verify version/architecture names."""
import hashlib
import json
from pathlib import Path
import shutil
import sys

source, target = map(Path, sys.argv[1:])
version = json.loads(Path("package.json").read_text())["version"]
target.mkdir(parents=True, exist_ok=True)
formats = {"exe": "windows-x86_64", "deb": "ubuntu-x86_64", "rpm": "fedora-x86_64", "AppImage": "linux-x86_64"}
for extension, platform in formats.items():
    candidates = list(source.rglob(f"*.{extension}"))
    if len(candidates) != 1:
        raise SystemExit(f"Expected one {extension} package, found {len(candidates)}")
    package = candidates[0]
    if version not in package.name or not any(arch in package.name for arch in ("x64", "amd64", "x86_64")):
        raise SystemExit(f"Unexpected package version/architecture: {package.name}")
    shutil.copyfile(package, target / f"snes-graph-{version}-{platform}.{extension}")
with (target / "SHA256SUMS").open("w") as checksums:
    for package in sorted(target.iterdir()):
        if package.name != "SHA256SUMS":
            checksums.write(f"{hashlib.file_digest(package.open('rb'), 'sha256').hexdigest()}  {package.name}\n")
