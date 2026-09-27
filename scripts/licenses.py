"""Refresh shipped dependency notices from locked, installed source archives.
Run explicitly after dependency changes; builds only consume the checked-in inventory.
Linux native libraries listed here are host-provided. Package-specific payloads must
also be inventoried before publishing installers (see licenses/README.md).
"""
import hashlib, json, re, subprocess, sys
from pathlib import Path

root = Path(__file__).resolve().parent.parent
components, texts, tools = {}, {}, []
missing_system = []
def notice(text):
    key = hashlib.sha256(text.encode()).hexdigest()[:16]
    texts[key] = text
    return key
def license_files(directory):
    return sorted(p for p in directory.rglob('*') if p.is_file() and
        re.match(r'^(licen[cs]e|copying|copyright|notice|unlicense)(?:[.\-_]|$)', p.name, re.I)
        and not any(v in ('node_modules', '.git', 'target') for v in p.relative_to(directory).parts))
def add(ecosystem, name, version, license, source, paths, platform):
    key = (ecosystem, name, version)
    if not license or not paths: raise RuntimeError(f'Missing license or notice: {key}')
    entry = components.setdefault(key, dict(ecosystem=ecosystem, name=name, version=version,
        license=license, source=source, platforms=[], notices=[]))
    if platform not in entry['platforms']: entry['platforms'].append(platform)
    for path in paths:
        text = path.read_text(errors='replace')
        if '\x00' in text: continue
        id = notice(text)
        if id not in entry['notices']: entry['notices'].append(id)

lock = json.loads((root/'package-lock.json').read_text())
for location, package in lock['packages'].items():
    if not location: continue
    directory = root/location
    if not directory.exists():
        if package.get('optional') or package.get('dev'): continue
        raise RuntimeError(f'Missing package {location}')
    data = json.loads((directory/'package.json').read_text())
    if package.get('dev'):
        tools.append(dict(ecosystem='npm', name=data['name'], version=data['version'], license=data.get('license', ''), role='build/test only'))
        continue
    add('npm', data['name'], data['version'], data.get('license'),
        package.get('resolved', 'https://www.npmjs.com/package/'+data['name']), license_files(directory), 'Web / Linux / Windows')

for target, platform in [('x86_64-unknown-linux-gnu', 'Linux'), ('x86_64-pc-windows-msvc', 'Windows')]:
    metadata = json.loads(subprocess.check_output(['cargo','metadata','--offline','--locked','--filter-platform',target,
        '--format-version','1','--manifest-path',str(root/'src-tauri/Cargo.toml')]))
    packages = {p['id']:p for p in metadata['packages']}
    nodes = {n['id']:n for n in metadata['resolve']['nodes']}
    runtime = set()
    def walk(id):
        if id in runtime: return
        runtime.add(id)
        for dep in nodes[id]['deps']:
            if any(k['kind'] is None for k in dep['dep_kinds']) and not any('proc-macro' in t['kind'] for t in packages[dep['pkg']]['targets']): walk(dep['pkg'])
    walk(metadata['resolve']['root'])
    for id,p in packages.items():
        if id == metadata['resolve']['root']: continue
        if id not in runtime:
            tools.append(dict(ecosystem='cargo', name=p['name'], version=p['version'], license=p['license'], role='build/proc-macro/test only', platform=platform))
            continue
        directory = Path(p['manifest_path']).parent
        paths = license_files(directory)
        if not paths:
            prefix = ('unic' if p['name'].startswith('unic-') else 'webview2' if p['name'].startswith('webview2-com') else 'alloc' if p['name']=='alloc-stdlib' else p['name'])
            paths = sorted((root/'licenses/upstream').glob(prefix+'-*'))
            if p['name']=='libappindicator-sys':
                paths = license_files(directory.parent/'libappindicator-0.9.0')
        add('cargo',p['name'],p['version'],p['license'],f'https://crates.io/api/v1/crates/{p["name"]}/{p["version"]}/download',paths,platform)

# Native Linux runtime: transitive linked libraries are supplied by the OS for
# this executable. Keep original distribution notices, not merely SPDX labels.
binary = root/'src-tauri/target/release/snes-graph'
if binary.exists() and sys.platform.startswith('linux'):
    output = subprocess.check_output(['ldd',str(binary)],text=True)
    libraries = re.findall(r'=> (/\S+)',output)
    rpms = set()
    for library in libraries:
        rpm = subprocess.check_output(['rpm','-qf','--qf','%{NAME}.%{ARCH}',str(Path(library).resolve())],text=True)
        rpms.add(rpm)
    installed = subprocess.check_output(['rpm','-qa','--qf','%{NAME}.%{ARCH}|%{SOURCERPM}\n'],text=True).splitlines()
    for rpm in sorted(rpms):
        version, lic, source = subprocess.check_output(['rpm','-q','--qf','%{VERSION}-%{RELEASE}\n%{LICENSE}\n%{SOURCERPM}',rpm],text=True).split('\n')
        paths = [Path(p) for p in subprocess.check_output(['rpm','-q','--licensefiles',rpm],text=True).splitlines() if Path(p).is_file()]
        if not paths:
            paths = [Path(p) for p in subprocess.check_output(['rpm','-ql',rpm],text=True).splitlines() if Path(p).is_file() and re.match(r'^(license|copying|copyright|notice)',Path(p).name,re.I)]
        if not paths:
            siblings = [line.split('|')[0] for line in installed if line.endswith('|'+source)]
            paths = sorted({Path(p) for sibling in siblings for p in subprocess.check_output(['rpm','-q','--licensefiles',sibling],text=True).splitlines() if Path(p).is_file()})
        if not paths:
            paths = sorted((root/'licenses/upstream').glob(re.sub(r'-[0-9].*','',source)+'-*'))
        if not paths:
            missing_system.append((rpm,version,lic,source));continue
        add('Linux system (not bundled)',rpm,version,lic,'https://src.fedoraproject.org/rpms/'+re.sub(r'-[0-9].*','',source),paths,'Linux system')

if missing_system: raise RuntimeError(f'Missing system notices: {missing_system}')

add('Windows SDK', 'Microsoft.Web.WebView2 loader', '1.0.3650.58', 'BSD-3-Clause and third-party notices', 'https://www.nuget.org/packages/Microsoft.Web.WebView2/1.0.3650.58', sorted((root/'licenses/upstream').glob('microsoft-webview2-*')), 'Windows')

fingerprint = hashlib.sha256(((root/'package-lock.json').read_text()+(root/'src-tauri/Cargo.lock').read_text()).encode()).hexdigest()
(root/'licenses/third-party.json').write_text(json.dumps(dict(lockFingerprint=fingerprint,components=sorted(components.values(),key=lambda p:(p['ecosystem'],p['name'],p['version'])),texts=texts),ensure_ascii=False,indent=2)+'\n')
(root/'licenses/build-tools.json').write_text(json.dumps(tools,ensure_ascii=False,indent=2)+'\n')
print(f'{len(components)} runtime components; {len(texts)} original notices; build tools listed separately')
