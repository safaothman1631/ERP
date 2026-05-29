#!/usr/bin/env bash
# complexity-radon.sh (T-V.11, V-LM.2)
#
# Runs radon's cyclomatic-complexity scan over backend/app with the
# classification bands enabled and writes the report to
# audit/complexity/python-<ISO-DATE>.txt.
#
# Flags:
#   -s   show source code (function bodies summarised)
#   -a   show average complexity at the bottom
#   -nc  only show functions of grade C or worse (the actionable bucket)
#
# Graceful: if `radon` is not on PATH, exits 0 with a warning so the caller
# (weekly-health-check.yml) does not break.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${REPO_ROOT}/audit/complexity"
DATE="$(date -u +%Y-%m-%d)"
OUT="${OUT_DIR}/python-${DATE}.txt"

mkdir -p "${OUT_DIR}"

if ! command -v radon >/dev/null 2>&1; then
  echo "[complexity-radon] WARN: radon not installed — \`pip install radon\`" >&2
  {
    echo "# Python complexity report — ${DATE}"
    echo
    echo "_Skipped: radon not installed._"
    echo
    echo "To enable: \`pip install radon\` then re-run."
  } > "${OUT}"
  exit 0
fi

if [ ! -d "${REPO_ROOT}/backend/app" ]; then
  echo "[complexity-radon] WARN: backend/app not found — skipping" >&2
  echo "_Skipped: backend/app missing._" > "${OUT}"
  exit 0
fi

{
  echo "# Python complexity report — ${DATE}"
  echo
  echo "Scope: backend/app  (excluding __init__.py)"
  echo "Bands: A (1-5) · B (6-10) · C (11-20) · D (21-30) · E (31-40) · F (>40)"
  echo "Threshold (V-LM.2): ≤ 15 per function. Grade C+ is shown below."
  echo
  echo "----"
  echo
} > "${OUT}"

# Run radon. We exclude __init__.py via --exclude. radon prints to stdout;
# capture into the report. We don't fail the script if radon prints findings.
set +e
radon cc "${REPO_ROOT}/backend/app" -s -a -nc --exclude '**/__init__.py' >> "${OUT}"
RC=$?
set -e

echo >> "${OUT}"
echo "_radon exit: ${RC}_" >> "${OUT}"

echo "[complexity-radon] wrote ${OUT}"
exit 0
