# Skill: AgentShield Rules (102 rules)

> ECC-derived: agentshield-runner

## ئامانج
سیستەماتیک پشکنینی ئەمنیەتی بە ١٠٢ ڕولی automated.

## فایلی Reference
- Scanner: `.github/scripts/agentshield.ps1`
- Patterns: `.github/scripts/agentshield-patterns.json` *(planned)*

## بەکارهێنان

```powershell
# Scan هەموو پرۆژە
.\.github\scripts\agentshield.ps1

# Scan فایلێکی تایبەت
.\.github\scripts\agentshield.ps1 -Path backend\app\api\pos.py

# Scan changed files تەنها
.\.github\scripts\agentshield.ps1 -ChangedOnly

# Severity تەنها
.\.github\scripts\agentshield.ps1 -Severity HIGH

# Include markdown/docs بە شێوەی opt-in
.\.github\scripts\agentshield.ps1 -IncludeDocs
```

**تێبینی:** scanner بە شێوەی بنەڕەتی `.md` scan ناکات، چونکە docs/example ـەکان زۆرجار false positive دروست دەکەن. بۆ پشکنینی docs، `-IncludeDocs` بەکار بهێنە.

## Rule Categories (ئاماژە بۆ شادۆ ئاژێنت‌شیلد)

سەیری [shadow-agentshield.agent.md](../../agents/shadow-agentshield.agent.md) ـی Cat A-I بکە.

## False Positive Handling

ئەگەر rule false-positive، لە کۆد comment زیاد بکە:

```python
# agentshield: ignore A1 — public test key
TEST_API_KEY = "sk_test_..."
```

```typescript
// agentshield: ignore D1 — markdown rendering, sanitized upstream
<div dangerouslySetInnerHTML={{ __html: html }} />
```

## CI Integration

```yaml
# .github/workflows/security.yml (Sprint 3)
- name: AgentShield
  run: pwsh .github/scripts/agentshield.ps1 -Severity HIGH -FailOnFound
```

## Custom Rules

`.github/scripts/agentshield-patterns.json`:
```json
{
  "A99": {
    "category": "Secrets",
    "severity": "HIGH",
    "pattern": "MY_CUSTOM_TOKEN_[A-Z0-9]+",
    "message": "Custom token detected"
  }
}
```
