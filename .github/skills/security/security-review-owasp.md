# Skill: Security Review (OWASP Top 10)

## OWASP 2021 Top 10

### A01 — Broken Access Control
- ✅ هەر endpoint `Depends(get_current_user)`
- ✅ `org_id` فیلتەر لە هەر query
- ✅ Role check بۆ admin endpoints
- ❌ Direct object reference بێ ownership check

### A02 — Cryptographic Failures
- ✅ bcrypt 12 rounds
- ✅ JWT بە secret strong (≥ 32 char random)
- ✅ TLS 1.2+ بۆ هەموو requests
- ❌ MD5/SHA1 بۆ password
- ❌ Plaintext storage

### A03 — Injection
- ✅ Pydantic validation
- ✅ Type-safe Firestore queries
- ✅ Parameterized SQL
- ❌ String concat لە queries
- ❌ `eval()`، `exec()`، `subprocess(shell=True)`

### A04 — Insecure Design
- ✅ Threat model پێش feature
- ✅ Rate limiting
- ✅ Input size limits

### A05 — Security Misconfiguration
- ✅ Production CORS = specific origins
- ✅ Debug mode = off لە production
- ✅ Default passwords گۆڕراون
- ❌ `serviceAccountKey.json` لە git

### A06 — Vulnerable Components
- ✅ `npm audit` / `pip-audit` weekly
- ✅ Dependabot enabled
- ✅ Outdated > 12 months → review

### A07 — ID & Auth Failures
- ✅ MFA optional
- ✅ Session timeout 30min
- ✅ Brute-force protection (rate limit)
- ❌ Password recovery via email-only

### A08 — Software Integrity Failures
- ✅ `package-lock.json` committed
- ✅ Subresource Integrity بۆ CDN scripts
- ❌ Auto-update بێ verification

### A09 — Logging & Monitoring
- ✅ Audit log بۆ sensitive actions
- ✅ Sentry/Logtail بۆ production
- ❌ Password/token لۆگ
- ❌ PII بێ mask

### A10 — SSRF
- ✅ URL validation پێش fetch
- ✅ Allowlist بۆ external domains
- ❌ User-controlled URL بێ check

## Checklist بۆ هەر PR

- [ ] هیچ secret لە diff
- [ ] هەموو endpoint auth check
- [ ] org_id verified
- [ ] Input Pydantic validated
- [ ] Error message بێ stack trace بۆ user
- [ ] Log بێ PII
