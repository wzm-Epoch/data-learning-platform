"""Create a runtime ZIP using an explicit allowlist; excludes personal state."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))['version']
inventory = json.loads((ROOT / 'docs/acceptance/offline-resources.json').read_text(encoding='utf-8'))
entries = {}
for item in inventory['assets']:
    path = ROOT / 'dist' / item['path']
    assert path.resolve().is_relative_to((ROOT / 'dist').resolve())
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    entries['dist/' + item['path']] = data

# No recursive docs inclusion: no progress JSON, snapshots, logs or raw metrics.
DOCUMENTS = [
    'docs/user-guide.md', 'docs/backup-restore-guide.md',
    'docs/add-project-guide.md', 'docs/known-issues.md',
    'docs/acceptance-report.md', 'docs/stages/phase-06-report.md',
]
for name in DOCUMENTS + ['scripts/serve.mjs', '启动学习平台.cmd']:
    entries[name] = (ROOT / name).read_bytes()
entries['build-evidence/package-lock.json'] = (ROOT / 'package-lock.json').read_bytes()
entries['package.json'] = json.dumps({
    'name': 'data-learning-platform-runtime', 'version': VERSION,
    'private': True, 'type': 'module', 'scripts': {'start': 'node scripts/serve.mjs'},
}, ensure_ascii=False, indent=2).encode('utf-8')
entries['README.md'] = ("# 数据分析学习平台离线运行包\n\n"
    "需安装Node.js，本机验证24.18.0。解压后双击启动学习平台.cmd或运行npm.cmd start，"
    "访问http://127.0.0.1:4173；在启动终端Ctrl+C停止。学习不需Python、npm安装或互联网。"
    "不要双击dist/index.html。\n\n"
    "本包只含正式运行资源及明确列出的指南、报告。维护源码保留在原工程。"
    "build-evidence中的依赖锁仅作构建证据，不需要安装。\n\n"
    "本包不含个人学习进度、浏览器快照或原始性能记录。报告所提测试前进度备份"
    "仅在原工程docs/acceptance/browser-before.json保留，未纳入本ZIP。"
    "最后的浏览器确认复测和记录恢复仍受来源策略阻挡，详见验收报告。\n").encode('utf-8')
assert not any(name.startswith('docs/acceptance/') for name in entries)
assert not any('browser-before' in name or 'offline-lesson-backup' in name for name in entries)
out = ROOT / 'delivery'
out.mkdir(exist_ok=True)
target = out / f'data-learning-platform-{VERSION}.zip'
if not target.exists():
    with zipfile.ZipFile(target, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in sorted(entries.items()):
            archive.writestr(name, data)
with zipfile.ZipFile(target) as archive:
    assert archive.testzip() is None
    assert set(archive.namelist()) == set(entries)
    for name, expected in entries.items():
        assert archive.read(name) == expected, name
digest = hashlib.sha256(target.read_bytes()).hexdigest()
result = {'archive': str(target), 'files': len(entries), 'bytes': target.stat().st_size,
          'sha256': digest, 'verifiedStaticFiles': len(inventory['assets']),
          'personalProgressIncluded': False, 'browserSnapshotsIncluded': False,
          'validation': 'all entries byte-identical; ZIP CRC passed'}
(out / f'data-learning-platform-{VERSION}.sha256').write_text(digest + '  ' + target.name + '\n', encoding='utf-8')
(ROOT / 'docs/acceptance/delivery-package.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(result, ensure_ascii=False))
