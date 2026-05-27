#requires -Version 7.0
<#
.SYNOPSIS
    One-time GCP project setup for Zoho ERP production.
    ڕێکخستنی پڕۆژەی GCP — جارێک بەکارهێنراوە بۆ شوێنی بەرهەمهێنان.

.DESCRIPTION
    Enables APIs, creates Artifact Registry repo, Firestore database, Memorystore Redis,
    Secret Manager secrets, BigQuery RUM dataset, Workload Identity Federation pool,
    and a deployer service account.
    Idempotent — safe to re-run.

.PARAMETER Project
    GCP project ID. ناسنامەی پڕۆژەی GCP.

.PARAMETER Region
    GCP region. ناوچە.

.PARAMETER Confirm
    Confirm cost-incurring resource creation. پەسەندکردنی خەرجی.

.EXAMPLE
    .\deploy\06a-setup-gcp-resources.ps1 -Project my-zoho-prod -Confirm
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$Project,

    [string]$Region = 'me-central1',

    [string]$RedisInstance = 'zoho-redis',

    [string]$ArtifactRepo = 'zoho-images',

    [string]$GithubRepo = '',  # e.g. "safa-othman/zoho"

    [switch]$Confirm
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir     = Join-Path $ScriptRoot 'logs'
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }
$Timestamp  = Get-Date -Format 'yyyyMMddTHHmmss'
$LogFile    = Join-Path $LogDir "gcp-setup-$Timestamp.log"
$ManifestFile = Join-Path $ScriptRoot 'gcp-resources-manifest.json'

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = "[{0}] [{1}] {2}" -f (Get-Date -Format 'HH:mm:ss'), $Level, $Message
    Write-Host $line
    Add-Content -Path $LogFile -Value $line
}

function Write-Banner {
    param([string]$En, [string]$Ku)
    Write-Host ""
    Write-Host ("=" * 78) -ForegroundColor Cyan
    Write-Host " EN: $En" -ForegroundColor Cyan
    Write-Host " KU: $Ku" -ForegroundColor Cyan
    Write-Host ("=" * 78) -ForegroundColor Cyan
}

function Invoke-Gcloud {
    param([string[]]$ArgList, [switch]$IgnoreError)
    Write-Log "gcloud $($ArgList -join ' ')"
    $output = & gcloud @ArgList 2>&1
    $output | ForEach-Object { Add-Content -Path $LogFile -Value $_ }
    if (-not $IgnoreError -and $LASTEXITCODE -ne 0) {
        throw "gcloud failed: $($ArgList -join ' ')"
    }
    return $output
}

# -----------------------------------------------------------------------------
# Pre-flight
# -----------------------------------------------------------------------------
Write-Banner -En "GCP one-time setup — start" -Ku "ڕێکخستنی GCP"
Write-Log "Project=$Project Region=$Region"

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    throw "gcloud not found. Install Google Cloud SDK first."
}

# Set active project
Invoke-Gcloud -ArgList @('config', 'set', 'project', $Project)

$manifest = [ordered]@{
    project       = $Project
    region        = $Region
    created_at    = (Get-Date -Format 'o')
    apis          = @()
    artifact_repo = $null
    firestore     = $null
    redis         = $null
    secrets       = @()
    bigquery      = $null
    wif           = $null
    service_account = $null
}

# -----------------------------------------------------------------------------
# 1. Enable APIs
# -----------------------------------------------------------------------------
Write-Banner -En "Enabling APIs" -Ku "چالاککردنی APIs"
$apis = @(
    'run.googleapis.com',
    'cloudbuild.googleapis.com',
    'artifactregistry.googleapis.com',
    'firestore.googleapis.com',
    'cloudtrace.googleapis.com',
    'secretmanager.googleapis.com',
    'logging.googleapis.com',
    'monitoring.googleapis.com',
    'bigquery.googleapis.com',
    'redis.googleapis.com',
    'iam.googleapis.com',
    'iamcredentials.googleapis.com',
    'sts.googleapis.com'
)

foreach ($api in $apis) {
    Write-Log "Enabling $api"
    Invoke-Gcloud -ArgList @('services', 'enable', $api, "--project=$Project") -IgnoreError
    $manifest.apis += $api
}

# -----------------------------------------------------------------------------
# 2. Artifact Registry
# -----------------------------------------------------------------------------
Write-Banner -En "Artifact Registry repo" -Ku "تۆمارخانەی Artifact Registry"
$exists = (Invoke-Gcloud -ArgList @('artifacts', 'repositories', 'describe', $ArtifactRepo, "--location=$Region", "--project=$Project", '--format=value(name)') -IgnoreError) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $exists) {
    Write-Log "Creating Artifact Registry repo: $ArtifactRepo"
    Invoke-Gcloud -ArgList @('artifacts', 'repositories', 'create', $ArtifactRepo,
        "--repository-format=docker",
        "--location=$Region",
        "--description=Zoho ERP container images",
        "--project=$Project")
} else {
    Write-Log "Artifact Registry repo already exists: $ArtifactRepo"
}
$manifest.artifact_repo = "$Region-docker.pkg.dev/$Project/$ArtifactRepo"

# -----------------------------------------------------------------------------
# 3. Firestore (native mode)
# -----------------------------------------------------------------------------
Write-Banner -En "Firestore native mode" -Ku "Firestore — native"
$fsExists = (Invoke-Gcloud -ArgList @('firestore', 'databases', 'describe', '--database=(default)', "--project=$Project", '--format=value(name)') -IgnoreError) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $fsExists) {
    Write-Log "Creating Firestore database in $Region"
    Invoke-Gcloud -ArgList @('firestore', 'databases', 'create',
        "--location=$Region",
        "--type=firestore-native",
        "--project=$Project") -IgnoreError
} else {
    Write-Log "Firestore database already exists"
}
$manifest.firestore = @{ location = $Region; type = 'firestore-native'; database = '(default)' }

# -----------------------------------------------------------------------------
# 4. Memorystore Redis  (COST WARNING)
# -----------------------------------------------------------------------------
Write-Banner -En "Memorystore Redis" -Ku "Redis — Memorystore"
$redisExists = (Invoke-Gcloud -ArgList @('redis', 'instances', 'describe', $RedisInstance, "--region=$Region", "--project=$Project", '--format=value(name)') -IgnoreError) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $redisExists) {
    if (-not $Confirm) {
        Write-Host ""
        Write-Host "  EN: Creating Memorystore Redis costs ~`$50/month." -ForegroundColor Yellow
        Write-Host "  KU: دروستکردنی Redis نزیکەی ٥٠ دۆلار/مانگ خەرجی هەیە." -ForegroundColor Yellow
        Write-Host "  Re-run with -Confirm to create." -ForegroundColor Yellow
        Write-Log "Redis creation skipped (no -Confirm)" 'WARN'
    } else {
        Write-Log "Creating Memorystore Redis instance: $RedisInstance"
        Invoke-Gcloud -ArgList @('redis', 'instances', 'create', $RedisInstance,
            "--size=1",
            "--region=$Region",
            "--tier=basic",
            "--redis-version=redis_7_0",
            "--project=$Project")
    }
}

# Capture connection string (if exists)
$redisHost = (Invoke-Gcloud -ArgList @('redis', 'instances', 'describe', $RedisInstance, "--region=$Region", "--project=$Project", '--format=value(host)') -IgnoreError) -join "`n"
$redisPort = (Invoke-Gcloud -ArgList @('redis', 'instances', 'describe', $RedisInstance, "--region=$Region", "--project=$Project", '--format=value(port)') -IgnoreError) -join "`n"
if ($redisHost -and $redisHost -notlike '*ERROR*') {
    $redisUrl = "redis://${redisHost}:${redisPort}/0"
    Write-Log "Redis URL: $redisUrl"
    $manifest.redis = @{
        instance = $RedisInstance
        host     = $redisHost.Trim()
        port     = $redisPort.Trim()
        url      = $redisUrl
    }
    Write-Host ""
    Write-Host "  Redis connection string / گرێدانی Redis:" -ForegroundColor Cyan
    Write-Host "    $redisUrl" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  Add this to Secret Manager:" -ForegroundColor White
    Write-Host "    echo '$redisUrl' | gcloud secrets versions add zoho-redis-url --data-file=- --project=$Project" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# 5. Secret Manager secrets
# -----------------------------------------------------------------------------
Write-Banner -En "Secret Manager secrets" -Ku "نهێنیەکانی Secret Manager"
$secrets = @('zoho-secret-key', 'zoho-sentry-dsn', 'zoho-redis-url')
foreach ($sec in $secrets) {
    $exists = (Invoke-Gcloud -ArgList @('secrets', 'describe', $sec, "--project=$Project", '--format=value(name)') -IgnoreError) -join "`n"
    if ($LASTEXITCODE -ne 0 -or -not $exists) {
        Write-Log "Creating secret: $sec"
        Invoke-Gcloud -ArgList @('secrets', 'create', $sec,
            '--replication-policy=automatic',
            "--project=$Project") -IgnoreError
    } else {
        Write-Log "Secret already exists: $sec"
    }
    $manifest.secrets += @{ name = $sec; created = $true }
}

Write-Host ""
Write-Host "  EN: Now add values to each secret:" -ForegroundColor White
Write-Host "  KU: ئێستا بەهای هەر نهێنیەک زیاد بکە:" -ForegroundColor White
foreach ($sec in $secrets) {
    Write-Host "    echo 'VALUE' | gcloud secrets versions add $sec --data-file=- --project=$Project" -ForegroundColor Yellow
}

# -----------------------------------------------------------------------------
# 6. BigQuery RUM dataset
# -----------------------------------------------------------------------------
Write-Banner -En "BigQuery RUM dataset" -Ku "زنجیرەداتای RUM لە BigQuery"
$bqExists = & bq --project_id=$Project show --dataset rum 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "Creating BigQuery dataset 'rum'"
    & bq --project_id=$Project mk --location=$Region --dataset --description='RUM Core Web Vitals raw events' rum 2>&1 | Tee-Object -FilePath $LogFile -Append
} else {
    Write-Log "BigQuery dataset 'rum' already exists"
}

# vitals_raw table schema (per design.md §9.1)
$vitalsSchema = @"
[
  {"name": "ts",           "type": "TIMESTAMP", "mode": "REQUIRED"},
  {"name": "tenant_id",    "type": "STRING"},
  {"name": "session_id",   "type": "STRING"},
  {"name": "user_id",      "type": "STRING"},
  {"name": "url",          "type": "STRING"},
  {"name": "route",        "type": "STRING"},
  {"name": "metric",       "type": "STRING", "mode": "REQUIRED"},
  {"name": "value",        "type": "FLOAT64", "mode": "REQUIRED"},
  {"name": "rating",       "type": "STRING"},
  {"name": "device",       "type": "STRING"},
  {"name": "browser",      "type": "STRING"},
  {"name": "country",      "type": "STRING"},
  {"name": "app_version",  "type": "STRING"},
  {"name": "navigation_type", "type": "STRING"}
]
"@
$schemaFile = Join-Path $env:TEMP "vitals_raw_schema.json"
Set-Content -Path $schemaFile -Value $vitalsSchema -Encoding UTF8

$tableExists = & bq --project_id=$Project show "${Project}:rum.vitals_raw" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Log "Creating BigQuery table rum.vitals_raw"
    & bq --project_id=$Project mk --table `
        --time_partitioning_field=ts `
        --time_partitioning_type=DAY `
        --clustering_fields=tenant_id,metric `
        "${Project}:rum.vitals_raw" $schemaFile 2>&1 | Tee-Object -FilePath $LogFile -Append
} else {
    Write-Log "BigQuery table rum.vitals_raw already exists"
}

$manifest.bigquery = @{
    dataset = 'rum'
    table   = 'vitals_raw'
    location = $Region
}

# -----------------------------------------------------------------------------
# 7. Service Account for GitHub Actions
# -----------------------------------------------------------------------------
Write-Banner -En "Deployer service account" -Ku "ئەکاونتی خزمەتگوزاری بۆ GitHub"
$saName = 'github-deployer'
$saEmail = "$saName@$Project.iam.gserviceaccount.com"

$saExists = (Invoke-Gcloud -ArgList @('iam', 'service-accounts', 'describe', $saEmail, "--project=$Project", '--format=value(email)') -IgnoreError) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $saExists) {
    Write-Log "Creating service account: $saEmail"
    Invoke-Gcloud -ArgList @('iam', 'service-accounts', 'create', $saName,
        "--display-name=GitHub Actions Deployer",
        "--project=$Project")
} else {
    Write-Log "Service account already exists: $saEmail"
}

$roles = @(
    'roles/run.admin',
    'roles/iam.serviceAccountUser',
    'roles/artifactregistry.writer',
    'roles/secretmanager.secretAccessor',
    'roles/cloudbuild.builds.editor',
    'roles/storage.admin'
)
foreach ($role in $roles) {
    Write-Log "Binding $role to $saEmail"
    Invoke-Gcloud -ArgList @('projects', 'add-iam-policy-binding', $Project,
        "--member=serviceAccount:$saEmail",
        "--role=$role",
        '--condition=None') -IgnoreError | Out-Null
}
$manifest.service_account = @{
    email = $saEmail
    roles = $roles
}

# -----------------------------------------------------------------------------
# 8. Workload Identity Federation
# -----------------------------------------------------------------------------
Write-Banner -En "Workload Identity Federation" -Ku "WIF بۆ GitHub Actions"
$poolId = 'github-pool'
$providerId = 'github-provider'

$projectNumber = (Invoke-Gcloud -ArgList @('projects', 'describe', $Project, '--format=value(projectNumber)') -IgnoreError) -join ""
$projectNumber = $projectNumber.Trim()

$poolExists = (Invoke-Gcloud -ArgList @('iam', 'workload-identity-pools', 'describe', $poolId,
    '--location=global', "--project=$Project", '--format=value(name)') -IgnoreError) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $poolExists) {
    Write-Log "Creating WIF pool: $poolId"
    Invoke-Gcloud -ArgList @('iam', 'workload-identity-pools', 'create', $poolId,
        '--location=global',
        '--display-name=GitHub Actions Pool',
        "--project=$Project")
} else {
    Write-Log "WIF pool already exists: $poolId"
}

$providerExists = (Invoke-Gcloud -ArgList @('iam', 'workload-identity-pools', 'providers', 'describe', $providerId,
    '--location=global', "--workload-identity-pool=$poolId",
    "--project=$Project", '--format=value(name)') -IgnoreError) -join "`n"
if ($LASTEXITCODE -ne 0 -or -not $providerExists) {
    Write-Log "Creating WIF OIDC provider: $providerId"
    $attrCondition = if ($GithubRepo) {
        "assertion.repository == '$GithubRepo'"
    } else {
        "assertion.repository_owner != ''"
    }
    Invoke-Gcloud -ArgList @('iam', 'workload-identity-pools', 'providers', 'create-oidc', $providerId,
        '--location=global',
        "--workload-identity-pool=$poolId",
        '--display-name=GitHub OIDC',
        '--attribute-mapping=google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner',
        "--attribute-condition=$attrCondition",
        '--issuer-uri=https://token.actions.githubusercontent.com',
        "--project=$Project")
} else {
    Write-Log "WIF provider already exists: $providerId"
}

$wifProvider = "projects/$projectNumber/locations/global/workloadIdentityPools/$poolId/providers/$providerId"

# Allow GitHub repo principal set to impersonate the SA
if ($GithubRepo) {
    Write-Log "Binding GitHub repo '$GithubRepo' principal to SA"
    Invoke-Gcloud -ArgList @('iam', 'service-accounts', 'add-iam-policy-binding', $saEmail,
        "--role=roles/iam.workloadIdentityUser",
        "--member=principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/$poolId/attribute.repository/$GithubRepo",
        "--project=$Project") -IgnoreError | Out-Null
} else {
    Write-Log "GithubRepo not provided. Bind manually with:" 'WARN'
    Write-Log "  gcloud iam service-accounts add-iam-policy-binding $saEmail \\" 'WARN'
    Write-Log "    --role=roles/iam.workloadIdentityUser \\" 'WARN'
    Write-Log "    --member=principalSet://iam.googleapis.com/projects/$projectNumber/locations/global/workloadIdentityPools/$poolId/attribute.repository/<OWNER>/<REPO>" 'WARN'
}

$manifest.wif = @{
    pool_id      = $poolId
    provider_id  = $providerId
    provider_resource = $wifProvider
    project_number = $projectNumber
}

# -----------------------------------------------------------------------------
# Save manifest
# -----------------------------------------------------------------------------
$manifestJson = $manifest | ConvertTo-Json -Depth 10
Set-Content -Path $ManifestFile -Value $manifestJson -Encoding UTF8
Write-Log "Saved manifest: $ManifestFile"

# -----------------------------------------------------------------------------
# Final summary
# -----------------------------------------------------------------------------
Write-Banner -En "GCP setup complete" -Ku "ڕێکخستنی GCP تەواو بوو"

Write-Host ""
Write-Host "  GitHub Action Secrets to set / نهێنیەکان لە GitHub:" -ForegroundColor Cyan
Write-Host ""
Write-Host "    GCP_PROJECT_ID    = $Project" -ForegroundColor Yellow
Write-Host "    GCP_SA_EMAIL      = $saEmail" -ForegroundColor Yellow
Write-Host "    GCP_WIF_PROVIDER  = $wifProvider" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Run via:" -ForegroundColor White
Write-Host "    gh secret set GCP_PROJECT_ID --body '$Project'" -ForegroundColor Gray
Write-Host "    gh secret set GCP_SA_EMAIL --body '$saEmail'" -ForegroundColor Gray
Write-Host "    gh secret set GCP_WIF_PROVIDER --body '$wifProvider'" -ForegroundColor Gray
Write-Host ""
Write-Host "  Manifest saved to: $ManifestFile" -ForegroundColor Gray
Write-Host "  Log file: $LogFile" -ForegroundColor Gray
Write-Host ""

exit 0
