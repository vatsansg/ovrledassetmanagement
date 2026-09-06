# Stages a release build and compiles the Windows installer.
#
# Prerequisites (one-time, manual - see installer/README.md):
#   1. Inno Setup 6 installed (https://jrsoftware.org/isinfo.php)
#   2. A portable Node.js Windows x64 build extracted into
#      installer\vendor\node\ (so installer\vendor\node\node.exe exists)
#
# Usage: powershell -File installer\build.ps1

$ErrorActionPreference = 'Stop'

$installerDir = $PSScriptRoot
$root = Split-Path -Parent $installerDir
$stageDir = Join-Path $installerDir 'stage'
$vendorNode = Join-Path $installerDir 'vendor\node\node.exe'
$iscc = "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"

if (-not (Test-Path $vendorNode)) {
    throw "Portable Node runtime not found at $vendorNode. See installer\README.md for how to obtain it."
}
if (-not (Test-Path $iscc)) {
    throw "Inno Setup 6 (ISCC.exe) not found at $iscc. Install it from https://jrsoftware.org/isinfo.php."
}

Write-Host "==> Cleaning previous stage"
Remove-Item -Recurse -Force $stageDir -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path "$stageDir\server" | Out-Null
New-Item -ItemType Directory -Force -Path "$stageDir\client" | Out-Null
New-Item -ItemType Directory -Force -Path "$stageDir\node" | Out-Null

Write-Host "==> Building client"
Push-Location "$root\client"
npm ci
if ($LASTEXITCODE -ne 0) { throw "client npm ci failed" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "client build failed" }
Pop-Location
Copy-Item -Recurse -Force "$root\client\dist" "$stageDir\client\dist"

Write-Host "==> Staging server (production dependencies only)"
Copy-Item -Recurse -Force "$root\server\src" "$stageDir\server\src"
Copy-Item -Force "$root\server\package.json" "$stageDir\server\package.json"
if (Test-Path "$root\server\package-lock.json") {
    Copy-Item -Force "$root\server\package-lock.json" "$stageDir\server\package-lock.json"
}
Push-Location "$stageDir\server"
npm ci --omit=dev
if ($LASTEXITCODE -ne 0) { throw "server npm ci failed" }
Pop-Location

Write-Host "==> Copying portable Node runtime"
Copy-Item -Recurse -Force "$installerDir\vendor\node\*" "$stageDir\node"

Write-Host "==> Compiling installer"
& $iscc "$installerDir\LedAssetManager.iss"
if ($LASTEXITCODE -ne 0) { throw "ISCC compilation failed" }

Write-Host "==> Done. Installer output in installer\output\"
