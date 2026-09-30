"""Create an isolated release source tree, excluding the local portfolio experiment."""
import ast
import json
from pathlib import Path
import shutil
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def release_server(source):
    tree = ast.parse(source)
    ranges = []
    for node in ast.walk(tree):
        remove = isinstance(node, ast.ImportFrom) and node.module in ('portfolio', 'portfolio_actions')
        remove |= isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'portfolio_service' for t in node.targets)
        remove |= isinstance(node, ast.If) and any(isinstance(n, ast.Constant) and n.value in ('/api/portfolio', '/api/portfolio/actions') for n in ast.walk(node.test))
        remove |= (isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
                   and isinstance(node.value.func, ast.Attribute)
                   and isinstance(node.value.func.value, ast.Name)
                   and node.value.func.value.id == 'portfolio_service')
        if remove:
            ranges.append((node.lineno, node.end_lineno))
    if len(ranges) != 6:
        raise ValueError('Integracao da carteira mudou; revise sua exclusao antes de gerar o pacote.')
    result = ''.join(line for i, line in enumerate(source.splitlines(keepends=True), 1)
                     if not any(start <= i <= end for start, end in ranges))
    if 'portfolio' in result:
        raise ValueError('Referencia a carteira permaneceu na API de atualizacao.')
    compile(result, 'release/backend/server.py', 'exec')
    return result


def main():
    outputs = ROOT / 'outputs'
    outputs.mkdir(exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='release-source-', dir=outputs))
    for name in ('app', 'components', 'hooks', 'lib', 'public', '.openai'):
        shutil.copytree(ROOT / name, stage / name, ignore=(lambda path, names: ['carteira'] if Path(path) == ROOT / 'app' else []))
    for name in ('package.json', 'tsconfig.json', 'next-env.d.ts', 'next.config.ts', 'vite.config.ts'):
        shutil.copy2(ROOT / name, stage / name)
    page_path = stage / 'app/page.tsx'
    page = page_path.read_text(encoding='utf-8')
    lines = page.splitlines(keepends=True)
    excluded = [line for line in lines if 'href="/carteira"' in line]
    if len(excluded) != 2 or any('<a ' not in line or '</a>' not in line for line in excluded):
        raise ValueError('Navegacao da carteira mudou; revise sua exclusao.')
    page_path.write_text(''.join(line for line in lines if line not in excluded), encoding='utf-8')
    (stage / 'backend').mkdir()
    (stage / 'backend/server.py').write_text(release_server((ROOT / 'backend/server.py').read_text(encoding='utf-8')), encoding='utf-8')
    shutil.copy2(ROOT / 'backend/queries.py', stage / 'backend/queries.py')
    shutil.copy2(ROOT / 'backend/usage.py', stage / 'backend/usage.py')
    (stage / 'scripts').mkdir()
    shutil.copy2(ROOT / 'scripts/start-iis.mjs', stage / 'scripts/start-iis.mjs')
    print(json.dumps({'stage': str(stage), 'excludedFeatures': ['carteira']}))


if __name__ == '__main__':
    main()
