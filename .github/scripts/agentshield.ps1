# AgentShield Scanner (PowerShell 5.1)
# Usage:
#   .\agentshield.ps1                        # scan whole project
#   .\agentshield.ps1 -Path backend\app      # scan path
#   .\agentshield.ps1 -ChangedOnly           # scan git diff
#   .\agentshield.ps1 -Severity HIGH         # filter
#   .\agentshield.ps1 -IncludeDocs           # include markdown/docs
#   .\agentshield.ps1 -FailOnFound           # exit code != 0 if findings

[CmdletBinding()]
param(
    [string]$Path = ".",
    [switch]$ChangedOnly,
    [ValidateSet("LOW","MED","HIGH","ALL")]
    [string]$Severity = "ALL",
    [switch]$IncludeDocs,
    [switch]$FailOnFound
)

$ErrorActionPreference = "Stop"

# ============================================================
# Rule definitions (subset of 102 — extensible)
# ============================================================

$rules = @(
    # === Cat A: Secrets ===
    @{ Id="A1";  Cat="Secret";    Sev="HIGH"; Pattern='AKIA[0-9A-Z]{16}';                Msg="AWS Access Key" }
    @{ Id="A2";  Cat="Secret";    Sev="HIGH"; Pattern='sk_live_[0-9a-zA-Z]{20,}';        Msg="Stripe live secret key" }
    @{ Id="A3";  Cat="Secret";    Sev="HIGH"; Pattern='-----BEGIN (RSA|OPENSSH) PRIVATE KEY-----'; Msg="Private key" }
    @{ Id="A4";  Cat="Secret";    Sev="HIGH"; Pattern='ghp_[A-Za-z0-9]{36}';             Msg="GitHub personal token" }
    @{ Id="A5";  Cat="Secret";    Sev="MED";  Pattern='password\s*=\s*[''"][^''"]{4,}[''"]'; Msg="Hardcoded password" }
    @{ Id="A6";  Cat="Secret";    Sev="HIGH"; Pattern='AIza[0-9A-Za-z\-_]{35}';          Msg="Google API key" }

    # === Cat B: Injection ===
    @{ Id="B1";  Cat="Injection"; Sev="HIGH"; Pattern='shell\s*=\s*True';                Msg="subprocess shell=True" }
    @{ Id="B2";  Cat="Injection"; Sev="HIGH"; Pattern='\beval\s*\(';                     Msg="eval() usage" }
    @{ Id="B3";  Cat="Injection"; Sev="HIGH"; Pattern='\bexec\s*\(';                     Msg="exec() usage" }
    @{ Id="B4";  Cat="Injection"; Sev="MED";  Pattern='\.execute\s*\(\s*[fF]?[''"][^?]*\{';  Msg="Possible SQL injection (f-string in execute)" }

    # === Cat D: XSS ===
    @{ Id="D1";  Cat="XSS";       Sev="MED";  Pattern='dangerouslySetInnerHTML';         Msg="dangerouslySetInnerHTML - verify sanitization" }
    @{ Id="D2";  Cat="CORS";      Sev="MED";  Pattern='allow_origins\s*=\s*\[\s*[''"]\*[''"]'; Msg='CORS allow_origins=["*"]' }

    # === Cat E: Crypto ===
    @{ Id="E1";  Cat="Crypto";    Sev="MED";  Pattern='hashlib\.md5\s*\(';               Msg="MD5 (weak hash)" }
    @{ Id="E2";  Cat="Crypto";    Sev="MED";  Pattern='hashlib\.sha1\s*\(';              Msg="SHA1 (weak hash)" }
    @{ Id="E3";  Cat="Crypto";    Sev="MED";  Pattern='Math\.random\s*\(';               Msg="Math.random() - not crypto-safe" }

    # === Cat G: Logging ===
    @{ Id="G1";  Cat="Logging";   Sev="MED";  Pattern='print\s*\([^)]*password';         Msg="password printed" }
    @{ Id="G2";  Cat="Logging";   Sev="MED";  Pattern='print\s*\([^)]*token';            Msg="token printed" }

    # === Cat I: Files ===
    @{ Id="I1";  Cat="File";      Sev="HIGH"; Pattern='serviceAccountKey\.json';         Msg="serviceAccountKey.json reference (verify .gitignore)" }
)

# ============================================================
# Severity filter
# ============================================================
function Test-Severity {
    param($ruleSev)
    if ($Severity -eq "ALL") { return $true }
    $order = @{ "LOW"=0; "MED"=1; "HIGH"=2 }
    return $order[$ruleSev] -ge $order[$Severity]
}

# ============================================================
# Determine files to scan
# ============================================================
$exclude = @(
    "*\node_modules\*",
    "*\venv\*",
    "*\.git\*",
    "*\dist\*",
    "*\build\*",
    "*\__pycache__\*",
    "*\.next\*",
    "*\agentshield.ps1"
)

$ext = @("*.py","*.ts","*.tsx","*.js","*.jsx","*.json","*.env","*.yml","*.yaml","*.ps1")
if ($IncludeDocs) {
    $ext += "*.md"
}

if ($ChangedOnly) {
    $files = git diff --name-only HEAD 2>$null
    if (-not $files) {
        Write-Host "No changed files." -ForegroundColor Yellow
        exit 0
    }
    $files = $files | Where-Object { Test-Path $_ } | ForEach-Object { Get-Item $_ }
} else {
    $files = Get-ChildItem -Path $Path -Recurse -Include $ext -File -ErrorAction SilentlyContinue |
        Where-Object {
            $f = $_.FullName
            -not ($exclude | Where-Object { $f -like $_ })
        }
}

# ============================================================
# Scan
# ============================================================
$findings = @()

foreach ($file in $files) {
    try {
        $content = Get-Content $file.FullName -Raw -ErrorAction SilentlyContinue
        if (-not $content) { continue }

        $lines = $content -split "`r?`n"
        for ($i = 0; $i -lt $lines.Count; $i++) {
            $line = $lines[$i]
            if ($line -match '#\s*agentshield:\s*ignore') { continue }
            if ($line -match '//\s*agentshield:\s*ignore') { continue }

            foreach ($rule in $rules) {
                if (-not (Test-Severity $rule.Sev)) { continue }
                if ($line -match $rule.Pattern) {
                    $findings += [PSCustomObject]@{
                        Severity = $rule.Sev
                        Rule     = $rule.Id
                        Cat      = $rule.Cat
                        File     = $file.FullName.Replace($PWD.Path + "\", "")
                        Line     = $i + 1
                        Message  = $rule.Msg
                        Snippet  = $line.Trim().Substring(0, [Math]::Min(80, $line.Trim().Length))
                    }
                }
            }
        }
    } catch {
        Write-Verbose "Skip: $($file.FullName) - $_"
    }
}

# ============================================================
# Report
# ============================================================
Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host " AgentShield Report" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

if ($findings.Count -eq 0) {
    Write-Host "[OK] No findings." -ForegroundColor Green
    exit 0
}

$grouped = $findings | Group-Object Severity | Sort-Object @{Expression={
    @{"HIGH"=0;"MED"=1;"LOW"=2}[$_.Name]
}}

foreach ($g in $grouped) {
    $color = switch ($g.Name) { "HIGH" { "Red" } "MED" { "Yellow" } default { "Gray" } }
    Write-Host "[$($g.Name)] $($g.Count) finding(s)" -ForegroundColor $color
}
Write-Host ""

$findings | Format-Table -AutoSize Severity, Rule, Cat, File, Line, Message

Write-Host ""
Write-Host "Total: $($findings.Count)" -ForegroundColor Cyan

if ($FailOnFound -and $findings.Count -gt 0) {
    exit 1
}
exit 0
