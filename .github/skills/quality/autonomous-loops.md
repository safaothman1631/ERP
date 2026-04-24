# Skill: Autonomous Loops

## ئامانج
سیستەم خۆکار بکات کۆد فیکس بکات بێ user intervention — لە سنووری ئەمنیەت ـدا.

## Loop Pattern

```
┌─────────────────────────────────────┐
│ 1. Run task                         │
│ 2. Verify (test / build / lint)     │
│ 3. If pass → done                   │
│ 4. If fail → diagnose               │
│ 5. Fix → goto 2 (max 3 iterations)  │
│ 6. After 3 → escalate to user       │
└─────────────────────────────────────┘
```

## Stop Conditions (CRITICAL)

- ✅ Success: تێست pass، build clean
- ⛔ ٣ هەوڵی نه‌سەرکەوتوو → user intervention
- ⛔ Same error دووبارە → approach گۆڕە یان بوەستە
- ⛔ Destructive action نزیک → پرسیار بکە
- ⛔ Cost budget تەواو (token / time)

## Anti-patterns

- ❌ Brute-force (هەمان شت دووبارە بکەرەوە)
- ❌ Endless loop بێ stop condition
- ❌ Ignore error (test skip بۆ "pass")
- ❌ Disable check (lint/test skip بۆ "pass")

## Diagnosis Heuristics

### Error نوێیە؟
- read error message
- search کۆد بۆ pattern
- web fetch ئەگەر unfamiliar

### Error دووبارەیە؟
- approach گۆڕە (نا هەمان fix جیاواز)
- ئاگاهی بکە: شاید root cause لای دیکە
- ئەگەر ٢ جار، escalate بۆ بەکارهێنەر

## Safety Gates

پێش هەر loop iteration:
- [ ] Diff بپشکنە (نا destructive؟)
- [ ] Test pre-existing شکست نەهێناوە؟
- [ ] Memory update — چی فێر بووم لەم iteration؟

## Example: POS Tester→Fixer Loop

Round 1: tester → 4 critical bugs → fixer → all fixed
Round 2: tester → 5 more bugs (AntD migration) → fixer → all fixed
Round 3: tester → 0 critical → ✅ pass → done

ئەگەر round 4 هەر هەمان bug بهێنایەتەوە → escalate.
