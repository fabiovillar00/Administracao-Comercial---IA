"""Create an isolated release source tree for the approved application."""
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]
BACKEND_FILES = ('server.py', 'queries.py', 'usage.py', 'portfolio.py', 'portfolio_analysis.py', 'group_dashboard.py')


def release_server(source):
    compile(source, 'release/backend/server.py', 'exec')
    if 'portfolio_service.start()' in source or 'from portfolio_actions import' in source:
        raise ValueError('Monitor ou acompanhamento antigo presente na API de publicacao.')
    return source


def main():
    outputs = ROOT / 'outputs'
    outputs.mkdir(exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='release-source-', dir=outputs))
    for name in ('app', 'components', 'hooks', 'lib', 'public', '.openai'):
        shutil.copytree(ROOT / name, stage / name)
    for name in ('package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'vite.config.ts'):
        shutil.copy2(ROOT / name, stage / name)
    (stage / 'backend').mkdir()
    for name in BACKEND_FILES:
        if name == 'server.py':
            (stage / 'backend' / name).write_text(release_server((ROOT / 'backend' / name).read_text(encoding='utf-8')), encoding='utf-8')
        else:
            shutil.copy2(ROOT / 'backend' / name, stage / 'backend' / name)
    (stage / 'scripts').mkdir()
    shutil.copy2(ROOT / 'scripts/start-iis.mjs', stage / 'scripts/start-iis.mjs')
    print(json.dumps({'stage': str(stage), 'excludedFeatures': [], 'includedFeatures': ['carteira']}))


if __name__ == '__main__':
    main()
