/**
 * Configuration object consumed by `vite-plugin-pwa` (added in a follow-up
 * task that touches `vite.config.ts`). Keeping it in its own module so the
 * Vite owner (P1) can import this without us editing their config.
 *
 * The shape matches `VitePWAOptions` from `vite-plugin-pwa`. We don't import
 * the type here because the plugin is an optional peer (declared in
 * `_deltas/P3-deps.md`) and pulling its types into the main build adds a
 * dev-only dependency on this file's bundling. If the plugin is added later,
 * the structural compatibility check is left to the integrator.
 */
export interface VitePWAOptions {
  // Subset of the upstream type — the fields we actually set.
  registerType?: 'autoUpdate' | 'prompt';
  strategies?: 'generateSW' | 'injectManifest';
  srcDir?: string;
  filename?: string;
  scope?: string;
  base?: string;
  injectRegister?: 'auto' | 'script' | 'inline' | null | false;
  manifest?: Record<string, unknown>;
  workbox?: Record<string, unknown>;
  injectManifest?: Record<string, unknown>;
  devOptions?: Record<string, unknown>;
}

export const PWA_CONFIG: VitePWAOptions = {
  // We hand-write `src/pwa/sw.ts`, so use injectManifest mode.
  strategies: 'injectManifest',
  srcDir: 'src/pwa',
  filename: 'sw.ts',

  // Show an update prompt instead of silently swapping; the prompt is wired
  // up in `register.ts`.
  registerType: 'prompt',
  injectRegister: null, // we register manually in `register.ts`

  scope: '/',
  base: '/',

  manifest: {
    id: '/?source=pwa',
    name: 'Zoho ERP — سیستەمی بازرگانی',
    short_name: 'Zoho ERP',
    description:
      'Kurdish + English ERP / POS — works offline. سیستەمی ERP بە کوردی، پشتگیری ئۆفلاین.',
    lang: 'ku',
    dir: 'rtl',
    start_url: '/?source=pwa',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    theme_color: '#1677ff',
    categories: ['business', 'productivity', 'finance'],
    icons: [
      {
        // Placeholder paths — assets to be added under `frontend/public/icons/`.
        src: '/icons/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'POS Terminal',
        short_name: 'POS',
        url: '/pos',
        icons: [{ src: '/icons/shortcut-pos.png', sizes: '96x96' }],
      },
      {
        name: 'Invoices',
        short_name: 'Invoices',
        url: '/invoices',
        icons: [{ src: '/icons/shortcut-invoices.png', sizes: '96x96' }],
      },
    ],
  },

  injectManifest: {
    // Limit precache to what's needed for the shell; everything else is
    // lazy and runtime-cached. 5MB ceiling matches the design budget.
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    globPatterns: ['**/*.{js,css,html,woff2,svg,png,ico}'],
    // The hand-written SW will be transformed by Vite as part of the build.
  },

  devOptions: {
    // Disabled by default in dev because the SW caching layer makes hot
    // module reload confusing. Flip to `true` to test the SW locally.
    enabled: false,
    type: 'module',
  },
};

export default PWA_CONFIG;
