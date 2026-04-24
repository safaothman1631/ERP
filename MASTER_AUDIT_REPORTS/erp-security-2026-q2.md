# Security + Audit Audit — 2026-Q2
**Agent:** ERP Security + Audit | **Date:** 2026-04-24

## A. Coverage Snapshot

**Overall Score: 6.5 / 10**

| Domain | Score | Notes |
|--------|-------|-------|
| Authentication | 8/10 | ✅ 2FA، refresh tokens، lockout — ❌ SSO، password policy |
| Authorization (RBAC) | 6/10 | ✅ core engine — ❌ coverage incomplete (banking، payroll، hr، CRM، ...) |
| Audit Logging | 7/10 | ✅ middleware — ❌ sensitive GETs not logged، not immutable |
| Encryption | 3/10 | ❌ no field-level encryption (national_id، salary، api_key، totp_secret plaintext) |
| GDPR | 0/10 | ❌ no data export، no deletion |
| Session Mgmt | 6/10 | ✅ JWT revocation — ❌ no explicit session tracking |
| API Keys | 0/10 | ❌ not implemented |
| Security Headers | 9/10 | ✅ CSP، X-Frame، X-Content-Type — ❌ HSTS missing |

## B. Top P0/P1 Gaps (max 10)

| ID | Severity | Title | File(s) | Ref | Effort |
|----|----------|-------|---------|-----|--------|
| G-1 | P0 | RBAC sweep incomplete (banking، journals، hr، payroll، manufacturing، projects، CRM، reports، exports) — ~99 endpoints unprotected | backend/app/api/{banking,accounts,hr,payroll,manufacturing,projects,crm,reports,exports}.py | OWASP A01 | M (18h) |
| G-2 | P0 | Field-level encryption missing (national_id، salary، api_key، totp_secret) | new services/crypto.py + model updates | GDPR Art 32، PCI DSS | L (4d) |
| G-3 | P0 | GDPR data export missing | new api/gdpr.py | GDPR Art 15 | M (2d) |
| G-4 | P0 | GDPR data deletion missing | new api/gdpr.py | GDPR Art 17 | L (3d) |
| G-5 | P1 | API key management missing | new api/api_keys.py + auth middleware | Odoo api_key module | M (3d) |
| G-6 | P1 | SSO Microsoft/SAML missing | backend/app/api/auth.py | Odoo auth_oauth | L (5d) |
| G-7 | P1 | Password policy not enforced | backend/app/api/auth.py:L316 | OWASP Password Guidelines 2021 | S (1d) |
| G-8 | P1 | Session tracking + logout-all missing | backend/app/services/auth.py | Odoo web.session | M (2d) |
| G-9 | P1 | Audit log not immutable (Firestore rules allow update/delete) | Firestore security rules | GDPR Art 32 | XS (1h) |
| G-10| P1 | Sensitive GETs not logged (payroll، employee salary، bank accounts) | backend/app/middleware/audit.py:L44 | GDPR audit trail | M (1d) |

## C. Quick Wins

- QW-1: HSTS header — main.py:L82 — 15min
- QW-2: Audit log immutability via Firestore rules — 1h
- QW-3: 2FA enforcement for admin/accountant roles — auth.py — 4h
- QW-4: Password validation regex (8 chars + uppercase + digit + blacklist) — auth.py — 1d
- QW-5: Sensitive GET path whitelist in audit middleware — 1d

## D. Big Rocks

- BR-1: RBAC sweep across all modules (banking 13، journals 6، hr 22، payroll 10، manufacturing 15، projects 12، CRM 18، reports 16، exports 14 endpoints) — 18h
- BR-2: Field-level encryption (Fernet wrapper + model updates + migration) — 4d
- BR-3: GDPR endpoints (export 2d + deletion 3d + 30-day grace period) — 5d
- BR-4: API key management (CRUD + auth middleware + scopes) — 3d
- BR-5: Microsoft OAuth + SAML (msal + python-saml libraries) — 5d
- BR-6: Session tracking (sessions collection + endpoints + logout-all) — 2d

## E. RBAC Coverage Gap Details (Sprint 5 left undone)

| Module | Endpoints needing require_perm | Permission codes | Effort |
|--------|--------------------------------|------------------|--------|
| Banking | 13 | bank.create/update/delete | 2h |
| Journals | 6 | accounts.create/update/delete | 1h |
| HR | 22 | hr.create/update/delete | 3h |
| Payroll | 10 | hr.payroll.create/update/delete | 2h |
| Manufacturing | 15 | manufacturing.* | 3h |
| Projects | 12 | projects.*، tasks.* | 2h |
| CRM | 18 | crm.*، crm.leads.* | 3h |
| Reports | 16 | reports.read | 2h |
| Exports | 14 | reports.export | 1h |
| **TOTAL** | **126** | — | **18h** |

## F. Existing Strengths (Sprint 5 shipped)

- 2FA TOTP + backup codes + QR setup (auth.py:L578-L639)
- Refresh tokens with 7-day grace + jti revocation (auth.py:L223-L295)
- Brute-force lockout 5/15min (auth.py:L118-L130)
- Firebase Google OAuth (auth.py:L156-L201)
- Password reset with 1h token expiry (auth.py:L403-L484)
- Roles + permissions DEFAULT_ROLES (rbac.py)
- require_perm dependency factory (services/permissions.py:L110-L118)
- Field-level redact/readonly (services/security_v2.py:L54-L84)
- Record-level ABAC predicates (services/security_v2.py:L89-L128)
- Audit middleware with auto-log POST/PUT/PATCH/DELETE (middleware/audit.py)
- Security headers: CSP، X-Frame-Options، X-Content-Type، Permissions-Policy، Cache-Control
- RBAC sweep DONE for: invoices، expenses، items، contacts، POS

## G. Counts
- P0: 4 | P1: 6 | P2: ~8 | QW: 5 | BR: 6
- Total effort: ~25 days (3 sprints)

## H. Recommended Lead + Skills

**Lead:** ERP Security + Audit (شادۆ ئاژێنت‌شیلد) | **Support:** زۆهۆ باکئێند

**Skills:**
- security/agentshield-rules
- security/security-review-owasp
- backend/python-patterns
- backend/firestore-patterns
- meta/karpathy-guidelines

**Sprint Plan:**
- Sprint A (5d): RBAC sweep + 2FA enforcement + password policy + HSTS + audit log immutability
- Sprint B (10d): Field encryption + GDPR export + GDPR deletion + audit sensitive GETs
- Sprint C (10d): Microsoft OAuth + SAML + API keys + session tracking

**Critical Path:** RBAC sweep (security holes — anyone can read banking/payroll/hr now)
**Compliance gating:** GDPR + encryption needed before EU customers
**Enterprise gating:** SSO + API keys needed for B2B sales
