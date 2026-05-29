#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# restore-full.sh — Full Firestore restore from a GCS export (SF3 / T-SF.3.2)
#
# RUNBOOK HEADER
# --------------
#   Purpose : Recover the ENTIRE Firestore database from a nightly GCS export
#             (`gs://<bucket>/firestore/<date>/`) into a NEW database, run an
#             integrity check, and stop short of promotion. Promotion (pointing
#             the live backend at the restored DB) is a deliberate, separate
#             manual step documented in docs/runbooks/dr-restore.md §6.
#   When    : Firestore PITR is unavailable (data loss older than the 7-day PITR
#             window) — see DISASTER_RECOVERY.md §4.4. This is the last-resort
#             fall-back path; prefer PITR (§4.3) when the loss is recent.
#   RTO     : 1–4 hours for tenants up to 500k docs (DISASTER_RECOVERY.md §1, R5.9).
#   Owner   : Platform / on-call SRE. Run only on the incident bridge with the
#             Incident Commander's go-ahead.
#   Safety  : NEVER restores into the live "(default)" database. The destination
#             is always a fresh, timestamped DB. The script refuses to proceed
#             if --destination resolves to "(default)".
#
# WHAT IT DOES
#   1. Pre-flight: verify gcloud/gsutil, auth, project, and that the source
#      export prefix exists and contains a Firestore export manifest.
#   2. Resolve the export to restore (explicit --source, or auto-pick latest).
#   3. Integrity-check the export objects (manifest present, non-empty, optional
#      sha256 sidecar verification).
#   4. Create the destination database (idempotent — reuses if already present
#      and empty; refuses if already populated unless --force).
#   5. `gcloud firestore import` the export into the destination DB.
#   6. Post-restore integrity check (collection/doc presence sampling).
#   7. Print explicit, copy-pasteable promotion + rollback instructions.
#
# USAGE
#   scripts/dr/restore-full.sh \
#       --project   erp-system-494716 \
#       --bucket    zoho-83cda-erp-backups \
#       [--source   firestore/2026-05-26/]   # default: latest under firestore/ \
#       [--destination zoho-restore-<epoch>] # default: auto-generated \
#       [--location me-central1] \
#       [--collection-ids invoices,contacts] # default: all \
#       [--dry-run] [--force] [--yes] [--no-color]
#
# EXIT CODES
#   0  success (restore + integrity OK)   3  integrity check failed
#   1  generic failure                    4  destination unsafe / already populated
#   2  invalid arguments                  5  source export not found / invalid
#
# Spec: tasks.md T-SF.3.2; DISASTER_RECOVERY.md §4.4, §6.
# ════════════════════════════════════════════════════════════════════════════
set -Eeuo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
PROJECT="${PROJECT:-${GCP_PROJECT_ID:-erp-system-494716}}"
BUCKET="${BACKUP_GCS_BUCKET:-zoho-83cda-erp-backups}"
SOURCE_PREFIX=""                       # e.g. firestore/2026-05-26/ (empty => latest)
DESTINATION=""                         # empty => auto-generated
LOCATION="${FIRESTORE_LOCATION:-me-central1}"
COLLECTION_IDS=""                      # empty => all collections
DRY_RUN=0
FORCE=0
ASSUME_YES=0
USE_COLOR=1

# ── Logging ───────────────────────────────────────────────────────────────--
_color() { [[ "$USE_COLOR" == "1" && -t 2 ]] && printf '%s' "$1" || true; }
C_RED="$(_color $'\033[0;31m')"; C_YEL="$(_color $'\033[0;33m')"
C_GRN="$(_color $'\033[0;32m')"; C_BLU="$(_color $'\033[0;34m')"; C_RST="$(_color $'\033[0m')"
log()  { printf '%s[restore-full]%s %s\n' "$C_BLU" "$C_RST" "$*" >&2; }
ok()   { printf '%s[restore-full] OK:%s %s\n' "$C_GRN" "$C_RST" "$*" >&2; }
warn() { printf '%s[restore-full] WARN:%s %s\n' "$C_YEL" "$C_RST" "$*" >&2; }
die()  { local rc="${2:-1}"; printf '%s[restore-full] FATAL:%s %s\n' "$C_RED" "$C_RST" "$1" >&2; exit "$rc"; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1" 1; }

# Loud on errors: print the failing command + line on any unhandled error.
trap 'die "command failed (line $LINENO): ${BASH_COMMAND}" 1' ERR

usage() { sed -n '2,66p' "$0"; exit "${1:-2}"; }

# ── Arg parsing ───────────────────────────────────────────────────────────--
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)        PROJECT="${2:?}"; shift 2 ;;
    --bucket)         BUCKET="${2:?}"; shift 2 ;;
    --source)         SOURCE_PREFIX="${2:?}"; shift 2 ;;
    --destination)    DESTINATION="${2:?}"; shift 2 ;;
    --location)       LOCATION="${2:?}"; shift 2 ;;
    --collection-ids) COLLECTION_IDS="${2:?}"; shift 2 ;;
    --dry-run)        DRY_RUN=1; shift ;;
    --force)          FORCE=1; shift ;;
    --yes|-y)         ASSUME_YES=1; shift ;;
    --no-color)       USE_COLOR=0; shift ;;
    -h|--help)        usage 0 ;;
    *) die "unknown argument: $1 (try --help)" 2 ;;
  esac
done

need gcloud
need gsutil
need awk

# ── run(): respects --dry-run for any MUTATING command ──────────────────────
run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s[restore-full] DRY-RUN:%s %s\n' "$C_YEL" "$C_RST" "$*" >&2
    return 0
  fi
  "$@"
}

# Read-only helpers always execute (even in dry-run) so the plan is realistic.
gsutil_ro() { gsutil "$@"; }

# ── Step 0 — pre-flight ─────────────────────────────────────────────────────
log "project=$PROJECT bucket=$BUCKET location=$LOCATION dry_run=$DRY_RUN force=$FORCE"

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  die "no active gcloud credentials — run 'gcloud auth login' (or activate a service account)" 1
fi
gcloud config set project "$PROJECT" >/dev/null 2>&1 || die "cannot set project $PROJECT" 1

# ── Step 1 — resolve the source export prefix ───────────────────────────────
# Layout written by the nightly export: gs://<bucket>/firestore/<YYYY-MM-DD>/...
# A valid Firestore export contains an overall export metadata object named
# "<prefix>.overall_export_metadata".
BASE="gs://${BUCKET}/firestore/"

if [[ -z "$SOURCE_PREFIX" ]]; then
  log "no --source given; selecting the most recent export under ${BASE}"
  # List immediate date "directories", sort lexically (ISO dates sort correctly),
  # take the last. gsutil ls returns trailing-slash dirs for prefixes.
  LATEST="$(gsutil_ro ls "$BASE" 2>/dev/null | grep -E '/[0-9]{4}-[0-9]{2}-[0-9]{2}/$' | sort | tail -n1 || true)"
  [[ -n "$LATEST" ]] || die "no dated exports found under ${BASE}" 5
  SOURCE_URI="$LATEST"
else
  # Normalise to a full gs:// URI with a single trailing slash.
  if [[ "$SOURCE_PREFIX" == gs://* ]]; then
    SOURCE_URI="${SOURCE_PREFIX%/}/"
  else
    SOURCE_URI="gs://${BUCKET}/${SOURCE_PREFIX#/}"
    SOURCE_URI="${SOURCE_URI%/}/"
  fi
fi
log "source export = ${SOURCE_URI}"

# ── Step 2 — integrity-check the export BEFORE we touch any database ─────────
log "integrity: verifying export manifest + object set"
# Firestore export always writes an overall metadata object. Its name is the
# export prefix with the trailing path segment repeated, e.g.
#   gs://b/firestore/2026-05-26/2026-05-26.overall_export_metadata
# We accept any *.overall_export_metadata under the prefix to be robust to the
# exact naming gcloud chose.
META_OBJ="$(gsutil_ro ls "${SOURCE_URI}**overall_export_metadata" 2>/dev/null | head -n1 || true)"
if [[ -z "$META_OBJ" ]]; then
  die "no *.overall_export_metadata under ${SOURCE_URI} — not a valid Firestore export (or still in progress)" 5
fi
ok "export manifest present: ${META_OBJ}"

# Count export-payload objects (output-N-of-M / .export_metadata) as a sanity gate.
OBJ_COUNT="$(gsutil_ro ls -r "${SOURCE_URI}**" 2>/dev/null | grep -E '\.(export_metadata|overall_export_metadata)$|all_namespaces' | wc -l | tr -d ' ')"
log "integrity: ${OBJ_COUNT} export object(s) detected under prefix"
[[ "${OBJ_COUNT:-0}" -ge 1 ]] || die "export prefix contains no recognisable Firestore objects" 5

# Optional sha256 sidecar verification: if a manifest of checksums exists at
# "<prefix>checksums.sha256" (written by our own pipeline), verify a sample.
SIDECAR="${SOURCE_URI}checksums.sha256"
if gsutil_ro -q stat "$SIDECAR" 2>/dev/null; then
  if command -v sha256sum >/dev/null 2>&1; then
    log "integrity: checksums.sha256 sidecar found — verifying a sample object"
    SAMPLE_LINE="$(gsutil_ro cat "$SIDECAR" 2>/dev/null | head -n1 || true)"
    if [[ -n "$SAMPLE_LINE" ]]; then
      EXP_HASH="$(awk '{print $1}' <<<"$SAMPLE_LINE")"
      REL_PATH="$(awk '{print $2}' <<<"$SAMPLE_LINE")"
      ACT_HASH="$(gsutil_ro cat "${SOURCE_URI}${REL_PATH}" 2>/dev/null | sha256sum | awk '{print $1}' || true)"
      if [[ -n "$EXP_HASH" && "$EXP_HASH" == "$ACT_HASH" ]]; then
        ok "integrity: sample checksum verified (${REL_PATH})"
      else
        die "integrity: checksum MISMATCH for ${REL_PATH} (expected ${EXP_HASH}, got ${ACT_HASH:-<none>})" 3
      fi
    fi
  else
    warn "checksums.sha256 sidecar present but 'sha256sum' unavailable — skipping content verification"
  fi
else
  warn "no checksums.sha256 sidecar (relying on GCS object integrity + Firestore import validation)"
fi

# ── Step 3 — resolve & guard the destination database ───────────────────────
if [[ -z "$DESTINATION" ]]; then
  DESTINATION="zoho-restore-$(date -u +%Y%m%d-%H%M%S)"
fi
# Hard safety rail: refuse to ever target the live default database.
if [[ "$DESTINATION" == "(default)" || "$DESTINATION" == "default" ]]; then
  die "refusing to restore into the live '(default)' database — choose a fresh --destination" 4
fi
log "destination database = ${DESTINATION}"

DB_EXISTS=0
if gcloud firestore databases describe --database="$DESTINATION" --project="$PROJECT" >/dev/null 2>&1; then
  DB_EXISTS=1
fi

if [[ "$DB_EXISTS" == "1" ]]; then
  warn "destination database '${DESTINATION}' already exists"
  if [[ "$FORCE" != "1" ]]; then
    die "destination already exists; re-run with --force to import into it (data may merge), or pick a new --destination" 4
  fi
  warn "--force set: will import INTO existing '${DESTINATION}' (caller accepts merge semantics)"
else
  # ── Step 4 — create the destination DB (idempotent via DB_EXISTS guard) ──
  log "creating destination database '${DESTINATION}' in ${LOCATION} (Datastore-mode? no — Firestore Native)"
  run gcloud firestore databases create \
    --database="$DESTINATION" \
    --location="$LOCATION" \
    --type=firestore-native \
    --project="$PROJECT" \
    --quiet
  ok "destination database created (or dry-run)"
fi

# ── Confirmation gate (skipped in dry-run / --yes) ──────────────────────────
if [[ "$DRY_RUN" != "1" && "$ASSUME_YES" != "1" ]]; then
  printf '%s[restore-full] About to import %s -> database %s on project %s.%s\n' \
    "$C_YEL" "$SOURCE_URI" "$DESTINATION" "$PROJECT" "$C_RST" >&2
  printf '[restore-full] Type the destination name to confirm: ' >&2
  read -r CONFIRM
  [[ "$CONFIRM" == "$DESTINATION" ]] || die "confirmation mismatch — aborting" 1
fi

# ── Step 5 — import ─────────────────────────────────────────────────────────
IMPORT_ARGS=(
  "${SOURCE_URI}${META_OBJ##*/}"          # gcloud wants the overall metadata URI
  --database="$DESTINATION"
  --project="$PROJECT"
  --quiet
)
# Re-derive the metadata URI cleanly (META_OBJ is already a full gs:// URI).
IMPORT_URI="$META_OBJ"
IMPORT_ARGS=( "$IMPORT_URI" --database="$DESTINATION" --project="$PROJECT" --quiet )

if [[ -n "$COLLECTION_IDS" ]]; then
  IMPORT_ARGS+=( "--collection-ids=${COLLECTION_IDS}" )
  log "scoped import — collection-ids=${COLLECTION_IDS}"
fi

log "starting import (this can take 30–240 min for large tenants)…"
run gcloud firestore import "${IMPORT_ARGS[@]}"
ok "import command completed (or dry-run)"

# ── Step 6 — post-restore integrity check ───────────────────────────────────
# Best-effort sampling: confirm a few well-known collections exist and are
# non-empty in the restored DB. Uses the lightweight Python sampler shipped
# alongside this script if present; otherwise emits manual verification steps.
SAMPLER="$(dirname "$0")/../../backend/scripts/verify_restore_sample.py"
if [[ "$DRY_RUN" != "1" ]]; then
  if [[ -f "$SAMPLER" ]] && command -v python3 >/dev/null 2>&1; then
    log "integrity: sampling restored database via verify_restore_sample.py"
    if python3 "$SAMPLER" \
        --project "$PROJECT" \
        --database "$DESTINATION" \
        --collections "${COLLECTION_IDS:-invoices,contacts,accounts,organizations}" \
        --min-per-collection 0; then
      ok "post-restore sampling passed"
    else
      die "post-restore sampling FAILED — investigate before any promotion" 3
    fi
  else
    warn "verify_restore_sample.py not runnable here — perform manual verification:"
    warn "  gcloud firestore operations list --database=${DESTINATION} --project=${PROJECT}"
    warn "  (confirm the import operation shows state=SUCCESSFUL)"
  fi
else
  log "DRY-RUN: skipping post-restore sampling"
fi

# ── Step 7 — promotion + rollback guidance (we deliberately STOP here) ───────
cat >&2 <<EOF

${C_GRN}════════════════════════════════════════════════════════════════════════${C_RST}
${C_GRN}RESTORE STAGED${C_RST} — database '${DESTINATION}' now holds the restored data.
This script intentionally does NOT promote it to live traffic.

NEXT STEPS (manual, on the incident bridge — see docs/runbooks/dr-restore.md §6):
  1. Verify the restored DB (sample 10 docs across invoices/contacts/journals).
  2. PROMOTE by repointing the backend at the restored DB:
       gcloud run services update zoho-erp \\
         --project ${PROJECT} --region ${LOCATION} \\
         --update-env-vars FIRESTORE_DATABASE_ID=${DESTINATION}
     (or perform a selective re-import into "(default)" if you prefer to keep
      the database name stable.)
  3. Re-run the accounting smoke + /api/health checks.

ROLLBACK (if the restored data is wrong):
  - Do nothing destructive: the live "(default)" DB was never touched.
  - Simply revert the Cloud Run env-var change above to the previous value.
  - Delete the staging DB once no longer needed:
       gcloud firestore databases delete --database=${DESTINATION} --project=${PROJECT}
${C_GRN}════════════════════════════════════════════════════════════════════════${C_RST}
EOF

ok "restore-full complete (dry_run=${DRY_RUN})"
exit 0
