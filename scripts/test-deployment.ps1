# Integration tests with real temporary files and mocked Windows services.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$global:PulsoTest_root = Join-Path ([IO.Path]::GetTempPath()) ('pulso-deploy-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $global:PulsoTest_root | Out-Null
$global:PulsoTest_states = @{}
$global:PulsoTest_enabled = @{}
$global:PulsoTest_touches = 0
$global:PulsoTest_failNew = $false
$global:PulsoTest_failStop = $false
$global:PulsoTest_failMove = $false
$global:PulsoTest_movedOnce = $false
function Get-ScheduledTask {
    param($TaskName, $TaskPath)
    if ($TaskName -eq 'Pulso - Interface' -and $global:PulsoTest_case -in @('absolute-launcher', 'wrong-launcher')) {
        $launcher = Join-Path $global:PulsoTest_app 'scripts/start-iis.mjs'
        if ($global:PulsoTest_case -eq 'wrong-launcher') { $launcher = 'C:\OtherApp\scripts\start-iis.mjs' }
        return [pscustomobject]@{ State = $global:PulsoTest_states[$TaskName]; Settings = [pscustomobject]@{Enabled = $true}; Actions = @([pscustomobject]@{ WorkingDirectory = ''; Execute = '"C:\Program Files\nodejs\node.exe"'; Arguments = '"' + $launcher + '"' }) }
    }
    [pscustomobject]@{ State = $global:PulsoTest_states[$TaskName]; Settings = [pscustomobject]@{Enabled = $global:PulsoTest_enabled[$TaskName]}; Actions = @([pscustomobject]@{ WorkingDirectory = $global:PulsoTest_workingDirectory; Execute = $(if ($TaskName -eq 'Pulso - API') { 'python.exe' } else { 'node.exe' }); Arguments = $(if ($TaskName -eq 'Pulso - API') { '-u backend/server.py' } else { 'scripts/start-iis.mjs' }) }) }
}
function Export-ScheduledTask { param($TaskName, $TaskPath) '<Task />' }
function Disable-ScheduledTask { param($TaskName, $TaskPath) $global:PulsoTest_touches++; $global:PulsoTest_enabled[$TaskName] = $false }
function Enable-ScheduledTask { param($TaskName, $TaskPath) $global:PulsoTest_enabled[$TaskName] = $true }
function Stop-ScheduledTask { param($TaskName, $TaskPath) if ($global:PulsoTest_failStop) { throw 'Simulated stop failure' }; $global:PulsoTest_states[$TaskName] = 'Ready' }
function Start-ScheduledTask { param($TaskName, $TaskPath) $global:PulsoTest_states[$TaskName] = 'Running' }
function Get-NetTCPConnection { [CmdletBinding()]param($State) }
function Start-Sleep { param($Seconds) }
function Invoke-RestMethod {
    param($Uri, $TimeoutSec)
    if ($global:PulsoTest_failNew -and (Get-Content -LiteralPath (Join-Path $global:PulsoTest_app 'backend/server.py') -Raw) -eq 'NEW') { throw 'Simulated unhealthy new API' }
    return @{ok = $true; database = 'TEST'}
}
function Invoke-WebRequest { param($Uri, [switch]$UseBasicParsing, $TimeoutSec) return @{StatusCode = 200; Content = 'Pulso'} }
function Move-Item {
    param($LiteralPath, $Destination)
    if ($global:PulsoTest_failMove -and $LiteralPath -like '*pacote*backend*server.py' -and -not $global:PulsoTest_movedOnce) {
        $global:PulsoTest_movedOnce = $true
        throw 'Simulated partial installation failure'
    }
    Microsoft.PowerShell.Management\Move-Item -LiteralPath $LiteralPath -Destination $Destination
}
function Assert($Condition, $Message) { if (-not $Condition) { throw $Message } }
$updater = Join-Path (Split-Path $PSScriptRoot -Parent) 'deploy/iis/Atualizar-Pulso.ps1'
Add-Type -AssemblyName System.IO.Compression.FileSystem
foreach ($case in @('absolute-launcher', 'wrong-launcher', 'validate', 'quoted-directory', 'empty-directory', 'bad-hash', 'bad-entry', 'bad-file-hash', 'success', 'rollback', 'partial-copy', 'stop-failure')) {
    $global:PulsoTest_case = $case
    $caseRoot = Join-Path $global:PulsoTest_root $case
    $global:PulsoTest_app = Join-Path $caseRoot 'App'
    $global:PulsoTest_workingDirectory = $global:PulsoTest_app
    if ($case -eq 'quoted-directory') { $global:PulsoTest_workingDirectory = '"' + $global:PulsoTest_app + '"' }
    if ($case -eq 'empty-directory') { $global:PulsoTest_workingDirectory = '' }
    $payload = Join-Path $caseRoot 'payload'
    $global:PulsoTest_touches = 0
    $global:PulsoTest_failNew = $case -eq 'rollback'
    $global:PulsoTest_failStop = $case -eq 'stop-failure'
    $global:PulsoTest_failMove = $case -eq 'partial-copy'
    $global:PulsoTest_movedOnce = $false
    foreach ($name in @('Pulso - API', 'Pulso - Interface')) { $global:PulsoTest_states[$name] = 'Running'; $global:PulsoTest_enabled[$name] = $true }
    $files = @()
    foreach ($relative in @('dist/standalone/server.js', 'dist/standalone/package.json', 'dist/standalone/asset.js', 'backend/server.py', 'backend/queries.py', 'scripts/start-iis.mjs')) {
        foreach ($parent in @($global:PulsoTest_app, $payload)) {
            $path = Join-Path $parent $relative
            New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force | Out-Null
            [IO.File]::WriteAllText($path, $(if ($parent -eq $global:PulsoTest_app) { 'OLD' } else { 'NEW' }))
        }
        $files += @{path = $relative; sha256 = (Get-FileHash -LiteralPath (Join-Path $payload $relative)).Hash}
    }
    [IO.File]::WriteAllText((Join-Path $global:PulsoTest_app '.env'), 'PRESERVE')
    # New modules are absent in older installations; upgrade and rollback must both work.
    foreach ($relative in @('backend/portfolio.py', 'backend/portfolio_actions.py', 'backend/usage.py')) {
        $path = Join-Path $payload $relative
        [IO.File]::WriteAllText($path, 'NEW')
        $files += @{path = $relative; sha256 = (Get-FileHash -LiteralPath $path).Hash; newModule = $true}
    }
    [IO.File]::WriteAllText((Join-Path $global:PulsoTest_app 'dist/standalone/obsolete.js'), 'OLD')
    if ($case -eq 'bad-file-hash') { $files[0].sha256 = '0' * 64 }
    @{application = 'PulsoComercial'; schema = 1; version = 'TEST'; files = $files} | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $payload 'release.json')
    $zip = Join-Path $caseRoot 'package.zip'
    $archive = [IO.Compression.ZipFile]::Open($zip, 'Create')
    foreach ($file in $files) {
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $payload $file.path), $file.path) | Out-Null
    }
    [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, (Join-Path $payload 'release.json'), 'release.json') | Out-Null
    $archive.Dispose()
    if ($case -eq 'bad-entry') {
        $archive = [IO.Compression.ZipFile]::Open($zip, 'Update')
        $entry = $archive.CreateEntry('dist/standalone/../../escape.txt')
        $archive.Dispose()
    }
    $hash = (Get-FileHash -LiteralPath $zip).Hash
    if ($case -eq 'bad-hash') { $hash = '0' * 64 }
    $failed = $false
    try { & $updater -AppRoot $global:PulsoTest_app -Package $zip -Sha256 $hash -ValidateOnly:($case -in @('validate', 'quoted-directory', 'absolute-launcher')) } catch { $failed = $true; Write-Host "Expected failure for ${case}: $_" }
    $shouldFail = $case -notin @('success', 'validate', 'quoted-directory', 'absolute-launcher')
    Assert ($failed -eq $shouldFail) "Unexpected outcome: $case"
    $expected = if ($case -eq 'success') { 'NEW' } else { 'OLD' }
    foreach ($file in $files) {
        $installedFile = Join-Path $global:PulsoTest_app $file.path
        if ($file.newModule -and $case -ne 'success') {
            Assert (-not (Test-Path -LiteralPath $installedFile)) "New module left after ${case}: $($file.path)"
        } else {
            Assert ((Get-Content -LiteralPath $installedFile -Raw) -eq $expected) "Incorrect file after ${case}: $($file.path)"
        }
    }
    Assert ((Get-Content -LiteralPath (Join-Path $global:PulsoTest_app '.env') -Raw) -eq 'PRESERVE') 'Configuration changed'
    Assert ((Test-Path (Join-Path $global:PulsoTest_app 'dist/standalone/obsolete.js')) -eq ($case -ne 'success')) 'Standalone tree replacement failed'
    foreach ($name in @('Pulso - API', 'Pulso - Interface')) { Assert ($global:PulsoTest_states[$name] -eq 'Running' -and $global:PulsoTest_enabled[$name]) 'Tasks were not restored' }
    if ($case -in @('validate', 'quoted-directory', 'empty-directory', 'absolute-launcher', 'wrong-launcher', 'bad-hash', 'bad-entry', 'bad-file-hash')) { Assert ($global:PulsoTest_touches -eq 0) 'Preflight changed tasks' }
    Write-Host "PASS: $case"
}
Write-Host "12 deployment scenarios passed. Evidence: $global:PulsoTest_root"
