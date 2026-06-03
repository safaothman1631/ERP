# Checklist-ی پشتڕاستکردنی e-Fakhata لەگەڵ وەزارەتی دارایی (MoF Verification)

> **مەبەست:** ئەو کۆدی e-Fakhata کە ئێستا هەیە لەسەر **draft spec** بنیاتنراوە — زۆر شوێن بە `# TODO: verify against published spec (R7.X)` نیشانکراون و هەموو نرخی باج `placeholder: True`ـن. ئەم checklist-ـە بۆ کەسی ops/compliance + ژمێریار + ڕاوێژکاری یاسایی-ی باجە تا زانیاری فەرمی لە **وەزارەتی دارایی عێراق (MoF)** وەربگرن و کۆد لەگەڵ spec-ی فەرمی یەک بخەنەوە.
>
> **خاوەن:** Accountant / Compliance Officer + Senior Backend.
> **ئاکام:** هەر `# TODO: verify (R7.X)` چارەسەر بکرێت، هەموو `placeholder=True` بکرێتە `False`.

---

## بەشی A — دۆکیومێنت/spec-ی فەرمی وەربگرە (Artifacts to Obtain)

- [ ] **A1.** کۆپیی فەرمی/بەستەری published spec-ی e-Fakhata (وەشانی ئێستا) — بە PDF/HTML.
- [ ] **A2.** **XSD/schema file**ـی فەرمی (XML Schema Definition) — بۆ validation-ی ڕاستەقینە.
- [ ] **A3.** نموونەی فاکتوری XML-ـی پەسەندکراو (sample signed invoice) لە MoF.
- [ ] **A4.** ڕێنماییەکانی واژۆ (signing guidelines) — جۆری cert، CA، algorithm.
- [ ] **A5.** ڕێنماییەکانی API/endpoint (submission protocol، authentication).
- [ ] **A6.** بەرنامەی پابەندبوون (compliance timeline) — کێ + کەی پێویستی بە e-Fakhata هەیە (threshold بەپێی قەبارە/کەرت).
- [ ] **A7.** پرۆسەی تۆمارکردن (onboarding/registration) بۆ ببیتە issuer-ی پەسەندکراو.

---

## بەشی B — Schema XML + Namespace (پشتڕاستکردنی wire-format)

> کۆدی ئێستا: `backend/app/efakhata/schema.py` + `version_registry.py`. ئەمانە دەبێت پشتڕاست بکرێن:

- [ ] **B1.** **Namespace URI** — کۆد ئێستا: `http://efakhata.mof.gov.iq/schema/v1` (**placeholder، R7.X**). ✅ URI-ـی ڕاستەقینەی MoF بزانە.
- [ ] **B2.** **Schema version** — کۆد ئێستا: `"1.0"` (root attribute `schemaVersion`). ✅ وەشانی ڕاستەقینە + چۆن نووسرێت (attribute یان element؟ R7.X).
- [ ] **B3.** **ناوی ڕووتی element** — کۆد: `Invoice`. ✅ پشتڕاست بکە.
- [ ] **B4.** **element vs attribute split** — کۆد `schemaVersion` و `Line number` وەک attribute داناوە (R7.X). ✅ پشتڕاست بکە کام field attribute-ـە و کام element.
- [ ] **B5.** **ناوی فیلدەکان** — هەمووی پشتڕاست بکە (کۆد PascalCase بەکاردەهێنێت):
  - Header: `InvoiceID`, `InvoiceNumber`, `IssueDate`, `InvoiceType`, `Currency`, `ExchangeRate`, `PaymentMethod`, `Reference`.
  - Party: `Supplier`/`Customer` → `Name`, `TaxID`, `Phone`, `Email`, `Address`(`Street`,`City`,`Governorate`,`PostalCode`,`Country`).
  - Line: `Description`, `ItemCode`, `Quantity`, `UnitPrice`, `DiscountAmount`, `TaxRate`, `TaxAmount`, `LineTotal`.
  - Totals: `Subtotal`, `DiscountAmount`, `VATAmount`, `WHTAmount`, `OtherTaxes`, `GrandTotal`.
- [ ] **B6.** **InvoiceType values** — کۆد: `standard | credit_note | debit_note`. ✅ کۆدەکانی ڕاستەقینەی MoF بزانە.
- [ ] **B7.** **PaymentMethod values** — کۆد: `cash | card | bank_transfer | credit | cod | other`. ✅ پشتڕاست بکە.
- [ ] **B8.** **ناوی پارێزگاکان (Governorate)** — کۆد slug-ـی ئینگلیزی بەکاردەهێنێت (`baghdad`, `erbil`...) بەڵام MoF لەوانەیە **ناوی عەرەبی** یان کۆدی فەرمی بخوازێت (R7.1). ✅ فۆرماتی ڕاستەقینە بزانە (١٨ پارێزگا).
- [ ] **B9.** **فۆرماتی ژمارە/Decimal** — کۆد ٢ خانەی دوای خاڵ (places) بۆ پارە، ٤ بۆ quantity، ٦ بۆ exchange_rate. ✅ precision-ـی داواکراو پشتڕاست بکە.
- [ ] **B10.** **دراو (Currency)** — کۆد: `IQD | USD | EUR` لەگەڵ `ExchangeRate`. ✅ ئایا MoF دراوی دیکە قبوڵ دەکات؟ ڕێسای exchange rate چییە؟
- [ ] **B11.** **فیلدە مەرجدارەکان (required vs optional)** — کۆد: customer ئیختیاری بۆ B2C، tax_id-ـی supplier مەرج. ✅ پشتڕاست بکە کام field MoF مەرج دەکات.
- [ ] **B12.** **encoding/declaration** — کۆد: UTF-8 + `standalone=True`. ✅ پشتڕاست بکە.

---

## بەشی C — واژۆ + Certificate (Signing & Cert Requirements)

> کۆدی ئێستا: `backend/app/efakhata/signing.py` + `cert_storage.py`.

- [ ] **C1.** **پرۆفایلی واژۆ** — کۆد: **XAdES-BES** (signxml 4.x) لەگەڵ fallback بۆ plain XML-DSig. ✅ پشتڕاست بکە MoF XAdES-BES دەخوازێت یان پرۆفایلێکی تر (XAdES-T بە timestamp؟).
- [ ] **C2.** **Algorithm** — کۆد: `rsa-sha256` + digest `sha256`، enveloped method. ✅ پشتڕاست بکە.
- [ ] **C3.** **Signature namespaces** — کۆد: `ds: http://www.w3.org/2000/09/xmldsig#` + `xades: http://uri.etsi.org/01903/v1.3.2#`. ✅ پشتڕاست بکە.
- [ ] **C4.** **جۆری Certificate** — کۆد: **PKCS#12** (.p12)، **self-signed** کە trust-ـی out-of-band بە تۆمارکردن لای MoF دەبێت. ✅ پشتڕاست بکە: ئایا MoF cert-ـی self-signed قبوڵ دەکات، یان دەبێت لە **CA-یەکی فەرمی/حکومی** بێت؟ ئەمە بنەمایی‌یە.
- [ ] **C5.** **تۆمارکردنی cert** — چۆن issuer cert-ـی خۆی لای MoF تۆمار دەکات؟ (پرۆسە + فۆرم + کات).
- [ ] **C6.** **SigningTime / claimed role** — کۆد: `claimed_roles=["Issuer"]`، signxml خۆی SigningTime دادەنێت. ✅ پشتڕاست بکە MoF چی دەخوازێت.
- [ ] **C7.** **شوێنی Signature element** — کۆد: enveloped (لەناو ڕووتی Invoice). ✅ پشتڕاست بکە (enveloped vs detached vs enveloping).
- [ ] **C8.** **Canonicalization (C14N)** — کام وەشانی C14N؟ ✅ پشتڕاست بکە (signxml default).
- [ ] **C9.** **رۆتاندنی cert (rotation/expiry)** — سیاسەتی نوێکردنەوەی cert چییە لای MoF؟

---

## بەشی D — Endpoints + Submission Protocol

> کۆدی ئێستا: `backend/app/efakhata/mof_client.py` + `submission_queue.py` (HTTPS + mTLS + `Idempotency-Key`، state machine، exponential backoff).

- [ ] **D1.** **Base URL** — کۆد: env var `MOF_BASE` (نییە → `MoFNotConfigured`). ✅ URL-ـی ڕاستەقینەی production + sandbox/test.
- [ ] **D2.** **Authentication** — چۆن؟ (mTLS؟ API key؟ OAuth؟ کۆد ئێستا mTLS فەرز دەکات).
- [ ] **D3.** **Submission endpoint** — path + HTTP method + content-type بۆ نووسینی فاکتور.
- [ ] **D4.** **Response format** — MoF چی دەگەڕێنێتەوە؟ (acknowledgement ID, UUID, QR, status).
- [ ] **D5.** **Status/acknowledgement** — چۆن دۆخی فاکتور بپرسرێت (acknowledged/rejected)؟ endpoint جیا؟
- [ ] **D6.** **Idempotency** — کۆد: `Idempotency-Key` بەکاردەهێنێت. ✅ پشتڕاست بکە MoF چۆن duplicate دەگرێت.
- [ ] **D7.** **Rate limits / timeouts** — کۆد: 30s timeout، 3 retries، backoff (1m/5m/30m/2h/12h، MAX 5). ✅ سنوورەکانی MoF بزانە.
- [ ] **D8.** **هەڵە/Error codes** — لیستی error code-ەکانی MoF + واتایان.
- [ ] **D9.** **QR / human-readable** — ئایا فاکتور پێویستی بە QR code/UUID-ی چاپکراو هەیە لەسەر ڕیسیت؟
- [ ] **D10.** **کاتی واقیعی (real-time vs batch)** — ئایا submission دەبێت کاتی-ڕاست بێت یان batch ڕێگەپێدراوە؟

---

## بەشی E — نرخی باج (Tax Rates — R7.1)

> کۆدی ئێستا: `backend/app/data/iraqi_tax_presets.py` + `backend/app/tax/withholding.py`. **هەمووی `placeholder=True`.** پێویستی بە پشتڕاستکردنی ژمێیاری مۆڵەتدار لە عێراق/هەرێم.

- [ ] **E1.** **VAT** — کۆد: `0.0٪` بۆ هەموو پارێزگا («Iraq has no broad VAT today»). ✅ پشتڕاست بکە — ئایا VAT هەیە/دێت؟ نرخ چەندە؟
- [ ] **E2.** **Withholding (WHT)** — کۆد placeholders: خزمەتگوزاری `3٪`، کرێ `5٪`، کەرەستە `2٪`، تر `0٪`. ✅ نرخی ڕاستەقینەی WHT بەپێی جۆر.
- [ ] **E3.** **باجی فرۆشتنی کەرتی** — کۆد placeholders: میوانداری `10٪`، پەیوەندی(telecom) `20٪`، جگەرە(excise) `300٪`. ✅ پشتڕاست بکە.
- [ ] **E4.** **جیاوازی KRG vs Federal** — کۆد `krg_region` flag هەیە بەڵام نرخی جیاوازی نییە. ✅ ئایا هەرێمی کوردستان نرخی باجی جیاوازی هەیە؟
- [ ] **E5.** **جیاوازی ١٨ پارێزگا** — ئایا باج بەپێی پارێزگا دەگۆڕێت یان نیشتمانییە؟
- [ ] **E6.** **threshold-ی باج** — ئایا threshold-ی registration بۆ باج هەیە (بەپێی گردنەی فرۆش)؟
- [ ] **E7.** **چۆن باج لە فاکتور پیشان بدرێت** — MoF چۆن دەخوازێت VAT/WHT/excise لە XML جیا بکرێتەوە؟

---

## بەشی F — جێبەجێکردن دوای پشتڕاستکردن (Post-Verification Actions)

- [ ] **F1.** نوێکردنەوەی `NS_EFK` + `NSMAP` لە `schema.py` (ئەگەر گۆڕا).
- [ ] **F2.** نوێکردنەوەی ناوی field/element/attribute لە `schema.py` (`to_xml`/`from_xml`).
- [ ] **F3.** نوێکردنەوەی `version_registry.py` (`namespace_uri` + `notes` + flip `placeholder`).
- [ ] **F4.** نوێکردنەوەی signing لە `signing.py` (ئەگەر CA/profile/algorithm گۆڕا).
- [ ] **F5.** نوێکردنەوەی `mof_client.py` (URL، auth، endpoints، error handling).
- [ ] **F6.** نوێکردنەوەی نرخەکان لە `iraqi_tax_presets.py` + `withholding.py` + flip `placeholder=False`.
- [ ] **F7.** validation لەگەڵ **XSD-ی فەرمی** (A2) — نموونەی XML-ی کۆد دەبێت validate بکات.
- [ ] **F8.** test submission بۆ **sandbox/test endpoint**ـی MoF (D1) + پشتڕاستکردنی acknowledgement.
- [ ] **F9.** نوێکردنەوەی تێستەکان (`backend/tests/test_efakhata_*.py`) بەپێی spec-ی نوێ.
- [ ] **F10.** لابردنی هەموو `# TODO: verify against published spec (R7.X)` کاتێک چارەسەرکران.

---

## تێبینی گرینگ

1. **بلۆکی دەرەکی:** بەشی A–E هەموویان پێویستیان بە دەستگەیشتن بە MoF/سەرچاوەی فەرمی هەیە — ERPIQ ناتوانێت بەبێ ئەمە تەواوی بکات. ئەمە دەبێت لەگەڵ کیانی یاسایی + ژمێیاری ناوخۆیی هاوتەریب ببرێت.
2. **مەترسی بنەمایی:** **C4** (self-signed vs CA cert) — ئەگەر MoF cert-ـی فەرمی/حکومی بخوازێت، پێویستی بە گۆڕانکاریی گەورەی `cert_storage.py` + پرۆسەی procurement هەیە.
3. **هیچ نرخی باج نابێت بێ پشتڕاستکردنی ژمێیار بگۆڕدرێت** — ئەمە کاریگەری یاسایی/دارایی لەسەر کڕیار هەیە.
