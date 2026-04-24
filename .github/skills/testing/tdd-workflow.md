# Skill: TDD Workflow

## Cycle
١. **Red** — تێستێکی شکست خواردوو بنووسە کە تایبەتە بە رەفتاری داواکراو
٢. **Green** — کەمترین کۆد بنووسە کە تێستەکە سەرکەوێت
٣. **Refactor** — کۆد پاک بکە، تێست هێشتا سەردەکەوێت

## Backend (test_all.py)
```python
# Red
def test_create_order_empty_cart_returns_400():
    res = client.post("/api/pos/orders/self", json={"lines": []})
    assert res.status_code == 400  # ئێستا 500 دەدات

# Green — لە pos.py
if not lines_data:
    raise HTTPException(400, "cart empty")

# Refactor — error message کوردی
raise HTTPException(400, "سەبەتە بەتاڵە")
```

## ڕێبەری حاڵەتە سنووریەکان
- Empty input → 400
- Missing auth → 401
- Wrong org_id → 403/404
- Not found → 404
- Duplicate → 409
- Server error → 500

## Frontend
بۆ ئێستا، manual testing لە browser + `npm run build` بەس.
لە سپرینتی داهاتوو (Sprint 5): Vitest + React Testing Library.

## Workflow بۆ Bug Fix
١. تێستێک بنووسە کە bug ـەکە reproduce بکات
٢. شکست بهێنێ (verify reproduction)
٣. کۆد فیکس بکە
٤. تێست سەربکەوێت
٥. هیچ تێستی پێشوو نەشکێ (`venv\Scripts\python.exe test_all.py`)
