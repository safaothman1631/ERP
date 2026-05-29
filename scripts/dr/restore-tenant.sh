#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# restore-tenant.sh — Selective per-tenant (org_id) Firestore restore
#                     (SF3 / T-SF.3.3)
#
# RUNBOOK HEADER
# --------------
#   Purpose : Restore the data for ONE organization (org_id) from a GCS export
#             without disturbing any other tenant. The native Firestore import
#             cannot filter by a field value, so this script uses a
#             restore -> filter -> re-import pipeline:
#               1. Import the full export into an ISOLATED scratch database.
#               2. Stream the scratch DB, keep only docs where org_id == <ORG>,
#                  and write a per-tenant patch (one JSON file per collection).
#               3. Apply that patch back into the LIVE "(default)" database via
#                  the application's own BaseRepository (org-scoped, audited).
#               4. Tear down the scratch database.
#   When    : A single tenant suffered data loss / corruption (bad bulk edit,
#             accidental delete) and PITR is either too coarse or already past
#             its 7-day window. Single-tenant blast radius — DISASTER_RECOVERY.md
#             §1 ("Single-tenant impact").
#   Owner   : Platform / on-call SRE, with the affected tenant's admin informed.
#   Safety  : Writes to live "(default)" ONLY through the org-scoped applier and
#             ONLY for the named org_id. --dry-run produces the patch and a diff
#             summary but performs NO live writes. Refuses an empty org_id.
#
# USAGE
#   scripts/dr/restore-tenant.sh \
#       --org-id    064a4a1a-487b-4835-a42a-4806ba8add72 \
#       --project   erp-system-494716 \
#       --bucket    zoho-83cda-erp-backups \
#       [--source   firestore/2026-05-26/]   # default: latest \
#       [--collections invoices,invoice_lines,contacts]  # default: all \
#       [--location me-central1] \
#       [--out-dir  ./_dr/tenant-restore]    # where patch JSON is written \
#       [--keep-scratch]                      # don't delete scratch DB at end \
#       [--apply]                             # actually write to live (default: off) \
#       [--dry-run] [--yes] [--no-color]
#
#   NOTE: --dry-run and (absence of) --apply are BOTH safety gates. Live writes
#         happen only when you pass --apply AND omit --dry-run.
#
# EXIT CODES
#   0  success                  3  filter/extract produced zero docs for org
#   1  generic failure          4  scratch DB unsafe / collision
#   2  invalid arguments        5  source export not found / invalid
#
# Spec: tasks.md T-SF.3.3; DISASTER_RECOVERY.md §4.3/§4.4.
# ════════════════════════════════════════════════════════════════════════════
set -Eeuo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
ORG_ID=""
PROJECT="${PROJECT:-${GCP_PROJECT_ID:-erp-system-494716}}"
BUCKET="${BACKUP_GCS_BUCKET:-zoho-83cda-erp-backups}"
SOURCE_PREFIX=""
COLLECTIONS=""                         # empty => all collections in the export
LOCATION="${FIRESTORE_LOCATION:-me-central1}"
OUT_DIR="./_dr/tenant-restore"
KEEP_SCRATCH=0
APPLY=0
DRY_RUN=0
ASSUME_YES=0
USE_COLOR=1

# ── Logging ─────────────────────────────────────────────────────────────────
_color() { [[ "$USE_COLOR" == "1" && -t 2 ]] && printf '%s' "$1" || true; }
C_RED="$(_color $'\033[0;31m')"; C_YEL="$(_color $'\033[0;33m')"
C_GRN="$(_color $'\033[0;32m')"; C_BLU="$(_color $'\033[0;34m')"; C_RST="$(_color $'\033[0m')"
log()  { printf '%s[restore-tenant]%s %s\n' "$C_BLU" "$C_RST" "$*" >&2; }
ok()   { printf '%s[restore-tenant] OK:%s %s\n' "$C_GRN" "$C_RST" "$*" >&2; }
warn() { printf '%s[restore-tenant] WARN:%s %s\n' "$C_YEL" "$C_RST" "$*" >&2; }
die()  { local rc="${2:-1}"; printf '%s[restore-tenant] FATAL:%s %s\n' "$C_RED" "$C_RST" "$1" >&2; exit "$rc"; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1" 1; }
trap 'die "command failed (line $LINENO): ${BASH_COMMAND}" 1' ERR

usage() { sed -n '2,57p' "$0"; exit "${1:-2}"; }

# ── Arg parsing ───────────────────────────────────────────────────────────--
while [[ $# -gt 0 ]]; do
  case "$1" in
    --org-id)       ORG_ID="${2:?}"; shift 2 ;;
    --project)      PROJECT="${2:?}"; shift 2 ;;
    --bucket)       BUCKET="${2:?}"; shift 2 ;;
    --source)       SOURCE_PREFIX="${2:?}"; shift 2 ;;
    --collections)  COLLECTIONS="${2:?}"; shift 2 ;;
    --location)     LOCATION="${2:?}"; shift 2 ;;
    --out-dir)      OUT_DIR="${2:?}"; shift 2 ;;
    --keep-scratch) KEEP_SCRATCH=1; shift ;;
    --apply)        APPLY=1; shift ;;
    --dry-run)      DRY_RUN=1; shift ;;
    --yes|-y)       ASSUME_YES=1; shift ;;
    --no-color)     USE_COLOR=0; shift ;;
    -h|--help)      usage 0 ;;
    *) die "unknown argument: $1 (try --help)" 2 ;;
  esac
done

[[ -n "$ORG_ID" ]] || die "--org-id is required" 2
need gcloud
need gsutil
need python3

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s[restore-tenant] DRY-RUN:%s %s\n' "$C_YEL" "$C_RST" "$*" >&2
    return 0
  fi
  "$@"
}

log "org_id=$ORG_ID project=$PROJECT bucket=$BUCKET dry_run=$DRY_RUN apply=$APPLY"

if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  die "no active gcloud credentials — run 'gcloud auth login'" 1
fi
gcloud config set project "$PROJECT" >/dev/null 2>&1 || die "cannot set project $PROJECT" 1

# ── Step 1 — resolve source export (reuse restore-full's layout) ────────────
BASE="gs://${BUCKET}/firestore/"
if [[ -z "$SOURCE_PREFIX" ]]; then
  LATEST="$(gsutil ls "$BASE" 2>/dev/null | grep -E '/[0-9]{4}-[0-9]{2}-[0-9]{2}/$' | sort | tail -n1 || true)"
  [[ -n "$LATEST" ]] || die "no dated exports found under ${BASE}" 5
  SOURCE_URI="$LATEST"
elif [[ "$SOURCE_PREFIX" == gs://* ]]; then
  SOURCE_URI="${SOURCE_PREFIX%/}/"
else
  SOURCE_URI="gs://${BUCKET}/${SOURCE_PREFIX#/}"; SOURCE_URI="${SOURCE_URI%/}/"
fi
META_OBJ="$(gsutil ls "${SOURCE_URI}**overall_export_metadata" 2>/dev/null | head -n1 || true)"
[[ -n "$META_OBJ" ]] || die "no overall_export_metadata under ${SOURCE_URI} — invalid export" 5
ok "source export = ${SOURCE_URI}"

# ── Step 2 — create an ISOLATED scratch DB ──────────────────────────────────
SCRATCH_DB="zoho-tenant-restore-${ORG_ID:0:8}-$(date -u +%H%M%S)"
if [[ "$SCRATCH_DB" == "(default)" ]]; then die "computed scratch DB name is unsafe" 4; fi
if gcloud firestore databases describe --database="$SCRATCH_DB" --project="$PROJECT" >/dev/null 2>&1; then
  die "scratch DB '${SCRATCH_DB}' already exists — collision, aborting" 4
fi
log "creating isolated scratch database '${SCRATCH_DB}'"
run gcloud firestore databases create \
  --database="$SCRATCH_DB" --location="$LOCATION" --type=firestore-native \
  --project="$PROJECT" --quiet

# Ensure we always tear the scratch DB down (unless --keep-scratch).
cleanup_scratch() {
  if [[ "$KEEP_SCRATCH" == "1" ]]; then
    warn "--keep-scratch set: leaving scratch DB '${SCRATCH_DB}' in place (delete it manually!)"
    return 0
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s[restore-tenant] DRY-RUN:%s would delete scratch DB %s\n' "$C_YEL" "$C_RST" "$SCRATCH_DB" >&2
    return 0
  fi
  log "tearing down scratch database '${SCRATCH_DB}'"
  gcloud firestore databases delete --database="$SCRATCH_DB" --project="$PROJECT" --quiet \
    || warn "failed to delete scratch DB '${SCRATCH_DB}' — delete it manually to avoid cost"
}
trap 'cleanup_scratch' EXIT

# ── Step 3 — import the full export into the scratch DB ─────────────────────
IMPORT_ARGS=( "$META_OBJ" --database="$SCRATCH_DB" --project="$PROJECT" --quiet )
[[ -n "$COLLECTIONS" ]] && IMPORT_ARGS+=( "--collection-ids=${COLLECTIONS}" )
log "importing export into scratch DB (collection-ids=${COLLECTIONS:-<all>})…"
run gcloud firestore import "${IMPORT_ARGS[@]}"
ok "scratch import complete (or dry-run)"

# ── Step 4 — filter to org_id and write a per-tenant patch ──────────────────
mkdir -p "$OUT_DIR"
PATCH_DIR="${OUT_DIR}/${ORG_ID}"
EXTRACTOR="$(dirname "$0")/../../backend/scripts/extract_tenant_from_db.py"
[[ -f "$EXTRACTOR" ]] || die "extractor not found: $EXTRACTOR" 1

log "filtering scratch DB to org_id=${ORG_ID} -> ${PATCH_DIR}/"
if [[ "$DRY_RUN" == "1" ]]; then
  printf '%s[restore-tenant] DRY-RUN:%s would run extractor against scratch DB\n' "$C_YEL" "$C_RST" >&2
  EXTRACT_RC=0
else
  EXTRACT_ARGS=(
    --project "$PROJECT"
    --database "$SCRATCH_DB"
    --org-id "$ORG_ID"
    --out-dir "$PATCH_DIR"
  )
  [[ -n "$COLLECTIONS" ]] && EXTRACT_ARGS+=( --collections "$COLLECTIONS" )
  set +e
  python3 "$EXTRACTOR" "${EXTRACT_ARGS[@]}"
  EXTRACT_RC=$?
  set -e
fi

if [[ "$DRY_RUN" != "1" ]]; then
  case "$EXTRACT_RC" in
    0) ok "extracted tenant patch to ${PATCH_DIR}/" ;;
    3) die "no documents matched org_id=${ORG_ID} in the export — wrong org or wrong export date?" 3 ;;
    *) die "extractor failed (rc=${EXTRACT_RC})" 1 ;;
  esac
fi

# ── Step 5 — apply the patch into LIVE "(default)" (gated) ──────────────────
APPLIER="$(dirname "$0")/../../backend/scripts/apply_tenant_patch.py"
[[ -f "$APPLIER" ]] || die "applier not found: $APPLIER" 1

if [[ "$APPLY" == "1" && "$DRY_RUN" != "1" ]]; then
  if [[ "$ASSUME_YES" != "1" ]]; then
    printf '%s[restore-tenant] About to WRITE restored docs for org %s into LIVE (default) DB on %s.%s\n' \
      "$C_YEL" "$ORG_ID" "$PROJECT" "$C_RST" >&2
    printf '[restore-tenant] Type the org_id to confirm: ' >&2
    read -r CONFIRM
    [[ "$CONFIRM" == "$ORG_ID" ]] || die "confirmation mismatch — aborting before any live write" 1
  fi
  log "applying patch to live (default) database (org-scoped, audited)…"
  python3 "$APPLIER" \
    --project "$PROJECT" \
    --database "(default)" \
    --org-id "$ORG_ID" \
    --in-dir "$PATCH_DIR" \
    --mode upsert
  ok "patch applied to live database for org ${ORG_ID}"
else
  # Diff-only / dry-run path: show what WOULD change without writing.
  log "diff-only mode (no live writes). Computing patch summary…"
  if [[ "$DRY_RUN" != "1" && -d "$PATCH_DIR" ]]; then
    python3 "$APPLIER" \
      --project "$PROJECT" \
      --database "(default)" \
      --org-id "$ORG_ID" \
      --in-dir "$PATCH_DIR" \
      --mode diff || warn "diff computation reported issues (non-fatal in diff mode)"
  fi
  warn "NOT applied to live DB. Re-run with --apply (and without --dry-run) to write."
fi

cat >&2 <<EOF

${C_GRN}════════════════════════════════════════════════════════════════════════${C_RST}
${C_GRN}TENANT RESTORE ${APPLY:+(apply)}${APPLY:-(diff-only)} COMPLETE${C_RST} for org_id=${ORG_ID}
  Patch JSON : ${PATCH_DIR}/
  Scratch DB : ${SCRATCH_DB} $( [[ "$KEEP_SCRATCH" == 1 ]] && echo '(KEPT — delete manually)' || echo '(torn down)')

VERIFY:
  - Inspect ${PATCH_DIR}/_manifest.json for per-collection doc counts.
  - In the app, confirm the affected tenant's records look correct.
ROLLBACK:
  - The live "(default)" DB write is an org-scoped upsert; to undo, re-apply an
    earlier export's patch or restore from PITR (DISASTER_RECOVERY.md §4.3).
${C_GRN}════════════════════════════════════════════════════════════════════════${C_RST}
EOF

ok "restore-tenant complete (dry_run=${DRY_RUN}, apply=${APPLY})"
exit 0
