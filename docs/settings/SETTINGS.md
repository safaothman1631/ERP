# Settings Architecture — Zoho ERP

This document provides a comprehensive overview of the settings and configuration system for the Zoho ERP project. It covers all configuration layers: environment variables, TypeScript interfaces, Python data models, theme tokens, i18n, authentication, and testing frameworks.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Frontend TypeScript Interfaces](#frontend-typescript-interfaces)
3. [Backend Python Data Models](#backend-python-data-models)
4. [Theme & Design Tokens](#theme--design-tokens)
5. [Localization (i18n) Configuration](#localization-i18n-configuration)
6. [Authentication Configuration](#authentication-configuration)
7. [Environment Variables](#environment-variables)
8. [API & CORS Configuration](#api--cors-configuration)
9. [Rate Limiting](#rate-limiting)
10. [Layout & Shell Configuration](#layout--shell-configuration)
11. [Feature Flags](#feature-flags)
12. [Storage & Persistence](#storage--persistence)
13. [Testing Frameworks](#testing-frameworks)
14. [Key File Index](#key-file-index)

---

## Architecture Overview

The settings system spans two layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React + TypeScript + Zustand)                        │
│                                                                 │
│  store.ts          — Auth, Theme, Layout (localStorage)         │
│  settingsStore.ts  — Org-scoped PublicConfig (localStorage +    │
│                       server sync)                              │
│  theme/tokens.ts   — Design tokens (single source of truth)     │
│  i18n.ts           — Language config (localStorage)             │
│  firebase.ts       — Firebase Auth + Firestore init             │
└────────────────────────────┬────────────────────────────────────┘
                             │  /api/system/public-config
                             │  /api/system/settings
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Backend (FastAPI + Python + Firestore)                         │
│                                                                 │
│  config.py             — Environment variables (pydantic)       │
│  settings_service.py   — Org-scoped settings bags (Firestore)   │
│  main.py               — CORS, security headers, rate limiting  │
│  middleware/rate_limit.py — slowapi rate limiting               │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Storage Layer                                                  │
│                                                                 │
│  localStorage  — client-side persistence (theme, lang, auth)    │
│  Firestore     — server-side org-scoped settings & feature flags│
└─────────────────────────────────────────────────────────────────┘
```

**Conflict resolution (Requirement 11.5):** When local and server settings conflict, the server always wins. The merge order is `DEFAULTS < local < server`.

---

## Frontend TypeScript Interfaces

### File: `frontend/src/store/settingsStore.ts`

Defines the org-scoped public configuration model. All interfaces are exported.

| Interface | Purpose |
|-----------|---------|
| `FormatsBag` | Date/time formats, number separators, units, paper size |
| `BrandingBag` | Logo URL, primary/secondary colors, font family, templates |
| `PaymentMethodsBag` | Enabled payment methods (cash, card, FIB, ZainCash, etc.) |
| `LocalizationBag` | Country pack, chart of accounts template, address/phone formats |
| `WorkingHoursBag` | Business open/close times and working days |
| `HolidaysBag` | List of holiday dates with optional recurrence |
| `SsoBag` | SSO providers (Google, Microsoft, SAML, LDAP) and 2FA requirement |
| `PortalsBag` | Customer/vendor portal settings and link expiry |
| `LanguagesBag` | Active languages, default language, RTL flag |
| `MobileBag` | Push notifications, biometrics, offline sync, barcode scanning |
| `PublicConfig` | Root interface composing all bags above |

**Key store actions:**
- `load()` — initial fetch from `/api/system/public-config`
- `refresh()` — force re-fetch
- `setConfig(cfg)` — local update
- `syncFromServer(orgId)` — post-login sync with server-wins merge (Req 11.3, 11.5)

**localStorage key:** `settings-config-cache` (Zustand persist, version 1)

---

### File: `frontend/src/store.ts`

Manages authentication session, theme, and layout mode.

| Type | Values | localStorage Key |
|------|--------|-----------------|
| `Theme` | `'light'` \| `'dark'` | `theme` |
| `LayoutMode` | 10 modes (see Layout section) | `shell.layoutMode` |

**Auth state fields (Req 6.5):**

| Field | Type | localStorage Key |
|-------|------|-----------------|
| `token` | `string \| null` | `token` |
| `userId` | `string \| null` | `userId` |
| `orgId` | `string \| null` | `orgId` |
| `userName` | `string \| null` | `userName` |
| `isAuthenticated` | `boolean` | derived from `token` |

**Exported helpers:**
- `applyTheme(theme)` — sets `document.documentElement[data-theme]`
- `getPersistedTheme()` — reads from localStorage
- `applyLayout(mode)` — sets `document.documentElement[data-layout]`
- `getPersistedLayout()` — reads from localStorage

---

## Backend Python Data Models

### File: `backend/app/config.py`

Uses `pydantic-settings` (`BaseSettings`) to load from environment variables and `.env` file.

```python
class Settings(BaseSettings):
    APP_NAME: str                        # Application display name
    ENVIRONMENT: str                     # "development" | "production"
    DEBUG: bool                          # Debug mode flag
    SECRET_KEY: str                      # JWT signing secret (never logged)
    ACCESS_TOKEN_EXPIRE_MINUTES: int     # Default: 1440 (24 hours)
    ALGORITHM: str                       # Default: "HS256"
    DATABASE_URL: str                    # SQLite or PostgreSQL connection string
    CORS_ORIGINS: str                    # Comma-separated allowed origins
    FIREBASE_CREDENTIALS_PATH: str       # Path to serviceAccountKey.json
    FIREBASE_STORAGE_BUCKET: str         # Firebase Storage bucket name
    UPLOAD_DIR: str                      # File upload directory
    PDF_TEMPLATE_DIR: str                # PDF template directory
    CACHE_TTL_SECONDS: int               # In-process cache TTL (default: 300)
    CACHE_ENABLED: bool                  # Toggle in-process cache
    RATE_LIMITING_ENABLED: bool          # Opt-in rate limiting (default: False)
    DEFAULT_RATE_LIMIT: str              # Format: "100/minute"
```

**`validate_env()` function** (Req 2.1–2.5):
- Production: hard-fails (`sys.exit(1)`) on missing/insecure values
- Development: logs warnings but continues
- Never exposes `SECRET_KEY` in logs or error messages

---

### File: `backend/app/services/settings_service.py`

Provides org-scoped settings bags stored in Firestore.

**Firestore path:** `settings/{category}/{doc_id}`  
**Document shape:** `{ org_id, key: "blob", category: <name>, value: <json string> }`

**Core functions:**

| Function | Description |
|----------|-------------|
| `get_bag(org_id, category, defaults)` | Read settings bag with server-wins merge; cached 60s |
| `set_bag(org_id, category, data)` | Write/replace settings bag; invalidates cache |
| `invalidate(org_id, category?)` | Drop cache for one or all categories of an org |
| `invalidate_all()` | Drop entire cache (tests/admin only) |

**Convenience getters** (all call `get_bag` with domain defaults):

| Function | Category | Key Settings |
|----------|----------|-------------|
| `get_sales_settings` | `sales` | quote expiry, payment terms, commission |
| `get_purchases_settings` | `purchases` | RFQ, 3-way match, approval threshold |
| `get_inventory_settings` | `inventory` | warehouse, FIFO, lot/serial tracking |
| `get_pos_settings` | `pos` | receipt printer, cash drawer, offline mode |
| `get_hr_settings` | `hr` | contract type, leave days, geofence |
| `get_payroll_settings` | `payroll` | pay period, tax/social security rates |
| `get_branding_settings` | `branding` | logo, colors, font, templates |
| `get_formats_settings` | `formats` | date/time format, separators, units |
| `get_localization_settings` | `localization` | country pack, COA template, phone format |
| `get_payment_methods_settings` | `payment_methods` | cash, card, FIB, ZainCash, currency |
| `get_sso_settings` | `sso` | Google, Microsoft, SAML, LDAP, 2FA |
| `get_portals_settings` | `portals` | customer/vendor portal, link expiry |
| `get_mobile_settings` | `mobile` | push, biometrics, offline sync |
| `get_gdpr_settings` | `gdpr` | consent, DSR email, retention days |
| `get_webhooks_settings` | `webhooks` | endpoints, signing secret, retry config |
| `get_crm_settings` | `crm` | pipelines, lead sources, scoring |
| `get_mrp_settings` | `mrp` | quality checks, work orders, BOM |
| `get_audit_settings` | `audit` | retention, export format, anomaly alerts |
| `get_api_tokens_settings` | `api_tokens` | rate limit, TTL, IP whitelist |
| `get_sms_whatsapp_settings` | `sms_whatsapp` | provider, sender ID, OTP template |

---

## Theme & Design Tokens

### File: `frontend/src/theme/tokens.ts`

Single source of truth for all design tokens (Req 3.1, 3.2).

| Export | Description |
|--------|-------------|
| `palette` | Full color palette: primary (50–900), success, warning, error, info, neutrals, dark mode variants |
| `space` | Named semantic spacing aliases (xxs=2 through xxxl=48) |
| `spacing` | Numeric 4px-grid scale (0–128) |
| `radius` | Border radius scale (xs=4 through pill=999) |
| `fontFamily` | RTL stack (Vazirmatn + Noto Sans Arabic) and LTR stack (Inter) |
| `fontSize` | xs=12 through 5xl=36, plus heading aliases |
| `fontWeight` | light=300 through extrabold=800 |
| `lineHeight` | Unitless multipliers and pixel values |
| `controlHeight` | compact=32, default=36, comfort=44 |
| `duration` | instant=0, fast=150, normal=250, slow=400, verySlow=600 (ms) |
| `motion` | Legacy duration/easing (kept for backward compat) |
| `easing` | standard, emphasized, decelerate, accelerate, linear |
| `shadow` | none, sm, md, lg, xl + dark variants |
| `status` | Semantic surface tokens: success, warning, danger, info, neutral |
| `zIndex` | base=0 through tooltip=1600 |
| `typography` | Semantic ramp: display, h1–h3, bodyLg, body, bodySm, caption, overline |
| `dataViz` | Categorical (8 colors), sequential, diverging palettes |
| `elevation` | flat, raised, floating, overlay, popover + dark variants |
| `layout` | Fixed dimensions: topbar height, sidebar widths, page padding, content max width |
| `a11y` | WCAG 2.1 AA touch targets, focus ring dimensions |
| `hcLight` / `hcDark` | High-contrast mode palettes |
| `buildAntTokens(mode, density, isRTL)` | Generates Ant Design token bundle |
| `buildAntComponents(mode)` | Generates Ant Design component overrides |

---

## Localization (i18n) Configuration

### File: `frontend/src/i18n.ts`

| Setting | Value |
|---------|-------|
| Supported languages | Kurdish (`ku`), Arabic (`ar`), English (`en`) |
| Translation files | `frontend/src/locales/ku.json`, `ar.json`, `en.json` |
| localStorage key | `app_language` |
| Default language | `ku` (Kurdish) |
| RTL languages | `ku`, `ar` (via `RTL_LANGS` Set) |
| Fallback language | `ku` |

**On language change:**
1. Saves to `localStorage['app_language']`
2. Sets `document.documentElement.dir` → `'rtl'` for Kurdish/Arabic, `'ltr'` otherwise
3. Sets `document.documentElement.lang` → language code

**Missing key handler:** `humanizeKey(key)` — strips namespaces, replaces separators with spaces, Title-cases the result. Example: `"returns.sales_returns"` → `"Sales Returns"`.

---

## Authentication Configuration

### File: `frontend/src/firebase.ts`

Firebase project: `zoho-83cda`

| Config Field | Purpose |
|-------------|---------|
| `apiKey` | Web API key for browser-to-Firebase requests |
| `authDomain` | OAuth redirect domain (`zoho-83cda.firebaseapp.com`) |
| `projectId` | Firebase project identifier |
| `storageBucket` | Cloud Storage bucket |
| `messagingSenderId` | FCM sender ID for push notifications |
| `appId` | Web app registration ID |
| `measurementId` | Google Analytics measurement ID |

**Exported services:** `auth`, `db` (Firestore), `googleProvider`, `analytics`

> **Security note:** These are public client-side identifiers. Security is enforced via Firestore Security Rules and Authentication, not by keeping these values secret.

### Backend JWT (Req 6.3, 6.4)

| Setting | Value |
|---------|-------|
| Algorithm | `HS256` |
| Token expiration | `1440` minutes (24 hours) |
| Secret key | `SECRET_KEY` env var (never logged) |

### Auth localStorage Keys (Req 6.7)

| Key | Value |
|-----|-------|
| `token` | JWT access token |
| `userId` | Authenticated user ID |
| `orgId` | Organisation ID |
| `userName` | Display name |

**Logout flow (Req 6.6):**
1. POST `/api/auth/logout` with Bearer token (backend adds JTI to denylist)
2. Firebase `signOut()` to clear Firebase session
3. Remove all auth keys from localStorage
4. Reset in-memory store state

---

## Environment Variables

### File: `backend/.env` / `backend/.env.example`

| Variable | Required in Prod | Default (Dev) | Description |
|----------|-----------------|---------------|-------------|
| `APP_NAME` | No | `"Zoho Books Local"` | Application display name |
| `ENVIRONMENT` | Yes | `"development"` | `"development"` or `"production"` |
| `DEBUG` | No | `false` | Enable debug mode (must be `false` in prod) |
| `SECRET_KEY` | Yes | insecure default | JWT signing secret (min 32 chars) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | JWT expiry in minutes |
| `ALGORITHM` | No | `"HS256"` | JWT signing algorithm |
| `DATABASE_URL` | Yes | `sqlite:///./zoho_books.db` | Database connection string |
| `CORS_ORIGINS` | Yes | localhost origins | Comma-separated allowed origins |
| `FIREBASE_CREDENTIALS_PATH` | Yes (or ADC) | `"serviceAccountKey.json"` | Path to Firebase service account key |
| `FIREBASE_STORAGE_BUCKET` | No | `""` | Firebase Storage bucket name |
| `UPLOAD_DIR` | No | `"uploads"` | File upload directory |
| `PDF_TEMPLATE_DIR` | No | `"templates"` | PDF template directory |
| `CACHE_TTL_SECONDS` | No | `300` | In-process cache TTL |
| `CACHE_ENABLED` | No | `true` | Toggle in-process cache |
| `RATE_LIMITING_ENABLED` | No | `false` | Opt-in rate limiting |
| `DEFAULT_RATE_LIMIT` | No | `"100/minute"` | Rate limit format: `"<count>/<period>"` |

**Production startup rules:**
- Missing required vars → `sys.exit(1)`
- Insecure `SECRET_KEY` default → `sys.exit(1)`
- `DEBUG=true` → `sys.exit(1)`
- Wildcard `CORS_ORIGINS=*` → `sys.exit(1)`
- Missing Firebase credentials (no ADC) → `sys.exit(1)`

---

## API & CORS Configuration

### File: `backend/app/main.py`

**CORS** (Req 5.2, 5.3): Origins parsed from `CORS_ORIGINS` env var as comma-separated list. Applied via `CORSMiddleware` with credentials, all methods, and `Content-Type`/`Authorization`/`X-Zoho-Retry` headers.

**Security headers** (Req 5.4) — applied to every response:

| Header | Value |
|--------|-------|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `Content-Security-Policy` | Comprehensive policy (see main.py) |
| `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` (for Firebase Auth popups) |
| `Cache-Control` | `no-store, no-cache, must-revalidate` (API routes only) |

**Frontend API proxy** (Req 5.5): Vite dev server proxies `/api` requests to `http://127.0.0.1:8000` (configured in `frontend/vite.config.ts`).

---

## Rate Limiting

### File: `backend/app/middleware/rate_limit.py`

| Setting | Value |
|---------|-------|
| Library | `slowapi` |
| Key function | `get_remote_address` (IP-based, Req 10.2) |
| Opt-in | `RATE_LIMITING_ENABLED` env var (Req 10.3) |
| Default limit | `DEFAULT_RATE_LIMIT` env var (default: `"100/minute"`) |
| Exceeded response | HTTP 429 with `RateLimitExceeded` error (Req 10.4) |

---

## Layout & Shell Configuration

### File: `frontend/src/store.ts`

**Supported layout modes** (Req 8.1):

| Mode | Description |
|------|-------------|
| `classic-sidebar` | Default — traditional left sidebar navigation |
| `top-megamenu` | Horizontal mega-menu at the top |
| `dual-rail` | Two-level icon + label rail |
| `icon-rail` | Icon-only compact rail |
| `dashboard-first` | Dashboard as the primary landing view |
| `command-centric` | Command palette-driven navigation |
| `workspace-tabs` | Tab-based workspace switching |
| `apps-launcher` | App launcher grid |
| `split-master-detail` | Master-detail split panel |
| `mobile-bottom-nav` | Mobile-optimized bottom navigation bar |

**Default:** `classic-sidebar`  
**localStorage key:** `shell.layoutMode`  
**DOM attribute:** `document.documentElement[data-layout]`

---

## Feature Flags

### Backend: `backend/app/api/feature_flags.py`

Feature flags are stored in Firestore under `feature_flags/{org_id}/{flag_key}` (Req 7.2).

- Flags are boolean and organization-scoped (Req 7.1, 7.3)
- API endpoints available for flag management (Req 7.4)
- Supports gradual rollout by percentage (Req 7.6)
- Disabled features hide UI elements or return appropriate errors (Req 7.5)

---

## Storage & Persistence

### localStorage Keys Summary

| Key | Store | Value | Requirement |
|-----|-------|-------|-------------|
| `token` | `useAuthStore` | JWT access token | 6.7 |
| `userId` | `useAuthStore` | User ID | 6.7 |
| `orgId` | `useAuthStore` | Organisation ID | 6.7 |
| `userName` | `useAuthStore` | Display name | 6.7 |
| `theme` | `useAuthStore` | `"light"` or `"dark"` | 3.6 |
| `shell.layoutMode` | `useAuthStore` | Layout mode string | 8.3 |
| `app_language` | i18n | Language code (`ku`/`ar`/`en`) | 4.3 |
| `settings-config-cache` | `useSettingsStore` | Serialized `PublicConfig` JSON | 11.1 |

### Firestore Collections

| Collection Path | Purpose | Requirement |
|----------------|---------|-------------|
| `settings/{category}/{doc_id}` | Org-scoped settings bags | 11.2 |
| `feature_flags/{org_id}/{flag_key}` | Feature flag values | 7.2 |

**Org scoping (Req 11.4):** Every Firestore read/write in `settings_service.py` is scoped to a single `org_id`. Two organisations sharing the same Firestore project never see each other's settings.

---

## Testing Frameworks

### Frontend — Vitest

**Config:** `frontend/vite.config.ts` (test section)  
**Run:** `npm run test` (from `frontend/`)

Key test files:
- `frontend/src/store/settingsStore.test.ts` — settings store unit tests
- `frontend/src/store.test.ts` — auth/theme/layout store tests
- `frontend/src/i18n.test.ts` — i18n language switching tests
- `frontend/src/theme/tokens.test.ts` — design token tests

### Frontend — Playwright (E2E)

**Config:** `frontend/playwright.config.ts`  
**Run:** `npm run e2e` (from `frontend/`)  
**Locale:** `ku-IQ` (Kurdish Iraq, Req 9.5)

### Backend — pytest

**Config:** `backend/pytest.ini` or `backend/pyproject.toml`  
**Run:** `pytest` (from `backend/`)

Key test files:
- `backend/tests/test_config.py` — environment validation tests
- `backend/tests/test_settings_service.py` — settings bag tests
- `backend/tests/test_auth.py` — JWT authentication tests
- `backend/tests/test_feature_flags.py` — feature flag tests

---

## Key File Index

| File | Layer | Purpose |
|------|-------|---------|
| `frontend/src/store/settingsStore.ts` | Frontend | Org-scoped PublicConfig store with server sync |
| `frontend/src/store.ts` | Frontend | Auth session, theme, and layout store |
| `frontend/src/theme/tokens.ts` | Frontend | Design tokens — single source of truth |
| `frontend/src/i18n.ts` | Frontend | i18n configuration (ku/ar/en, RTL support) |
| `frontend/src/firebase.ts` | Frontend | Firebase app initialization and service exports |
| `frontend/src/locales/ku.json` | Frontend | Kurdish translations |
| `frontend/src/locales/ar.json` | Frontend | Arabic translations |
| `frontend/src/locales/en.json` | Frontend | English translations |
| `frontend/vite.config.ts` | Frontend | Vite build config, dev server proxy, test config |
| `frontend/tsconfig.json` | Frontend | TypeScript strict mode, ES2023 target |
| `backend/app/config.py` | Backend | Environment variables (pydantic-settings) |
| `backend/app/services/settings_service.py` | Backend | Org-scoped settings bags (Firestore) |
| `backend/app/main.py` | Backend | FastAPI app, CORS, security headers, rate limiting |
| `backend/app/middleware/rate_limit.py` | Backend | slowapi rate limiting middleware |
| `backend/app/api/feature_flags.py` | Backend | Feature flag API endpoints |
| `backend/app/firebase_client.py` | Backend | Firebase Admin SDK initialization |
| `backend/.env` | Backend | Local environment variables (not committed) |
| `backend/.env.example` | Backend | Environment variable template |

---

*Generated as part of the Settings Documentation System — Requirement 1.1, 1.2, 1.3*
