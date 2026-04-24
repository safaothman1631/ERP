# Skill: Continuous Learning v2

> ECC-derived: instinct-extractor + skill-evolver + memory-keeper

## فەلسەفە

سیستەم لە کاتی خۆی **خۆ بەرەوپێش** ببات. هەڵەکانی دووبارە دیارن، چارەسەری دیار. بکەیت کە ئەو زانیارییە بپارێزرێت و خۆکار جێبەجێ بکرێت.

## ٤ قۆناغ

### 1. Capture (لە کاتی کار)
کاتێک:
- bug فیکس کرا
- حاڵەتی تایبەت ڕووی دا
- pattern نوێ کەشف کرا

→ session memory نوێ بکە:
```markdown
<!-- /memories/session/lessons.md -->
- 2026-04-22: AntD 6 `Tag size` لابراوە
- 2026-04-22: route ordering لە FastAPI گرنگە
```

### 2. Aggregate (پاش task)
شادۆ کۆچ بانگ بکە:
- session lessons بپشکنە
- frequency ≥ 3 → instinct دروست بکە
- frequency < 3 → لە session بمێنیتەوە

### 3. Promote
| دۆخ | کارکردن |
|-----|----------|
| ١ جار | session فقط |
| ٢-٣ جار | `/memories/instincts/` |
| ٥+ جار | `/memories/` (user) + skill update |
| ١٠+ جار | `.github/rules/` (always-follow) |

### 4. Distribute
- Skill nuwe دروست بکە (شادۆ سکیڵ‌میکەر)
- Existing skill update بکە
- Agent description ـی پەیوەست update بکە
- ئەگەر critical: `copilot-instructions.md` نوێ بکە

## Instinct Format

```markdown
## Instinct: <name>

**Domain:** backend | frontend | testing | security | meta
**Trigger:** کاتێک <specific condition>
**Action:** <concrete action>
**Reasoning:** چونکە <root cause>
**Source:** Sprint X / Bug #N / Task Y
**Frequency:** N (هەر کات بەکار هاتە، +1 بکە)
**Confidence:** ★ بۆ ★★★★★
**Last verified:** YYYY-MM-DD
**Related:** [skill](path)، [rule](path)
```

## Confidence Scale

- ★ — مشاهیدەی یەک کات
- ★★ — ٢-٣ جار، context محدود
- ★★★ — ٤-٦ جار، چەند context
- ★★★★ — ٧+ جار، مختلف context
- ★★★★★ — verified بە تێست + skill ـیش documenting

## Auto-trigger
هەر شادۆ تێستەر یان دەڤەلۆپەر دوای task ـی گەورە، شادۆ کۆچ بانگ بکات بۆ extraction.
