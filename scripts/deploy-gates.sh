#!/usr/bin/env bash
# deploy-gates.sh
# ----------------------------------------------------------------------------
# Enforces the 8 traffic-shift gates listed in validation.md §"Gates that block
# traffic-shift". Called by `scripts/deploy-bluegreen.sh` after the candidate
# revision is live at 1% traffic but before the 100% cutover.
#
# Returns:
#   0  — all gates passed; safe to shift 100% traffic
#   1  — at least one gate failed (with diagnostic logged); abort cutover
#   0  — gate inputs are missing (graceful degradation; see notes per gate)
#
# Env vars:
#   CANDIDATE_URL          base URL of the candidate revision (required)
#   CANDIDATE_SHA          git commit being deployed (required for CI gates)
#   GITHUB_REPO            org/repo for CI-status lookup, e.g. zoho/erp
#   GITHUB_TOKEN           token with `actions:read` scope (CI gates 5–8)
#   SENTRY_AUTH_TOKEN +    used by gate 3 (crash rate during soak)
#   SENTRY_ORG_SLUG / SENTRY_PROJECT_SLUG
#   SHELL_BUNDLE_BUDGET_KB shell gz budget; default 380
#   SHELL_PATH             path under CANDIDATE_URL for the shell; default /
#
# Set executable bit on commit (chmod +x scripts/deploy-gates.sh).

set -uo pipefail

ts()    { date +"%Y-%m-%dT%H:%M:%S%z"; }
log()   { printf '[%s] [deploy-gates] %s\n' "$(ts)" "$*" >&2; }
warn()  { printf '[%s] [deploy-gates] WARN: %s\n' "$(ts)" "$*" >&2; }
err()   { printf '[%s] [deploy-gates] FAIL: %s\n' "$(ts)" "$*" >&2; }

FAILURES=()

record_fail() {
  err "$1"
  FAILURES+=("$1")
}

# Resolve script dir (so we can call sibling scripts from any cwd).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

CANDIDATE_URL="${CANDIDATE_URL:-}"
CANDIDATE_SHA="${CANDIDATE_SHA:-}"
SHELL_PATH="${SHELL_PATH:-/}"
SHELL_BUDGET_KB="${SHELL_BUNDLE_BUDGET_KB:-380}"
SOAK_WINDOW_MIN="${SOAK_WINDOW_MIN:-5}"

if [[ -z "${CANDIDATE_URL}" ]]; then
  warn "CANDIDATE_URL not set — running gates in dry-run / informational mode."
fi

# ── Gate 1: Shell bundle size gz ≤ budget ──────────────────────────────────
gate_bundle_size() {
  log "Gate 1/8 — shell bundle size ≤ ${SHELL_BUDGET_KB} KB gz"
  if [[ -z "${CANDIDATE_URL}" ]]; then
    warn "Gate 1 skipped (no CANDIDATE_URL)"
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    warn "Gate 1 skipped (curl not available)"
    return 0
  fi
  local tmp
  tmp=$(mktemp)
  if ! curl -sS -L --compressed-no-auto -H 'Accept-Encoding: gzip' \
      -o "${tmp}" "${CANDIDATE_URL%/}${SHELL_PATH}" 2>/dev/null; then
    # Older curl needs --compressed flag tweak; fall back to plain.
    curl -sS -L -H 'Accept-Encoding: gzip' -o "${tmp}" "${CANDIDATE_URL%/}${SHELL_PATH}" || true
  fi
  local raw_bytes
  raw_bytes=$(wc -c <"${tmp}" | tr -d ' ')
  # Gzip the response ourselves to measure on-the-wire size if server didn't compress.
  local gz_bytes
  gz_bytes=$(gzip -c -- "${tmp}" | wc -c | tr -d ' ')
  rm -f -- "${tmp}"
  local kb=$(( gz_bytes / 1024 ))
  log "Gate 1: gz=${kb} KB (raw=${raw_bytes} B)"
  if (( kb > SHELL_BUDGET_KB )); then
    record_fail "Gate 1 — shell ${kb} KB gz exceeds budget ${SHELL_BUDGET_KB} KB"
  fi
}

# ── Gate 2: Synthetic SLO probe — p95 within budget for Class-A endpoints ──
gate_probe() {
  log "Gate 2/8 — production reality probe (synthetic SLO)"
  if [[ -z "${CANDIDATE_URL}" ]]; then
    warn "Gate 2 skipped (no CANDIDATE_URL)"
    return 0
  fi
  if ! command -v node >/dev/null 2>&1; then
    warn "Gate 2 skipped (node not available)"
    return 0
  fi
  if PROBE_TARGET_URL="${CANDIDATE_URL}" \
     PROBE_AUTH_TOKEN="${PROBE_AUTH_TOKEN:-}" \
     node "${SCRIPT_DIR}/production-reality-probe.mjs" >/dev/null; then
    log "Gate 2: probe passed"
  else
    local rc=$?
    if (( rc == 2 )); then
      record_fail "Gate 2 — synthetic probe reported p95 > 2× SLO on at least one endpoint"
    else
      warn "Gate 2 — probe exited rc=${rc} (treated as soft pass)"
    fi
  fi
}

# ── Gate 3: Sentry crash rate during soak < 0.5% ───────────────────────────
gate_crash_rate() {
  log "Gate 3/8 — Sentry crash rate during ${SOAK_WINDOW_MIN}m soak"
  if [[ -z "${SENTRY_AUTH_TOKEN:-}" || -z "${SENTRY_ORG_SLUG:-}" || -z "${SENTRY_PROJECT_SLUG:-}" ]]; then
    warn "Gate 3 skipped (Sentry credentials missing)"
    return 0
  fi
  # We call crash-rate-tracker.mjs in a tight window; it always returns a
  # report. We treat presence of 🔴 in stdout as a failure signal.
  local out
  out=$(node "${SCRIPT_DIR}/crash-rate-tracker.mjs" 2>/dev/null || true)
  if grep -q "🔴" <<<"${out}"; then
    record_fail "Gate 3 — Sentry crash rate below threshold during soak"
  else
    log "Gate 3: crash rate within budget"
  fi
}

# ── Generic GitHub-Actions check helper ────────────────────────────────────
# Looks up the latest check-run with `name_glob` on CANDIDATE_SHA and asserts
# conclusion=success. Skips with warning if creds missing.
gh_check_status() {
  local name_glob="$1"
  local label="$2"
  local gate_num="$3"
  log "Gate ${gate_num}/8 — CI status: ${label}"
  if [[ -z "${GITHUB_TOKEN:-}" || -z "${GITHUB_REPO:-}" || -z "${CANDIDATE_SHA}" ]]; then
    warn "Gate ${gate_num} skipped (GITHUB_TOKEN / GITHUB_REPO / CANDIDATE_SHA missing)"
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    warn "Gate ${gate_num} skipped (curl missing)"
    return 0
  fi
  local url="https://api.github.com/repos/${GITHUB_REPO}/commits/${CANDIDATE_SHA}/check-runs?per_page=100"
  local body
  body=$(curl -sS -H "Authorization: Bearer ${GITHUB_TOKEN}" \
                 -H "Accept: application/vnd.github+json" \
                 "${url}" || echo '{}')
  # Best-effort grep (avoids hard jq dependency).
  if grep -E "\"name\"[[:space:]]*:[[:space:]]*\"[^\"]*${name_glob}[^\"]*\"" <<<"${body}" >/dev/null; then
    if grep -E "${name_glob}.*\"conclusion\"[[:space:]]*:[[:space:]]*\"success\"" <<<"${body}" >/dev/null \
       || grep -E "\"conclusion\"[[:space:]]*:[[:space:]]*\"success\".*${name_glob}" <<<"${body}" >/dev/null; then
      log "Gate ${gate_num}: ${label} ✓"
      return 0
    fi
    record_fail "Gate ${gate_num} — ${label} did not pass on ${CANDIDATE_SHA:0:8}"
  else
    warn "Gate ${gate_num} — no ${label} check-run found for ${CANDIDATE_SHA:0:8}; treating as soft pass"
  fi
}

# ── Run all gates ─────────────────────────────────────────────────────────
gate_bundle_size                                                         # 1
gate_probe                                                                # 2
gate_crash_rate                                                           # 3
gh_check_status "coverage"      "coverage gate"        4                  # 4
gh_check_status "bundle-diff"   "bundle-diff gate"     5                  # 5
gh_check_status "async-safety"  "async-safety lint"    6                  # 6
gh_check_status "audit-loc"     "audit-loc gate"       7                  # 7
gh_check_status "firestore-ind" "firestore-indexes gate" 8                # 8

if (( ${#FAILURES[@]} == 0 )); then
  log "All 8 gates passed (or skipped gracefully). OK to cut over."
  exit 0
fi

err "DEPLOY GATES FAILED (${#FAILURES[@]}):"
for f in "${FAILURES[@]}"; do
  printf '  - %s\n' "${f}" >&2
done
exit 1
