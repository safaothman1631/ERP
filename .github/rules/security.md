# Rule: Security (OWASP Top 10)

**ALWAYS-FOLLOW**

## Auth
- هەر endpoint پێویستە `Depends(get_current_user)` بێت (ئەگەر نا public نەبێت)
- `org_id` پێویستە لە کۆتا کات verify بکرێت لەسەر فایل/ڕیکۆرد
- JWT secret لە `.env` تەنها (نا hardcoded)
- Password: bcrypt، 12+ rounds

## Input
- هەموو body schema بە Pydantic
- Path/Query parameter type-cast (پێش query بکوژراو)
- File upload: extension + magic-byte verify
- HTML input: sanitize (bleach یان dompurify)

## Secrets
- ❌ هیچ کات commit بە `serviceAccountKey.json`، `.env`
- `.gitignore` پێش هەر شت پشکنە
- API keys لە environment variables

## Injection
- Firestore: type-safe (`where("field", "==", value)`)
- SQL: parameterized queries تەنها
- Shell command: `subprocess.run(args=[...])` نا `shell=True`

## CORS
- Production: domain-specific origins (نا `*`)

## Logging
- ❌ هیچ کات password، token، یان PII لۆگ مەکە
- Sentry/error tracker: redact sensitive fields
