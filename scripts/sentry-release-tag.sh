#!/usr/bin/env bash
# sentry-release-tag.sh
# ----------------------------------------------------------------------------
# Wrap `sentry-cli` to create, commit-associate, and finalize a Sentry release
# on every deploy. Referenced by validation.md §V-PR.3 and Tasks T-V.9.
#
# Designed to be called from .github/workflows/deploy-cloudrun.yml as a
# post-deploy step, e.g.:
#
#   - name: Tag Sentry release
#     env:
#       SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
#       SENTRY_ORG:        ${{ vars.SENTRY_ORG_SLUG }}
#       SENTRY_PROJECT:    ${{ vars.SENTRY_PROJECT_SLUG }}
#       APP_VERSION:       ${{ github.ref_name }}
#       GIT_SHA:           ${{ github.sha }}
#     run: ./scripts/sentry-release-tag.sh
#
# Required env:
#   SENTRY_AUTH_TOKEN   internal-integration token with `project:releases`
#   SENTRY_ORG          org slug (also reads SENTRY_ORG_SLUG)
#   SENTRY_PROJECT      project slug (also reads SENTRY_PROJECT_SLUG)
#   APP_VERSION         e.g. "v2.4.0" or "2026.05.27"
#   GIT_SHA             the commit SHA being deployed
#
# Optional env:
#   SENTRY_ENVIRONMENT  e.g. "production", "staging" — passed to deploys
#   SOURCEMAP_DIR       directory whose JS+map files should be uploaded
#   URL_PREFIX          prefix used when serving sourcemaps (e.g. "~/assets")
#
# Exit codes:
#   0  — release created (or already exists) and finalized.
#   0  — credentials missing → warn and exit (graceful degradation).
#   1  — sentry-cli failed for a non-credential reason.
#
# Set executable bit on commit (chmod +x scripts/sentry-release-tag.sh).

set -euo pipefail

warn() { printf '[sentry-release-tag] WARN: %s\n' "$*" >&2; }
log()  { printf '[sentry-release-tag] %s\n' "$*" >&2; }
die()  { printf '[sentry-release-tag] ERROR: %s\n' "$*" >&2; exit "${2:-1}"; }

# Accept either SENTRY_ORG / SENTRY_ORG_SLUG, same for project.
SENTRY_ORG="${SENTRY_ORG:-${SENTRY_ORG_SLUG:-}}"
SENTRY_PROJECT="${SENTRY_PROJECT:-${SENTRY_PROJECT_SLUG:-}}"
APP_VERSION="${APP_VERSION:-}"
GIT_SHA="${GIT_SHA:-}"

# Graceful degradation — missing creds means we're running locally / in a fork.
if [[ -z "${SENTRY_AUTH_TOKEN:-}" || -z "${SENTRY_ORG}" || -z "${SENTRY_PROJECT}" ]]; then
  warn "SENTRY_AUTH_TOKEN / SENTRY_ORG / SENTRY_PROJECT missing — skipping Sentry release tag."
  exit 0
fi

if [[ -z "${APP_VERSION}" || -z "${GIT_SHA}" ]]; then
  warn "APP_VERSION / GIT_SHA missing — skipping Sentry release tag."
  exit 0
fi

# Locate sentry-cli (prefer npx → installed binary → npm dlx)
if command -v sentry-cli >/dev/null 2>&1; then
  SENTRY_CLI="sentry-cli"
elif command -v npx >/dev/null 2>&1; then
  SENTRY_CLI="npx --yes @sentry/cli@latest"
else
  warn "sentry-cli not found and npx unavailable — skipping."
  exit 0
fi

RELEASE="${APP_VERSION}-${GIT_SHA:0:12}"
export SENTRY_AUTH_TOKEN SENTRY_ORG SENTRY_PROJECT

log "Creating Sentry release: ${RELEASE}"
${SENTRY_CLI} releases new "${RELEASE}" || die "sentry-cli releases new failed"

log "Associating commits (auto)"
# `--auto` lets Sentry walk the local git history. If we're in a shallow CI
# checkout, `set-commits --auto` will skip rather than fail; that's fine.
${SENTRY_CLI} releases set-commits "${RELEASE}" --auto --ignore-missing \
  || warn "set-commits --auto returned non-zero; continuing"

# Optional sourcemap upload
if [[ -n "${SOURCEMAP_DIR:-}" && -d "${SOURCEMAP_DIR}" ]]; then
  log "Uploading sourcemaps from ${SOURCEMAP_DIR}"
  ${SENTRY_CLI} releases files "${RELEASE}" upload-sourcemaps \
    "${SOURCEMAP_DIR}" \
    ${URL_PREFIX:+--url-prefix "${URL_PREFIX}"} \
    --rewrite \
    || warn "sourcemap upload failed; release still finalized"
fi

log "Finalizing release: ${RELEASE}"
${SENTRY_CLI} releases finalize "${RELEASE}" || die "sentry-cli releases finalize failed"

# Mark a deploy in this environment if SENTRY_ENVIRONMENT supplied.
if [[ -n "${SENTRY_ENVIRONMENT:-}" ]]; then
  log "Marking deploy in environment=${SENTRY_ENVIRONMENT}"
  ${SENTRY_CLI} releases deploys "${RELEASE}" new --env "${SENTRY_ENVIRONMENT}" \
    || warn "deploys new failed; release still finalized"
fi

log "Done. Release ${RELEASE} tagged."
