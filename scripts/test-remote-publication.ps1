[CmdletBinding()]
param([ValidateSet('success','connection','build','validation','apply')][string]$Case)
$ErrorActionPreference = 'Stop'
if (-not $Case) {
    foreach ($scenario in @('success','connection','build','validation','apply')) {
        & powershell.exe -NoProfile -File $PSCommandPath -Case $scenario
        $expected = if ($scenario -eq 'success') { 0 } else { 1 }
        if ($LASTEXITCODE -ne $expected) { throw "Unexpected exit for $scenario" }
    }
    Write-Host 'Five remote publication scenarios passed (mocked transport/build).'
    return
}
$global:PulsoRemoteCase = $Case
$global:PulsoRemoteCalls = 0
$global:PulsoRemoteTemp = Join-Path ([IO.Path]::GetTempPath()) ('pulso-remote-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $global:PulsoRemoteTemp | Out-Null
function New-PSSession { param($ComputerName,$Authentication,$ErrorAction) if ($global:PulsoRemoteCase -eq 'connection') { throw 'Mock access denied' }; return 'mock-session' }
function Remove-PSSession {
    param($Session,$ErrorAction)
    $expectedCalls = switch ($global:PulsoRemoteCase) { 'build' {1} 'validation' {3} default {4} }
    if ($global:PulsoRemoteCalls -ne $expectedCalls) { throw "Wrong deployment stage count: $global:PulsoRemoteCalls" }
}
function Invoke-Command {
    param($Session,$ScriptBlock,$ArgumentList)
    $global:PulsoRemoteCalls++
    if ($global:PulsoRemoteCalls -eq 2) { return 'C:\Pulso\Pacotes\mock' }
    if ($global:PulsoRemoteCase -eq 'validation' -and $global:PulsoRemoteCalls -eq 3) { throw 'Mock validation failed' }
    if ($global:PulsoRemoteCase -eq 'apply' -and $global:PulsoRemoteCalls -eq 4) { throw 'Mock install failed; rollback handled remotely' }
}
function Copy-Item { param($LiteralPath,$Destination,$ToSession) }
function node { $global:LASTEXITCODE = $(if ($global:PulsoRemoteCase -eq 'build') { 1 } else { 0 }) }
function python {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq 'scripts/package-release.py') {
        $file = Join-Path $global:PulsoRemoteTemp 'release.zip'
        [IO.File]::WriteAllText($file,'mock package')
        @{package=$file;sha256=(Get-FileHash -LiteralPath $file).Hash;version='TEST'} | ConvertTo-Json | Set-Content -LiteralPath $args[2]
    }
}
& (Join-Path $PSScriptRoot 'publish-remote.ps1') -UseCurrentCredential
exit $LASTEXITCODE
