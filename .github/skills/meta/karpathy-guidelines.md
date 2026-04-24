# Skill: Karpathy Guidelines

> Inspired by `forrestchang/andrej-karpathy-skills`, adapted for Zoho ERP and Copilot Chat.

## ئامانج

کەمکردنەوەی هەڵەی باو لە coding agents:
- assumption بێ clarification
- overengineering
- drive-by refactor
- fix بێ verification

## Always-On Usage

ئەم skill ـە پێویستە **هەمیشە** لە هەر داواکارییەکی non-trivial جێبەجێ بکرێت، تەنانەت ئەگەر بە ناو بانگ نەکرێت.

## 1. Think Before Coding

- ئەگەر ambiguity هەیە، assumption مەکە.
- ئەگەر دوو یان زیاتر interpretation هەن، گرنگترینیان ڕوون بکەوە.
- ئەگەر کارێکی سادەتر هەیە، پیشنیازی بکە.
- ئەگەر controlling detail ونە، clarify بکە پێش edit.

**نمونەی باش:**
- "مەبەستی `faster` response time ـە، throughput ـە، یان UX perceived speed؟"

**نمونەی خراپ:**
- cache + index + async لە یەک کات، بێ دیاریکردنی مەبەست

## 2. Simplicity First

- تەنها ئەوە بنووسە کە داوا کراوە.
- abstraction بۆ single-use code مەهێنە.
- configuration/flexibility ی زیاد مەزیاد مەکە.
- error handling بۆ impossible scenario مەزیاد مەکە.

**تاقیکردنەوەی سادەیی:**
- ئەگەر 200 هێڵ دەنووسیت و 50 هێڵیش بەسە، rewrite بکە.
- ئەگەر senior engineer بڵێت overcomplicated ـە، simplify بکە.

## 3. Surgical Changes

- تەنها ئەو کۆدە دەستپێوەربگرە کە بە task ـەکە پەیوەستە.
- formatting، comments، quote style، naming drift مەگۆڕە ئەگەر task ـەکەی داوا نەکردبێت.
- dead code ـی پێشوو مەسڕەوە، تەنها ئاماژەی پێ بدە.
- orphan ـەکانی هەر edit ـی خۆت پاک بکە.

**تاقیکردنەوە:**
- هەر هێڵی گۆڕاو پێویستە ڕاستەوخۆ بگەڕێتەوە بۆ داواکارییەکە.

## 4. Goal-Driven Execution

- imperative request بگۆڕە بۆ success criteria ـی تاقیکراو.
- bug fix:
  1. reproduce
  2. fix
  3. rerun focused check
- refactor:
  1. baseline verify
  2. refactor
  3. verify before/after behavior

**فۆرماتی plan:**

```text
1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]
```

## Tradeoff

ئەم skill ـە بەرەو caution دەچێت زیاتر لە speed. بۆ task ـە زۆر سادەکان، judgment بەکاربهێنە و process ـەکە قورس مەکە.

## Integration لە Zoho

- لە `copilot-instructions.md` بە شێوەی always-on register کراوە.
- لە task ـە backend/frontend/testing/security ـەکاندا لەگەڵ skill ـەکانی تر کار دەکات، نەک لەجیاتیان.
- بۆ planner، ئەم skill ـە behavioral overlay ـە بۆ هەموو plans.

## پەیوەستەکان

- [verification-loop](verification-loop.md)
- [tdd-workflow](../testing/tdd-workflow.md)
- [token-optimization](../harness/token-optimization.md)