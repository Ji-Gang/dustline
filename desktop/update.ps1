param([string]$Repository='Ji-Gang/dustline',[string]$PackageDirectory)
$ErrorActionPreference='Stop'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
$install=[IO.Path]::GetFullPath($PSScriptRoot)
$appDir=Join-Path $install 'resources\app'
if (!(Test-Path -LiteralPath (Join-Path $install 'DUSTLINE.exe'))) { throw 'Run this script from the extracted DUSTLINE folder.' }
if (Get-Process DUSTLINE -ErrorAction SilentlyContinue) { throw 'Close DUSTLINE before updating. No running game will be stopped.' }
$current=Get-Content -Encoding UTF8 -LiteralPath (Join-Path $appDir 'package.json') -Raw | ConvertFrom-Json
$runtime=Get-Content -Encoding UTF8 -LiteralPath (Join-Path $install 'runtime-version.txt') -Raw
$stage=Join-Path $install ('.update-'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
if ($PackageDirectory) {
 Copy-Item -LiteralPath (Join-Path $PackageDirectory 'update.json') -Destination $stage
 Copy-Item -LiteralPath (Join-Path $PackageDirectory 'dustline-update.zip') -Destination $stage
} else {
 if ($Repository -notmatch '^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$') { throw 'Invalid owner/repository.' }
 # Public Release downloads avoid anonymous REST API rate limits.
 Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repository/releases/latest/download/update.json" -OutFile (Join-Path $stage 'update.json') -TimeoutSec 60
 $releaseManifest=Get-Content -Encoding UTF8 -LiteralPath (Join-Path $stage 'update.json') -Raw | ConvertFrom-Json
 if ($releaseManifest.version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid release version.' }
 # Pin the ZIP to the manifest version, even if another release appears now.
 Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repository/releases/download/v$($releaseManifest.version)/dustline-update.zip" -OutFile (Join-Path $stage 'dustline-update.zip') -TimeoutSec 120
}
$manifest=Get-Content -Encoding UTF8 -LiteralPath (Join-Path $stage 'update.json') -Raw | ConvertFrom-Json
if ($manifest.schema -ne 1 -or $manifest.runtime -ne $runtime.Trim()) { throw 'Runtime changed. Download the full release once.' }
if ([version]$manifest.version -le [version]$current.version) { Write-Host "Already current: $($current.version)"; return }
$zip=Join-Path $stage 'dustline-update.zip'
if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Update checksum mismatch; installed game is unchanged.' }
Add-Type -AssemblyName System.IO.Compression.FileSystem
$extract=Join-Path $stage 'app'
New-Item -ItemType Directory -Path $extract | Out-Null
$archive=[IO.Compression.ZipFile]::OpenRead($zip)
try {
 foreach ($entry in $archive.Entries) {
  $name=$entry.FullName.Replace('\','/')
  if ($name -match '(^/|:|(^|/)\.\.(/|$))') { throw 'Unsafe archive path.' }
  $target=[IO.Path]::GetFullPath((Join-Path $extract $name))
  if (!$target.StartsWith($extract+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) { throw 'Archive path escapes staging directory.' }
  if ($name.EndsWith('/')) { continue }
  $parent=Split-Path -Parent $target
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  [IO.Compression.ZipFileExtensions]::ExtractToFile($entry,$target,$false)
 }
} finally { $archive.Dispose() }
$files=@(Get-ChildItem -LiteralPath $extract -File -Recurse)
if ($files.Count -ne @($manifest.files.PSObject.Properties).Count) { throw 'Unexpected update file count.' }
foreach ($file in $files) {
 $relative=$file.FullName.Substring($extract.Length+1).Replace('\','/')
 $expected=$manifest.files.PSObject.Properties[$relative]
 if (!$expected -or (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash -ne $expected.Value) { throw "Invalid file: $relative" }
}
$next=Get-Content -Encoding UTF8 -LiteralPath (Join-Path $extract 'package.json') -Raw | ConvertFrom-Json
if ($next.version -ne $manifest.version -or $next.name -ne 'dustline-desktop' -or $next.main -ne 'desktop/main.cjs') { throw 'Invalid application metadata.' }
if (Get-Process DUSTLINE -ErrorAction SilentlyContinue) { throw 'Close DUSTLINE and retry.' }
$backup=Join-Path $install ('resources\app-backup-'+[guid]::NewGuid().ToString('N'))
# All paths derive from this installation; preserve the previous app for recovery.
Move-Item -LiteralPath $appDir -Destination $backup
try { Move-Item -LiteralPath $extract -Destination $appDir } catch { Move-Item -LiteralPath $backup -Destination $appDir; throw }
Write-Host "Updated $($current.version) -> $($next.version). Previous app: $backup"
