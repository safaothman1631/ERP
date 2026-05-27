# CLAUDE.md — وەسفی پڕۆژە (Project Map)

> ئەم فایلە بۆ ئەوەیە کە Claude هەر کاتێک پێویستی بە زانیاری پڕۆژە بوو، تەنها ئەمە بخوێنێتەوە بێ ئەوەی هەموو فایلەکانی تر بخوێنێتەوە. هەر گۆرانکاریەک کە Claude دەکات پێویستە ئێرەش بنووسێت.

---

## 🏗️ پڕۆژە چییە؟

**سیستەمی ERP/بازرگانی تەواو** — وەک Zoho One، بەڵام بە زمانی کوردی (سۆرانی) و پشتگیری عێراق. دوو بەش هەیە:

| بەش | تەکنەلۆژی |
|------|------------|
| `frontend/` | React + TypeScript + Vite + Zustand |
| `backend/` | Python (venv لە `backend/venv/`) |

---

## 📁 پێکهاتەی فایلەکانی سەرەکی (frontend/src)

```
frontend/src/
├── types/index.ts              ← تایپەکانی سەرەکی (Contact, Item, Invoice, Bill, Project...)
├── pages/
│   ├── modules/moduleConfigs.ts ← کۆنفیگی 30+ مۆدیوولی ext (Wave A/B/C/D)
│   └── ...                     ← هەموو پەڕەکانی تر
├── layouts/
│   ├── moduleMap.ts            ← ڕووت → ModuleKey mapping
│   └── navDestinations.ts      ← تۆمارخانەی هەموو ڕووتەکان
├── stores/
│   ├── posCart.ts              ← سەبەتەی POS (IndexedDB persist)
│   ├── posFloor.ts             ← نەخشەی POS
│   ├── posSession.ts           ← سێشنی POS
│   └── posOffline.ts           ← POS ئۆفلاین
├── components/
│   ├── pos/                    ← کۆمپۆنێنتەکانی POS
│   └── ...
├── design-system/              ← سیستەمی دیزاین
├── hooks/                      ← Custom React hooks
├── api/                        ← کلاینتی API
├── docs/sections/              ← دۆکیومێنتی هەر مۆدیوول
├── locales/                    ← وەرگێڕان
└── stores/                     ← Zustand stores
```

---

## 🧩 مۆدیوولەکانی سیستەم

### Wave A — بازرگانی سەرەکی (Core Business)
| ڕووت | ناو |
|------|-----|
| `/invoices` | فاکتور |
| `/quotes` | نرخنامە |
| `/sales-orders` | داواکاری فرۆشتن |
| `/bills` | پسوولە |
| `/purchase-orders` | داواکاری کڕین |
| `/expenses` | خەرجی |
| `/banking` | بانکداری |
| `/accounts` | هەژمارداری |
| `/journals` | ژوورناڵ |
| `/inventory` | ئەنبار |
| `/manufacturing` | بەرهەمهێنان |
| `/pos` | POS (فرۆشگا) |
| `/crm` | CRM |
| `/hr` | کارمەند |
| `/payroll` | مووچە |
| `/projects` | پڕۆژە |
| `/assets` | دارایی |
| `/reports` | ڕاپۆرت |
| `/l10n-iq` | زیاتری عێراق |
| `/einvoice` | فاکتوری ئەلیکترۆنی |
| `/helpdesk` | یارمەتیدان |
| `/field-service` | خزمەتگوزاری مەیدانی |
| `/subscriptions` | بەشداری |
| `/dms` | دۆکیومێنت |
| `/kb` | ویکی/زانیاری |

### Wave B — Engagement (`/ext/<slug>`)
`livechat`, `social`, `comms`, `engagement`, `elearning`

### Wave C — Platform (`/ext/<slug>`)
`rental`, `ai`, `mobile`, `iot`, `studio`

### Wave D — Vertical Industries (`/ext/<slug>`)
`healthcare`, `hospital`, `pharmacy`, `hotel`, `restaurant`, `construction`, `real-estate`, `education`, `logistics`, `agriculture`, `ngo`, `government`

### زیادکراوەکانی تر
`quality`, `maintenance`, `plm`, `repairs`, `hr-extended`

---

## 🔑 تایپەکانی سەرەکی (`types/index.ts`)

- `Contact` — کڕیار/دابینکار
- `Item` — بەرهەم/خزمەت
- `Invoice` / `InvoiceLine` — فاکتور
- `Bill` — پسووڵە
- `Quote` — نرخنامە
- `Expense` — خەرجی
- `Project` — پڕۆژە
- `Account` — هەژمار (هەسابداری)
- `ApiListResponse<T>` — وەڵامی لیست لە API

---

## 🗺️ ڕووتەکان

- **تۆمارخانەی تەواو:** `layouts/navDestinations.ts`
- **ڕووت → مۆدیوول:** `layouts/moduleMap.ts`
- **مۆدیوولەکانی ext:** `/ext/<slug>` (وەک `/ext/healthcare`)

---

## 🏪 POS (فرۆشگا)

- **Offline-first:** IndexedDB بەکاردەهێنرێت (نە localStorage)
- **Stores:** `posCart`, `posFloor`, `posSession`, `posOffline`
- **کۆمپۆنێنت:** `components/pos/`
- **ڕاپۆرت:** `pages/pos/`
- **Kitchen Display:** `pages/pos/POSKitchen.tsx`
- **ڕیسیت:** `components/pos/ReceiptTemplate80mm.tsx`

---

## 🌐 زمان و L10n

- **UI:** کوردی سۆرانی بە دروستی
- **زیاتری عێراق:** `/l10n-iq`, `/einvoice`, `/whatsapp`, `/ocr`
- **وەرگێڕان:** `frontend/src/locales/`
- **i18n:** فایلی `i18n.ts` + `hooks/useLanguage.ts`

---

## 🔌 مۆدیوولی ext — کۆنفیگ

هەموو 30+ مۆدیوولی ext لە **`pages/modules/moduleConfigs.ts`** تۆمار کراون. هەر مۆدیوول هەیەتی:
- `slug` — ڕووت (`/ext/<slug>`)
- `basePath` — API (`/api/<slug>`)
- `title` — ناوی کوردی
- `group` — `engagement | platform | vertical`
- `resources[]` — تابەکان + فیلدەکانی فۆرم

---

## 🪝 Custom Hooks گرینگەکان

| Hook | بەکاری |
|------|--------|
| `useCRUD` | CRUD بۆ هەموو ڕیسۆرسەکان |
| `useMutationRefresh` | دووبارەخوێندنەوە پاش گۆرانکاری |
| `useFirestoreLive` | داتای زیندوو |
| `useFeatureFlag` | فیچەر فلاگ |
| `useLayout` | کۆنتڕۆلی لایەوت |
| `usePermission` | مۆڵەتەکان |
| `useMediaQuery` | ڕێسپۆنسیڤ |
| `useLanguage` | زمان |

---

## 🛠️ Design System

فایلەکان لە `design-system/`:
- `DetailLayout.tsx` — لایەوتی وردەکاری
- `KeyValueGrid.tsx` — گریدی کلیل-بەها
- `InlineEdit.tsx` — دەستکاریکردنی لە جێخۆی
- `ColumnVisibility.tsx` — نیشاندانی ستوون
- `ContextMenu.tsx` — مێنیوی کونتێکست
- `KbdHint.tsx` — کلیلەکانی کیبۆرد
- `EnvironmentBadge.tsx` — نیشانەی ژینگە
- `UserSelect.tsx` — هەڵبژاردنی بەکارهێنەر

---

## 📊 API

- `api/featureFlags.ts` — فلاگەکانی فیچەر
- `api/vendorPortal.ts` — پۆرتاڵی دابینکار

---

## 🧪 تێستەکان

- `*.test.ts` / `*.test.tsx` لە تەنیشتی فایلی سەرەکی
- `*.vitest.test.tsx` — تێستی Vitest
- `*.integration.test.ts` — تێستی یەکگرتن

---

## ⚠️ تێبینی گرینگ

1. `backend/venv/` — تەنها Python virtual environment, **کۆدی سەرەکی باکەند لێرە نییە** (دەبێت لە جێگایەکی تر بێت یان هێشتا نەنووسراوە)
2. `node_modules/` — هەرگیز دەستکاری نەکە
3. POS بە IndexedDB کار دەکات بۆ ئۆفلاین — نە localStorage
4. هەموو مۆدیوولی ext ئەکتیفکردنیان پێویستە لە `moduleConfigs.ts`

---

## 📝 تۆمارخانەی گۆرانکاریەکانی Claude

> هەر گۆرانکارێک کە Claude دەکات ئێرە دابنووسرێت:

### 2026-05-27 — Critical Fix A (Frontend Build & Integration)

- `frontend/package.json` — بەرز کردنەوەی `vite-plugin-pwa` لە `^0.20.5` بۆ `^1.3.0` (پشتگیری vite v8).
- `frontend/vite.config.ts` — زیادکردنی `VitePWA(PWA_CONFIG)` لە `plugins[]` پاش `react()`. ئەمە `dist/sw.js` دەنووسێت لە کاتی build.
- `frontend/eslint.config.js` — تۆمارکردنی پلاگینی `local` لە `../tools/eslint-rules/index.js` و چالاککردنی دوو ڕێسا:
  - `local/require-query-class: 'warn'`
  - `local/precise-invalidation: 'warn'`
- `frontend/src/main.tsx` — گۆڕینی `import './i18n'` بۆ `initI18n()` لە `./i18n.config` (namespaced lazy loading) لەگەڵ fallback بۆ مۆدیوولی legacy.
- `_deltas/critical-fix-A-summary.md`, `_deltas/build-evidence-frontend.txt`, `_deltas/bundle-sizes-after-build.txt` — تۆماری گۆڕانکاریەکان.

**TODOs بۆ بەکارهێنەر:** بەکارهێنەر دەبێت `npm install --legacy-peer-deps` و `npm run build` و `npm run i18n:split` لە Windows جێبەجێ بکات — ژینگەی Linux sandbox توانای تەواوکردنی install-ی نەبوو.
