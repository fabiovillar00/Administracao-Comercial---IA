# One-time activation on the IIS server. Preserves Windows authentication and rewrite rules.
[CmdletBinding()]
param([string]$AppRoot='C:\Pulso\App', [string]$SiteRoot='C:\Pulso\Site')
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$principal=[Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Execute como administrador no servidor IIS.' }
$app=(Resolve-Path -LiteralPath $AppRoot).ProviderPath.TrimEnd('\')
$site=(Resolve-Path -LiteralPath $SiteRoot).ProviderPath.TrimEnd('\')
$base=Split-Path $app -Parent
if ((Split-Path $site -Parent) -ne $base) { throw 'App e Site devem compartilhar a pasta base do Pulso.' }
if (-not (Test-Path -LiteralPath (Join-Path $app 'backend/server.py'))) { throw 'Aplicacao nao encontrada.' }
$handler=Join-Path $site 'pulso-user.ashx'
$source=Join-Path $PSScriptRoot 'pulso-user.ashx'
if (-not (Test-Path -LiteralPath $handler) -or -not (Test-Path -LiteralPath $source)) { throw 'Handler de identidade original ou atualizado ausente.' }
Import-Module WebAdministration
$sites=@(Get-Website | Where-Object { [Environment]::ExpandEnvironmentVariables($_.physicalPath).TrimEnd('\') -eq $site })
if ($sites.Count -ne 1) { throw 'Nao foi possivel identificar unicamente o site IIS.' }
$pool=$sites[0].applicationPool
$poolItem=Get-Item "IIS:\AppPools\$pool"
# WebAdministration may return the identity name instead of its numeric enum value.
$poolIdentity=([string]$poolItem.processModel.identityType).Trim()
if ($poolIdentity -notin @('ApplicationPoolIdentity','4')) { throw 'Pool usa identidade personalizada; revise as permissoes antes da ativacao.' }
$apiUser=(Get-ScheduledTask -TaskName 'Pulso - API' -TaskPath '\').Principal.UserId
if (-not $apiUser) { throw 'Conta da API nao encontrada.' }
$accounts=@('S-1-5-18','S-1-5-32-544',"IIS APPPOOL\$pool",$apiUser)
$sids=@($accounts | ForEach-Object {
    if ($_ -like 'S-1-*') { [Security.Principal.SecurityIdentifier]::new($_) }
    else { ([Security.Principal.NTAccount]::new($_)).Translate([Security.Principal.SecurityIdentifier]) }
})
$folder=Join-Path $base 'Config\Usage'
$key=Join-Path $folder 'identity.key'
foreach ($target in @($app,$site,$folder,$key,$handler)) {
    $cursor=$target
    while ($cursor) {
        if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Link/junction nao permitido: $cursor" }
        $cursor=Split-Path $cursor -Parent
    }
}
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$acl=[Security.AccessControl.DirectorySecurity]::new()
$acl.SetAccessRuleProtection($true,$false)
for ($i=0; $i -lt $sids.Count; $i++) {
    $rights=if ($i -lt 2) { 'FullControl' } else { 'ReadAndExecute' }
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sids[$i],$rights,'ContainerInherit,ObjectInherit','None','Allow'))
}
Set-Acl -LiteralPath $folder -AclObject $acl
if (-not (Test-Path -LiteralPath $key)) {
    $bytes=New-Object byte[] 32
    $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes); [IO.File]::WriteAllBytes($key,$bytes) } finally { $rng.Dispose(); [Array]::Clear($bytes,0,$bytes.Length) }
} elseif ((Get-Item -LiteralPath $key).Length -ne 32) { throw 'Chave existente invalida; nao foi sobrescrita.' }
$fileAcl=[Security.AccessControl.FileSecurity]::new()
$fileAcl.SetAccessRuleProtection($true,$false)
for ($i=0; $i -lt $sids.Count; $i++) {
    $rights=if ($i -lt 2) { 'FullControl' } else { 'Read' }
    $fileAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sids[$i],$rights,'Allow'))
}
Set-Acl -LiteralPath $key -AclObject $fileAcl
$dataFolder=Join-Path $app 'outputs\usage'
$cursor=$dataFolder
while ($cursor) {
    if ((Test-Path -LiteralPath $cursor) -and ((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Link/junction nao permitido: $cursor" }
    $cursor=Split-Path $cursor -Parent
}
New-Item -ItemType Directory -Path $dataFolder -Force | Out-Null
$dataAcl=[Security.AccessControl.DirectorySecurity]::new()
$dataAcl.SetAccessRuleProtection($true,$false)
foreach ($i in @(0,1,3)) {
    $rights=if ($i -eq 3) { 'Modify' } else { 'FullControl' }
    $dataAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sids[$i],$rights,'ContainerInherit,ObjectInherit','None','Allow'))
}
Set-Acl -LiteralPath $dataFolder -AclObject $dataAcl
$backup=Join-Path $base ('Atualizacoes\identidade-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $backup | Out-Null
Copy-Item -LiteralPath $handler -Destination (Join-Path $backup 'pulso-user.ashx')
Copy-Item -LiteralPath $source -Destination $handler -Force
Write-Host "Identidade para auditoria preparada. Backup: $backup."
Write-Host 'Publique o pacote da aplicacao e valide /api/me e /uso via HTTPS com Fabio e outra conta. Nao foram alteradas regras de autenticacao ou autorizacao do IIS.'
