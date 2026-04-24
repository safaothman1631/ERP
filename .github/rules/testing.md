# Rule: Testing

**ALWAYS-FOLLOW**

## Backend
- پێش commit: `venv\Scripts\python.exe test_all.py` — ٠ failures پێویستە
- هەر endpointـی نوێ، تێستی هەبێت لە `test_all.py`
- حاڵەتە سنووریەکان (empty input، invalid auth، missing org_id) ـیش تاقیبکەرەوە

## Frontend
- پێش commit: `npm run build` — ✓ Built بێ ئیرۆر
- ⚠️ `npx tsc --noEmit` بەس کافی نییە — `tsc -b` (build) ئیرۆری زیاتر دەدۆزێتەوە

## TDD (پێشنیاری بۆ فیچەری گرنگ)
١. تێست بنووسە (failing → red)
٢. کۆد بنووسە (passing → green)
٣. Refactor بکە، تێست هێشتا سەردەکەوێت

## ❌ NEVER
- skip لە تێست بۆ "خێرایی"
- comment کردنی تێستی شکست خواردوو لەباتی فیکسکردنی
- پاککردنی تێست لەبەر ئەوەی شکستی هێناوە
