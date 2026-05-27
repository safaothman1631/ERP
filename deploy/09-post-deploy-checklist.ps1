#requires -Version 7.0
<#
.SYNOPSIS
    Post-deploy operator checklist with browser tab launcher.
    لیستی کارمەند دوای ناردن.

.DESCRIPTION
    Prints a Kurdish + English checklist of everything the operator must verify
    after a successful deploy. Optionally opens consoles in the browser.

.PARAMETER Project
    GCP project ID. ناسنامەی پڕۆژەی GCP.

.PARAMETER ServiceName
    Cloud Run service name.

.PARAMETER Region
    GCP region.

.PARAMETER FrontendUrl
    Vercel deployed URL.

.PARAMETER OpenBrowser
    Open each checklist item's console URL in the browser.
#>
[CmdletBinding()]
param(
    [string]$Project,
    [string]$ServiceName = 'zoho-erp-backend',
    [string]$Region = 'me-central1',
    [string]$FrontendUrl,
    [string]$BackendUrl,
    [switch]$OpenBrowser
)

$ErrorActionPreference = 'Continue'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# Resolve URLs from saved files if not provided
if (-not $FrontendUrl) {
    $f = Join-Path $ScriptRoot 'vercel-url.txt'
    if (Test-Path $f) { $FrontendUrl = (Get-Content $f -Raw).Trim() }
}
if (-not $BackendUrl) {
    $b = Join-Path $ScriptRoot 'cloudrun-url.txt'
    if (Test-Path $b) { $BackendUrl = (Get-Content $b -Raw).Trim() }
}

if (-not $Project) {
    $manifest = Join-Path $ScriptRoot 'gcp-resources-manifest.json'
    if (Test-Path $manifest) {
        $m = Get-Content $manifest -Raw | ConvertFrom-Json
        $Project = $m.project
        if (-not $Region) { $Region = $m.region }
    }
}

function Write-Banner {
    param([string]$En, [string]$Ku)
    Write-Host ""
    Write-Host ("=" * 78) -ForegroundColor Cyan
    Write-Host " EN: $En" -ForegroundColor Cyan
    Write-Host " KU: $Ku" -ForegroundColor Cyan
    Write-Host ("=" * 78) -ForegroundColor Cyan
}

Write-Banner -En "Post-deploy operator checklist" -Ku "لیستی پشکنینی دوای ناردن"
Write-Host ""
Write-Host "  Project    : $Project"   -ForegroundColor White
Write-Host "  Service    : $ServiceName" -ForegroundColor White
Write-Host "  Region     : $Region"    -ForegroundColor White
Write-Host "  Frontend   : $FrontendUrl" -ForegroundColor White
Write-Host "  Backend    : $BackendUrl"  -ForegroundColor White
Write-Host ""

# Build checklist items
$checks = @(
    @{
        N=1
        En="Cloud Run min-instances=1 (warm)"
        Ku="Cloud Run هەمیشە چالاک — min-instances=1"
        Cmd="gcloud run services describe $ServiceName --region=$Region --project=$Project --format='value(spec.template.metadata.annotations.\"autoscaling.knative.dev/minScale\")'"
        Url="https://console.cloud.google.com/run/detail/$Region/$ServiceName/metrics?project=$Project"
    },
    @{
        N=2
        En="Min/max instances, CPU, memory match spec"
        Ku="پێگەی سەرچاوەکانی Cloud Run"
        Cmd="gcloud run services describe $ServiceName --region=$Region --project=$Project"
        Url="https://console.cloud.google.com/run/detail/$Region/$ServiceName/revisions?project=$Project"
    },
    @{
        N=3
        En="Firestore security rules deployed"
        Ku="یاساکانی سەلامەتی Firestore"
        Cmd="firebase deploy --only firestore:rules --project $Project"
        Url="https://console.firebase.google.com/project/$Project/firestore/rules"
    },
    @{
        N=4
        En="Firestore composite indexes deployed"
        Ku="ئیندیکسەکانی هاوبەشی Firestore"
        Cmd="firebase deploy --only firestore:indexes --project $Project"
        Url="https://console.firebase.google.com/project/$Project/firestore/indexes"
    },
    @{
        N=5
        En="6 Cloud Monitoring dashboards exist (see docs/observability/README.md)"
        Ku="٦ داشبۆردی Cloud Monitoring"
        Cmd="gcloud monitoring dashboards list --project=$Project --format='value(displayName)'"
        Url="https://console.cloud.google.com/monitoring/dashboards?project=$Project"
    },
    @{
        N=6
        En="Alerts wired to Slack/email"
        Ku="ئاگاداریەکان گرێدراون لەگەڵ Slack/email"
        Cmd="gcloud alpha monitoring channels list --project=$Project"
        Url="https://console.cloud.google.com/monitoring/alerting/notifications?project=$Project"
    },
    @{
        N=7
        En="Backup job scheduled + verified (Firestore export)"
        Ku="جدوەلی بەکئەپ تاقی کراوەتەوە"
        Cmd="gcloud scheduler jobs list --project=$Project --location=$Region"
        Url="https://console.cloud.google.com/cloudscheduler?project=$Project"
    },
    @{
        N=8
        En="DNS — custom domain points at Vercel (frontend) and Cloud Run (api subdomain)"
        Ku="DNS بۆ Vercel و Cloud Run ڕاست کراوە"
        Cmd="nslookup <your-domain>"
        Url=$FrontendUrl
    },
    @{
        N=9
        En="TLS certificates issued (Vercel auto, Cloud Run auto)"
        Ku="مۆڵەتی TLS دەرکرا"
        Cmd="curl -vI $FrontendUrl 2>&1 | Select-String 'subject:|issuer:|notAfter'"
        Url="$FrontendUrl"
    },
    @{
        N=10
        En="CSP header is Report-Only for first 14 days"
        Ku="CSP لە دۆخی ڕاپۆرت تەنها — ١٤ ڕۆژ"
        Cmd="curl -sI $FrontendUrl | Select-String 'Content-Security-Policy'"
        Url=$FrontendUrl
    },
    @{
        N=11
        En="Sentry release tagged for this deploy"
        Ku="وەشانی Sentry تاگ کراوە"
        Cmd="(manual check)"
        Url="https://sentry.io/organizations/$env:SENTRY_ORG_SLUG/releases/"
    },
    @{
        N=12
        En="Initial scorecard regenerated post-deploy"
        Ku="کۆرتکارد دوای ناردن دووبارە تۆمار کراوەتەوە"
        Cmd="node scripts/world-class-scorecard.mjs"
        Url=$null
    }
)

foreach ($c in $checks) {
    Write-Host ""
    Write-Host ("[{0,2}] " -f $c.N) -NoNewline -ForegroundColor Yellow
    Write-Host $c.En -ForegroundColor White
    Write-Host "     " -NoNewline
    Write-Host $c.Ku -ForegroundColor White
    Write-Host "     Verify: " -NoNewline -ForegroundColor Gray
    Write-Host $c.Cmd -ForegroundColor Cyan
    if ($c.Url) {
        Write-Host "     Open  : $($c.Url)" -ForegroundColor Gray
        if ($OpenBrowser) {
            try {
                Start-Process $c.Url
                Start-Sleep -Milliseconds 400
            } catch {
                Write-Host "     (could not open: $_)" -ForegroundColor DarkGray
            }
        }
    }
}

Write-Host ""
Write-Banner -En "When all 12 are ✔, you are live in production." -Ku "کاتێک هەموو ١٢ تەواو بوون، لە بەرهەمهێنانی."
Write-Host ""
Write-Host "  Re-run smoke test any time:" -ForegroundColor White
Write-Host "    .\deploy\08-smoke-test-production.ps1" -ForegroundColor Cyan
Write-Host ""
if (-not $OpenBrowser) {
    Write-Host "  Open all console URLs in the browser:" -ForegroundColor White
    Write-Host "    .\deploy\09-post-deploy-checklist.ps1 -OpenBrowser" -ForegroundColor Cyan
    Write-Host ""
}

exit 0
