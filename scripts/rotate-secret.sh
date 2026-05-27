#!/usr/bin/env bash
# rotate-secret.sh — Rotate a GCP Secret Manager secret and roll Cloud Run.
#
# Spec: requirements.md §10.7, design.md §5.3, tasks.md T-6.3
#
# Usage:
#   ./scripts/rotate-secret.sh --secret SECRET_KEY [--service zoho-erp] \
#                              [--region me-central1] [--project erp-system-494716] \
#                              [--value-from-stdin] [--dry-run] [--no-disable-old]
#
# What it does:
#   1. Mints a new value (or reads one from stdin if --value-from-stdin).
#   2. Adds it as a new Secret Manager version (becomes `latest`).
#   3. Updates the Cloud Run service to point ENV_NAME=SECRET:latest.
#   4. Waits for the new revision to serve, then probes /api/health.
#   5. Records the prior version id; after 24h grace the operator runs
#      this script with --finalize <prior_version> to disable the old one.
#
# Exit codes:
#   0  success
#   1  generic failure
#   2  invalid arguments
#   3  health check failed after rotation (operator must roll back)

set -euo pipefail

SECRET_NAME=""
SERVICE="${SERVICE:-zoho-erp}"
REGION="${REGION:-me-central1}"
PROJECT="${PROJECT:-erp-system-494716}"
VALUE_FROM_STDIN=0
DRY_RUN=0
NO_DISABLE_OLD=0
FINALIZE_VERSION=""
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
HEALTH_TIMEOUT_SECS="${HEALTH_TIMEOUT_SECS:-180}"

log()  { printf '[rotate-secret] %s\n' "$*" >&2; }
die()  { log "FATAL: $*"; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1"; }

usage() {
  sed -n '2,30p' "$0"
  exit 2
}

# ---- Arg parsing ----------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --secret)            SECRET_NAME="${2:-}"; shift 2 ;;
    --service)           SERVICE="${2:-}"; shift 2 ;;
    --region)            REGION="${2:-}"; shift 2 ;;
    --project)           PROJECT="${2:-}"; shift 2 ;;
    --health-path)       HEALTH_PATH="${2:-}"; shift 2 ;;
    --value-from-stdin)  VALUE_FROM_STDIN=1; shift ;;
    --dry-run)           DRY_RUN=1; shift ;;
    --no-disable-old)    NO_DISABLE_OLD=1; shift ;;
    --finalize)          FINALIZE_VERSION="${2:-}"; shift 2 ;;
    -h|--help)           usage ;;
    *) die "unknown argument: $1 (try --help)" ;;
  esac
done

[[ -z "$SECRET_NAME" ]] && die "--secret is required"

need gcloud
need curl
need openssl
need awk

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY RUN: no GCP mutations will be made"
fi

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY: $*"
  else
    "$@"
  fi
}

# ---- Mode: --finalize -----------------------------------------------
# Disable an old version after the 24h grace.
if [[ -n "$FINALIZE_VERSION" ]]; then
  log "finalizing: disabling $SECRET_NAME version $FINALIZE_VERSION"
  run gcloud secrets versions disable "$FINALIZE_VERSION" \
    --secret="$SECRET_NAME" \
    --project="$PROJECT"
  log "OK — old version disabled (still recoverable via 'enable')"
  exit 0
fi

# ---- Step 0: capture the current state -----------------------------
log "project=$PROJECT region=$REGION service=$SERVICE secret=$SECRET_NAME"

# Find the version Cloud Run currently uses, so we can disable it after grace.
CURRENT_VERSION="$(gcloud secrets versions list "$SECRET_NAME" \
  --project="$PROJECT" \
  --filter="state=ENABLED" \
  --sort-by="~createTime" \
  --limit=1 \
  --format='value(name)' 2>/dev/null | awk -F/ '{print $NF}' || true)"

if [[ -z "$CURRENT_VERSION" ]]; then
  log "no enabled version found — this looks like the first rotation"
else
  log "current latest version = $CURRENT_VERSION"
fi

# ---- Step 1: mint a new value --------------------------------------
TMPVAL="$(mktemp)"
trap 'rm -f "$TMPVAL"' EXIT INT TERM

if [[ "$VALUE_FROM_STDIN" == "1" ]]; then
  log "reading new value from stdin..."
  cat > "$TMPVAL"
  [[ -s "$TMPVAL" ]] || die "empty stdin"
else
  log "generating a random 64-byte hex value"
  openssl rand -hex 64 > "$TMPVAL"
fi

# ---- Step 2: add new version ---------------------------------------
log "adding new Secret Manager version..."
NEW_VERSION=""
if [[ "$DRY_RUN" == "0" ]]; then
  NEW_VERSION="$(gcloud secrets versions add "$SECRET_NAME" \
    --project="$PROJECT" \
    --data-file="$TMPVAL" \
    --format='value(name)' | awk -F/ '{print $NF}')"
  log "new version = $NEW_VERSION"
else
  log "DRY: would gcloud secrets versions add $SECRET_NAME --data-file=<value>"
  NEW_VERSION="DRY_RUN"
fi

# ---- Step 3: roll Cloud Run ----------------------------------------
# ENV var name == SECRET name by convention (overridable via $ENV_NAME).
ENV_NAME="${ENV_NAME:-$SECRET_NAME}"
log "updating Cloud Run service: ${ENV_NAME}=${SECRET_NAME}:latest"
run gcloud run services update "$SERVICE" \
  --project="$PROJECT" \
  --region="$REGION" \
  --update-secrets "${ENV_NAME}=${SECRET_NAME}:latest" \
  --quiet

# ---- Step 4: probe health ------------------------------------------
SVC_URL=""
if [[ "$DRY_RUN" == "0" ]]; then
  SVC_URL="$(gcloud run services describe "$SERVICE" \
    --project="$PROJECT" \
    --region="$REGION" \
    --format='value(status.url)')"
fi

if [[ -n "$SVC_URL" ]]; then
  log "probing ${SVC_URL}${HEALTH_PATH} (up to ${HEALTH_TIMEOUT_SECS}s)..."
  end=$(( $(date +%s) + HEALTH_TIMEOUT_SECS ))
  ok=0
  while [[ $(date +%s) -lt $end ]]; do
    if curl -fsS -o /dev/null --max-time 10 "${SVC_URL}${HEALTH_PATH}"; then
      ok=1
      break
    fi
    sleep 5
  done
  if [[ $ok -ne 1 ]]; then
    log "HEALTH CHECK FAILED — rollback required"
    log "to roll back:"
    log "  gcloud run services update $SERVICE --project $PROJECT --region $REGION \\"
    log "    --update-secrets ${ENV_NAME}=${SECRET_NAME}:${CURRENT_VERSION}"
    exit 3
  fi
  log "health OK"
fi

# ---- Step 5: record + schedule old-version disable -----------------
AUDIT_LINE="$(date -u +%FT%TZ),$SECRET_NAME,$CURRENT_VERSION,$NEW_VERSION,${USER:-unknown}"
log "audit: $AUDIT_LINE"

AUDIT_DIR="$(dirname "$0")/../audit/secrets"
if [[ -d "$AUDIT_DIR" ]] || mkdir -p "$AUDIT_DIR" 2>/dev/null; then
  echo "$AUDIT_LINE" >> "$AUDIT_DIR/rotations.csv" || true
fi

if [[ "$NO_DISABLE_OLD" == "1" ]]; then
  log "skipping schedule (--no-disable-old set)"
elif [[ -n "$CURRENT_VERSION" && "$CURRENT_VERSION" != "$NEW_VERSION" ]]; then
  log "REMINDER: in 24h run:"
  log "  $0 --secret $SECRET_NAME --finalize $CURRENT_VERSION"
fi

log "rotation complete"
exit 0
