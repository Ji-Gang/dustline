param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$package=Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$minor=([version]$package.version).ToString(2)
$build=Join-Path $root "dist\DUSTLINE-Internet-$minor-win32-x64"
if (!$OutputDirectory) { $OutputDirectory=Join-Path $root 'dist\release' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$appDir=Join-Path $build 'resources\app'
$files=[ordered]@{}
Get-ChildItem -LiteralPath $appDir -Recurse -File | Sort-Object FullName | ForEach-Object {
 $relative=$_.FullName.Substring($appDir.Length+1).Replace('\','/')
 $files[$relative]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower()
}
$zip=Join-Path $OutputDirectory 'dustline-update.zip'
Compress-Archive -Path (Join-Path $appDir '*') -DestinationPath $zip -Force
$runtime=(Get-Content (Join-Path $build 'runtime-version.txt') -Raw).Trim()
@{schema=1;version=$package.version;runtime=$runtime;sha256=(Get-FileHash $zip -Algorithm SHA256).Hash.ToLower();files=$files} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $OutputDirectory 'update.json')
Compress-Archive -LiteralPath $build -DestinationPath (Join-Path $OutputDirectory 'DUSTLINE-Windows.zip') -Force
