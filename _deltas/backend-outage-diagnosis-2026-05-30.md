# Backend — هۆکار + پلانی جێبەجێکردن — 2026-05-30 (v4، پشتڕاستکراو)

> هەموو ئەمانە لە کۆنسۆڵی زیندوو بینراون و پشتڕاستکراون.

---

## 1. ڕاستییە پشتڕاستکراوەکان (زیندوو)

- پڕۆژە: **zoho-83cda**.
- **Cloud Run — دوو سێرڤیس** (هەردوو `zoho-erp-backend`):
  - **europe-west1** → boot دەبێت، `route_count: 2338`، بەڵام داتا شکست دەهێنێت.
  - **me-central1** → بوونی هەیە (سەوز)، بەڵام **وەڵامی گشتی نادات** (نە `/api/live` نە `/api/metrics`).
- **Firestore — دوو داتابەیس:**
  | Database | Location | داتا |
  |---|---|---|
  | **`(default)`** | **me-central1** | ✅ **داتا ڕاستەکان لێرەن** — contacts: ١,٢٨٤، invoices: ٣,٩٠٢، items: ٨٧١، + accounts, journals, users, payments... |
  | `zoho-erp-prod` | europe-west1 | داتای تێدا پشتڕاست نەکراوە (بەئەگەری زۆر بەتاڵ) |
- **فرۆنتئیند:** Vercel (erpiq.systems) بار دەبێت؛ `vercel.json` `/api` → europe (`-ew`)؛ `cloudrun-url.txt` → europe.
- **firebase.json:** هۆستینگی ئاماژە بۆ serviceId نەبوو (`zoho-erp`) دەکرد → **بلۆکی hosting لابرا** (Firebase ئێستا تەنها بۆ داتا).

## 2. هۆکاری بنەڕەتی (بەڵگەدار)

«گواستنەوە بۆ Europe» باکئیندێکی نوێ + داتابەیسێکی نوێی europe (`zoho-erp-prod`) دروستکرد، بەڵام **داتا ڕاستەکانت لە `(default)` @ me-central1 مانەوە**. بۆیە باکئیندی europe داتای ڕاستی نابینێت (یان داتابەیسی هەڵە/بەتاڵ دەخوێنێتەوە، یان ناتوانێت بگاتە DBـی me-central1). باکئیندی ئەسڵی (me-central1، هاوشوێن لەگەڵ داتا) ئێستا گشتی ناکار دەکات. ئەنجام: دابەشبوون بەسەر دوو region/DB = شکست.

## 3. باشترین پێشنیار (لەگەڵ داواکارییەکەت دەگونجێت): یەکخستن لەسەر **me-central1**

**هۆکار:** داتاکەت لە `(default)` @ me-central1ـە (شوێنی DB ناگۆڕدرێت؛ گواستنەوەی +٦٠٠٠ دۆکیومێنت مەترسیدار و بێ سوودە)، و me-central1 (دۆحە) **نزیکترین** بۆ عێراق = باشترین latency. باکئیند هاوشوێن لەگەڵ داتا.

**ئامانجی کۆتایی:**
- **Vercel** = فرۆنتئیند + دۆمەین + هۆستینگ → proxyـی `/api` بۆ باکئیندی me-central1.
- **Cloud Run (me-central1)** = تاکە باکئیند، DBـی `(default)` بەکاردەهێنێت.
- **Firebase** = تەنها `(default)` Firestore + Auth. بێ هۆستینگ. ✅ (کراوە)

## 4. هەنگاوەکانی جێبەجێکردن (بە ڕیز)

**A. [کراوە] firebase.json** — بلۆکی hosting لابرا (Firebase = تەنها داتا).

**B. باکئیند لە me-central1 دووبارە deploy بکە** (ئێستا گشتی وەڵام نادات). لەسەر کۆمپیوتەری خۆت:
```bash
gcloud run deploy zoho-erp-backend --source . \
  --region me-central1 --project zoho-83cda --allow-unauthenticated
```
(هەمان Dockerfile = frontend+backend). دڵنیابە env ئاماژە بۆ DBـی `(default)` دەکات (هیچ override-ی FIRESTORE_DATABASE نەبێت).

**C. مۆڵەتی Firestore + Secret بدە بە service accountـی me-central1** (تۆ جێبەجێی دەکەیت — من ناتوانم IAM بگۆڕم):
```bash
SA=$(gcloud run services describe zoho-erp-backend --region me-central1 \
      --project zoho-83cda --format='value(spec.template.spec.serviceAccountName)')
PROJNUM=$(gcloud projects describe zoho-83cda --format='value(projectNumber)')
SA=${SA:-${PROJNUM}-compute@developer.gserviceaccount.com}
gcloud projects add-iam-policy-binding zoho-83cda --member="serviceAccount:$SA" --role="roles/datastore.user"
gcloud projects add-iam-policy-binding zoho-83cda --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

**D. پشتڕاستبکەرەوە me-central1 وەڵام دەداتەوە:**
```bash
curl https://zoho-erp-backend-6plfqh2hiq-ww.a.run.app/api/live      # → {"status":"alive"}
curl https://zoho-erp-backend-6plfqh2hiq-ww.a.run.app/api/metrics   # → route_count
```

**E. Vercel بۆ me-central1 ئاراستە بکە** (دوای سەرکەوتنی D — **من دەیکەم**): `vercel.json` `/api/*` → `...-ww.a.run.app` + `cloudrun-url.txt`. پاشان Vercel redeploy.

**F. پشتڕاستکردنەوە:** erpiq.systems → داخیلبوون + داشبۆرد داتا پیشان بدات.

**G. پاککردنەوە** (دوای سەرکەوتنی F، تۆ پشتڕاست دەکەیتەوە — سڕینەوەیە):
```bash
gcloud run services delete zoho-erp-backend --region europe-west1 --project zoho-83cda
```
و داتابەیسی `zoho-erp-prod` (europe) بسڕەوە لە کۆنسۆڵ (سەرەتا دڵنیابە بەتاڵە).

## 5. دابەشکردنی کار
- **من دەیکەم (فایل):** firebase.json ✅ ؛ vercel.json + cloudrun-url.txt (لە هەنگاوی E، دوای D).
- **تۆ دەیکەیت (CLI/کۆنسۆڵ):** B (redeploy)، C (IAM)، G (سڕینەوە) — چونکە redeploy و گۆڕینی مۆڵەت و سڕینەوە لە دەستی منا نین.

## 6. تێبینی — جێگرەوەی خێرا (نا-پێشنیارکراو)
ئەگەر پەلەت هەیە: دەکرێ باکئیندی europe چاک بکرێت تا DBـی `(default)` @ me-central1 بخوێنێتەوە (cross-region) + IAM. خێرا کاردەکات، بەڵام latency خراپتر و region دابەشکراو — دژی پلانە پاکەکەت.

*v4 — لەسەر بنەمای داتای زیندووی پشتڕاستکراو. پڕۆژە: zoho-83cda.*
