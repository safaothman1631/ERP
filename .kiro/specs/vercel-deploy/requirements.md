# Requirements: Vercel Deployment

## Introduction

Frontend ـی React/Vite ـەکە (ئێستا لە Firebase Hosting) بخەیتە سەر Vercel ژێر ئەکاونتی `safaothman1631s-projects`. Backend (FastAPI لە Cloud Run) نەگۆڕێت.

---

## Requirements

### Requirement 1: vercel.json Configuration

**User Story:** وەک developer، دەمەوێت `vercel.json` هەبێت لە `frontend/` بۆ ئەوەی Vercel بتوانێت build و SPA routing ئەنجام بدات.

#### Acceptance Criteria

1. فایلی `frontend/vercel.json` دروست بکرێت کە `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"` دیاری بکات.
2. `vercel.json` rewrite rule هەبێت کە هەموو non-asset paths بگەڕێنێتەوە بۆ `index.html` بۆ SPA routing.
3. `vercel.json` headers هەبێت کە static assets ـی hashed ـ بکات `Cache-Control: public, max-age=31536000, immutable` و `index.html` بکات `Cache-Control: no-cache`.

---

### Requirement 2: Environment Variables

**User Story:** وەک developer، دەمەوێت هەموو `VITE_*` env vars لە Vercel project settings دیاری بکرێن.

#### Acceptance Criteria

1. ئەم env vars ـانە پێویستن لە Vercel (Production + Preview): `VITE_API_URL`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_STORAGE_BUCKET`.
2. فایلی `.env.example` لە `frontend/` دروست بکرێت کە ناوی هەموو env vars ـەکان نیشان بدات (بەبێ نرخی ڕاستەقینە).

---

### Requirement 3: Firebase Config Migration to Env Vars

**User Story:** وەک developer، دەمەوێت Firebase config لە `firebase.ts` بخوێنرێتەوە لە env vars بەجای hardcoded values.

#### Acceptance Criteria

1. `frontend/src/firebase.ts` گۆڕبێت بۆ ئەوەی `firebaseConfig` لە `import.meta.env.VITE_FIREBASE_*` بخوێنێتەوە.
2. فایلی `frontend/.env.local.example` دروست بکرێت بۆ development.

---

### Requirement 4: SPA Routing Verification

**User Story:** وەک user، دەمەوێت هەموو routes ـەکان (مەسەلەن `/login`, `/dashboard`) کاربکەن پاش deploy لە Vercel.

#### Acceptance Criteria

1. Vercel rewrite rule ئەوەی دڵنیا بکات کە direct URL access بۆ هەر route ـێک `index.html` دەگەڕێنێتەوە.
2. `vercel.json` ـەکە بتوانرێت بە `vercel build` verify بکرێت.
