# Rule: Performance

**ALWAYS-FOLLOW**

## Backend
- Firestore: هەموو filtering لە Python (composite indexes نا)
- N+1 queries: bulk fetch بکە بە `where("__name__", "in", [...])`
- Pagination: limit + cursor، نا offset
- Caching: لە `app/cache.py` بۆ داتای کەم گۆڕاو (taxes، COA)

## Frontend
- Code splitting: lazy import بۆ ڕۆتەکانی گەورە
- Image optimization: WebP + lazy loading
- Bundle size: پێش deploy `npm run build` چاودێری بکە (≤ 500KB chunks)
- Re-renders: `useMemo`، `useCallback` تەنها کاتێک پێویستن

## Targets
- LCP < 2.5s
- INP < 200ms
- CLS < 0.1
- API response < 500ms p95

## ❌ NEVER
- Premature optimization
- بەکارهێنانی `useMemo` لەسەر هەموو شت
- ئاوەزی DB کە کاتێک Python-side filter بەکار دەکرێت
