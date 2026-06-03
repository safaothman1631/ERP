# Checklist-ی ئامادەیی SOC 2 Type II + ISO 27001 + PDPL/GDPR — ERPIQ

> **مەبەست:** نەخشەیەکی کرداری بۆ گەیشتن بە **SOC 2 Type II** + **ISO/IEC 27001** + پابەندبوون بە **PDPL (یاسای پاراستنی داتای کەسی)/GDPR**. ئەمە دۆخی ئێستای کۆد دەردەخات (چی هەیە) بەرامبەر بۆشاییەکان (چی کەمە).
>
> **خاوەن:** CTO + Compliance Officer (+ auditor-ی دەرەکی بۆ SOC 2/ISO).
> **دۆخی ستوون:** ✅ هەیە · 🟡 بەشەکی · ❌ کەمە/نییە.

---

## 0. کورتەی دۆخی ئێستا (Current Posture)

ERPIQ پێشتر چەند کۆنترۆڵی تەکنیکی-ی بنەڕەتی هەیە (لە کۆد، بەپێی `CLAUDE.md` بەشی SF4/SF1):

| دەستکەوت | شوێن لە کۆد |
|----------|---------------|
| **RBAC** + مۆڵەتەکان | `app/services/permissions.py`, `require_perm` |
| **Audit hash-chain** (تۆماری دەستکارینەکراو) | audit logging service |
| **CSRF protection** | `app/middleware/csrf.py` |
| **Firestore security rules** + rules-tests | `firestore.rules`, `firestore-rules-tests/` |
| **Secret scanning** | `.gitleaks.toml` + workflow + pre-commit |
| **Tenant isolation tests** | `test_tenant_isolation/jwt/csrf/upload` |
| **Data-rights (GDPR export/erasure)** | `app/api/data_rights.py` (export/erasure perms) |
| **Field encryption** | `field-encryption-key` (Secret Manager) |
| **DR (backup/restore)** | `scripts/dr/*`, `app/api/admin/dr_restore.py` (4-eyes) |
| **Observability** | OTel middleware + dashboards (terraform/monitoring) |
| **Idempotency + rate-limit** | `idempotency_http.py` |
| **Legal drafts** | `legal/` (ToS/Privacy/DPA/... — هەموو **DRAFT**) |
| **SIRP / security docs** | `docs/security/{sirp,security-summary,firestore-rules-audit}.md` |

> **بەڵام:** هیچ بەرنامەی فەرمی، pen-test، یان audit-ی دەرەکی نییە — ئەمانە بۆشاییە سەرەکییەکانن.

---

## 1. بەرنامەی فەرمی + حوکمڕانی (Program & Governance)

- [ ] ❌ **ISMS** (Information Security Management System) — سکۆپ + statement of applicability (ISO 27001 پێویست).
- [ ] ❌ سیاسەتە نووسراوەکان (security policy، acceptable use، access control، incident response، BCP/DR، vendor management، data classification).
- [ ] ❌ خاوەنی risk register-ی فەرمی + هەڵسەنگاندنی مەترسی-ی ساڵانە.
- [ ] ❌ دیاریکردنی **خاوەنی ئاسایش** (CISO/security lead) + بەرپرسیارێتی board-level.
- [ ] 🟡 SIRP (incident response) — draft هەیە لە `docs/security/sirp.md`؛ پێویستی بە فەرمیکردن + تاقیکردنەوە (tabletop).
- [ ] ❌ بەرنامەی training-ی ئاسایش بۆ کارمەند (ساڵانە + onboarding).
- [ ] ❌ management review-ی دووبارە (ISO clause 9.3).

---

## 2. کۆنترۆڵی دەستگەیشتن (Access Control)

- [ ] ✅ RBAC جێبەجێ کراوە (`permissions.py`).
- [ ] 🟡 جیاکردنەوەی ئەرکەکان (SoD) — بەشەکی (4-eyes لە DR restore)؛ پێویستی بە فراوانکردن بۆ پرۆسە دارایییەکان.
- [ ] ❌ **SSO / OIDC / SAML** — نییە (پلانەکە لە چینی ٦ ئاماژەی پێدەکات: «Vault، OIDC/SSO»). بۆ enterprise + audit پێویستە.
- [ ] ❌ **MFA** بۆ هەژماری ئەدمین/کارمەند.
- [ ] ❌ access review-ی دووبارە (هەر ٣ مانگ) + offboarding (IAM leaver) — `scripts/ops/iam-leaver-audit.py` هەیە بەڵام پێویستی بە پرۆسەی فەرمی + بەڵگە هەیە.
- [ ] ✅ least-privilege لە service accounts (secretAccessor تەرخان).
- [ ] 🟡 سیاسەتی وشەی نهێنی + session (lockout دوای ٥ هەوڵ هەیە لە login).

---

## 3. پاراستنی داتا (Data Protection / PDPL / GDPR)

- [ ] ✅ encryption at rest (Firestore default) + field-level encryption (`field-encryption-key`).
- [ ] ✅ encryption in transit (HTTPS/TLS).
- [ ] ✅ **Data Subject Rights** — export + erasure API هەیە (`data_rights.py`, perms `privacy.export/erasure`).
- [ ] 🟡 سیاسەتی privacy + DPA — draft لە `legal/`؛ پێویستی بە **counsel sign-off**.
- [ ] ❌ **Data classification** + retention/purge policy-ی فەرمی (purge کۆد هەیە، سیاسەت نا).
- [ ] ❌ **RoPA** (Record of Processing Activities — GDPR Art. 30).
- [ ] ❌ **DPIA** (Data Protection Impact Assessment) بۆ پرۆسە مەترسیدارەکان.
- [ ] ❌ سیاسەتی consent + cookie (marketing site CookieBanner هەیە، سیاسەتی فەرمی نا).
- [ ] 🟡 sub-processors list — draft لە `legal/`؛ پێویستی بە نوێکردنەوە + DPA لەگەڵ هەر sub-processor (GCP، Vercel، Stripe، 360Dialog/Crisp).
- [ ] ❌ **PDPL (عێراق)** — پشتڕاستکردنی پابەندبوون بە یاسای پاراستنی داتای عێراق/هەرێم (لەگەڵ counsel-ی ناوخۆیی) — data residency؟ cross-border transfer؟
- [ ] ❌ breach notification process (کات + کەناڵ، بەپێی PDPL/GDPR).

---

## 4. ئاسایشی سیستەم + گەشەپێدان (System & Dev Security)

- [ ] ✅ Secret scanning (`.gitleaks.toml` + CI + pre-commit).
- [ ] 🟡 Firestore rules + tests (`firestore-rules-tests/`) + audit doc — هەیە؛ پێویستی بە review-ی دووبارە.
- [ ] ✅ CSRF + upload validation (`csrf.py`, `upload_validation.py`).
- [ ] ✅ audit hash-chain (tamper-evident log).
- [ ] ✅ idempotency + rate-limit.
- [ ] ❌ **Penetration test** (دەرەکی، ساڵانە) — نییە (پلانەکە ئاماژەی پێدەکات).
- [ ] ❌ **Vulnerability scanning** (dependency + container) — SAST/DAST/SCA لە CI.
- [ ] ❌ **Bug bounty** / responsible disclosure (responsible disclosure نییە).
- [ ] 🟡 change management — git + PR + CI gates هەیە؛ پێویستی بە پرۆسەی فەرمی (approval + rollback + بەڵگە، بڕوانە CAB).
- [ ] ❌ secure SDLC policy + code review-ی فەرمی (mandatory reviewer).
- [ ] ❌ secrets management-ی ناوەندی (Vault) — ئێستا Secret Manager؛ پلانەکە Vault پێشنیار دەکات.

---

## 5. کارگێڕی + بەردەوامی (Operations & Resilience)

- [ ] 🟡 **DR**: backup/restore scripts + 4-eyes + workflow هەیە؛ پێویستی بە **DR drill-ی دۆکیومێنتکراو** + RTO/RPO-ی فەرمی.
- [ ] 🟡 **Monitoring/alerting**: terraform dashboards + alerts + OTel هەیە؛ پێویستی بە on-call rotation-ی فەرمی + escalation policy (`docs/oncall/` هەیە).
- [ ] ❌ **SLA** فەرمی بۆ کڕیار (draft لە `legal/` — sign-off پێویستە).
- [ ] ❌ **Vendor / sub-processor risk review** (GCP، Vercel، Stripe، payment providers) — فەرمی نا.
- [ ] ❌ **Business Continuity Plan (BCP)** — فەرمی نا.
- [ ] 🟡 logging + retention — audit log هەیە؛ پێویستی بە retention policy + log review-ی دووبارە.
- [ ] ❌ capacity / availability management-ی فەرمی.

---

## 6. هەنگاوەکانی گەیشتن بە بڕواننامە (Path to Certification)

| هەنگاو | SOC 2 Type II | ISO 27001 |
|--------|---------------|-----------|
| 1 | دیاریکردنی سکۆپ + Trust Services Criteria (Security مەرج، +Availability/Confidentiality) | دیاریکردنی سکۆپی ISMS + SoA |
| 2 | gap assessment (بەکارهێنانی ئەم checklist-ـە) | risk assessment + treatment plan |
| 3 | جێبەجێکردنی کۆنترۆڵە کەمەکان (بەشی ١–٥) | جێبەجێکردنی Annex A controls |
| 4 | **readiness audit** (auditor-ی دەرەکی) | internal audit |
| 5 | **observation period** (٣–١٢ مانگ کۆکردنەوەی بەڵگە — Type II) | management review |
| 6 | audit-ی فەرمی + ڕاپۆرت | certification audit (Stage 1 + 2) |
| 7 | نوێکردنەوەی ساڵانە | surveillance audit (ساڵانە) + recert (٣ ساڵ) |

> **پێشینەبەندی بۆ ERPIQ:** یەکەم **بەرنامەی فەرمی + سیاسەت + خاوەنی ئاسایش** (بەشی ١) دابمەزرێنە، چونکە کۆنترۆڵی تەکنیکیی زۆری ئێستا هەیە بەڵام بەڵگە/پرۆسەی فەرمی کەمە. دواتر **pen-test** + **SSO/MFA**. SOC 2/ISO پێش قۆناغی ٣ (کاتێک کڕیاری enterprise + ١٠٠+ کڕیار) واقیعییە.

---

## تێبینی گرینگ

1. **کۆد ≠ پابەندبوون:** ERPIQ کۆنترۆڵی تەکنیکی-ی باشی هەیە (RBAC، audit-chain، CSRF، encryption، data-rights)، بەڵام SOC 2/ISO **بەڵگە + پرۆسەی فەرمی + audit-ی دەرەکی** دەخوازن — ئەمانە دەرەکین و کاتبەرن.
2. **دەرەکی (دەستی ERPIQ نییە):** auditor (SOC 2/ISO firm)، pen-test vendor، counsel بۆ legal sign-off + PDPL، insurance. هەمووی لە `CLAUDE.md` (scale-foundation) وەک «دەرەکی» نیشانکراون.
3. **PDPL-ی عێراق:** پێویستی بە ڕاوێژکاری یاسایی-ی ناوخۆیی هەیە بۆ پابەندبوون بە یاسای پاراستنی داتای عێراق/هەرێم (data residency، cross-border، consent).
4. هیچ شتێک لێرە ڕاوێژی یاسایی نییە — هەموو بەپێی auditor/counsel پشتڕاست بکرێت.
