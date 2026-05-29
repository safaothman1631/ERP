# Security Penetration Checklist — production_core (Phase 6)

**Date:** 2026-05-25  
**Scope:** Core ERP modules pre-launch

## Authentication

| Check | Status | Notes |
|-------|--------|-------|
| JWT expiry 1h / refresh 7d | ✅ | auth.py |
| Brute-force lockout (account + IP) | ✅ | 5 attempts / 15 min |
| 2FA enforced for admin/accountant | ✅ | login + TOTP |
| Password strength validation | ✅ | schemas |

## Authorization

| Check | Status | Notes |
|-------|--------|-------|
| RBAC phase-2 scope (123 routes) | ✅ | audit_rbac_coverage.py |
| Sensitive GET audit logging | ✅ | payroll, hr, banking paths |
| IDOR org_id checks | ⚠️ | spot-check per module; repos filter by org |

## Data Protection

| Check | Status | Notes |
|-------|--------|-------|
| PII field encryption (Fernet) | ✅ | HR, payslip, users, gateway keys |
| GDPR export/delete | ✅ | privacy.py |
| Audit log immutability | ✅ | firestore.rules deny update/delete |

## Transport & Headers

| Check | Status | Notes |
|-------|--------|-------|
| HSTS | ✅ | main.py middleware |
| CSP, X-Frame-Options | ✅ | security headers middleware |
| HTTPS redirect production | ✅ | enforce_https middleware |

## API Hardening

| Check | Status | Notes |
|-------|--------|-------|
| Rate limiting | ✅ | slowapi + RateLimitMiddleware |
| Input sanitization tests | ✅ | test_input_sanitization.py |
| Webhook auth (Iraq payments) | ✅ | public webhooks + idempotency |

## Residual Risks (accepted v1)

- In-memory rate limiter without Redis in multi-worker Cloud Run
- Wave scaffold modules not penetration-tested
- Real FIB/Zain Cash HMAC verification depends on merchant docs

## Recommendation

**Pass** for controlled production_core launch with monitoring (Sentry) and 30-day security review post-launch.
