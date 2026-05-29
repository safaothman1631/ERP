#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════════
# provision-dr.sh — One-time DR infrastructure provisioning (SF3 / T-SF.3.4-3.8)
#
# RUNBOOK HEADER
# --------------
#   Purpose : Stand up the durable-storage side of disaster recovery:
#               (A) Firestore Point-in-Time Recovery (PITR), 7-day window.
#               (B) GCS "turbo replication" of the backup bucket from the
#                   primary region (me-central1) to a far region (europe-west4).
#               (C) A dedicated, versioned, retention-locked backup bucket with
#                   Bucket-Lock + per-object retention (immutability / WORM).
#               (D) A lifecycle policy: Standard -> Nearline @30d -> Coldline
#                   @90d -> Archive @365d.
#   When    : Initial DR setup, and whenever any of the above must be (re)applied.
#             SAFE to re-run: every step is written to be idempotent — it checks
#             current state and only mutates on drift.
#   Owner   : Platform lead WITH project Owner/Editor + Firestore Admin +
#             Storage Admin roles. This APPLIES real cloud resources and incurs
#             cost — run deliberately, ideally with --dry-run first.
#   Cost    : Turbo replication + dual-region storage + Archive class all bill.
#             Review the printed cost notes before applying in production.
#
# IMPORTANT — TURBO REPLICATION REQUIRES A DUAL-REGION BUCKET
#   GCS "turbo replication" is a property of a *dual-region* bucket and gives a
#   replication RPO SLA (15 min). You cannot turn it on for a single-region
#   bucket. This script therefore provisions the backup bucket as the
#   me-central1 + europe-west4 dual-region (location "ASIA1"/custom dual-region)
#   with --rpo=ASYNC_TURBO. If a single-region bucket already exists, the script
#   prints the migration path rather than silently doing a destructive move.
#
# USAGE
#   scripts/dr/provision-dr.sh \
#       --project   erp-system-494716 \
#       --db         "(default)" \
#       --bucket     zoho-83cda-erp-backups \
#       --primary    ME-CENTRAL1 \
#       --secondary  EUROPE-WEST4 \
#       [--retention-days 2555]      # object-lock retention (7y legal default) \
#       [--dry-run] [--yes] [--no-color]
#
# EXIT CODES
#   0 success/no-op   1 generic failure   2 invalid args   6 manual step required
#
# Spec: tasks.md T-SF.3.4 (PITR), T-SF.3.5 (turbo replication),
#       T-SF.3.6 (bucket+object lock), T-SF.3.7 (lifecycle),
#       T-SF.3.8 (wiring this into the runbook); DISASTER_RECOVERY.md §6.
# ════════════════════════════════════════════════════════════════════════════
set -Eeuo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
PROJECT="${PROJECT:-${GCP_PROJECT_ID:-erp-system-494716}}"
DB="${FIRESTORE_DATABASE_ID:-(default)}"
BUCKET="${BACKUP_GCS_BUCKET:-zoho-83cda-erp-backups}"
PRIMARY="${DR_PRIMARY_REGION:-ME-CENTRAL1}"
SECONDARY="${DR_SECONDARY_REGION:-EUROPE-WEST4}"
RETENTION_DAYS="${DR_RETENTION_DAYS:-2555}"   # 7 years (legal records, §1)
DRY_RUN=0
ASSUME_YES=0
USE_COLOR=1

# ── Logging ─────────────────────────────────────────────────────────────────
_color() { [[ "$USE_COLOR" == "1" && -t 2 ]] && printf '%s' "$1" || true; }
C_RED="$(_color $'\033[0;31m')"; C_YEL="$(_color $'\033[0;33m')"
C_GRN="$(_color $'\033[0;32m')"; C_BLU="$(_color $'\033[0;34m')"; C_RST="$(_color $'\033[0m')"
log()  { printf '%s[provision-dr]%s %s\n' "$C_BLU" "$C_RST" "$*" >&2; }
ok()   { printf '%s[provision-dr] OK:%s %s\n' "$C_GRN" "$C_RST" "$*" >&2; }
warn() { printf '%s[provision-dr] WARN:%s %s\n' "$C_YEL" "$C_RST" "$*" >&2; }
die()  { local rc="${2:-1}"; printf '%s[provision-dr] FATAL:%s %s\n' "$C_RED" "$C_RST" "$1" >&2; exit "$rc"; }
need() { command -v "$1" >/dev/null 2>&1 || die "missing required command: $1" 1; }
trap 'die "command failed (line $LINENO): ${BASH_COMMAND}" 1' ERR

usage() { sed -n '2,46p' "$0"; exit "${1:-2}"; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)        PROJECT="${2:?}"; shift 2 ;;
    --db)             DB="${2:?}"; shift 2 ;;
    --bucket)         BUCKET="${2:?}"; shift 2 ;;
    --primary)        PRIMARY="${2:?}"; shift 2 ;;
    --secondary)      SECONDARY="${2:?}"; shift 2 ;;
    --retention-days) RETENTION_DAYS="${2:?}"; shift 2 ;;
    --dry-run)        DRY_RUN=1; shift ;;
    --yes|-y)         ASSUME_YES=1; shift ;;
    --no-color)       USE_COLOR=0; shift ;;
    -h|--help)        usage 0 ;;
    *) die "unknown argument: $1 (try --help)" 2 ;;
  esac
done

need gcloud
need gsutil

run() {
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s[provision-dr] DRY-RUN:%s %s\n' "$C_YEL" "$C_RST" "$*" >&2
    return 0
  fi
  "$@"
}

log "project=$PROJECT db=$DB bucket=$BUCKET primary=$PRIMARY secondary=$SECONDARY dry_run=$DRY_RUN"
if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
  die "no active gcloud credentials — run 'gcloud auth login'" 1
fi
gcloud config set project "$PROJECT" >/dev/null 2>&1 || die "cannot set project $PROJECT" 1

if [[ "$DRY_RUN" != "1" && "$ASSUME_YES" != "1" ]]; then
  printf '%s[provision-dr] This APPLIES real GCP DR resources (cost-bearing) on %s. Continue? [y/N] %s' \
    "$C_YEL" "$PROJECT" "$C_RST" >&2
  read -r ANS; [[ "$ANS" == "y" || "$ANS" == "Y" ]] || die "aborted by operator" 1
fi

# ════════════════════════════════════════════════════════════════════════════
# (A) T-SF.3.4 — Firestore Point-in-Time Recovery (PITR), 7-day window
# ════════════════════════════════════════════════════════════════════════════
# PITR keeps per-minute snapshots for the trailing 7 days, enabling the
# "restore to T-1min" path in DISASTER_RECOVERY.md §4.3. Enabling PITR has no
# downtime. 7 days is the maximum (and only) retention GCP offers for PITR.
log "[A] ensuring Firestore PITR is ENABLED on database '${DB}'"
PITR_STATE="$(gcloud firestore databases describe --database="$DB" --project="$PROJECT" \
  --format='value(pointInTimeRecoveryEnablement)' 2>/dev/null || true)"
if [[ "$PITR_STATE" == "POINT_IN_TIME_RECOVERY_ENABLED" ]]; then
  ok "[A] PITR already enabled (7-day window) — no-op"
else
  log "[A] current PITR state='${PITR_STATE:-unknown}' -> enabling"
  run gcloud firestore databases update \
    --database="$DB" \
    --project="$PROJECT" \
    --enable-pitr
  ok "[A] PITR enable issued (verify: gcloud firestore databases describe --database='$DB')"
fi

# ════════════════════════════════════════════════════════════════════════════
# (C) T-SF.3.6 — Dedicated DR bucket: dual-region + versioning + Bucket-Lock
#                + per-object retention (WORM immutability)
#   (We provision the bucket BEFORE turbo replication because turbo replication
#    is a property of the dual-region bucket created here.)
# ════════════════════════════════════════════════════════════════════════════
# Custom dual-region: me-central1 + europe-west4. Placement keeps one copy near
# the app (low-latency restore) and one copy on another continent (regional
# isolation per DISASTER_RECOVERY.md §1).
log "[C] ensuring backup bucket gs://${BUCKET} exists as a ${PRIMARY}+${SECONDARY} dual-region"
if gsutil ls -b "gs://${BUCKET}" >/dev/null 2>&1; then
  CUR_LOC="$(gsutil ls -L -b "gs://${BUCKET}" 2>/dev/null | awk -F': *' '/Location constraint/{print $2}' | tr -d ' ' || true)"
  CUR_TYPE="$(gsutil ls -L -b "gs://${BUCKET}" 2>/dev/null | awk -F': *' '/Location type/{print $2}' | tr -d ' ' || true)"
  log "[C] bucket exists (location=${CUR_LOC:-?}, type=${CUR_TYPE:-?})"
  if [[ "${CUR_TYPE,,}" != *"dual-region"* ]]; then
    warn "[C] existing bucket is NOT dual-region — turbo replication cannot be enabled on it."
    warn "[C] MANUAL MIGRATION REQUIRED (no destructive auto-move):"
    warn "      1. Create new dual-region bucket gs://${BUCKET}-dr (commands below, --dry-run them first)."
    warn "      2. gsutil -m rsync -r gs://${BUCKET} gs://${BUCKET}-dr"
    warn "      3. Repoint BACKUP_GCS_BUCKET / FIREBASE_STORAGE_BUCKET to the new bucket."
    warn "      4. Verify, then retire the old single-region bucket."
    MANUAL_BUCKET_STEP=1
  fi
else
  # gcloud storage supports custom dual-region via --placement.
  log "[C] creating dual-region bucket with placement ${PRIMARY},${SECONDARY}"
  run gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT" \
    --location="ASIA1" \
    --placement="${PRIMARY},${SECONDARY}" \
    --default-storage-class=STANDARD \
    --uniform-bucket-level-access \
    --public-access-prevention
  ok "[C] bucket created (dual-region ${PRIMARY}+${SECONDARY})"
fi

# Object versioning — protects against overwrite/delete of backup objects.
log "[C] enabling object versioning on gs://${BUCKET}"
run gcloud storage buckets update "gs://${BUCKET}" --versioning --project="$PROJECT"
ok "[C] versioning enabled"

# Per-object retention (WORM) + Bucket-Lock the retention policy so it cannot be
# shortened or removed. NOTE: Locking is IRREVERSIBLE — the retention period can
# only be lengthened afterward, never shortened. Hence the explicit confirmation.
log "[C] setting retention policy: ${RETENTION_DAYS}d on gs://${BUCKET}"
CUR_RET="$(gsutil retention get "gs://${BUCKET}" 2>/dev/null || true)"
if grep -q "Retention Policy" <<<"$CUR_RET" 2>/dev/null && grep -q "Locked" <<<"$CUR_RET" 2>/dev/null; then
  ok "[C] retention policy already present and LOCKED — no-op (cannot shorten a locked policy)"
else
  run gsutil retention set "${RETENTION_DAYS}d" "gs://${BUCKET}"
  ok "[C] retention period set to ${RETENTION_DAYS}d"
  if [[ "$DRY_RUN" != "1" && "$ASSUME_YES" != "1" ]]; then
    printf '%s[provision-dr] LOCK the retention policy now? This is IRREVERSIBLE. [y/N] %s' "$C_YEL" "$C_RST" >&2
    read -r LOCK_ANS
  else
    LOCK_ANS="y"
  fi
  if [[ "${LOCK_ANS:-n}" == "y" || "${LOCK_ANS:-n}" == "Y" ]]; then
    # gsutil prompts for confirmation; pipe "yes" non-interactively.
    run bash -c "printf 'yes\n' | gsutil retention lock 'gs://${BUCKET}'"
    ok "[C] retention policy LOCKED (immutable WORM, ${RETENTION_DAYS}d)"
  else
    warn "[C] retention policy set but NOT locked — lock later: gsutil retention lock gs://${BUCKET}"
  fi
fi

# ════════════════════════════════════════════════════════════════════════════
# (B) T-SF.3.5 — GCS turbo replication (RPO SLA 15 min) me-central1->europe-west4
# ════════════════════════════════════════════════════════════════════════════
# Turbo replication is set via the bucket's RPO mode. ASYNC_TURBO gives the
# 15-minute replication RPO SLA across the dual-region's two placements.
if [[ "${MANUAL_BUCKET_STEP:-0}" == "1" ]]; then
  warn "[B] skipping turbo-replication enable — bucket is single-region (see [C] migration steps)"
  TURBO_PENDING=1
else
  log "[B] enabling turbo replication (RPO=ASYNC_TURBO) on gs://${BUCKET}"
  CUR_RPO="$(gcloud storage buckets describe "gs://${BUCKET}" --project="$PROJECT" \
    --format='value(rpo)' 2>/dev/null || true)"
  if [[ "$CUR_RPO" == "ASYNC_TURBO" ]]; then
    ok "[B] turbo replication already ON — no-op"
  else
    run gcloud storage buckets update "gs://${BUCKET}" --recovery-point-objective=ASYNC_TURBO --project="$PROJECT"
    ok "[B] turbo replication enabled (${PRIMARY}<->${SECONDARY}, 15-min RPO SLA)"
  fi
fi

# ════════════════════════════════════════════════════════════════════════════
# (D) T-SF.3.7 — Lifecycle: Standard -> Nearline@30d -> Coldline@90d -> Archive@365d
# ════════════════════════════════════════════════════════════════════════════
# Lifecycle transitions trade retrieval latency/cost for storage cost as
# backups age. We keep Standard for the freshest (likely-to-be-restored) copies,
# then step down. Objects under a LOCKED retention policy still transition class;
# they simply cannot be deleted before the retention age. We deliberately do NOT
# add a delete rule here — deletion is governed by the locked retention policy.
LIFECYCLE_JSON="$(mktemp)"
trap 'rm -f "$LIFECYCLE_JSON"' EXIT INT TERM
cat > "$LIFECYCLE_JSON" <<'JSON'
{
  "rule": [
    { "action": { "type": "SetStorageClass", "storageClass": "NEARLINE" },
      "condition": { "age": 30, "matchesStorageClass": ["STANDARD"] } },
    { "action": { "type": "SetStorageClass", "storageClass": "COLDLINE" },
      "condition": { "age": 90, "matchesStorageClass": ["NEARLINE", "STANDARD"] } },
    { "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" },
      "condition": { "age": 365, "matchesStorageClass": ["COLDLINE", "NEARLINE", "STANDARD"] } }
  ]
}
JSON
log "[D] applying lifecycle (Standard->Nearline@30d->Coldline@90d->Archive@365d)"
run gsutil lifecycle set "$LIFECYCLE_JSON" "gs://${BUCKET}"
ok "[D] lifecycle policy applied"

# ════════════════════════════════════════════════════════════════════════════
# Summary + verification commands
# ════════════════════════════════════════════════════════════════════════════
cat >&2 <<EOF

${C_GRN}════════════════════════════════════════════════════════════════════════${C_RST}
${C_GRN}DR PROVISIONING DONE${C_RST} (dry_run=${DRY_RUN})
  Firestore PITR : enabled (7-day window) on '${DB}'
  Backup bucket  : gs://${BUCKET}  (${PRIMARY}+${SECONDARY} dual-region$( [[ "${TURBO_PENDING:-0}" == 1 ]] && echo ', TURBO PENDING migration' ))
  Object lock    : versioning + ${RETENTION_DAYS}d retention (lock per prompt above)
  Lifecycle      : Standard -> Nearline@30d -> Coldline@90d -> Archive@365d

VERIFY:
  gcloud firestore databases describe --database='${DB}' --project=${PROJECT} \\
    --format='value(pointInTimeRecoveryEnablement)'
  gcloud storage buckets describe gs://${BUCKET} --project=${PROJECT} \\
    --format='value(rpo,location,locationType)'
  gsutil retention get gs://${BUCKET}
  gsutil lifecycle get gs://${BUCKET}
$( [[ "${MANUAL_BUCKET_STEP:-0}" == 1 ]] && printf '\n%s[provision-dr] MANUAL STEP REQUIRED — see [C] dual-region migration above.%s\n' "$C_YEL" "$C_RST" )
${C_GRN}════════════════════════════════════════════════════════════════════════${C_RST}
EOF

if [[ "${MANUAL_BUCKET_STEP:-0}" == "1" ]]; then
  exit 6
fi
ok "provision-dr complete"
exit 0
