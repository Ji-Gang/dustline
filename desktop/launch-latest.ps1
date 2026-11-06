param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$gameRoot=Split-Path -Parent $PSScriptRoot
$latest=Get-ChildItem -LiteralPath (Join-Path $gameRoot 'dist') -Directory | Where-Object { $_.Name -match '^DUSTLINE-Internet-(\d+\.\d+)-win32-x64$' -and (Test-Path -LiteralPath (Join-Path $_.FullName 'DUSTLINE.exe')) } | Sort-Object { [version]($_.Name -replace '^DUSTLINE-Internet-|\-win32-x64$','') } -Descending | Select-Object -First 1
if (!$latest) { throw 'No installed DUSTLINE build found.' }
$target=Join-Path $latest.FullName 'DUSTLINE.exe'
if ($CheckOnly) { Write-Output $target; exit 0 }
$older=Get-Process DUSTLINE -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path -ne $target }
if ($older) { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.MessageBox]::Show('请先关闭正在运行的旧版 DUSTLINE，再启动新版。','DUSTLINE') | Out-Null; exit 0 }
Start-Process -FilePath (Join-Path $latest.FullName 'DUSTLINE.exe') -WorkingDirectory $latest.FullName
