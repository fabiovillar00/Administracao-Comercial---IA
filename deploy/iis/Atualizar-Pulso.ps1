# Compatible with Windows PowerShell 5.1. Does not modify IIS, credentials or database.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Package,
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$Sha256,
    [string]$AppRoot = 'C:\Pulso\App',
    [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Safe-Child([string]$Root, [string]$Relative) {
    $base = [IO.Path]::GetFullPath($Root).TrimEnd('\', '/')
    $path = [IO.Path]::GetFullPath((Join-Path $base $Relative))
    if (-not $path.StartsWith($base + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Caminho fora da pasta esperada: $Relative"
    }
    return $path
}
function Assert-NoLinks([string]$Path) {
    $cursor = $Path
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Link/junction nao permitido: $cursor"
            }
        }
        $parent = Split-Path $cursor -Parent
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
function Write-Status([string]$Message) {
    $line = '{0} {1}' -f (Get-Date -Format s), $Message
    Write-Host $line
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
}
function Test-Services {
    $api = Invoke-RestMethod -Uri 'http://127.0.0.1:8000/api/health' -TimeoutSec 10
    if ($api.ok -ne $true -or -not $api.database) { throw 'API/banco nao saudavel.' }
    $web = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/' -UseBasicParsing -TimeoutSec 10
    if ($web.StatusCode -ne 200 -or $web.Content -notmatch 'Pulso') { throw 'Interface nao saudavel.' }
}
function Wait-Services {
    $lastFailure = ''
    for ($attempt = 0; $attempt -lt 12; $attempt++) {
        try { Test-Services; return } catch { $lastFailure = $_.Exception.Message }
        Start-Sleep -Seconds 2
    }
    throw "Aplicacao nao iniciou: $lastFailure"
}
function Stop-Pulso {
    foreach ($name in $taskNames) {
        Disable-ScheduledTask -TaskName $name -TaskPath '\' | Out-Null
        Stop-ScheduledTask -TaskName $name -TaskPath '\'
    }
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
        $running = @($taskNames | Where-Object { (Get-ScheduledTask -TaskName $_ -TaskPath '\').State -eq 'Running' })
        $listeners = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in 3000, 8000 })
        if ($running.Count -eq 0 -and $listeners.Count -eq 0) { return }
        Start-Sleep -Seconds 1
    }
    throw 'Tarefas/processos nao pararam. Nenhum processo sera encerrado a forca.'
}
function Start-Pulso {
    foreach ($name in $taskNames) {
        Enable-ScheduledTask -TaskName $name -TaskPath '\' | Out-Null
        Start-ScheduledTask -TaskName $name -TaskPath '\'
    }
}

$app = (Resolve-Path -LiteralPath $AppRoot).ProviderPath.TrimEnd('\')
if (-not (Test-Path -LiteralPath (Join-Path $app 'backend/server.py'))) { throw 'Pasta do Pulso invalida.' }
Assert-NoLinks $app
$base = Split-Path $app -Parent
$updates = Safe-Child $base 'Atualizacoes'
Assert-NoLinks $updates
New-Item -ItemType Directory -Path $updates -Force | Out-Null
$lock = $null
$taskNames = @('Pulso - API', 'Pulso - Interface')
$changed = [Collections.Generic.List[string]]::new()
$tasksTouched = $false
$run = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$work = Safe-Child $updates $run
try {
    $lock = [IO.File]::Open((Safe-Child $updates 'update.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    New-Item -ItemType Directory -Path $work | Out-Null
    $logPath = Safe-Child $work 'atualizacao.log'
    Write-Status 'Validando pacote e instalacao.'
    $zipPath = (Resolve-Path -LiteralPath $Package).ProviderPath
    if ((Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash -ne $Sha256) { throw 'SHA256 do ZIP divergente.' }
    $stage = Safe-Child $work 'pacote'
    New-Item -ItemType Directory -Path $stage | Out-Null
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($zipPath)
    try {
        $seen = @{}
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName
            if ($name -notmatch '^(release\.json|dist/standalone/[^:]+|backend/(server|queries|usage|portfolio|portfolio_actions|portfolio_analysis|group_dashboard)\.py|scripts/start-iis\.mjs)$' -or
                $name.Contains('\') -or $name -match '(^|/)\.\.?(/|$)' -or $seen.ContainsKey($name) -or $name.EndsWith('/')) {
                throw "Entrada inesperada no ZIP: $name"
            }
            $seen[$name] = $true
            $target = Safe-Child $stage $name
            New-Item -ItemType Directory -Path (Split-Path $target -Parent) -Force | Out-Null
            [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
        }
    } finally { $zip.Dispose() }
    $manifest = Get-Content -LiteralPath (Safe-Child $stage 'release.json') -Raw | ConvertFrom-Json
    if ($manifest.application -ne 'PulsoComercial' -or $manifest.schema -ne 1) { throw 'Manifesto incompativel.' }
    $manifestPaths = @{}
    foreach ($file in $manifest.files) {
        if ($file.path -eq 'release.json' -or $manifestPaths.ContainsKey($file.path) -or -not $seen.ContainsKey($file.path)) { throw 'Manifesto inconsistente.' }
        $manifestPaths[$file.path] = $true
        if ((Get-FileHash -LiteralPath (Safe-Child $stage $file.path) -Algorithm SHA256).Hash -ne $file.sha256) { throw "Arquivo corrompido: $($file.path)" }
    }
    if ($manifestPaths.Count -ne $seen.Count - 1) { throw 'ZIP possui arquivos sem hash.' }
    $targets = @('dist/standalone', 'backend/server.py', 'backend/queries.py', 'scripts/start-iis.mjs')
    $newModules = @('backend/portfolio.py', 'backend/portfolio_actions.py', 'backend/usage.py', 'backend/portfolio_analysis.py', 'backend/group_dashboard.py')
    if ($seen.ContainsKey('backend/portfolio_analysis.py')) {
        if (-not $seen.ContainsKey('backend/portfolio.py')) { throw 'Modulos da carteira incompletos.' }
    } elseif ($seen.ContainsKey($newModules[0]) -xor $seen.ContainsKey($newModules[1])) { throw 'Modulos da carteira incompletos.' }
    $targets += @($newModules | Where-Object { $seen.ContainsKey($_) })
    foreach ($required in @('dist/standalone/server.js', 'dist/standalone/package.json', 'backend/server.py', 'backend/queries.py', 'scripts/start-iis.mjs')) {
        if (-not (Test-Path -LiteralPath (Safe-Child $stage $required) -PathType Leaf)) { throw "Pacote incompleto: $required" }
    }
    foreach ($relative in $targets) {
        $target = Safe-Child $app $relative
        Assert-NoLinks $target
        if (-not (Test-Path -LiteralPath $target) -and $relative -notin $newModules) { throw "Instalacao incompleta: $relative" }
        if (Test-Path -LiteralPath $target -PathType Container) {
            if (@(Get-ChildItem -LiteralPath $target -Recurse -Force | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }).Count) { throw 'Instalacao contem links.' }
        }
    }
    foreach ($name in $taskNames) {
        $task = Get-ScheduledTask -TaskName $name -TaskPath '\'
        if ($task.State -ne 'Running' -or -not $task.Settings.Enabled) { throw "Tarefa deve estar habilitada e executando antes da atualizacao: $name" }
        if (@($task.Actions).Count -ne 1) { throw "A tarefa deve ter exatamente uma acao: $name" }
        $action = $task.Actions[0]
        $workingDirectory = ([string]$action.WorkingDirectory).Trim().Trim('"')
        if ([string]::IsNullOrWhiteSpace($workingDirectory)) {
            # The Node launcher resolves its imports relative to its own file.
            # Accept no working directory only for this exact absolute launcher.
            $launcher = ([string]$action.Arguments).Trim().Trim('"')
            $expectedLauncher = Safe-Child $app 'scripts/start-iis.mjs'
            if ($name -ne 'Pulso - Interface' -or $launcher -ne $expectedLauncher) {
                throw "Tarefa '$name': 'Iniciar em' vazio e argumentos nao correspondem ao caminho absoluto do iniciador esperado. Nenhuma tarefa foi alterada."
            }
        } else {
            if ($workingDirectory -notmatch '^[a-zA-Z]:[\\/]' -or $workingDirectory.IndexOfAny([IO.Path]::GetInvalidPathChars()) -ge 0) {
                throw "Tarefa '$name': diretorio de trabalho invalido: '$workingDirectory'. Informe um caminho absoluto."
            }
            if ([IO.Path]::GetFullPath($workingDirectory).TrimEnd('\') -ne $app) { throw "Diretorio da tarefa diferente de AppRoot: $name" }
        }
        $exe = [IO.Path]::GetFileName($action.Execute.Trim('"'))
        if ($name -eq 'Pulso - API') {
            if ($exe -notin @('python', 'python.exe') -or $action.Arguments -notmatch 'backend[/\\]server\.py') { throw 'Acao da tarefa API nao reconhecida.' }
        } elseif ($exe -notin @('node', 'node.exe') -or $action.Arguments -notmatch 'scripts[/\\]start-iis\.mjs') { throw 'Acao da tarefa Interface nao reconhecida.' }
        Export-ScheduledTask -TaskName $name -TaskPath '\' | Set-Content -LiteralPath (Safe-Child $work ($name + '.xml')) -Encoding UTF8
    }
    Test-Services
    Write-Status "Pre-validacao concluida. Versao: $($manifest.version)."
    if ($ValidateOnly) { Write-Status 'Validacao apenas: nenhum arquivo de producao ou tarefa foi alterado.'; return }
    $backup = Safe-Child $work 'backup'
    New-Item -ItemType Directory -Path $backup | Out-Null
    $tasksTouched = $true
    Stop-Pulso
    Write-Status 'Tarefas paradas. Guardando a versao anterior e instalando o pacote.'
    foreach ($relative in $targets) {
        $target = Safe-Child $app $relative
        $old = Safe-Child $backup $relative
        New-Item -ItemType Directory -Path (Split-Path $old -Parent) -Force | Out-Null
        if (Test-Path -LiteralPath $target) { Move-Item -LiteralPath $target -Destination $old }
        $changed.Add($relative)
        Move-Item -LiteralPath (Safe-Child $stage $relative) -Destination $target
    }
    Start-Pulso
    Wait-Services
    Write-Status "SUCESSO. Backup: $backup. Confira as consultas no endereco HTTPS de producao."
    @{ version = $manifest.version; status = 'success'; at = (Get-Date -Format o); backup = $backup; sha256 = $Sha256 } |
        ConvertTo-Json | Set-Content -LiteralPath (Safe-Child $work 'resultado.json') -Encoding UTF8
} catch {
    $failure = $_
    if ($tasksTouched) {
        try {
            if ($changed.Count -gt 0) {
                Stop-Pulso
                foreach ($relative in $changed) {
                    $target = Safe-Child $app $relative
                    $old = Safe-Child $backup $relative
                    if (Test-Path -LiteralPath $target) {
                        $failed = Safe-Child $work ('falha/' + $relative)
                        New-Item -ItemType Directory -Path (Split-Path $failed -Parent) -Force | Out-Null
                        Move-Item -LiteralPath $target -Destination $failed
                    }
                    if (Test-Path -LiteralPath $old) { Copy-Item -LiteralPath $old -Destination $target -Recurse }
                }
            }
            Start-Pulso
            Wait-Services
            Write-Status "FALHA; versao anterior mantida/restaurada. Motivo: $failure"
        } catch {
            Write-Status "ATENCAO: restauracao automatica falhou: $_. Backup e log em $work."
            throw "Atualizacao falhou ($failure) e exige recuperacao manual. Consulte $work."
        }
    } elseif ($lock -and (Test-Path -LiteralPath $work)) {
        Write-Status "FALHA antes da alteracao: $failure"
    }
    throw $failure
} finally { if ($lock) { $lock.Dispose() } }
