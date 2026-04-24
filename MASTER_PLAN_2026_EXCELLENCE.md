# 🎯 MASTER PLAN — Zoho ERP Excellence Initiative (Apr 2026)

> **مەبەست:** سیستەمێکی تەواو، بێ ئیرۆر، پرۆفیشناڵ، ریسپۆنسیڤ، ریەلتایم.
> **Methodology:** Karpathy-style — Think → Plan → Execute one phase at a time → Verify → Report.
> **Status:** Draft v1 — produced by `پلانساز` for `زۆهۆ مێشک` to dispatch.

---

## 📊 Executive Summary

| Phase | بەش | Lead Agent | Skills | Deliverable | Estimated Sessions |
|-------|----|------------|--------|-------------|--------------------|
| **0** | Foundation: Trash + Help framework | شادۆ دەڤەلۆپەر | `python-patterns`, `react19-patterns` | Soft-delete API + `PageHelp` component + Trash page | 1 |
| **1** | Documentation visibility | شادۆ دۆکیومێنتەر | `documentation-lookup` | Help icon on every page + nav docs section + per-page help text | 1 |
| **2** | Navbar redesign — clean & modern | شادۆ دیزاینەر + ERP UX | `antd-rtl-patterns` | Consolidated 3-tier nav, search-first, modern visual | 1 |
| **3** | Dialog audit — every form complete | زۆهۆ تێستەر + شادۆ دەڤەلۆپەر | `verification-loop` | Dialog inventory + missing-field fixes + report per dialog | 2-3 |
| **4** | Serial-number tracking expansion | ERP Inventory | `firestore-patterns` | Serials in PO/SO/transfers/POS where missing | 1-2 |
| **5** | Endpoint audit — zero click errors | زۆهۆ تێستەر | `tdd-workflow` | Smoke-test runner that hits every page route + fix-list | 2 |
| **6** | Button audit + Realtime sync | شادۆ دەڤەلۆپەر | `react19-patterns` | Every button functional + Firestore onSnapshot for live data | 2 |
| **7** | Responsive design | شادۆ دیزاینەر | `antd-rtl-patterns` | Mobile/tablet breakpoints, touch-friendly, all OS tested | 1-2 |
| **8** | Support UX layer | ERP UX | `documentation-lookup` | Inline tooltips, error-recovery hints, contact-support widget | 1 |
| **9** | Final integration + verification | شادۆ ئیڤاڵ | `verification-loop` | Full test pass, build green, smoke green, sign-off report | 1 |

**واقعی:** ئەم ئیشە ~12-15 session پێویستە بۆ کوالیتی-بەرز. هەر فەیز بە جیا تەواو دەکرێت و چێک دەکرێت.

---

## 🧠 Karpathy Overlay (هەمیشە چالاک)

پێش هەر فەیز:
1. **Think:** پێش کۆد نووسین، فایلە کاریگەرەکان لیست بکە و plan بنووسە.
2. **Simplicity:** کەمترین کۆد — هیچ abstraction زیادە.
3. **Surgical:** تەنها هێڵە پێویستەکان بگۆڕە.
4. **Goal-driven:** هەر فەیز endpoint-ـی verifiable ـی هەیە (build green + smoke green + screenshot).

---

## 📋 Phase 0 — Foundation (THIS SESSION)

### ئامانج
سێ شت ـی foundational کە هەموو فەیزەکانی تر پێی پشت دەبەستن:
1. **Soft-delete + Trash backend** — هەر `delete` خۆکار `deleted_at` set دەکات، نا واقعی delete.
2. **Trash page** — لیستی هەموو شتە سڕاوەکان + restore + permanent delete (پاش 30 ڕۆژ).
3. **`PageHelp` component** — یەک component، هەر پەیجێک content ی خۆی پاس دەکات.

### Files to touch
- **NEW:** `backend/app/services/trash_service.py` — utility بۆ soft delete + restore
- **NEW:** `backend/app/api/trash.py` — `GET /api/trash`, `POST /api/trash/restore/{id}`, `DELETE /api/trash/permanent/{id}`
- **MODIFY:** `backend/app/firestore/base.py` — `BaseRepository.delete()` بە default soft delete دەکات
- **MODIFY:** `backend/app/main.py` — register trash router
- **NEW:** `frontend/src/pages/Trash.tsx` — UI
- **NEW:** `frontend/src/components/PageHelp.tsx` — drawer with help content
- **NEW:** `frontend/src/data/page-help.ts` — central registry: `route → help content`
- **MODIFY:** `frontend/src/App.tsx` — add `/trash` route
- **MODIFY:** `frontend/src/locales/{en,ku}.json` — keys

### Verification
- ✅ `POST /api/contacts/{id}` بانگکردن لای Trash دەرکەوێت، نا لە لیست
- ✅ `POST /api/trash/restore/{id}` گەڕانەوە
- ✅ Frontend build green
- ✅ Manual: حذف یەک contact → بینین لە `/trash` → restore

### Deliverable
Demo: حذف بکە، بڕۆ Trash، گەڕێنەوە — هەموو لە کوالیتی production.

---

## 📋 Phase 1 — Documentation Visibility

### ئامانج
هەر پەیجێک Help icon ـی هەبێت کە کاتێک کلیک دەکرێت drawer دەکرێتەوە و دەڵێت:
- ئەم پەیجە چیە
- بۆچی بەکار دەهێنرێت
- هەموو فیڵدی پێویست
- نموونەی workflow
- لینکی تایبەت بۆ documentation تەواو

### Files
- **EXTEND:** `frontend/src/components/PageHelp.tsx` (لە Phase 0)
- **NEW:** `frontend/src/data/page-help.ts` — entry per route
- **MODIFY:** هەر پەیجێک یەک `<PageHelp pageKey="contacts" />` زیاد بکات لە header
- **NEW:** `frontend/src/pages/DocsHub.tsx` — central docs page
- **MODIFY:** `AppLayout.tsx` — add `Docs` to nav

### Verification
- ٥ پەیجی random چێک بکە — Help icon → drawer دەکرێتەوە بە content ی پەیوەست
- DocsHub هەموو پەیجەکان لیست دەکات

---

## 📋 Phase 2 — Navbar Redesign

### ئامانج
ناڤباری ئێستا 17 sub-menu ی هەیە — زۆر ئاڵۆزە. سادە بکرێت بۆ **3 tiers**:
1. **Pinned** (Dashboard, Sales, Inventory, POS, Reports)
2. **All Modules** (یەک accordion گەورە کە 4 گرووپ ـی تێدایە: Operations, Finance, People, System)
3. **Search Bar** (`Ctrl+K`) — هەموو پەیجێک بدۆزێتەوە

### Visual changes
- Reduce from 250px → 240px width
- Remove emojis from logo, use clean typography
- Hover: subtle background change instead of color shift
- Active item: 3px accent bar on inline-end side
- User avatar: bottom badge for online status

### Files
- **REWRITE:** `frontend/src/components/AppLayout.tsx` (sidebar section)
- **NEW:** `frontend/src/components/CommandPalette.tsx` — Ctrl+K search
- **NEW:** `frontend/src/components/NavGroup.tsx` — collapsible group

### Verification
- Sidebar width measure ≤ 240px
- Item count visible at once ≥ 12
- Ctrl+K opens, types "invoices", Enter navigates

---

## 📋 Phase 3 — Dialog Audit

### Methodology
1. سکریپتی scanner دروست بکە کە هەموو `Modal` و `Drawer` لە `frontend/src/pages/**/*.tsx` لیست دەکات
2. هەر یەکیان match بکە لەگەڵ backend Pydantic schema ی پەیوەست
3. Missing-field report: کام فیڵد لە backend هەیە بەڵام لە UI نییە
4. Fix هەر کام بە یەک یەک

### Files (NEW tooling)
- **NEW:** `frontend/scripts/dialog-audit.mjs` — AST scan
- **NEW:** `MASTER_AUDIT_REPORTS/dialogs.md` — auto-generated report

### Verification
- Report لیستی ٥٠+ dialog لە سیستەم
- هەر کام green ✅ یان ❌ + missing fields
- پاش fix: ٠ ❌

---

## 📋 Phase 4 — Serial Number Tracking

### Where to add (lookup needed first)
- ✅ Inventory: already has `/api/inventory/serials` — verify usage
- ❌ Sales Order line items — add `serial_numbers[]` field
- ❌ Purchase Order receipt — capture serials on receive
- ❌ Stock Transfer — track serials per move
- ❌ POS Order — auto-assign on sale
- ❌ Invoice line items (if shipped from inventory)

### Files
- **MODIFY:** SO/PO/Transfer/POS schemas + UI line-item rows
- **NEW:** `frontend/src/components/SerialNumberPicker.tsx` — reusable

---

## 📋 Phase 5 — Endpoint Audit

### Methodology
1. Iterate `frontend/src/App.tsx` route table
2. هەر route → render headless → check console for `404`/`500`/`405`
3. Generate `endpoint-health.md` report
4. Fix هەر یەک

### Tooling
- **NEW:** `frontend/scripts/route-smoke.mjs` — Playwright headless

---

## 📋 Phase 6 — Button + Realtime

### Buttons
- Scanner دروست بکە کە هەموو `<Button onClick={...}>` چێک بکات کە handler ـیان undefined نییە
- هەر button کە placeholder `() => {}` ـە fix بکە

### Realtime
- لیستی پەیجی listing identify بکە (Invoices, Contacts, Items, ...)
- بۆ هەر کام `useFirestoreSubscription(collection, query)` hook بەکار بهێنە
- onSnapshot → Zustand store → UI خۆکار refresh

### Files
- **NEW:** `frontend/src/hooks/useFirestoreLive.ts`
- **MODIFY:** ٢٠+ پەیجی listing

---

## 📋 Phase 7 — Responsive

### Breakpoints
- Mobile: < 576px — collapse sidebar to bottom-nav, single-column tables
- Tablet: 576-992px — sidebar collapsed by default, 2-column forms
- Desktop: ≥ 992px — current layout

### Tooling
- AntD `<Grid>` xs/sm/md/lg/xl
- `useMediaQuery` hook
- Touch targets ≥ 44px

### Files
- **NEW:** `frontend/src/components/MobileNav.tsx`
- **MODIFY:** AppLayout — conditional render
- **MODIFY:** all data tables — `scroll={{ x: 'max-content' }}` + responsive columns

---

## 📋 Phase 8 — Support UX

### Features
- Tooltip on every form field explaining purpose
- Error messages: action-oriented (نا "خراپ بوو" → "تکایە ئیمەیڵی دروست داخڵ بکە")
- "Need help?" floating widget bottom-end
- Auto-detect: 3 errors لە 60 ثانیە → پێشنیار "support بپرسە؟"

### Files
- **NEW:** `frontend/src/components/SupportWidget.tsx`
- **NEW:** `frontend/src/utils/errorTracker.ts`
- **MODIFY:** هەموو error message keys لە locales

---

## 📋 Phase 9 — Final Integration

### Checklist
- [ ] `npm run build` green
- [ ] Backend: `python test_all.py` green
- [ ] Manual smoke: login → dashboard → contact create → invoice create → trash → restore
- [ ] Mobile emulator (Chrome DevTools) — هەر پەیجێک render دەبێت
- [ ] Lighthouse: Performance ≥ 80, Accessibility ≥ 90
- [ ] Final report: `FINAL_AUDIT_REPORT.md`

---

## 🎬 Execution Protocol

هەر فەیز ئاوا تەواو دەکرێت:

```
1. زۆهۆ مێشک: announce phase start
2. Lead agent: read existing code, plan exact changes
3. Implement (surgical)
4. شادۆ ئیڤاڵ: verify (build + smoke)
5. شادۆ دۆکیومێنتەر: update memory + report
6. Move to next phase OR pause for user review
```

---

## 📌 Notes & Risks

- **Risk:** Phase 6 realtime ممکنە Firestore quota کاریگەری هەبێت — quota بکات لە batch 500.
- **Risk:** Phase 3 dialog scanner false-positives لە dynamic forms — manual review پێویستە.
- **Risk:** Phase 7 responsive ممکنە breaking change بێت بۆ desktop layout — feature-flag بەکار بهێنە.
- **Decision needed:** retention period بۆ Trash — پێشنیار: 30 ڕۆژ (configurable).

---

**Status:** Ready for execution. Awaiting GO signal for Phase 0.
