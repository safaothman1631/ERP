# Requirements Document

## Introduction

ئەم دۆکیومێنتە داواکارییەکانی تەواوی سیستەمی ERP (Enterprise Resource Planning) دیاری دەکات کە لەسەر پرۆژەی ئێستا (React/TypeScript + Python/FastAPI + Firebase/Firestore) دروست دەکرێت. ئامانجەکە باشتر کردنی هەموو لایەنەکانی سیستەمەکەیە — UI/UX، پێرفۆرمانس، سیکوریتی، داتابەیس، لۆجیک، ناڤبار، و تێستینگ — بۆ ئەوەی بگاتە ئاستی پرۆدەکشن.

---

## Glossary

| ووشە | مانا |
|------|------|
| ERP | Enterprise Resource Planning — سیستەمی بەڕێوەبردنی کارگێڕی کۆمپانیا |
| RBAC | Role-Based Access Control — کۆنترۆڵی دەستگەیشتن بەپێی رۆڵ |
| RTL | Right-to-Left — نووسین لە ڕاست بۆ چەپ (کوردی/عەرەبی) |
| JWT | JSON Web Token — تۆکێنی ناسنامەپشتراستکردن |
| MFA | Multi-Factor Authentication — پشتراستکردنی پلەی دووەم |
| PBT | Property-Based Testing — تێستینگی بەپێی تایبەتمەندی |
| CSP | Content Security Policy — سیاسەتی ئەمنیەتی ناوەڕۆک |
| OWASP | Open Web Application Security Project |
| SLA | Service Level Agreement — ڕێکەوتنامەی ئاستی خزمەتگوزاری |
| FCP | First Contentful Paint — یەکەم خاڵی نیشاندانی ناوەڕۆک |
| LCP | Largest Contentful Paint — گەورەترین خاڵی نیشاندانی ناوەڕۆک |
| CLS | Cumulative Layout Shift — گۆڕانی شێوازی کۆمکراو |

---

## Requirements

---

### داواکاری ١: پەرەی سەرەتا (Landing Page) و ناسنامەی براند

**چیرۆکی بەکارهێنەر:** وەکو سەردانکارێکی نوێ، دەمەوێت پەرەیەکی سەرەتای پرۆفیشناڵ و مۆدێرن ببینم کە سیستەمەکە باش ناساندبێت و هەموو تایبەتمەندییەکانی نیشان بداتم، بۆ ئەوەی بتوانم بڕیار بدەم کە تۆمار بکەم.

#### پێوانەی پەسەندکردن

1. WHERE پرۆژەی ئێستا لاندینگ پەیجی نییە، WHEN بەکارهێنەر بچێتە `/` بەبێ لۆگئین، THE سیستەم SHALL ئەوان بگەیەنێت بۆ پەرەی سەرەتای گشتی (marketing landing page) نەک داشبۆرد.
2. WHEN پەرەی سەرەتا بارکرا، THE سیستەم SHALL هیرۆ سێکشنێک نیشان بدات کە ئەنیمەیشنی داخڵبوون (entrance animation) هەبێت بە Framer Motion، لەناو ١٠٠٠ms.
3. THE پەرەی سەرەتا SHALL ئەم بەشانە تێدا بێت: هیرۆ، تایبەتمەندییەکان، پلانەکان، شاهیدەکان، و CTA (Call to Action).
4. WHEN بەکارهێنەر ماوسی بهێنێتە سەر هەر کارتێک، THE سیستەم SHALL ئەنیمەیشنی hover نیشان بدات (scale + shadow) بە CSS transitions.
5. THE پەرەی سەرەتا SHALL بە تەواوی ریسپانسیڤ بێت لە موبایل (320px) تا دێسکتۆپ (1920px+).
6. THE سیستەم SHALL کێرسەری کەستەم نیشان بدات (custom cursor) لە دێسکتۆپ کە لەگەڵ ئەلیمێنتەکان ئینتەراکت دەکات.
7. WHEN بەکارهێنەر کلیکی دەکات لەسەر "دەست پێبکە" یان "تۆمار بکە"، THE سیستەم SHALL بە ئەنیمەیشنی سمۆث بگاتە پەرەی تۆمارکردن.
8. THE پەرەی سەرەتا SHALL پشتگیری زمانی کوردی و ئینگلیزی بکات بە دوگمەی گۆڕینی زمان.

---

### داواکاری ٢: تۆمارکردن و چوونەژوورەوە (Auth Flow)

**چیرۆکی بەکارهێنەر:** وەکو بەکارهێنەرێکی نوێ، دەمەوێت بتوانم بە ئاسانی تۆمار بکەم و چوونەژوورەوەم ئاسان و ئەمن بێت، بۆ ئەوەی بتوانم زووتر دەست بکەم بە کارکردن.

#### پێوانەی پەسەندکردن

1. THE فۆرمی تۆمارکردن SHALL ئەم خانەکانە تێدا بێت: ناوی تەواو، ئیمەیڵ، پاسوۆرد، پشتراستکردنی پاسوۆرد، و ناوی کۆمپانیا.
2. WHEN بەکارهێنەر فۆرمی تۆمارکردن پڕ دەکاتەوە، THE سیستەم SHALL validation ی ریەل-تایم نیشان بدات (inline error messages) بەبێ ئەوەی فۆرمەکە سەبمیت بکرێت.
3. THE پاسوۆرد SHALL ئەم مەرجانە پێویست بکات: کەمترین ٨ پیت، یەک پیتی گەورە، یەک ژمارە، یەک نیشانەی تایبەت.
4. WHEN تۆمارکردن سەرکەوتوو بوو، THE سیستەم SHALL ئیمەیڵی پشتراستکردن بنێرێت و بەکارهێنەر بگەیەنێت بۆ پەرەی ئۆنبۆردینگ.
5. THE فۆرمی چوونەژوورەوە SHALL پشتگیری "بیرت نییە؟" بکات کە ئیمەیڵی ریسێت بنێرێت.
6. WHEN بەکارهێنەر ٥ جار پاسوۆردی هەڵە بنووسێت، THE سیستەم SHALL ئەکاونتەکە بۆ ١٥ خولەک قفڵ بکاتەوە.
7. THE سیستەم SHALL پشتگیری MFA (Multi-Factor Authentication) بکات بە TOTP (Google Authenticator).
8. WHEN بەکارهێنەر چوونەژوورەوەی سەرکەوتوو کرد، THE سیستەم SHALL JWT token بدات کە ئەمرەی ١ ساعەت هەبێت و refresh token بدات کە ئەمرەی ٧ ڕۆژ هەبێت.
9. THE سیستەم SHALL پشتگیری SSO (Single Sign-On) بکات بە Google OAuth 2.0.
10. WHEN بەکارهێنەر لە سیستەمەوە دەردەچێت، THE سیستەم SHALL هەموو tokenەکان بسڕێتەوە و session بکاتەوە.

---

### داواکاری ٣: ئۆنبۆردینگ (Onboarding Flow)

**چیرۆکی بەکارهێنەر:** وەکو بەکارهێنەرێکی نوێ، دەمەوێت پرۆسەی ئۆنبۆردینگ بە ئاسانی و سمۆثی بگوازمەوە، بۆ ئەوەی سیستەمەکە بۆ کۆمپانیاکەم ڕێکبخەم بەبێ گیرماندن.

#### پێوانەی پەسەندکردن

1. THE ئۆنبۆردینگ SHALL ٥ هەنگاو هەبێت: (١) زانیاری کۆمپانیا، (٢) پیشەسازی، (٣) مۆدیوڵەکان، (٤) بەکارهێنەرانی یەکەم، (٥) ڕێکخستنی دارایی.
2. WHEN بەکارهێنەر لە هەنگاوێک بۆ هەنگاوی دیکە دەچێت، THE سیستەم SHALL ئەنیمەیشنی slide transition نیشان بدات.
3. THE progress bar SHALL ئاستی پێشکەوتن نیشان بدات لە هەموو هەنگاوێکدا.
4. WHEN بەکارهێنەر هەنگاوێک تەواو دەکات، THE سیستەم SHALL داتاکە بچەسپێنێت (auto-save) بەبێ ئەوەی بەکارهێنەر دوگمەی "پاشەکەوت" بکاتەوە.
5. THE بەکارهێنەر SHALL بتوانێت بگەڕێتەوە بۆ هەنگاوی پێشوو بەبێ لەدەستدانی داتا.
6. WHEN ئۆنبۆردینگ تەواو بوو، THE سیستەم SHALL داشبۆردی سەرەکی نیشان بدات لەگەڵ checklist ی خوشەویستانەی "گامەکانی دواتر".
7. THE ئۆنبۆردینگ SHALL بتوانرێت لاوەکی (skip) بکرێت و دواتر لە Settings تەواو بکرێت.

---

### داواکاری ٤: UI/UX و سیستەمی دیزاین

**چیرۆکی بەکارهێنەر:** وەکو بەکارهێنەر، دەمەوێت سیستەمەکە جوان و مۆدێرن بێت لەگەڵ ئەنیمەیشن و ئینتەراکشنی سمۆث، بۆ ئەوەی کارکردن لەگەڵیدا خۆشی بێت.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL Framer Motion بەکاربهێنێت بۆ هەموو ئەنیمەیشنەکان (page transitions، modal entrances، list stagger).
2. WHEN بەکارهێنەر لە پەیجێک بۆ پەیجێکی دیکە دەچێت، THE سیستەم SHALL ئەنیمەیشنی fade+slide نیشان بدات لەناو ٣٠٠ms.
3. THE دوگمەکان SHALL ئەنیمەیشنی press (scale down) هەبێت لەکاتی کلیک.
4. THE مۆداڵەکان SHALL ئەنیمەیشنی scale+fade هەبێت لەکاتی کردنەوە و داخستن.
5. THE لیستەکان SHALL stagger animation هەبێت (هەر ئایتەمێک بە ١٠٠ms دواکەوتن دێت).
6. THE سیستەم SHALL dark mode و light mode پشتگیری بکات بە گۆڕینی سمۆث.
7. THE سیستەم SHALL کێرسەری کەستەم (custom cursor) هەبێت لە دێسکتۆپ کە لەگەڵ ئەلیمێنتەکان ئینتەراکت دەکات.
8. THE سیستەم SHALL skeleton loading نیشان بدات لەکاتی بارکردنی داتا.
9. THE سیستەم SHALL toast notifications بەکاربهێنێت بۆ feedback ی کردارەکان.
10. THE سیستەم SHALL بە تەواوی ریسپانسیڤ بێت لە موبایل، تابلێت، و دێسکتۆپ.
11. THE سیستەم SHALL پشتگیری RTL (ڕاست بۆ چەپ) بکات بۆ کوردی.
12. WHERE بەکارهێنەر ئینتەرنێتی لەدەست دات، THE سیستەم SHALL offline indicator نیشان بدات.

---

### داواکاری ٥: پێرفۆرمانس

**چیرۆکی بەکارهێنەر:** وەکو بەکارهێنەر، دەمەوێت سیستەمەکە خێرا بار بکات و بەبێ گیرماندن کار بکات، بۆ ئەوەی کارەکانم بە ئاسانی بکەم.

#### پێوانەی پەسەندکردن

1. THE پەرەی سەرەتا SHALL FCP (First Contentful Paint) کەمتر لە ١.٥ چرکە هەبێت لە شبکەی ٤G.
2. THE داشبۆرد SHALL LCP (Largest Contentful Paint) کەمتر لە ٢.٥ چرکە هەبێت.
3. THE سیستەم SHALL CLS (Cumulative Layout Shift) کەمتر لە ٠.١ هەبێت.
4. THE سیستەم SHALL code splitting بەکاربهێنێت بۆ هەموو رووتەکان (lazy loading).
5. THE سیستەم SHALL virtual scrolling بەکاربهێنێت بۆ لیستەکانی زیاتر لە ١٠٠ ئایتەم.
6. THE سیستەم SHALL API responses cache بکات بە React Query لەگەڵ stale-while-revalidate.
7. THE سیستەم SHALL images optimize بکات (WebP، lazy loading، responsive sizes).
8. THE backend SHALL API responses لەناو ٢٠٠ms بگەیەنێت بۆ ٩٥٪ی داواکارییەکان.
9. THE سیستەم SHALL database queries optimize بکات بە Firestore indexes.
10. THE سیستەم SHALL bundle size کەمتر لە ٢٠٠KB (gzipped) بۆ initial load هەبێت.

---

### داواکاری ٦: سیکوریتی

**چیرۆکی بەکارهێنەر:** وەکو بەڕێوەبەری سیستەم، دەمەوێت داتاکانی کۆمپانیاکەم بە تەواوی ئەمن بێت لە هەموو جۆرە هێرشێکەوە، بۆ ئەوەی متمانەم بێت بە سیستەمەکە.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL OWASP Top 10 پاراستن بکات (XSS، CSRF، SQL Injection، etc.).
2. THE سیستەم SHALL CSP headers بەکاربهێنێت بۆ پاراستن لە XSS.
3. THE سیستەم SHALL هەموو API endpoints بە JWT authentication پارێزێت.
4. THE سیستەم SHALL rate limiting بەکاربهێنێت (١٠٠ داواکاری لە خولەکێکدا بۆ هەر IP).
5. THE سیستەم SHALL هەموو داتای هەستیار encrypt بکات (AES-256) لە Firestore.
6. THE سیستەم SHALL audit log بنووسێت بۆ هەموو کردارە گرینگەکان.
7. THE سیستەم SHALL CORS بە دروستی ڕێکبخات (تەنها domain ی دیاریکراو).
8. THE سیستەم SHALL Firestore Security Rules بەکاربهێنێت بۆ دەستگەیشتنی ئاستی داتابەیس.
9. THE سیستەم SHALL dependency scanning بەکاربهێنێت (Dependabot) بۆ CVE detection.
10. THE سیستەم SHALL secrets هەرگیز لە کۆد نەنووسێت (environment variables بەکاربهێنێت).
11. WHEN هێرشی brute-force دیاری کرا، THE سیستەم SHALL ئەو IP ەی بۆ ٢٤ ساعەت بلۆک بکات.
12. THE سیستەم SHALL HTTPS بەکاربهێنێت بۆ هەموو پەیوەندییەکان.

---

### داواکاری ٧: داتابەیس و API

**چیرۆکی بەکارهێنەر:** وەکو دێڤەلۆپەر، دەمەوێت داتابەیسەکە باش دیزاین کرابێت و API ەکان ڕوون و ئاسان بن، بۆ ئەوەی بتوانم زووتر تایبەتمەندییە نوێیەکان زیاد بکەم.

#### پێوانەی پەسەندکردن

1. THE Firestore schema SHALL بۆ هەموو مۆدیوڵەکان دیاری کرابێت لەگەڵ indexes ی پێویست.
2. THE API SHALL RESTful بێت لەگەڵ OpenAPI 3.0 documentation.
3. THE API endpoints SHALL versioning هەبێت (`/api/v1/`).
4. THE سیستەم SHALL real-time updates بەکاربهێنێت بە Firestore onSnapshot بۆ داتای گرینگ.
5. THE API SHALL pagination هەبێت بۆ هەموو لیستەکان (cursor-based pagination).
6. THE API SHALL filtering و sorting پشتگیری بکات بۆ هەموو لیستەکان.
7. THE سیستەم SHALL soft delete بەکاربهێنێت (is_deleted flag) نەک hard delete.
8. THE سیستەم SHALL optimistic updates بەکاربهێنێت بۆ باشتر کردنی UX.
9. THE API SHALL error responses standardized بێت (RFC 7807 Problem Details).
10. THE سیستەم SHALL database transactions بەکاربهێنێت بۆ کردارە گرینگەکان.
11. THE سیستەم SHALL Firestore Security Rules بنووسێت بۆ هەموو collection ەکان.
12. THE API SHALL request/response validation بەکاربهێنێت بە Pydantic.

---

### داواکاری ٨: مۆدیوڵی فرۆشتن (Sales)

**چیرۆکی بەکارهێنەر:** وەکو بەڕێوەبەری فرۆشتن، دەمەوێت بتوانم پرۆسەی فرۆشتن لە سەرەتا تا کۆتا بەڕێوە ببەم، بۆ ئەوەی داهاتەکانم باشتر بشارمەوە.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL workflow ی فرۆشتن پشتگیری بکات: Quote → Sales Order → Invoice → Payment.
2. THE سیستەم SHALL بتوانێت quote بدرێتە invoice بە یەک کلیک.
3. THE سیستەم SHALL price lists پشتگیری بکات (کەستەمەر-تایبەت، دەورە-تایبەت).
4. THE سیستەم SHALL discount management پشتگیری بکات (بڕ و ڕێژە).
5. THE سیستەم SHALL recurring invoices پشتگیری بکات (ئایانە، مانگانە، ساڵانە).
6. THE سیستەم SHALL credit notes و refunds پشتگیری بکات.
7. THE سیستەم SHALL sales reports نیشان بدات (بە کەستەمەر، بە کاڵا، بە دەورە).
8. WHEN invoice پارەدانەکەی تێپەڕی، THE سیستەم SHALL ئاگادارکردنەوە بنێرێت.
9. THE سیستەم SHALL multi-currency پشتگیری بکات (IQD، USD، EUR).
10. THE سیستەم SHALL e-invoice پشتگیری بکات بۆ داواکارییەکانی عێراق.

---

### داواکاری ٩: مۆدیوڵی کڕین (Purchasing)

**چیرۆکی بەکارهێنەر:** وەکو بەڕێوەبەری کڕین، دەمەوێت بتوانم هەموو پرۆسەی کڕین بەڕێوە ببەم لە داواکاری تا پارەدان، بۆ ئەوەی خەرجییەکانم کۆنترۆڵ بکەم.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL workflow ی کڕین پشتگیری بکات: Purchase Order → Receive → Bill → Payment.
2. THE سیستەم SHALL vendor management پشتگیری بکات لەگەڵ ئەرشیفی کڕین.
3. THE سیستەم SHALL 3-way matching پشتگیری بکات (PO + Receipt + Bill).
4. THE سیستەم SHALL vendor credits و returns پشتگیری بکات.
5. THE سیستەم SHALL purchase reports نیشان بدات (بە فرۆشیار، بە کاڵا، بە دەورە).
6. THE سیستەم SHALL approval workflow بۆ PO ی گەورە پشتگیری بکات.
7. THE سیستەم SHALL vendor portal پشتگیری بکات بۆ ئەوەی فرۆشیارەکان PO ی خۆیان ببینن.

---

### داواکاری ١٠: مۆدیوڵی ئەکاونتینگ (Accounting)

**چیرۆکی بەکارهێنەر:** وەکو ژمێریار، دەمەوێت بتوانم هەموو کردارە دارایییەکان تۆمار بکەم و ڕاپۆرتی دارایی دروست بکەم، بۆ ئەوەی دۆخی دارایی کۆمپانیاکەم ببینم.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL double-entry bookkeeping پشتگیری بکات.
2. THE سیستەم SHALL chart of accounts پشتگیری بکات لەگەڵ ئاستی چەندین.
3. THE سیستەم SHALL journal entries پشتگیری بکات (manual و automatic).
4. THE سیستەم SHALL bank reconciliation پشتگیری بکات.
5. THE سیستەم SHALL ئەم ڕاپۆرتانە دروست بکات: Balance Sheet، P&L، Cash Flow، Trial Balance.
6. THE سیستەم SHALL fiscal year management پشتگیری بکات.
7. THE سیستەم SHALL tax management پشتگیری بکات (VAT، withholding tax).
8. THE سیستەم SHALL multi-currency revaluation پشتگیری بکات.
9. THE سیستەم SHALL analytic accounts پشتگیری بکات بۆ cost center tracking.
10. THE سیستەم SHALL budget management پشتگیری بکات لەگەڵ variance analysis.

---

### داواکاری ١١: مۆدیوڵی ئینڤێنتۆری (Inventory)

**چیرۆکی بەکارهێنەر:** وەکو بەڕێوەبەری کۆگا، دەمەوێت بتوانم ئەستۆکەکانم بشارمەوە و کۆنترۆڵ بکەم، بۆ ئەوەی هەرگیز کاڵا کەم نەبێت یان زیادە نەبێت.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL multi-warehouse management پشتگیری بکات.
2. THE سیستەم SHALL stock locations (bin/shelf) پشتگیری بکات.
3. THE سیستەم SHALL serial numbers و lot tracking پشتگیری بکات.
4. THE سیستەم SHALL cycle counts و physical inventory پشتگیری بکات.
5. THE سیستەم SHALL reorder rules (min/max) پشتگیری بکات.
6. THE سیستەم SHALL putaway rules پشتگیری بکات.
7. THE سیستەم SHALL inventory valuation (FIFO، Average Cost) پشتگیری بکات.
8. THE سیستەم SHALL shipments و delivery challans پشتگیری بکات.
9. THE سیستەم SHALL inventory reports نیشان بدات (stock aging، movement، valuation).
10. WHEN ئەستۆک لە ئاستی reorder کەمتر بوو، THE سیستەم SHALL ئاگادارکردنەوە بنێرێت.

---

### داواکاری ١٢: مۆدیوڵی HR و پارەدانی کارمەندان (HR & Payroll)

**چیرۆکی بەکارهێنەر:** وەکو بەڕێوەبەری HR، دەمەوێت بتوانم زانیاری کارمەندانم بەڕێوە ببەم و پارەدانی مانگانەیان بە ئاسانی ئامادە بکەم، بۆ ئەوەی کارمەندەکانم بە کاتی خۆی پارەیان وەربگرن.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL employee profiles پشتگیری بکات لەگەڵ هەموو زانیاریەکان.
2. THE سیستەم SHALL contracts management پشتگیری بکات.
3. THE سیستەم SHALL attendance tracking پشتگیری بکات (check-in/out).
4. THE سیستەم SHALL leave management پشتگیری بکات (مۆڵەت، نەخۆشی، etc.).
5. THE سیستەم SHALL payroll rules پشتگیری بکات (بنچینە، زیادەکاری، کەمکردنەوە).
6. THE سیستەم SHALL payroll runs پشتگیری بکات لەگەڵ payslips.
7. THE سیستەم SHALL HR reports نیشان بدات (headcount، turnover، cost).
8. THE سیستەم SHALL پشتگیری بکات بۆ داواکارییەکانی عێراق (social security، income tax).

---

### داواکاری ١٣: مۆدیوڵی CRM

**چیرۆکی بەکارهێنەر:** وەکو نوێنەری فرۆشتن، دەمەوێت بتوانم leads و opportunities بشارمەوە و پرۆسەی فرۆشتن بەڕێوە ببەم، بۆ ئەوەی زیاتر فرۆشتن بکەم.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL lead management پشتگیری بکات (capture، qualify، convert).
2. THE سیستەم SHALL pipeline view (Kanban) پشتگیری بکات.
3. THE سیستەم SHALL activity tracking پشتگیری بکات (calls، emails، meetings).
4. THE سیستەم SHALL CRM reports و insights نیشان بدات.
5. THE سیستەم SHALL lead scoring پشتگیری بکات.
6. THE سیستەم SHALL email integration پشتگیری بکات.

---

### داواکاری ١٤: رۆڵ و مۆڵەتەکان (RBAC)

**چیرۆکی بەکارهێنەر:** وەکو بەڕێوەبەری سیستەم، دەمەوێت بتوانم دەستگەیشتنی هەر بەکارهێنەرێک بە تەواوی کۆنترۆڵ بکەم، بۆ ئەوەی هەر کەسێک تەنها ئەوەی پێویستیەتی ببینێت.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL role-based access control (RBAC) بەکاربهێنێت.
2. THE سیستەم SHALL ئەم رۆڵە پێشبینیکراوانە هەبێت: Super Admin، Admin، Manager، Accountant، Sales Rep، HR، Viewer.
3. THE بەڕێوەبەر SHALL بتوانێت رۆڵی کەستەم دروست بکات.
4. THE مۆڵەتەکان SHALL بە ئاستی module، action (create/read/update/delete)، و record دیاری بکرێن.
5. WHEN بەکارهێنەر هەوڵ دات بچێتە پەرەیەک کە مۆڵەتی نییە، THE سیستەم SHALL پەرەی "دەستگەیشتن ڕەتکراوەتەوە" نیشان بدات.
6. THE سیستەم SHALL field-level permissions پشتگیری بکات (هەندێک خانە تەنها بۆ رۆڵی دیاریکراو دیاری بن).
7. THE سیستەم SHALL permission inheritance پشتگیری بکات (رۆڵی کەستەم لە رۆڵی بنچینەوە وەرگرێت).
8. THE سیستەم SHALL audit log بنووسێت بۆ هەموو گۆڕانکارییەکانی مۆڵەت.

---

### داواکاری ١٥: ناڤبار و ڕووتینگ (Navigation & Routing)

**چیرۆکی بەکارهێنەر:** وەکو بەکارهێنەر، دەمەوێت هەموو لینکەکانی ناڤبار کار بکەن و هیچ ٤٠٤ نەبینم، بۆ ئەوەی بتوانم بە ئاسانی لە سیستەمەکەدا بگەڕێم.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL هەموو لینکەکانی ناڤبار بە رووتی دیاریکراو map بکات.
2. WHERE لینکێک لە ناڤبار هەیە بەبێ رووتی دیاریکراو، THE سیستەم SHALL ئەو لینکە لابدات یان placeholder page دروست بکات.
3. THE "Workflow" بەشی Settings SHALL رووتی `/settings?s=workflows` هەبێت و پەرەی تەواوی هەبێت.
4. THE numbering بەشی Settings SHALL رووتی `/settings?s=numbering` هەبێت و بە دروستی کار بکات.
5. THE سیستەم SHALL breadcrumb navigation نیشان بدات بۆ هەموو پەرەکان.
6. THE سیستەم SHALL command palette (Ctrl+K) پشتگیری بکات بۆ خێرا گەڕان.
7. WHEN بەکارهێنەر بچێتە رووتێکی نەبوو، THE سیستەم SHALL پەرەی 404 ی جوان نیشان بدات لەگەڵ لینکی گەڕانەوە.
8. THE سیستەم SHALL deep linking پشتگیری بکات (URL بتوانرێت share بکرێت).
9. THE ناڤبار SHALL بتوانرێت collapse بکرێت بۆ زیاتر شوێن بۆ ناوەڕۆک.
10. THE سیستەم SHALL favorites/bookmarks پشتگیری بکات بۆ پەرەکانی زۆر بەکارهاتوو.

---

### داواکاری ١٦: تێستینگ و کوالیتی

**چیرۆکی بەکارهێنەر:** وەکو دێڤەلۆپەر، دەمەوێت سیستەمەکە بە تەواوی تێست کرابێت لە هەموو لایەنێکەوە، بۆ ئەوەی متمانەم بێت کە هیچ bug ێک لە پرۆدەکشن نەبێت.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL unit tests هەبێت بۆ هەموو utility functions و business logic (کەمترین ٨٠٪ coverage).
2. THE سیستەم SHALL integration tests هەبێت بۆ هەموو API endpoints.
3. THE سیستەم SHALL E2E tests هەبێت بە Playwright بۆ هەموو critical user journeys.
4. THE سیستەم SHALL property-based tests هەبێت بۆ ئەم تایبەتمەندییانە:
   - هەموو invoice ێک کە دروست دەکرێت دەبێت total ی دروست هەبێت (sum of line items + tax - discount).
   - هەموو journal entry ێک دەبێت balanced بێت (debits = credits).
   - هەموو stock movement ێک دەبێت stock balance ی دروست بگوازێتەوە.
   - هەموو permission check ێک دەبێت consistent بێت (RBAC invariants).
5. THE سیستەم SHALL performance tests هەبێت (Lighthouse CI) بۆ هەموو پەرەکانی گرینگ.
6. THE سیستەم SHALL security tests هەبێت (OWASP ZAP) بۆ هەموو API endpoints.
7. THE CI/CD pipeline SHALL هەموو تێستەکان ئەجرا بکات پێش هەر deploy.
8. THE سیستەم SHALL visual regression tests هەبێت بۆ کۆمپۆنێنتە گرینگەکان.
9. WHEN هەر تێستێک شکست هێنا، THE CI/CD pipeline SHALL deploy ڕەت بکاتەوە.
10. THE سیستەم SHALL test coverage report دروست بکات لە هەموو CI run ێکدا.

---

### داواکاری ١٧: پرۆدەکشن و دیپلۆی

**چیرۆکی بەکارهێنەر:** وەکو DevOps، دەمەوێت سیستەمەکە بە ئاسانی deploy بکرێت و لە پرۆدەکشن باش کار بکات، بۆ ئەوەی downtime نەبێت.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL CI/CD pipeline هەبێت بە GitHub Actions.
2. THE سیستەم SHALL Docker containers بەکاربهێنێت بۆ backend.
3. THE سیستەم SHALL environment variables بۆ هەموو configuration بەکاربهێنێت.
4. THE سیستەم SHALL health check endpoint هەبێت (`/health`).
5. THE سیستەم SHALL structured logging بەکاربهێنێت (JSON format).
6. THE سیستەم SHALL error monitoring بەکاربهێنێت (Sentry).
7. THE سیستەم SHALL uptime monitoring هەبێت.
8. THE سیستەم SHALL database backups ئۆتۆماتیکی هەبێت (ڕۆژانە).
9. THE سیستەم SHALL zero-downtime deployments پشتگیری بکات.
10. THE سیستەم SHALL rollback mechanism هەبێت بۆ کاتی کێشە.

---

### داواکاری ١٨: زمان و لۆکەلایزەیشن

**چیرۆکی بەکارهێنەر:** وەکو بەکارهێنەری کوردستانی، دەمەوێت سیستەمەکە بە کوردی کار بکات و هەموو نووسینەکان بە کوردی بن، بۆ ئەوەی ئاسانتر بتوانم بەکاری بهێنم.

#### پێوانەی پەسەندکردن

1. THE سیستەم SHALL پشتگیری زمانی کوردی (Sorani) و ئینگلیزی بکات.
2. THE سیستەم SHALL RTL layout بۆ کوردی بەکاربهێنێت.
3. THE سیستەم SHALL ژمارەکان بە فۆرماتی کوردی نیشان بدات (کۆمای هەزار، خاڵی دەیی).
4. THE سیستەم SHALL بەرواری کوردی پشتگیری بکات.
5. THE سیستەم SHALL زمان بتوانرێت لە هەر کاتێکدا گۆڕدرێت بەبێ reload.
6. THE سیستەم SHALL هەموو پەیامەکانی هەڵە و سەرکەوتن بە زمانی هەڵبژێردراو نیشان بدات.

---

## تایبەتمەندییەکانی دروستی (Correctness Properties)

ئەم تایبەتمەندییانە دەبێت بە property-based testing پشتراست بکرێن:

### P1: دوازانی ژمارەکانی Invoice
```
∀ invoice i: i.total = sum(i.lines[*].amount) + i.tax_amount - i.discount_amount
```

### P2: هاوسەنگی Journal Entry
```
∀ journal_entry j: sum(j.debits) = sum(j.credits)
```

### P3: دروستی Stock Balance
```
∀ product p, warehouse w: stock_balance(p, w) = initial_stock + sum(in_movements) - sum(out_movements)
```

### P4: RBAC Invariants
```
∀ user u, resource r, action a:
  can_access(u, r, a) ↔ ∃ role ∈ u.roles: permission(role, r, a) = true
```

### P5: دروستی Audit Trail
```
∀ action a performed by user u: ∃ audit_log_entry e: e.user_id = u.id ∧ e.action = a ∧ e.timestamp ≤ now()
```

### P6: دروستی Token Expiry
```
∀ JWT token t: is_valid(t) ↔ t.exp > now() ∧ t.signature_valid ∧ ¬is_revoked(t)
```
