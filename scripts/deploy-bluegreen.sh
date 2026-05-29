#!/usr/bin/env bash
# Cloud Run blue/green deploy with automatic rollback (P4 / R10.3, design §3.6).
#
# Usage:
#   SERVICE_NAME=zoho-backend NEW_IMAGE=gcr.io/proj/zoho-backend:abc123 \
#   REGION=me-central1 PROJECT=my-proj \
#   scripts/deploy-bluegreen.sh
#
# Required env:
#   SERVICE_NAME  — Cloud Run service name (e.g. zoho-backend)
#   NEW_IMAGE     — full container image URI to deploy
#
# Optional env:
#   PROJECT       — GCP project; defaults to current gcloud config
#   REGION        — Cloud Run region; default me-central1
#   CANDIDATE_TAG — tag for the candidate revision; default 'candidate'
#   SOAK_MINUTES  — soak duration at 1% before full cutover; default 5
#   ERROR_THRESHOLD — 5xx rate threshold to abort (fraction); default 0.005
#   SOAK_TRAFFIC  — initial candidate traffic %; default 1
#
# Exit codes:
#   0 — successful cutover to 100% on the new revision
#   1 — rollback executed because of elevated 5xx
#   2 — pre-flight configuration error (missing env / tools)
#   3 — gcloud command failed unexpectedly

set -euo pipefail

# ── Logging helpers ─────────────────────────────────────────────────────────

ts() { date +"%Y-%m-%dT%H:%M:%S%z"; }
log()  { printf '[%s] [deploy-bluegreen] %s\n' "$(ts)" "$*" >&2; }
err()  { printf '[%s] [deploy-bluegreen] ERROR: %s\n' "$(ts)" "$*" >&2; }
die()  { err "$*"; exit "${2:-3}"; }

# ── Pre-flight ──────────────────────────────────────────────────────────────

log "starting blue/green deploy"

: "${SERVICE_NAME:?SERVICE_NAME must be set}" || die "missing SERVICE_NAME" 2
: "${NEW_IMAGE:?NEW_IMAGE must be set}" || die "missing NEW_IMAGE" 2

PROJECT="${PROJECT:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${REGION:-me-central1}"
CANDIDATE_TAG="${CANDIDATE_TAG:-candidate}"
SOAK_MINUTES="${SOAK_MINUTES:-5}"
SOAK_TRAFFIC="${SOAK_TRAFFIC:-1}"
ERROR_THRESHOLD="${ERROR_THRESHOLD:-0.005}"

if [[ -z "${PROJECT}" ]]; then
  die "PROJECT is not set and no default gcloud project configured" 2
fi

command -v gcloud >/dev/null || die "gcloud CLI not found in PATH" 2

log "service=${SERVICE_NAME} region=${REGION} project=${PROJECT}"
log "candidate image=${NEW_IMAGE}"
log "candidate tag=${CANDIDATE_TAG} soak=${SOAK_MINUTES}m traffic=${SOAK_TRAFFIC}% threshold=${ERROR_THRESHOLD}"

# ── Resolve previous revision (for rollback) ────────────────────────────────

PREV_REVISION=$(
  gcloud run services describe "${SERVICE_NAME}" \
    --project "${PROJECT}" --region "${REGION}" \
    --format='value(status.latestReadyRevisionName)' 2>/dev/null || true
)
if [[ -z "${PREV_REVISION}" ]]; then
  log "WARN: no previous ready revision found — this looks like the first deploy"
else
  log "previous ready revision: ${PREV_REVISION}"
fi

# ── Step 1: Deploy candidate with NO traffic ────────────────────────────────

log "step 1/4: deploying candidate revision with --no-traffic --tag ${CANDIDATE_TAG}"

if ! gcloud run deploy "${SERVICE_NAME}" \
      --project "${PROJECT}" \
      --region "${REGION}" \
      --image "${NEW_IMAGE}" \
      --no-traffic \
      --tag "${CANDIDATE_TAG}" \
      --quiet; then
  die "candidate deploy failed" 3
fi

CANDIDATE_REVISION=$(
  gcloud run services describe "${SERVICE_NAME}" \
    --project "${PROJECT}" --region "${REGION}" \
    --format='value(status.latestCreatedRevisionName)'
)
log "candidate revision: ${CANDIDATE_REVISION}"

# ── Step 2: Shift SOAK_TRAFFIC% to candidate ────────────────────────────────

log "step 2/4: shifting ${SOAK_TRAFFIC}% traffic to candidate"
PREV_TRAFFIC=$((100 - SOAK_TRAFFIC))

shift_traffic() {
  # $1 = candidate percent, $2 = previous percent
  local cand="$1"
  local prev="$2"
  if [[ -n "${PREV_REVISION}" && "${prev}" -gt 0 ]]; then
    gcloud run services update-traffic "${SERVICE_NAME}" \
      --project "${PROJECT}" --region "${REGION}" \
      --to-revisions "${PREV_REVISION}=${prev},${CANDIDATE_REVISION}=${cand}" \
      --quiet
  else
    gcloud run services update-traffic "${SERVICE_NAME}" \
      --project "${PROJECT}" --region "${REGION}" \
      --to-revisions "${CANDIDATE_REVISION}=${cand}" \
      --quiet
  fi
}

if ! shift_traffic "${SOAK_TRAFFIC}" "${PREV_TRAFFIC}"; then
  err "traffic shift to ${SOAK_TRAFFIC}% failed — attempting rollback"
  rollback_candidate
  exit 1
fi

# ── Step 3: Soak — poll Cloud Monitoring for 5xx during SOAK_MINUTES ────────

log "step 3/4: soaking ${SOAK_MINUTES} minute(s) — watching 5xx rate"

# Poll every 30s; abort early if threshold crossed.
SOAK_SECONDS=$((SOAK_MINUTES * 60))
INTERVAL=30
ELAPSED=0
ABORT=0

# MQL query for Cloud Run 5xx rate over the last 1 minute, filtered to revision tag.
read_5xx_rate() {
  # Outputs a float between 0 and 1, or empty string on failure.
  local mql
  mql=$(cat <<'EOF'
fetch cloud_run_revision::run.googleapis.com/request_count
| filter (resource.service_name == 'SERVICE_NAME_PLACEHOLDER'
       && resource.revision_name == 'CANDIDATE_REVISION_PLACEHOLDER')
| group_by 1m, [count: sum(value.request_count) ]
| filter response_code_class == '5xx'
EOF
)
  # NOTE: the metric path varies by environment; the simpler reading is via
  # the monitoring read-time-series API. We use a defensive query and tolerate
  # an empty result (treated as 0%).
  local total_5xx total_all rate
  total_5xx=$(gcloud monitoring time-series list \
    --project "${PROJECT}" \
    --filter "metric.type=\"run.googleapis.com/request_count\" AND resource.label.revision_name=\"${CANDIDATE_REVISION}\" AND metric.label.response_code_class=\"5xx\"" \
    --interval-end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --interval-start-time "$(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-1M +%Y-%m-%dT%H:%M:%SZ)" \
    --format='value(points.value.int64Value)' 2>/dev/null \
    | awk '{s+=$1} END {print s+0}')
  total_all=$(gcloud monitoring time-series list \
    --project "${PROJECT}" \
    --filter "metric.type=\"run.googleapis.com/request_count\" AND resource.label.revision_name=\"${CANDIDATE_REVISION}\"" \
    --interval-end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --interval-start-time "$(date -u -d '1 minute ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-1M +%Y-%m-%dT%H:%M:%SZ)" \
    --format='value(points.value.int64Value)' 2>/dev/null \
    | awk '{s+=$1} END {print s+0}')
  if [[ -z "${total_all}" || "${total_all}" == "0" ]]; then
    echo "0"
    return
  fi
  rate=$(awk -v a="${total_5xx}" -v b="${total_all}" 'BEGIN { printf "%.6f", a/b }')
  echo "${rate}"
}

while (( ELAPSED < SOAK_SECONDS )); do
  sleep "${INTERVAL}"
  ELAPSED=$(( ELAPSED + INTERVAL ))
  RATE=$(read_5xx_rate || echo "0")
  log "soak check t+${ELAPSED}s — 5xx rate = ${RATE}"

  # Bash can't compare floats — defer to awk.
  if awk -v r="${RATE}" -v t="${ERROR_THRESHOLD}" 'BEGIN { exit !(r+0 > t+0) }'; then
    err "5xx rate ${RATE} exceeds threshold ${ERROR_THRESHOLD} — aborting soak"
    ABORT=1
    break
  fi
done

# ── Rollback path ───────────────────────────────────────────────────────────

rollback_candidate() {
  log "rollback: removing candidate tag and routing 100% back to previous revision"
  if [[ -n "${PREV_REVISION}" ]]; then
    gcloud run services update-traffic "${SERVICE_NAME}" \
      --project "${PROJECT}" --region "${REGION}" \
      --to-revisions "${PREV_REVISION}=100" --quiet || true
  fi
  gcloud run services update-traffic "${SERVICE_NAME}" \
    --project "${PROJECT}" --region "${REGION}" \
    --remove-tags "${CANDIDATE_TAG}" --quiet || true
  log "rollback complete"
}

if (( ABORT == 1 )); then
  rollback_candidate
  exit 1
fi

# ── Step 4: Promote candidate to 100% ──────────────────────────────────────

log "step 4/4: soak passed — promoting candidate to 100% traffic"
if ! gcloud run services update-traffic "${SERVICE_NAME}" \
      --project "${PROJECT}" --region "${REGION}" \
      --to-revisions "${CANDIDATE_REVISION}=100" --quiet; then
  err "final cutover failed — initiating rollback"
  rollback_candidate
  exit 1
fi

# Clean up tag (optional — keeps URL surface tidy).
gcloud run services update-traffic "${SERVICE_NAME}" \
  --project "${PROJECT}" --region "${REGION}" \
  --remove-tags "${CANDIDATE_TAG}" --quiet || true

log "blue/green deploy succeeded — ${CANDIDATE_REVISION} is now serving 100% traffic"
exit 0
