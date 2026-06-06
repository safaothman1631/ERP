# Delta — Premium Glass RTL Experience (frontend only)

> سپێک: `.kiro/specs/premium-glass-rtl-experience`. **هیچ گۆڕانکارییەک لە `backend/` نەکراوە**
> (پشتڕاستکرایەوە: ٠ فایلی backend لە ماوەی سێشندا دەستکاری کراوە). تەنها `frontend/` + `.kiro/`.

## چی کرا (What landed)

### ١) سپێکی Kiro
- `.kiro/specs/premium-glass-rtl-experience/{requirements,design,tasks}.md` — R1–R8، ئەرکیتێکچەری
  «چینی میرات»، ستراتیژی گلاس/مۆشن/ڕیسپۆنسیڤ/پاکی زمان، و دابەشکردنی کار.

### ٢) بناغەی گلاس + مۆشنی گشتی (cascade بۆ هەموو سیستەمەکە)
- **`frontend/src/theme/premium.css`** (نوێ) — چینی پریمیۆم کە دوای `polish.css` بار دەکرێت:
  گلاس بۆ هەموو overlay-ی antd (dropdown, select, popover, tooltip, message, notification)؛
  cascade-ی role-accent (دوگمەی primary بە gradient + sheen، active nav، focus ring، scrollbar)؛
  keyframes (shimmer, sheen, fade-up, float, pop)؛ hover-lift بۆ کارت؛ skeleton shimmer؛
  bottom-sheet بۆ مۆداڵ/درۆوەر لە مۆبایل (< 640px). هەمووی پشت `@supports` + reduced-motion.
- **`frontend/src/main.tsx`** — ئیمپۆرتی `./theme/premium.css` دوای `polish.css`.
- **`frontend/src/theme/motionPresets.ts`** — زیادکردنی variant-ی هاوبەش: `listContainer/listItem`،
  `fadeUp`، `heroReveal` + هەریەکە counterpart-ی reduced.
- **`frontend/src/hooks/useGlassMotion.ts`** — دەرخستنی variant-ە نوێیەکان، reduced-aware.

### ٣) جیاکردنەوەی ڕۆڵ
- **`frontend/src/theme/roleThemes.ts`** — gradient-ی هیرۆی دەوڵەمەندتر (دوو-ستۆپ) + glow-ی
  جیاوازتر بۆ هەر ١٢ ڕۆڵ. (سیستەمی ڕۆڵ/داشبۆرد/هیرۆ پێشتر هەبوو؛ ئەمە cascade-ی accent-ی
  زیادکرد بۆ دوگمە/nav/focus/scrollbar بەناو هەموو سیستەمەکەدا.)

### ٤) بەرزکردنەوەی design-system (میرات بۆ هەموو پەڕەکان)
- `KpiCard.tsx`, `SectionCard.tsx`, `ChartCard.tsx` — کلاسی `premium-card` (hover-glow-ی role accent).
- `ChartCard.tsx` — چاکردنی «Retry» hardcode → `t('retry')` + `useTranslation`.
- `KeyValueGrid.tsx` — چاکردنی `'کۆپی کرا'` hardcode → `t('copied')` + `useTranslation`.

### ٥) گاردی پاکی زمان (ku ↔ en) — داواکاریی سێیەم
- **`frontend/scripts/i18n-purity.mjs`** (نوێ) — گاردی سێ-چێکی (بێ dependency):
  - A: کلیلی `t()` کە لە کوردی نییە (ئینگلیزی دەردەکەوێت لە UI-ی کوردی) — **گەیتی سەرەکی**.
  - B: پیتی عەرەبی hardcode لە کۆد (کوردی دەردەکەوێت لە UI-ی ئینگلیزی) — heuristic.
  - C: وشەی لاتین لەناو نرخی ku.json.
  - فلاگ: `--scope=foundation`, `--strict`, `--json`. (قاڵبی چاپ/پسوولە و ternary-ی `isRTL` جیاکراونەتەوە
    وەک زمان-دروست/مەبەستدار.)
- **`frontend/scripts/i18n-backfill.mjs` + `i18n-backfill-data.json`** (نوێ) — ٤١٠ کلیلی کوردی + ئینگلیزی
  نووسراو بۆ ئەو کلیلانەی لە کوردی کەم بوون (form_layout, entity_select, command_palette, money_input,
  data_table_v2, uploader, toast, nav.* labels + blurbs/descriptions، هتد). merge بۆ
  `public/locales/{ku,en}/{common,errors}.json` بەبێ سڕینەوەی کلیلی بوونیار.
- **چاککراو بۆ بێ-ناکۆکی:** `FileUploadField.tsx`/`ImageUploadField.tsx` (`upload.*` → `uploader.*`)،
  `EntitySwitcher.tsx` (`topbar.entity_switcher` → `entity_switcher.select`).
- **`frontend/package.json`** — scripts: `i18n:purity`, `i18n:purity:foundation`, `i18n:backfill`.

**ئەنجام:** لە **foundation scope** کلیلی کوردیی نەماو لە **٢٢٥ → ٠** هاتە خوارەوە (گەیت سەوز).

## تاقیکردنەوە (Verification)
- ✅ **٦٦/٦٦ فایلی locale JSON دروستن** (ku/en/ar، BOM-safe). کلیلە نوێکان پشتڕاستکراون لە ku و en.
- ✅ **`i18n:purity --scope=foundation` → Check A = 0** (exit 0). Check B residual = mock data +
  ternary-ی زمان-دروست (تێکەڵبوون نییە).
- ✅ **هیچ گۆڕانکارییەک لە backend** (٠ فایلی backend لە ٢ کاتژمێری ڕابردوو).
- ✅ تەواوبوونی هەموو فایلە دەستکاریکراوەکان پشتڕاستکرا بە Read (motionPresets 71، KpiCard 308،
  ChartCard 167، roleThemes 96، useGlassMotion 34، هتد — هیچ بڕانێک نییە).

### تێبینی ژینگە (گرنگ بۆ بەکارهێنەر)
Sandbox-ی Linux کە تێیدا `tsc`/`build` جێبەجێ دەکرا، کۆپیی **کۆن/ناتەواوی** ئەو فایلانەی هەبوو کە
بە ئامرازی فایل (Edit/Write) گۆڕاون لەم سێشنەدا — ئەمە ئەرتیفاکتی هاوکاتکردنی sandbox-ـە، **نەک
کێشەی کۆد**. فایلە ڕاستەقینەکانت (Windows) تەواو و دروستن (بە Read پشتڕاستکراون). بۆ گەیتی کۆتایی،
لەسەر Windows ئەمانە جێبەجێ بکە:

```powershell
cd frontend
npx tsc --noEmit          # یان: npm run build
npm run lint
npm run i18n:purity:foundation
npm run rtl:audit
npm run audit:glass-modals
```

## ماوە (Long tail — سێشنی داهاتوو)
- جوانکاریی per-page بۆ هەموو ٢٩٥ پەڕە بە بەکارهێنانی primitive-ە بەرزکراوەکان.
- پاکی زمانی تەواوی ڕیپۆ بۆ سفر (ماوە ~٢٢٧٨ کلیلی fallback لە دەرەوەی foundation scope).
- پاکی زمانی عەرەبی (ar) — بەپێی هەڵبژاردنی بەکارهێنەر دواخراوە.
- baseline-ی Playwright per-role لە مۆبایل + دێسکتۆپ، RTL + LTR.

---

## نوێکردنەوە — شەپۆلی ئەیگێنتی پاراڵێل (Long-tail، ٢٠٢٦-٠٥-٣٠)

بە **٨ ئەیگێنتی پاراڵێل** (٦ بۆ ku/en بەپێی گرووپی مۆدیوول + ٢ پاککردنەوە) + ١ ئەیگێنتی عەرەبی + ١ ئەیگێنتی Playwright، long-tail-ـی پاکی زمان بەرەو سفر بردرا. **تەواوی ئەم شەپۆلە data-only بوو — ٠ فایلی backend، ٠ فایلی کۆمپۆنێنتی src دەستکاری کران (سفر مەترسیی build).**

- **ئەیگێنتەکان** (هەریەکە فایلی جیاوازی خۆی نووسی، بێ ناکۆکی): `scripts/i18n-data/{sales,finance,ops,people,platform,cleanup-a,cleanup-b}.json` (ku+en) + `arabic.json` (ar). کۆی ~٢٧٠٠ جووتی وەرگێڕانی نووسراو.
- **`scripts/i18n-merge-data.mjs`** (نوێ) — merge بەپێی لیستی فەرمیی `i18n-purity` (نەک گرووپی ئەیگێنت)؛ شوێنی هەر کلیلێک بەپێی `defaultNs`-ی فایلەکە دیاری دەکات؛ وەرگێڕان بە دەقی ئینگلیزیی fallback بەیەکدەخات؛ هەرگیز کلیلی بوونیار ناسڕێتەوە.
- **ئەنجام:** کلیلی کوردیی نەماوی سەرتاسەری ڕیپۆ **٢٢٧٨ → ٢٤٠ (≈٨٩.٥٪ کەمبوونەوە)**. زیادکرا: **~١٥٧٤ ku + ١٥٧٤ en + ٣٨٦ ar** بۆ `public/locales/{ku,en,ar}/*.json`. foundation scope هێشتا **٠**. هەموو ٦٣ فایلی locale JSON دروستن.
- **ماوەی ٢٤٠:** زۆربەیان بلۆککراون بەهۆی ناکۆکیی کلیلی flat-string (`settings` ٨ بەکارهێنانی bare، `tax` ٩، `help` ٣...) — ناتوانرێت بەسەلامەتی data-only چاک بکرێن بەبێ گۆڕینی کلیل لە کۆمپۆنێنتدا (پێویستی بە build-verification هەیە، بۆ سێشنی داهاتوو).
- **Playwright:** `frontend/e2e/premium-glass-roles.spec.ts` (نوێ) — ٤٨ تێست (١٢ ڕۆڵ × ٢ ڤیوپۆرت × ٢ ئاراستە)، env-gated بە `RUN_GLASS_SNAPSHOTS=1`، گریسفووڵ سکیپ، baseline-ەکان بە `--update-snapshots` لەسەر ماشینی بەکارهێنەر دروست دەکرێن.

**تێبینیی ژینگە:** `npm run build` لە sandbox-ی Linux کارناکات چونکە `node_modules` لەسەر Windows دامەزراوە (binding-ی rolldown-ی Windows). build/dev تەنها لەسەر Windows-ـی بەکارهێنەر کاردەکات؛ `npm run dev` بەسەرکەوتوویی تاقیکرایەوە (ready 179ms). بۆ پێشوێزی local لەگەڵ داتای زیندوو: `$env:VITE_DEV_API_TARGET="https://erpiq.systems"; npm run dev` (پرۆکسی ئێستا env-driven کراوە لە `vite.config.ts`).
