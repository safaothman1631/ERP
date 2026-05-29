# App Store Listing — Zoho Kurdish ERP

> Spec ref: requirements.md §R5.6, design.md §5.9, tasks.md T-G.5.9. App
> Store Connect allows 40 locales — we ship 3.

---

## Kurdish Sorani (`ku-IQ` — falls back to `en-US` for unsupported regions)

### Title (30 chars)
```
زۆهۆ کوردی - ERP
```

### Subtitle (30 chars) — Apple ASO power slot
```
ERP و POS و حسابات بە کوردی
```

### Keywords (100 chars, comma-separated, no spaces)
```
ERP,POS,حساب,فاکتورە,کوردی,عراق,بازرگانی,zoho,kurdish,محاسبة,inventory,e-fakhata,iraq
```

### Promotional text (170 chars)
```
نوێ: پشتگیری تەواوی فاکتوری ئەلیکترۆنی (e-fakhata) لەگەڵ هاوسەنگکردنی
ئۆتۆماتیکی لەگەڵ سیستەمی وەزارەتی دارایی عێراق.
```

### Description (4000 chars) — mirror Play Store ku-IQ. See `play-store.md#ku`.

---

## Arabic (`ar-SA` — Apple's nearest to Iraqi Arabic locale)

### Title (30 chars)
```
زوهو الكردي - ERP
```

### Subtitle (30 chars)
```
ERP و POS و محاسبة بالكردية
```

### Keywords (100 chars)
```
ERP,POS,محاسبة,فاتورة,كردي,عراق,أعمال,zoho,kurdish,inventory,e-fakhata,iraq,مخزون
```

### Promotional text (170 chars)
```
جديد: دعم كامل للفاتورة الإلكترونية (e-fakhata) مع المزامنة التلقائية
لنظام وزارة المالية العراقية.
```

### Description — mirror Play Store ar-IQ. See `play-store.md#ar`.

---

## English (`en-US`)

### Title (30 chars)
```
Zoho Kurdish ERP & POS
```

### Subtitle (30 chars)
```
ERP, POS, accounting for Iraq
```

### Keywords (100 chars)
```
ERP,POS,accounting,invoice,kurdish,iraq,business,zoho,inventory,e-fakhata,arabic,mobile
```

### Promotional text (170 chars)
```
New: Full e-Fakhata (Iraqi e-invoicing) support with automatic
sync to the Ministry of Finance system.
```

### Description — mirror Play Store en-US. See `play-store.md#en`.

---

## Privacy nutrition labels (App Privacy section)

The Zoho Kurdish ERP collects the following **with user consent**, used
only to provide the service:

- **Contact Info** (name, email, phone) — required for account creation;
  linked to user; not used for tracking.
- **Financial Info** (invoices, transactions) — required for accounting
  features; linked to user; not used for tracking.
- **Identifiers** (device ID, FCM token) — required for push notifications;
  linked to user; not used for tracking.
- **Diagnostics** (crash logs via Crashlytics, performance traces) — used
  for app functionality; not linked to user; not used for tracking.

We do **NOT** collect: precise location, browsing history, search history,
sensitive info, audio data, contacts list, photos.

We do **NOT** share data with third parties for advertising.

---

## Build numbers + version policy

- Version (`CFBundleShortVersionString`): semantic version exposed to user,
  e.g. `1.4.1`.
- Build (`CFBundleVersion`): monotonically increasing integer, bumped on
  every TestFlight upload (Fastlane handles this; see `mobile/ios/fastlane/Fastfile`).

Release notes per `(version, locale)`:

```yaml
# fastlane/metadata/<locale>/release_notes.txt
```

---

## In-app purchases / subscriptions

The mobile app surfaces the same subscription tiers as the web product
(Starter / Growth / Pro). Apple takes 15–30% of subscriptions purchased
through IAP; to avoid this, the mobile app does NOT process IAP — it
opens the marketing site's billing flow in an in-app browser.

This is compliant with App Store Review Guideline 3.1.3(b) "Multiplatform
Services" because the same account is usable across web and mobile.

> If Apple rejects the listing under 3.1.1 / 3.1.3, fall back to Apple IAP
> and absorb the commission — track in the partner-entity fallback doc.
