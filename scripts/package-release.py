"""Package a tested standalone build; no credentials or local configuration."""
import hashlib
import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--result-file', type=Path)
    args = parser.parse_args()
    marker = ROOT / 'outputs/release-build.json'
    if not marker.is_file():
        raise SystemExit('Build de atualizacao ausente. Execute prepare-release.ps1.')
    release = json.loads(marker.read_text(encoding='utf-8'))
    stage = Path(release['stage']).resolve()
    if stage.parent != (ROOT / 'outputs').resolve() or release.get('excludedFeatures') != [] or release.get('includedFeatures') != ['carteira']:
        raise SystemExit('Origem de atualizacao invalida.')
    version_source = (stage / 'lib/app-version.ts').read_text(encoding='utf-8')
    match = re.search(r"export const APP_VERSION = '(V\.[0-9]{2}\.[0-9]{3})';", version_source)
    if not match or version_source != (ROOT / 'lib/app-version.ts').read_text(encoding='utf-8'):
        raise SystemExit('Versao visual invalida ou alterada depois do build. Execute prepare-release.ps1 novamente.')
    app_version = match.group(1)
    version = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    files = sorted(p for p in (stage / 'dist/standalone').rglob('*') if p.is_file())
    files += [stage / name for name in ('backend/server.py', 'backend/queries.py', 'backend/usage.py', 'backend/portfolio.py', 'backend/portfolio_analysis.py', 'backend/group_dashboard.py', 'scripts/start-iis.mjs')]
    if not (stage / 'dist/standalone/server.js').is_file():
        raise SystemExit('Build standalone ausente. Execute prepare-release.ps1.')
    for name in ('backend/portfolio.py', 'backend/portfolio_analysis.py', 'backend/group_dashboard.py', 'app/carteira/page.tsx'):
        if not (stage / name).is_file():
            raise SystemExit(f'Carteira incompleta: {name}')
    manifest = {'application': 'PulsoComercial', 'schema': 1, 'version': version, 'appVersion': app_version, 'excludedFeatures': [], 'includedFeatures': ['carteira'], 'files': []}
    output = ROOT / 'outputs' / f'Pulso-Release-{version}.zip'
    output.parent.mkdir(exist_ok=True)
    with ZipFile(output, 'x', ZIP_DEFLATED) as archive:
        for path in files:
            relative = path.relative_to(stage).as_posix()
            content = path.read_bytes()
            manifest['files'].append({'path': relative, 'sha256': hashlib.sha256(content).hexdigest()})
            archive.writestr(relative, content)
        archive.writestr('release.json', json.dumps(manifest, indent=2))
    with ZipFile(output) as archive:
        assert archive.testzip() is None
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix('.zip.sha256').write_text(digest + '\n', encoding='ascii')
    launcher = f'''# Default: validate without publishing. Add -Aplicar to publish.
[CmdletBinding()]
param([switch]$Aplicar)
$ErrorActionPreference = 'Stop'
& (Join-Path $PSScriptRoot 'Atualizar-Pulso.ps1') -Package (Join-Path $PSScriptRoot '{output.name}') -Sha256 '{digest}' -ValidateOnly:(-not $Aplicar)
'''
    kit = output.with_name(f'Pulso-Kit-Atualizacao-{version}.zip')
    with ZipFile(kit, 'x', ZIP_DEFLATED) as archive:
        archive.write(output, output.name)
        archive.write(ROOT / 'deploy/iis/Atualizar-Pulso.ps1', 'Atualizar-Pulso.ps1')
        archive.write(ROOT / 'deploy/iis/Ativar-Uso.ps1', 'Ativar-Uso.ps1')
        archive.write(ROOT / 'deploy/iis/pulso-user.ashx', 'pulso-user.ashx')
        archive.write(ROOT / 'docs/uso-plataforma.md', 'USO-DA-PLATAFORMA.md')
        archive.writestr('Publicar-Pulso.ps1', launcher)
        archive.write(ROOT / 'docs/atualizacao-automatica.md', 'MANUAL.md')
        archive.writestr('LEIA-ME.txt', '''PULSO - ATUALIZACAO ASSISTIDA

1. Copie este kit para o servidor 192.168.0.15 e extraia em uma pasta
   propria, por exemplo C:\\Pulso\\Pacotes\\VERSAO. Nao extraia em C:\\Pulso\\App.
2. Abra PowerShell como administrador nessa pasta.
3. Confira sem publicar: .\\Publicar-Pulso.ps1
   Para ativar Uso da plataforma pela primeira vez, consulte USO-DA-PLATAFORMA.md
   e execute .\\Ativar-Uso.ps1 no servidor antes de publicar.
4. Apos validacao sem erros, publique: .\\Publicar-Pulso.ps1 -Aplicar
5. Confira o site de producao e as consultas.

O ZIP interno nao deve ser extraido manualmente. Seu hash ja esta no script.
O processo cuida de backup, tarefas, troca e verificacao. Em falha, tenta
restaurar a versao anterior. Logs e backups: C:\\Pulso\\Atualizacoes.
Nao feche o PowerShell durante a atualizacao. Consulte MANUAL.md.
Se scripts forem bloqueados, solicite assinatura/aprovacao a TI.
''')
    with ZipFile(kit) as archive:
        assert archive.testzip() is None
    print(f'Pacote: {output}\nSHA256: {digest}\nKit para copiar ao servidor: {kit}')
    if args.result_file:
        args.result_file.write_text(json.dumps({'package': str(output), 'sha256': digest, 'version': version, 'appVersion': app_version}), encoding='utf-8')


if __name__ == '__main__':
    main()
