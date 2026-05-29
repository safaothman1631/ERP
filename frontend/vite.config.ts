/**
 * Vite configuration for the Zoho-Iraq ERP frontend.
 *
 * This config is the source of truth for the **bundle splitting strategy**
 * defined in the world-class-performance spec (R1.5, R3.6, design §1.6).
 *
 * Shell budget (R1.5):
 *   - Public route shell  ≤ 180 KB gzipped
 *   - Authenticated shell ≤ 350 KB gzipped (vendor-react + vendor-query +
 *     vendor-i18n + app entry + index CSS)
 *   - Each per-route chunk ≤ 80 KB gzipped
 *
 * `frontend/scripts/check-shell-size.mjs` reads `dist/stats.html`'s JSON
 * sidecar and asserts the shell stays under budget on every build.
 *
 * NOTE: the PWA / Service Worker plugin lives in `src/pwa/pwa-config.ts` and
 * is wired in during phase P3 (offline POS). It is intentionally NOT added
 * here — the bundle-diet phase must measure first.
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PWA_CONFIG } from './src/pwa/pwa-config';

// `__dirname` is not defined in ESM — derive it from `import.meta.url`.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// `process.env` is provided by Node when Vite loads this file. The cast keeps
// us TS-clean without pulling in `@types/node` exclusively for the version.
declare const process: { env: Record<string, string | undefined> };

const APP_VERSION = process.env.npm_package_version ?? '0.0.0-dev';

export default defineConfig({
  plugins: [
    react(),
    /**
     * PWA / Workbox service worker (P3 — Offline POS, R4.4–4.5).
     * Configuration lives in `src/pwa/pwa-config.ts`; the hand-written SW
     * source is `src/pwa/sw.ts` and uses the injectManifest strategy.
     * Emits `dist/sw.js` (or the configured filename) and the precache
     * manifest at build time.
     */
    // VitePWA is typed against vite-plugin-pwa's own VitePWAOptions; our local
    // shape in pwa-config.ts is a structural subset, so the cast is safe.
    VitePWA(PWA_CONFIG as unknown as Parameters<typeof VitePWA>[0]),
    /**
     * Bundle analyzer — emits `dist/stats.html` (treemap, gzip + brotli sizes)
     * on every production build. A GitHub Action diffs the size against the
     * previous main build and comments on the PR (R3.7).
     *
     * `emitFile: true` is intentionally NOT set so the report is written next
     * to the build output rather than served as a regular asset.
     */
    visualizer({
      filename: 'dist/stats.html',
      gzipSize: true,
      brotliSize: true,
      template: 'treemap',
      sourcemap: false,
      // Suppress the "Statistics file generated" log on every build.
      open: false,
    }),
  ],
  define: {
    /**
     * Exposed as `__APP_VERSION__` to client code (RUM, Sentry tags, the
     * `/api/rum/vitals` payload). Single string source ⇒ keeps the version
     * consistent across error reports and deploys.
     */
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  resolve: {
    /**
     * `@/...` resolves to `frontend/src/...`. Mirrors the `paths` entry in
     * `tsconfig.app.json`. Spec text and copy-pasted examples reach for the
     * alias; first-party code mostly uses relative paths today.
     */
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  server: {
    port: 5173,
    headers: {
      // Firebase signInWithPopup needs popup window communication in dev.
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
    // Development proxy: all /api requests are forwarded to the FastAPI backend.
    // In production, the frontend is served as static files and the backend is
    // deployed separately. Set VITE_API_BASE_URL (e.g. https://api.example.com)
    // in the production environment and prefix all API calls with that variable
    // so they reach the correct host without a proxy.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Inline assets under 4 KB; anything larger is a separate cached file.
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        /**
         * Manual chunking strategy — every line ties to a chunk in design §1.6.
         *
         * Ordering matters: the first matching predicate wins, so the most
         * specific buckets come first. Vendor splits exist so each library
         * lives behind its own cacheable URL — small upgrades don't invalidate
         * the React shell, and lazy modules don't pay for libraries they never
         * touch.
         *
         * @param id - The absolute module path being resolved.
         * @returns The chunk name to merge this module into, or `undefined` to
         *          let Rollup decide (which means: route-level dynamic import
         *          owns its own chunk, the desired behavior for lazy routes).
         */
        manualChunks(id: string): string | undefined {
          // ── Application code: help registry is its own lazy island ─────
          //
          // (system-wide-ux-overhaul R8.1, R8.3, R15.5, R16.1, task 2.2).
          // The registry is dynamically imported by `useHelp` on first
          // Help_Icon activation; isolating it as its own chunk keeps the
          // initial bundle under the per-route budget defined in
          // `perf-budgets.json` and lets the help payload fail independently
          // from the rest of the app — `useHelp` falls back to the always-
          // bundled `help.unavailable.message` key when this chunk fails to
          // load.
          if (id.includes('/src/help/registry')) {
            return 'help';
          }

          // ── Application code: per-section lazy splits ─────────────────
          //
          // Returning `undefined` lets Rollup keep each settings section and
          // each ext-module config in its own dynamically-imported chunk.
          // Listed explicitly so future refactors don't accidentally roll
          // these back into a vendor chunk via a broader regex.
          if (id.includes('/src/pages/settings/')) {
            return undefined;
          }
          if (id.includes('/src/pages/modules/moduleConfigs/sections/')) {
            return undefined;
          }

          // ── Vendor splits ──────────────────────────────────────────────
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // React runtime + router → the always-loaded shell core.
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router-dom') ||
            id.includes('node_modules/react-router/') ||
            id.includes('node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }

          // TanStack React Query — present on every page; split from React so
          // a Query upgrade doesn't invalidate the React chunk.
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'vendor-query';
          }

          // Ant Design icons — large and tree-shake-resistant; deferred so
          // route chunks that import a handful of icons share one cached file
          // instead of duplicating SVG metadata across many chunks.
          if (
            id.includes('node_modules/@ant-design/icons') ||
            id.includes('node_modules/antd/es/icon') ||
            id.includes('node_modules/antd/lib/icon')
          ) {
            return 'vendor-antd-icons';
          }

          // Ant Design components — the rest of antd (Buttons, Forms, etc.).
          if (id.includes('node_modules/antd')) {
            return 'vendor-antd-core';
          }

          // Recharts — only loaded on routes that import a chart component.
          if (
            id.includes('node_modules/recharts') ||
            id.includes('node_modules/d3-')
          ) {
            return 'vendor-charts';
          }

          // Framer Motion — split because PageTransition is in the shell but
          // the heavier APIs (animate, useMotionValue trees) are page-local.
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }

          // Firebase: split per service so login-only flows don't pull
          // Firestore, and dashboards don't pull messaging (R3.6).
          if (id.includes('node_modules/@firebase/auth') || id.includes('node_modules/firebase/auth')) {
            return 'vendor-firebase-auth';
          }
          if (id.includes('node_modules/@firebase/firestore') || id.includes('node_modules/firebase/firestore')) {
            return 'vendor-firebase-firestore';
          }
          if (id.includes('node_modules/@firebase/messaging') || id.includes('node_modules/firebase/messaging')) {
            return 'vendor-firebase-messaging';
          }
          if (id.includes('node_modules/@firebase/storage') || id.includes('node_modules/firebase/storage')) {
            return 'vendor-firebase-storage';
          }
          // The Firebase "app" core (shared init) — lightweight, kept separate.
          if (id.includes('node_modules/@firebase/app') || id.includes('node_modules/firebase/app')) {
            return 'vendor-firebase-core';
          }
          // Any other firebase sub-package (analytics, functions, etc.) lands
          // here so we never accidentally co-bundle it with the shell.
          if (id.includes('node_modules/@firebase/') || id.includes('node_modules/firebase/')) {
            return 'vendor-firebase-misc';
          }

          // ReactFlow — only loaded on routes that use diagrams (workflows,
          // approval builder, mindmaps). Lazy-only chunk.
          if (id.includes('node_modules/reactflow') || id.includes('node_modules/@reactflow/')) {
            return 'vendor-flow';
          }

          // React Grid Layout — dashboard editor only. Lazy.
          if (id.includes('node_modules/react-grid-layout') || id.includes('node_modules/react-resizable')) {
            return 'vendor-grid';
          }

          // Office-format readers/writers (xlsx, mammoth for docx, pdfjs).
          // Heavy and infrequently used → lazy.
          if (
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/mammoth') ||
            id.includes('node_modules/pdfjs') ||
            id.includes('node_modules/pdf-lib')
          ) {
            return 'vendor-office';
          }

          // i18n runtime — shipped with the shell because the very first
          // render needs translated text.
          if (
            id.includes('node_modules/i18next') ||
            id.includes('node_modules/react-i18next') ||
            id.includes('node_modules/i18next-http-backend')
          ) {
            return 'vendor-i18n';
          }

          // DnD-kit — only used by the dashboard editor and a few list pages.
          if (id.includes('node_modules/@dnd-kit/')) {
            return 'vendor-dnd';
          }

          // Misc small utilities used widely enough to stay together.
          if (
            id.includes('node_modules/dayjs') ||
            id.includes('node_modules/axios') ||
            id.includes('node_modules/zustand')
          ) {
            return 'vendor-utils';
          }

          // Catch-all for any vendor we haven't called out yet.
          return 'vendor';
        },
      },
    },
  },
});
