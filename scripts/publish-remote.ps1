[CmdletBinding()]
param(
    [string]$Server = 'DMBAPP03.DMB.LOCAL',
    [switch]$CheckAccessOnly,
    [switch]$UseCurrentCredential
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$outputs = Join-Path $root 'outputs'
New-Item -ItemType Directory -Path $outputs -Force | Out-Null
$run = (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$log = Join-Path $outputs "publicacao-$run.log"
$session = $null
$lock = $null
$transcribing = $false
$applying = $false
try {
    $lock = [IO.File]::Open((Join-Path $outputs 'publish.lock'), 'OpenOrCreate', 'ReadWrite', 'None')
    Start-Transcript -Path $log | Out-Null
    $transcribing = $true
    Write-Host "Destino: $Server - C:\Pulso\App"
    Write-Host 'Use este processo somente depois de aprovar as alteracoes locais.'
    Write-Host 'Conectando com autenticacao do dominio; nenhuma senha sera gravada.'
    $connection = @{ComputerName = $Server; Authentication = 'Kerberos'; ErrorAction = 'Stop'}
    if (-not $UseCurrentCredential) {
        $credential = Get-Credential -Message "Conta autorizada a atualizar o Pulso em $Server (DOMINIO\usuario)"
        if (-not $credential) { throw 'Autenticacao cancelada.' }
        $connection.Credential = $credential
    }
    $session = New-PSSession @connection
    Invoke-Command -Session $session -ScriptBlock {
        $ErrorActionPreference = 'Stop'
        $admin = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
        if (-not $admin.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'A conta remota precisa administrar os arquivos e tarefas do Pulso.' }
        if (-not (Test-Path -LiteralPath 'C:\Pulso\App\backend\server.py')) { throw 'Instalacao Pulso nao encontrada neste servidor.' }
        Get-ScheduledTask -TaskName 'Pulso - API','Pulso - Interface' | Select-Object TaskName,State
    }
    if ($CheckAccessOnly) { Write-Host 'Acesso confirmado. Nenhum pacote gerado ou aplicado.'; return }
    # The desktop runtime may not be present in the ordinary Windows PATH.
    $nodeBin = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin'
    $pythonBin = Join-Path $env:LOCALAPPDATA 'Programs\Python\Python310'
    foreach ($bin in @($nodeBin, $pythonBin)) {
        if (Test-Path -LiteralPath $bin) { $env:PATH = $bin + ';' + $env:PATH }
    }
    Get-Command node,python -ErrorAction Stop | Out-Null
    $resultFile = Join-Path $outputs "release-$run.json"
    Write-Host 'Executando testes e preparando a versao...'
    & (Join-Path $PSScriptRoot 'prepare-release.ps1') -ResultFile $resultFile
    if (-not (Test-Path -LiteralPath $resultFile)) { throw 'Preparacao nao produziu um pacote confirmado.' }
    $release = Get-Content -LiteralPath $resultFile -Raw | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath $release.package -Algorithm SHA256).Hash -ne $release.sha256) { throw 'Hash do pacote local divergente.' }
    $remote = Invoke-Command -Session $session -ArgumentList $run -ScriptBlock {
        param($Run)
        $ErrorActionPreference = 'Stop'
        $folder = Join-Path 'C:\Pulso\Pacotes' $Run
        New-Item -ItemType Directory -Path $folder | Out-Null
        $folder
    }
    Write-Host 'Transferindo o pacote e o atualizador...'
    Copy-Item -LiteralPath $release.package -Destination "$remote\release.zip" -ToSession $session
    Copy-Item -LiteralPath (Join-Path $root 'deploy\iis\Atualizar-Pulso.ps1') -Destination "$remote\Atualizar-Pulso.ps1" -ToSession $session
    Write-Host 'Validando a instalacao remota...'
    Invoke-Command -Session $session -ArgumentList $remote,$release.sha256 -ScriptBlock {
        param($Folder,$Hash)
        $ErrorActionPreference = 'Stop'
        & (Join-Path $Folder 'Atualizar-Pulso.ps1') -Package (Join-Path $Folder 'release.zip') -Sha256 $Hash -ValidateOnly
    }
    Write-Host 'Aplicando a versao. Mantenha esta janela aberta e a conexao de rede ativa.'
    $applying = $true
    Invoke-Command -Session $session -ArgumentList $remote,$release.sha256 -ScriptBlock {
        param($Folder,$Hash)
        $ErrorActionPreference = 'Stop'
        & (Join-Path $Folder 'Atualizar-Pulso.ps1') -Package (Join-Path $Folder 'release.zip') -Sha256 $Hash
    }
    $applying = $false
    Write-Host "SUCESSO: versao $($release.version) publicada. Confira o site com Ctrl+F5."
} catch {
    Write-Host "FALHA: $($_.Exception.Message)" -ForegroundColor Red
    if ($applying) {
        Write-Host 'A publicacao nao foi confirmada. Consulte o log em C:\Pulso\Atualizacoes no servidor antes de repetir. O atualizador tenta restaurar em falhas de instalacao; perda da conexao exige conferir o estado remoto.'
    } else { Write-Host 'Publicacao interrompida antes da aplicacao. Nenhuma troca foi solicitada por este processo.' }
    Write-Host "Log local: $log"
    exit 1
} finally {
    if ($session) { Remove-PSSession -Session $session -ErrorAction SilentlyContinue }
    if ($transcribing) { Stop-Transcript | Out-Null }
    if ($lock) { $lock.Dispose() }
}
