#Requires -Version 5.1
<#
.SYNOPSIS
    04-push-to-github.ps1 - Commit and push changes to GitHub.

.PARAMETER RepoName
    Name of the GitHub repo (default: 'zoho'). The remote is expected to be
    github.com/safaothman1631/<RepoName>.

.PARAMETER Branch
    Branch to push (default: 'main').

.PARAMETER Message
    Commit message override. If omitted, prompts the user with a default.

.DESCRIPTION
    - Verifies clean working tree (or prompts).
    - Verifies remote origin matches github.com/safaothman1631/<RepoName>.
    - Refuses to commit if any .env file or common secret pattern is staged.
    - git add -A; git commit; git push -u origin <Branch>.

.NOTES
    Exit 0 = push successful. Exit 1+ = failure (git error is printed verbatim).
#>
param(
    [string]$RepoName = 'zoho',
    [string]$Branch = 'main',
    [string]$Message
)

# ===========================================================================
# Setup
# ===========================================================================
$ErrorActionPreference = 'Continue'
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = Split-Path -Parent $ScriptDir
$LogsDir   = Join-Path $ScriptDir 'logs'
if (-not (Test-Path $LogsDir)) { New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null }

$Timestamp = (Get-Date -Format 'yyyyMMdd-HHmmss')
$LogFile = Join-Path $LogsDir "push-$Timestamp.log"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

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
Write-Host "  04-push-to-github.ps1 - push bo GitHub" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Log "Repo:   $RepoRoot"
Write-Log "Target: github.com/safaothman1631/$RepoName"
Write-Log "Branch: $Branch"
Write-Host ""

Push-Location $RepoRoot
try {
    # =======================================================================
    # 1. Verify this is a git repo
    # =======================================================================
    $gitDir = & git rev-parse --git-dir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "Not a git repository: $RepoRoot" -Level 'ERROR'
        Write-Host "Run: git init" -ForegroundColor Yellow
        exit 1
    }
    Write-Log "[OK] git repo detected" -Level 'OK'

    # =======================================================================
    # 2. Verify gh authenticated - kurdi: pshknini ke gh chuwentajurewe
    # =======================================================================
    $ghAuth = & gh auth status 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "gh not authenticated - run 'gh auth login'" -Level 'ERROR'
        exit 1
    }
    Write-Log "[OK] gh authenticated" -Level 'OK'

    # =======================================================================
    # 3. Verify/setup origin - kurdi: pshknini origin
    # =======================================================================
    $expectedRemote = "https://github.com/safaothman1631/$RepoName.git"
    $currentRemote = & git remote get-url origin 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Log "No 'origin' remote configured" -Level 'WARN'
        $ans = Read-Host "Add origin = $expectedRemote ? (y/N)"
        if ($ans -eq 'y' -or $ans -eq 'Y') {
            & git remote add origin $expectedRemote
            Write-Log "Added origin = $expectedRemote" -Level 'OK'
        } else {
            Write-Log "Aborted by user - no remote configured" -Level 'ERROR'
            exit 1
        }
    } else {
        # Normalize for comparison (allow .git suffix or not)
        $normCurrent = $currentRemote.Trim() -replace '\.git$',''
        $normExpect  = $expectedRemote      -replace '\.git$',''
        if ($normCurrent -ne $normExpect) {
            Write-Log "origin mismatch:" -Level 'WARN'
            Write-Host "  current:  $currentRemote" -ForegroundColor Yellow
            Write-Host "  expected: $expectedRemote" -ForegroundColor Yellow
            $ans = Read-Host "Update origin to expected? (y/N)"
            if ($ans -eq 'y' -or $ans -eq 'Y') {
                & git remote set-url origin $expectedRemote
                Write-Log "origin updated to $expectedRemote" -Level 'OK'
            } else {
                Write-Log "Keeping current origin: $currentRemote" -Level 'WARN'
            }
        } else {
            Write-Log "[OK] origin matches expected" -Level 'OK'
        }
    }

    # =======================================================================
    # 4. Show preview - kurdi: nishani gorrankariyakan
    # =======================================================================
    Write-Host ""
    Write-Host "--- git status (short) ---" -ForegroundColor Cyan
    & git status --short
    Write-Host ""

    # =======================================================================
    # 5. Secret guard - kurdi: parastni .env u secrets le pushkrdn
    # =======================================================================
    Write-Host "--- Secret scan ---" -ForegroundColor Cyan
    # Files tracked or staged
    $stagedFiles = & git diff --name-only --cached 2>&1
    $modifiedFiles = & git status --porcelain 2>&1 | ForEach-Object {
        if ($_ -match '^\s*\S+\s+(.+)$') { $matches[1].Trim('"') }
    }
    $allTouched = @($stagedFiles) + @($modifiedFiles) | Where-Object { $_ } | Sort-Object -Unique

    $secretPatterns = @(
        '\.env$', '\.env\.', '\.env\.deploy', '\.env\.local', '\.env\.production',
        'credentials\.json', 'service-account\.json', 'firebase-adminsdk.*\.json',
        '\.pem$', 'id_rsa', 'id_ed25519', '\.p12$', '\.pfx$', 'serviceAccountKey'
    )
    $blocked = @()
    foreach ($f in $allTouched) {
        foreach ($pat in $secretPatterns) {
            if ($f -match $pat) {
                # allow .env.example explicitly
                if ($f -notmatch '\.env\.example$') {
                    $blocked += $f
                    break
                }
            }
        }
    }
    if ($blocked.Count -gt 0) {
        Write-Log "[X] REFUSING TO COMMIT - secret-like files detected:" -Level 'ERROR'
        foreach ($b in $blocked) { Write-Host "    $b" -ForegroundColor Red }
        Write-Host ""
        Write-Host "Add these to .gitignore or remove them first, then re-run." -ForegroundColor Yellow
        exit 1
    }
    Write-Log "[OK] No secret-like files in changeset" -Level 'OK'

    # =======================================================================
    # 6. Stage everything - kurdi: zyadkrdni hamuyan
    # =======================================================================
    Write-Host ""
    Write-Host "--- git add -A ---" -ForegroundColor Cyan
    & git add -A
    if ($LASTEXITCODE -ne 0) {
        Write-Log "git add failed" -Level 'ERROR'
        exit 1
    }

    # Anything to commit?
    $staged = & git diff --name-only --cached 2>&1
    if (-not $staged) {
        Write-Log "Nothing to commit - working tree is clean" -Level 'WARN'
        # Still try to push in case local is ahead of remote
        Write-Host ""
        Write-Host "--- git push (in case local is ahead) ---" -ForegroundColor Cyan
        & git push -u origin $Branch
        $pushRc = $LASTEXITCODE
        if ($pushRc -ne 0) {
            Write-Log "git push failed (rc=$pushRc)" -Level 'ERROR'
            exit $pushRc
        }
        Write-Log "Push complete" -Level 'OK'
        exit 0
    }

    # =======================================================================
    # 7. Confirm commit message - kurdi: dlnyabuun le payami commit
    # =======================================================================
    if (-not $Message) {
        $default = 'feat: world-class performance spec P0-P6 + validation framework'
        Write-Host ""
        Write-Host "Default commit message:" -ForegroundColor Cyan
        Write-Host "  $default" -ForegroundColor White
        $input = Read-Host "Press Enter to accept, or type a new message"
        if ($input) { $Message = $input } else { $Message = $default }
    }
    Write-Log "Commit message: $Message"

    # =======================================================================
    # 8. Commit - kurdi: commit
    # =======================================================================
    Write-Host ""
    Write-Host "--- git commit ---" -ForegroundColor Cyan
    & git commit -m $Message
    if ($LASTEXITCODE -ne 0) {
        Write-Log "git commit failed" -Level 'ERROR'
        exit 1
    }
    Write-Log "[OK] commit created" -Level 'OK'

    # =======================================================================
    # 9. Push - kurdi: pushkrdn
    # =======================================================================
    Write-Host ""
    Write-Host "--- git push -u origin $Branch ---" -ForegroundColor Cyan
    & git push -u origin $Branch
    $pushRc = $LASTEXITCODE
    if ($pushRc -ne 0) {
        Write-Log "[X] git push FAILED (exit $pushRc)" -Level 'ERROR'
        Write-Host ""
        Write-Host "Common fixes:" -ForegroundColor Yellow
        Write-Host "  - First push to new repo: git push -u origin $Branch --force-with-lease" -ForegroundColor Yellow
        Write-Host "  - Branch protection blocked: open a PR instead" -ForegroundColor Yellow
        Write-Host "  - Re-authenticate: gh auth refresh" -ForegroundColor Yellow
        exit $pushRc
    }
    Write-Log "[OK] push successful" -Level 'OK'

    # =======================================================================
    # 10. Output URLs - kurdi: nishani linkakan
    # =======================================================================
    $sha = (& git rev-parse HEAD).Trim()
    $repoUrl = "https://github.com/safaothman1631/$RepoName"
    $commitUrl = "$repoUrl/commit/$sha"
    $actionsUrl = "$repoUrl/actions"

    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "  [OK] push tewaw bu - serkawtu" -ForegroundColor Green
    Write-Host "  Push complete - successful" -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Commit:  $commitUrl" -ForegroundColor Cyan
    Write-Host "  Repo:    $repoUrl"   -ForegroundColor Cyan
    Write-Host "  Actions: $actionsUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next: .\deploy\05-setup-secrets.ps1" -ForegroundColor Cyan
    exit 0
} finally {
    Pop-Location
}
