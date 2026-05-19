# Design: Vercel Deployment

## Architecture Overview

```
frontend/ (React/Vite)
├── vercel.json          ← NEW: Vercel project config
├── .env.local.example   ← NEW: dev env template
├── src/
│   └── firebase.ts      ← MODIFY: hardcoded → env vars
└── dist/                ← Vercel build output
```

Backend (FastAPI on Cloud Run) — unchanged.

---

## vercel.json Structure

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    {
      "source": "/((?!assets|favicon|manifest|icons|_next).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-cache" }
      ]
    }
  ]
}
```

---

## Firebase Config Migration

`firebase.ts` ـەکە ئێستا hardcoded values هەیە. گۆڕبێت بۆ:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
```

---

## Environment Variables

| Variable | Value (Production) |
|---|---|
| `VITE_API_URL` | `https://zoho-erp-xxxxx-uc.a.run.app` |
| `VITE_FIREBASE_API_KEY` | `AIzaSyDGM0lLMx0hbF0WuVx8Qr03u5GMs-h-xFw` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `zoho-83cda.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `zoho-83cda` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `zoho-83cda.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `363501065969` |
| `VITE_FIREBASE_APP_ID` | `1:363501065969:web:5f18d232f71aeaacb6fb50` |
| `VITE_FIREBASE_MEASUREMENT_ID` | `G-3N2ZX9189E` |

---

## Deployment Steps (Manual — یەک جار)

1. `npm i -g vercel` (ئەگەر نەبوو)
2. `cd frontend && vercel link` → ئەکاونتی `safaothman1631s-projects` هەڵبژێرە
3. Env vars لە Vercel dashboard دابنێ
4. `vercel --prod` یان git push بۆ auto-deploy

---

## Files Changed

| File | Action |
|---|---|
| `frontend/vercel.json` | CREATE |
| `frontend/.env.local.example` | CREATE |
| `frontend/src/firebase.ts` | MODIFY (env vars) |
