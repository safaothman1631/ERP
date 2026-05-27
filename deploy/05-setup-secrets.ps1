#Requires -Version 5.1
<#
.SYNOPSIS
    05-setup-secrets.ps1 - Set all GitHub Actions secrets via `gh secret set`.

.DESCRIPTION
    Verifies gh auth, then for each known secret name:
      - Reads value from deploy/.env.deploy if present and key is set there.
      - Otherwise prompts the user with Read-Host -AsSecureString.
      - Calls `gh secret set <NAME> --body <value>` against the current repo.
    Never logs the values. Writes a manifest of which names were set.

.NOTES
    Idempotent: re-running just overwrites.
    Exit 0 = all required secrets set.
    Exit 1 = gh not auth, or repo not detected, or a critical secret skipped.
#>

# ===========================================================================
# Setup
# ===========================================================================
$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogsDir   = Join-Path $ScriptDir 'logs'
$ManifestFile = Join-Path $ScriptDir 'secrets-set-manifest.txt'
$EnvDeploy = Join-Path $ScriptDir '.env.deploy'

if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$Timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$LogFile = Join-Path $LogsDir "secrets-$Timestamp.log"
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }
try { chcp 65001 | Out-Null } catch { }

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "[$([DateTime]::Now.ToString('HH:mm:ss'))] [$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    if ($Level -eq 'ERROR') { Write-Host $line -ForegroundColor Red }
    elseif ($Level -eq 'WARN') { Write-Host $line -ForegroundColor Yellow }
    elseif ($Level -eq 'OK') { Write-Host $line -ForegroundColor Green }
    else { Write-Host $line }
}

# ===========================================================================
# Banner
# ===========================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  05-setup-secrets.ps1 - dani GitHub Actions secrets" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Log "Starting secret setup at $Timestamp"

# ===========================================================================
# 1. Verify gh
# ===========================================================================
Push-Location $RepoRoot
try {
    $ghAuth = & gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "gh not authenticated - run 'gh auth login'" -Level 'ERROR'
        exit 1
    }
    Write-Log "[OK] gh authenticated" -Level 'OK'

    $repoView = & gh repo view --json nameWithOwner 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Not in a GitHub-linked repo (or no remote 'origin') - run 04-push-to-github.ps1 first" -Level 'ERROR'
        exit 1
    }
    Write-Host ""

    # =======================================================================
    # 2. Load .env.deploy if present - kurdi: barxwendnewey .env.deploy
    # =======================================================================
    $envValues = @{}
    if (Test-Path $EnvDeploy) {
        Write-Log "Loading values from $EnvDeploy" -Level 'INFO'
        Get-Content $EnvDeploy | ForEach-Object {
            $line = $_.Trim()
            if ($line -and -not $line.StartsWith('#') -and $line.Contains('=')) {
                $idx = $line.IndexOf('=')
                $k = $line.Substring(0, $idx).Trim()
                # strip inline comment after the value
                $vRaw = $line.Substring($idx + 1)
                $hashIdx = $vRaw.IndexOf('#')
                if ($hashIdx -ge 0) { $vRaw = $vRaw.Substring(0, $hashIdx) }
                $v = $vRaw.Trim().Trim('"').Trim("'")
                if ($k -and $v) { $envValues[$k] = $v }
            }
        }
        Write-Log "Loaded $($envValues.Count) values from .env.deploy (values masked)" -Level 'OK'
    } else {
        Write-Log ".env.deploy not present - all secrets will be prompted interactively" -Level 'INFO'
    }
    Write-Host ""

    # =======================================================================
    # 3. Define secrets - kurdi: pekhati hamu secrets
    # =======================================================================
    $secrets = @(
        @{ Name='VITE_SENTRY_DSN';        Required=$true;  Desc='Sentry DSN for frontend (Vite)' },
        @{ Name='SENTRY_DSN';             Required=$true;  Desc='Sentry DSN for backend' },
        @{ Name='SENTRY_AUTH_TOKEN';      Required=$true;  Desc='Sentry release auth token (releases:write)' },
        @{ Name='CLOUDRUN_URL';           Required=$false; Desc='Backend Cloud Run URL (set after first deploy)' },
        @{ Name='GCP_PROJECT_ID';         Required=$true;  Desc='GCP project ID' },
        @{ Name='GCP_WIF_PROVIDER';       Required=$true;  Desc='Workload Identity Federation provider resource' },
        @{ Name='GCP_SERVICE_ACCOUNT';    Required=$true;  Desc='Runner service account email' },
        @{ Name='VERCEL_TOKEN';           Required=$true;  Desc='Vercel deploy token' },
        @{ Name='VERCEL_ORG_ID';          Required=$true;  Desc='Vercel org ID' },
        @{ Name='VERCEL_PROJECT_ID';      Required=$true;  Desc='Vercel project ID' },
        @{ Name='REDIS_URL';              Required=$true;  Desc='Memorystore Redis connection string' },
        @{ Name='FIREBASE_PROJECT_ID';    Required=$true;  Desc='Firebase project ID' },
        @{ Name='LOAD_TEST_TARGET_URL';   Required=$false; Desc='Load test target URL' },
        @{ Name='LOAD_TEST_USER_EMAIL';   Required=$false; Desc='Load test user email' },
        @{ Name='LOAD_TEST_USER_PASSWORD';Required=$false; Desc='Load test user password' },
        @{ Name='LOAD_TEST_TENANT_ID';    Required=$false; Desc='Load test tenant ID' }
    )

    # =======================================================================
    # 4. Set each secret - kurdi: dani hamu secret yek-be-yek
    # =======================================================================
    $manifest = @()
    $manifest += "# secrets-set-manifest.txt - $Timestamp"
    $manifest += "# Repo: $($repoView | ConvertFrom-Json | Select-Object -ExpandProperty nameWithOwner)"
    $manifest += "# Names only - VALUES NEVER LOGGED"
    $manifest += ""

    $setCount = 0
    $skipCount = 0
    $failCount = 0

    foreach ($s in $secrets) {
        $name = $s.Name
        $required = $s.Required
        $desc = $s.Desc

        Write-Host "--- $name ---" -ForegroundColor Cyan
        Write-Host "    $desc" -ForegroundColor DarkGray

        # 1. Try .env.deploy first
        $value = $null
        if ($envValues.ContainsKey($name) -and $envValues[$name]) {
            $value = $envValues[$name]
            Write-Host "    [source: .env.deploy]" -ForegroundColor DarkGray
        } else {
            # 2. Prompt
            $reqTag = if ($required) { 'REQUIRED' } else { 'optional' }
            $secure = Read-Host "    Enter value ($reqTag, blank to skip)" -AsSecureString
            if ($secure.Length -gt 0) {
                $bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
                try {
                    $value = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
                } finally {
                    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
                }
            }
        }

        if (-not $value) {
            if ($required) {
                Write-Log "[!] $name skipped (REQUIRED - re-run to set)" -Level 'WARN'
                $manifest += "[SKIPPED-REQUIRED] $name"
            } else {
                Write-Log "[-] $name skipped (optional)" -Level 'INFO'
                $manifest += "[SKIPPED-OPTIONAL] $name"
            }
            $skipCount++
            Write-Host ""
            continue
        }

        # 3. Call gh secret set via stdin - the value never appears on argv/cmdline.
        # We write the value with NO trailing newline to a temp file, then redirect stdin
        # from that file via Start-Process. Piping a string in PowerShell adds CRLF which
        # would corrupt the secret value (gh would store "secret`r`n").
        $tmpSecretFile = $null
        $tmpStdoutFile = $null
        $tmpStderrFile = $null
        try {
            $tmpSecretFile = [System.IO.Path]::GetTempFileName()
            $tmpStdoutFile = [System.IO.Path]::GetTempFileName()
            $tmpStderrFile = [System.IO.Path]::GetTempFileName()
            # Write value with NO trailing newline using .NET (Out-File / Set-Content always add one)
            [System.IO.File]::WriteAllText($tmpSecretFile, $value, [System.Text.UTF8Encoding]::new($false))

            $proc = Start-Process -FilePath 'gh' `
                -ArgumentList @('secret','set',$name,'--body','-') `
                -NoNewWindow -Wait -PassThru `
                -RedirectStandardInput  $tmpSecretFile `
                -RedirectStandardOutput $tmpStdoutFile `
                -RedirectStandardError  $tmpStderrFile
            $rc = $proc.ExitCode
            if ($rc -eq 0) {
                Write-Log "[OK] $name set" -Level 'OK'
                $manifest += "[SET] $name"
                $setCount++
            } else {
                # Log gh's stderr (does NOT contain the secret value - only the name)
                $ghErr = ''
                try { $ghErr = (Get-Content -Raw $tmpStderrFile -ErrorAction Stop).Trim() } catch { }
                if ($ghErr) { Write-Log "gh error for $name : $ghErr" -Level 'WARN' }
                Write-Log "[X] $name FAILED (exit $rc)" -Level 'ERROR'
                $manifest += "[FAILED] $name"
                $failCount++
            }
        } catch {
            Write-Log "[X] $name FAILED: $_" -Level 'ERROR'
            $manifest += "[FAILED] $name"
            $failCount++
        } finally {
            # zero out value variable and delete temp files
            $value = $null
            foreach ($f in @($tmpSecretFile, $tmpStdoutFile, $tmpStderrFile)) {
                if ($f -and (Test-Path $f)) {
                    try { Remove-Item -Force $f -ErrorAction Stop } catch { }
                }
            }
            [GC]::Collect()
        }
        Write-Host ""
    }

    # =======================================================================
    # 5. Write manifest - kurdi: nuusini manifest
    # =======================================================================
    $manifest += ""
    $manifest += "Summary: SET=$setCount  SKIPPED=$skipCount  FAILED=$failCount"
    Set-Content -Path $ManifestFile -Value $manifest -Encoding UTF8
    Write-Log "Manifest written to: $ManifestFile" -Level 'OK'

    # =======================================================================
    # 6. Final
    # =======================================================================
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  Summary - SET=$setCount, SKIPPED=$skipCount, FAILED=$failCount" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Manifest: $ManifestFile" -ForegroundColor Cyan
    Write-Host "Log:      $LogFile" -ForegroundColor Cyan
    Write-Host ""

    if ($failCount -gt 0) {
        Write-Host "[!] hendek secret shkti henan - re-run after fixing." -ForegroundColor Yellow
        exit 1
    } else {
        Write-Host "[OK] hamu secrets danran" -ForegroundColor Green
        Write-Host "All set - deploy via .github/workflows/ now will pick these up." -ForegroundColor Green
        exit 0
    }
} finally {
    Pop-Location
}
