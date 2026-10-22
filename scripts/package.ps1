param(
    [string]$Version = '0.1.6.0',
    [string]$Repository = 'S3NTIN3LOne/Jellyplus'
)
$ErrorActionPreference = 'Stop'
if ($Version -notmatch '^\d+\.\d+\.\d+\.\d+$') { throw 'Version must have four numeric components.' }
if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Invalid repository.' }
$root = Split-Path $PSScriptRoot -Parent
$dotnet = 'dotnet'
if (Test-Path (Join-Path $root '.tools/dotnet/dotnet.exe')) { $dotnet = Join-Path $root '.tools/dotnet/dotnet.exe' }
& $dotnet build (Join-Path $root 'src/Jellyplus/Jellyplus.csproj') -c Release "-p:Version=$Version"
if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
$out = Join-Path $root 'artifacts'
New-Item -ItemType Directory -Force $out | Out-Null
$zipName = "Jellyplus_$Version.zip"
$zip = Join-Path $out $zipName
Compress-Archive -LiteralPath (Join-Path $root 'src/Jellyplus/bin/Release/net10.0/Jellyfin.Plugin.Jellyplus.dll') -DestinationPath $zip -Force
$manifest = @(@{
    guid = 'd357e8be-6be8-46b5-bd30-15a530412cd9'
    name = 'Jelly+'
    description = 'Shared playback progress, seasonal recommendations and a personal home screen for Jellyfin Web and LG webOS.'
    overview = 'Shared progress and a personal home screen'
    owner = $Repository.Split('/')[0]
    category = 'General'
    versions = @(@{
        version = $Version
        changelog = 'Resolve the TV recommendation position from Jellyfin home settings, including automatically inserted library rows, instead of matching Live TV row markup.'
        targetAbi = '12.2.0.0'
        sourceUrl = "https://github.com/$Repository/releases/download/v$Version/$zipName"
        checksum = (Get-FileHash -LiteralPath $zip -Algorithm MD5).Hash.ToLowerInvariant()
        timestamp = [DateTime]::UtcNow.ToString('yyyy-MM-ddTHH:mm:ssZ')
    })
})
$json = ConvertTo-Json -InputObject $manifest -Depth 8
[IO.File]::WriteAllText((Join-Path $root 'manifest.json'), $json, [Text.UTF8Encoding]::new($false))
Copy-Item (Join-Path $root 'manifest.json') (Join-Path $out 'manifest.json')
Write-Output "Package: $zip"
