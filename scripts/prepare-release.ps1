# Execute on the development computer, from any directory.
[CmdletBinding()]
param([string]$ResultFile)
$ErrorActionPreference = 'Stop'
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    python -m unittest discover -s backend -p 'test_*.py'
    if ($LASTEXITCODE) { throw 'Testes da API falharam.' }
    node --experimental-strip-types lib/revenue-evolution.test.mjs
    if ($LASTEXITCODE) { throw 'Testes do grafico falharam.' }
    node node_modules/typescript/bin/tsc --noEmit
    if ($LASTEXITCODE) { throw 'Verificacao TypeScript falhou.' }
    node scripts/build-iis.mjs
    if ($LASTEXITCODE) { throw 'Build falhou; nenhum pacote foi gerado.' }
    if ($ResultFile) { python scripts/package-release.py --result-file $ResultFile }
    else { python scripts/package-release.py }
    if ($LASTEXITCODE) { throw 'Empacotamento falhou.' }
} finally { Pop-Location }
