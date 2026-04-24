# Rule: Git Workflow

**ALWAYS-FOLLOW** — هیچ کات سەرپێچی مەکە بێ ڕەزامەندی بەکارهێنەر.

## ❌ NEVER

- `git push --force` بێ ڕەزامەندی
- `git reset --hard` لەسەر کۆدی نەکۆچکراو
- `git commit --no-verify` (pre-commit hooks سپای ناکرێت)
- `git rebase` لە branchـی هاوبەش (main/master) دوای push
- ئەمەندکردنی commit ـی pushed
- پاککردنەوەی فایلەکانی نەناسراو بێ پشکنین (لەوانەیە کاری بەردەوام بێت)

## ✅ ALWAYS

- پەیامی commit ڕوون و کورت — کوردی یان English (هاوسەنگ)
- پێش commit: `git status` و `git diff` بپشکنە
- Branchـی نوێ بۆ هەر فیچەر/bugfix
- ئەگەر merge conflict، یارمەتی بخوازە لە بەکارهێنەر
- پێش `push`، تێست بکە (build + test_all.py)

## Format

```
<type>: <subject>

<body — optional>
```

types: `feat`، `fix`، `refactor`، `docs`، `test`، `chore`، `style`
