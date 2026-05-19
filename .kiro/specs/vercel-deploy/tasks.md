# Implementation Plan: Vercel Deployment

## Overview

Deploy the React/Vite frontend to Vercel under account `safaothman1631s-projects`. Three coding tasks: create `vercel.json`, migrate Firebase config to env vars, and verify the build.

## Tasks

- [x] 1. Create `frontend/vercel.json`
  - Create `frontend/vercel.json` with `framework: "vite"`, `buildCommand: "npm run build"`, `outputDirectory: "dist"`
  - Add SPA rewrite rule: all non-asset paths → `/index.html`
  - Add Cache-Control headers: `/assets/*` → immutable, `/index.html` → no-cache
  - **Acceptance**: file exists and is valid JSON matching design spec
  - **Requirement**: Requirement 1

- [x] 2. Migrate Firebase config to environment variables
  - Modify `frontend/src/firebase.ts` to read all config values from `import.meta.env.VITE_FIREBASE_*`
  - Remove hardcoded credential values from `firebaseConfig` object
  - Create `frontend/.env.local.example` with all required `VITE_FIREBASE_*` keys (no real values, just key names)
  - Create `frontend/.env.example` with all required `VITE_*` keys for Vercel reference
  - **Acceptance**: `firebase.ts` contains no hardcoded API keys; `.env.local.example` lists all keys
  - **Requirement**: Requirements 2, 3

- [x] 3. Verify build succeeds with env vars
  - Create `frontend/.env.local` (gitignored) with real values for local build verification
  - Run `npm run build` in `frontend/` to confirm the Vite build completes without errors
  - Confirm `dist/index.html` exists after build
  - **Acceptance**: build exits 0, `dist/index.html` exists
  - **Requirement**: Requirement 3

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2"] },
    { "wave": 3, "tasks": ["3"] }
  ]
}
```

## Notes

- Task 1 is already complete (`frontend/vercel.json` was created).
- Firebase config values are public client-side identifiers — safe to document in `.env.example`.
- After these tasks, manually run `vercel link` and set env vars in Vercel dashboard.
