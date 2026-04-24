# Skill: Strategic Compact

> ECC-derived: prompt-compactor

## ئامانج

context window پاراستن. کاتێک پێویستە سەدان فایل بپشکنیت یان مێژووی conversation درێژە، **strategically compact** بکە.

## کاتێک بەکار بێنە

- سەرکەوتنی conversation ≥ 60% context
- پێش task ـی گەورەی نوێ
- پێش `runSubagent` (subagent context کەمتر بەکار بهێنێت)

## تەکنیک‌ـەکان

### 1. Memory Persistence
- session memory نوێ بکە بە summary
- conversation history کورت بکەرەوە
- نوێ session دەستپێ بکە (clean slate)

### 2. Selective Re-read
- نا هەموو فایل دووبارە بخوێنە
- تەنها بەش‌ـی پەیوەست (line range)

### 3. Subagent Delegation
- کاری گەورە → `runSubagent` (clean context)
- subagent تەنها result دەنێرێتەوە (compact)

### 4. Symbol-only Context
لەباتی هەموو فایل، structure تەنها:
- function/class signatures
- imports
- TODOs

### 5. Hash-based Cache
- ئەگەر فایلێک نەگۆڕاوە (hash هەمان)، نا re-read

## Format بۆ Compact Summary

```markdown
## Session Summary <date>

### Goal
<one-line>

### Done
- ✅ <item 1>
- ✅ <item 2>

### Pending
- 🔄 <item>

### Decisions
- <decision> — <reason>

### Files touched
- path/to/file.py — <change>

### Next steps
- <step 1>
- <step 2>
```

## ❌ Anti-pattern

- ❌ هەموو conversation کۆپی بکەیت بۆ session
- ❌ duplicate لە چەند فایل (یەک source of truth)
- ❌ verbose summary (paragraphs نا)
