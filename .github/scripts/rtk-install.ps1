# RTK Installer for Windows (PowerShell 5.1, ASCII only)
# Usage: .\.github\scripts\rtk-install.ps1
$ErrorActionPreference = 'Stop'

$RtkVersion = 'v0.37.2'
$InstallDir = "$env:USERPROFILE\tools\rtk"
$ZipUrl     = "https://github.com/rtk-ai/rtk/releases/download/$RtkVersion/rtk-x86_64-pc-windows-msvc.zip"
$ZipPath    = "$env:TEMP\rtk-install.zip"

Write-Host "[RTK] Installing $RtkVersion to $InstallDir"

# 1. Already installed?
$existing = Get-Command rtk.exe -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[RTK] Already installed at: $($existing.Source)" -ForegroundColor Green
    & rtk --version
    return
}

# 2. Create install dir
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

# 3. Download
Write-Host "[RTK] Downloading from $ZipUrl ..."
$ProgressPreference = 'SilentlyContinue'
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath -UseBasicParsing

# 4. Extract
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force

# 5. Add to User PATH (persistent)
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
    Write-Host '[RTK] Added to User PATH. Restart terminal or VS Code to apply.'
}

# 6. Verify in current session
$env:Path = "$env:Path;$InstallDir"
& "$InstallDir\rtk.exe" --version

Write-Host ''
Write-Host '[RTK] Done. Next steps:'
Write-Host '  1. Restart VS Code (Developer: Reload Window)'
Write-Host '  2. Run: rtk init -g --copilot   (already done if hook config exists)'
Write-Host '  3. Source wrappers: . .\.github\scripts\rtk-wrappers.ps1'
