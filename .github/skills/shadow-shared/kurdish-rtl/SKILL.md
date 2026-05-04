# SKILL: Kurdish RTL & Multi-language

## HTML Setup
```html
<html lang="ckb" dir="rtl">
```

## Tailwind RTL
- استفاده بکە logical properties:
  - `ms-4` (margin-inline-start) ✓
  - `me-4` (margin-inline-end) ✓
  - `ps-4`, `pe-4` ✓
  - **NOT** `ml-4`, `mr-4` ✗

## Fonts
```css
@import url('https://fonts.googleapis.com/css2?family=Vazirmatn:wght@100..900&family=Noto+Sans+Arabic:wght@100..900&display=swap');

body {
  font-family: 'Vazirmatn', 'Noto Sans Arabic', system-ui, sans-serif;
}

/* Latin sections */
.ltr-text {
  font-family: 'Inter', system-ui, sans-serif;
  direction: ltr;
}
```

## Numerals (per locale)
```typescript
new Intl.NumberFormat('ckb-IQ').format(1234567)  // ١٬٢٣٤٬٥٦٧
new Intl.NumberFormat('en-US').format(1234567)   // 1,234,567
```

## Dates
```typescript
new Intl.DateTimeFormat('ckb-IQ', {
  year: 'numeric', month: 'long', day: 'numeric'
}).format(new Date())
```

## Mirror Icons
```css
[dir="rtl"] .icon-chevron-right {
  transform: scaleX(-1);
}
```

## next-intl Setup
```typescript
// i18n/routing.ts
import { defineRouting } from 'next-intl/routing'
export const routing = defineRouting({
  locales: ['ckb', 'ar', 'tr', 'en'],
  defaultLocale: 'ckb',
  localePrefix: 'as-needed',
})
```

## Kurdish-specific characters
- ێ ۆ ڵ ڕ ێ ڤ ـ
- ZWNJ (zero-width non-joiner): `\u200C`
- ZWJ: `\u200D`
- normalize input with `string.normalize('NFC')`
