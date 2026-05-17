# Frontend Build Configuration

This document describes the build system, TypeScript configuration, and development tooling for the Zoho ERP frontend.

---

## Available npm Scripts

Run any script with `npm run <script>` from the `frontend/` directory.

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `vite` | Start the Vite development server on port 5173 with HMR |
| `build` | `tsc -b && vite build` | Type-check with TypeScript then bundle for production |
| `test` | `vitest --run` | Run all Vitest unit tests once (non-watch mode) |
| `e2e` | `playwright test` | Run all Playwright end-to-end tests |
| `e2e:install` | `playwright install --with-deps chromium` | Install Playwright browser binaries |
| `e2e:report` | `playwright show-report` | Open the last Playwright HTML report |
| `lint` | `eslint .` | Run ESLint across the entire project |
| `preview` | `vite preview` | Serve the production `dist/` build locally for inspection |
| `nav:audit` | `node ./scripts/nav-audit.mjs` | Audit navigation structure for consistency |
| `nav:sweep` | `playwright test tests/e2e/nav-sweep.spec.ts` | Run navigation smoke tests |
| `guard:compat` | `node ./scripts/compat-guard.mjs` | Check browser compatibility constraints |
| `lhci` | `lhci autorun` | Run Lighthouse CI performance and accessibility audits |

### Typical Workflows

```bash
# Development
npm run dev          # Start dev server at http://localhost:5173

# Before committing
npm run lint         # Check for lint errors
npm run test         # Run unit tests

# Production build
npm run build        # Outputs to dist/
npm run preview      # Verify the production build locally

# End-to-end testing (requires dev server running)
npm run dev &
npm run e2e
```

---

## TypeScript Configuration

The project uses a composite TypeScript setup with two tsconfig files referenced from the root `tsconfig.json`.

### Root `tsconfig.json`

```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

The root config is a project-references hub — it delegates to two scoped configs.

### `tsconfig.app.json` — Application Source

Covers all files under `src/` (excluding test files).

| Option | Value | Purpose |
|--------|-------|---------|
| `target` | `ES2023` | Compile to modern JavaScript |
| `lib` | `ES2023, DOM, DOM.Iterable` | Include browser and ES2023 type definitions |
| `module` | `ESNext` | Use native ES modules |
| `moduleResolution` | `bundler` | Vite-compatible module resolution |
| `jsx` | `react-jsx` | Use the React 17+ automatic JSX transform |
| `strict` | `true` | Enable all strict type checks (see below) |
| `noFallthroughCasesInSwitch` | `true` | Prevent accidental switch case fall-through |
| `noUncheckedSideEffectImports` | `true` | Flag imports with side effects that aren't explicitly typed |
| `erasableSyntaxOnly` | `true` | Disallow TypeScript syntax that cannot be erased at emit |
| `verbatimModuleSyntax` | `true` | Enforce explicit `import type` for type-only imports |
| `noEmit` | `true` | Type-check only; Vite handles the actual emit |
| `noUnusedLocals` | `false` | Unused locals are allowed in app source |
| `noUnusedParameters` | `false` | Unused parameters are allowed in app source |

### `tsconfig.node.json` — Build Tool Source

Covers `vite.config.ts` only. Stricter than the app config.

| Option | Value | Notes |
|--------|-------|-------|
| `target` | `ES2023` | Same as app |
| `strict` | `true` | Strict mode enabled |
| `noUnusedLocals` | `true` | Stricter — no unused locals in build scripts |
| `noUnusedParameters` | `true` | Stricter — no unused parameters in build scripts |

### What `strict: true` Enables

Enabling `strict` is equivalent to turning on all of the following compiler flags:

- `strictNullChecks` — `null` and `undefined` are not assignable to other types
- `strictFunctionTypes` — Stricter checking of function parameter types
- `strictBindCallApply` — Type-safe `.bind()`, `.call()`, `.apply()`
- `strictPropertyInitialization` — Class properties must be initialized in the constructor
- `noImplicitAny` — Variables without a type annotation cannot implicitly be `any`
- `noImplicitThis` — `this` expressions must have an explicit type
- `alwaysStrict` — Emit `"use strict"` in every output file

---

## Vite Build Configuration

### Development Server

```typescript
server: {
  port: 5173,
  proxy: {
    '/api': {
      target: 'http://127.0.0.1:8000',
      changeOrigin: true,
      secure: false,
    },
  },
}
```

- **Port**: The dev server listens on `http://localhost:5173`.
- **API Proxy**: All requests to `/api/*` are forwarded to the FastAPI backend at `http://127.0.0.1:8000`. This avoids CORS issues during development.
- **Production note**: In production the frontend is served as static files. Set the `VITE_API_BASE_URL` environment variable (e.g. `https://api.example.com`) and prefix all API calls with it — no proxy is available in production.

### Production Build Output

```typescript
build: {
  outDir: 'dist',
  emptyOutDir: true,
}
```

- Output directory: `dist/`
- The output directory is cleaned before each build (`emptyOutDir: true`).

### Vendor Chunk Splitting

The build uses Rollup's `manualChunks` to split large dependencies into separate cacheable chunks. This improves initial load time by allowing browsers to cache vendor bundles independently of application code.

| Chunk Name | Included Packages |
|------------|------------------|
| `vendor-antd-icons` | `@ant-design/icons` |
| `vendor-antd-core` | `antd`, `@ant-design/*` (excluding icons) |
| `vendor-react-dom` | `react-dom` |
| `vendor-react` | `react`, `react-router*` |
| `vendor-charts` | `recharts` |
| `vendor-firebase` | `firebase` |
| `vendor-utils` | `dayjs`, `i18next`, `react-i18next`, `axios`, `zustand` |

Icons are split from the main Ant Design chunk because `@ant-design/icons` is large and often changes independently.

### Vitest (Unit Test) Configuration

Vitest is configured inside `vite.config.ts` via the `test` key:

```typescript
test: {
  environment: 'jsdom',
  setupFiles: ['./src/test-setup.ts'],
  globals: true,
}
```

| Option | Value | Description |
|--------|-------|-------------|
| `environment` | `jsdom` | Simulate a browser DOM environment for React component tests |
| `setupFiles` | `./src/test-setup.ts` | Run this file before each test suite (e.g. jest-dom matchers) |
| `globals` | `true` | Expose `describe`, `it`, `expect`, etc. as globals (no imports needed) |

Run unit tests with:

```bash
npm run test          # Run once
npx vitest            # Watch mode
```

---

## Playwright (E2E Test) Configuration

Playwright is configured in `playwright.config.ts`.

### Key Settings

| Setting | Value | Description |
|---------|-------|-------------|
| `testDir` | `./e2e` | Directory containing E2E test files |
| `timeout` | `30 000 ms` | Maximum time per test |
| `expect.timeout` | `5 000 ms` | Maximum time for assertion matchers |
| `fullyParallel` | `false` | Tests run sequentially |
| `workers` | `1` | Single worker process |
| `retries` | `0` | No automatic retries on failure |
| `baseURL` | `http://localhost:5173` | Override with `PLAYWRIGHT_BASE_URL` env var |
| `locale` | `ku-IQ` | Kurdish (Iraq) locale for all tests |
| `trace` | `retain-on-failure` | Save traces only when a test fails |
| `screenshot` | `only-on-failure` | Capture screenshots only on failure |
| `video` | `retain-on-failure` | Record video only on failure |

### Locale Setting

The `ku-IQ` locale (Kurdish — Iraq) is set globally so that all E2E tests exercise the application in the primary target language. This ensures RTL layout, Kurdish date/number formatting, and Kurdish UI strings are validated by default.

### Browser

Tests run against **Chromium** (Desktop Chrome profile) only.

### Running E2E Tests

```bash
# The dev server must be running first
npm run dev

# In a separate terminal
npm run e2e              # Run all tests
npm run e2e:report       # View HTML report after a run
npm run nav:sweep        # Run navigation-specific smoke tests
```

To run against a different URL (e.g. a staging environment):

```bash
PLAYWRIGHT_BASE_URL=https://staging.example.com npm run e2e
```

---

## Key Dependencies

### Runtime

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.2.4 | UI framework |
| `react-router-dom` | ^7.14.0 | Client-side routing |
| `antd` | ^6.3.5 | UI component library |
| `zustand` | ^5.0.12 | State management |
| `firebase` | ^12.12.0 | Authentication and Firestore |
| `i18next` / `react-i18next` | ^26 / ^17 | Internationalization |
| `axios` | ^1.14.0 | HTTP client |
| `recharts` | ^3.8.1 | Charts and data visualization |

### Development

| Package | Version | Purpose |
|---------|---------|---------|
| `vite` | ^8.0.1 | Build tool and dev server |
| `typescript` | ~5.9.3 | Type checking |
| `vitest` | ^4.1.6 | Unit test runner |
| `@playwright/test` | ^1.59.1 | End-to-end test runner |
| `eslint` | ^9.39.4 | Linting |
| `fast-check` | ^3.23.2 | Property-based testing |
| `@testing-library/react` | ^16.3.2 | React component testing utilities |
