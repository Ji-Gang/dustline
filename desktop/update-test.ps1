$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$test=Join-Path $root ('desktop-check\updater-'+[guid]::NewGuid().ToString('N'))
$install=Join-Path $test 'installed'
$package=Join-Path $test 'package'
$content=Join-Path $test 'content'
New-Item -ItemType Directory -Path "$install\resources\app","$package","$content\desktop" -Force | Out-Null
Set-Content -LiteralPath "$install\DUSTLINE.exe" -Value ''
Set-Content -LiteralPath "$install\runtime-version.txt" -Value '44.6.0'
@{name='dustline-desktop';version='0.16.0';main='desktop/main.cjs'} | ConvertTo-Json | Set-Content -Encoding UTF8 "$install\resources\app\package.json"
Copy-Item -LiteralPath "$PSScriptRoot\update.ps1" -Destination "$install\update.ps1"
Add-Content -LiteralPath "$install\update.ps1" -Value '# previous updater revision'
@{name='dustline-desktop';version='0.16.1';main='desktop/main.cjs'} | ConvertTo-Json | Set-Content -Encoding UTF8 "$content\package.json"
Copy-Item -LiteralPath "$PSScriptRoot\update.ps1" -Destination "$content\desktop\update.ps1"
Set-Content -LiteralPath "$content\desktop\main.cjs" -Value '// isolated updater fixture'
$files=[ordered]@{}
Get-ChildItem -LiteralPath $content -File -Recurse | ForEach-Object { $files[$_.FullName.Substring($content.Length+1).Replace('\','/')]=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLower() }
Compress-Archive -Path "$content\*" -DestinationPath "$test\good.zip"
@{schema=1;version='0.16.1';runtime='44.6.0';sha256=(Get-FileHash "$test\good.zip" -Algorithm SHA256).Hash;files=$files} | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 "$package\update.json"
Set-Content -LiteralPath "$package\dustline-update.zip" -Value 'corrupt archive'
$rejected=$false
try { & "$install\update.ps1" -PackageDirectory $package } catch { $rejected=$_.Exception.Message -like '*checksum mismatch*' }
if (!$rejected -or (Get-Content "$install\resources\app\package.json" -Raw | ConvertFrom-Json).version -ne '0.16.0') { throw 'Corrupted update changed installed game.' }
Write-Host 'PASS corrupted archive rejected without changing installation'
Copy-Item -LiteralPath "$test\good.zip" -Destination "$package\dustline-update.zip" -Force
& "$install\update.ps1" -PackageDirectory $package
if ((Get-Content "$install\resources\app\package.json" -Raw | ConvertFrom-Json).version -ne '0.16.1') { throw 'Update was not installed.' }
if ((Get-FileHash "$install\update.ps1").Hash -ne (Get-FileHash "$content\desktop\update.ps1").Hash) { throw 'Updater was not refreshed.' }
Write-Host 'PASS content update and updater refresh'
Rename-Item -LiteralPath "$package\dustline-update.zip" -NewName 'not-needed.zip'
& "$install\update.ps1" -PackageDirectory $package
Write-Host 'PASS current installation skips archive download/copy'
