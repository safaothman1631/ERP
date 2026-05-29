// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

/**
 * Astro configuration for the Kurdish ERP marketing site.
 *
 * Architecture (per growth-to-100/design.md §1.1):
 *   - Static output (no SSR) for sub-1.5s LCP on Iraqi 4G.
 *   - Trilingual: /ku/ (default at /), /en/, /ar/.
 *   - Sitemap auto-generated with hreflang.
 *   - Deployed to Vercel (apex zoho-kurdish.iq).
 */
export default defineConfig({
  site: 'https://zoho-kurdish.iq',
  trailingSlash: 'ignore',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
    assets: '_astro',
  },
  image: {
    // Use built-in sharp service for OG image and asset optimization
    service: { entrypoint: 'astro/assets/services/sharp' },
  },
  integrations: [
    tailwind({
      applyBaseStyles: false, // we own base styles via brand.css
    }),
    mdx(),
    sitemap({
      i18n: {
        defaultLocale: 'ku',
        locales: {
          ku: 'ku-IQ',
          en: 'en-US',
          ar: 'ar-IQ',
        },
      },
      filter: (page) =>
        // Exclude /pay (handled by app) and any /api stubs
        !page.includes('/api/') && !page.includes('/pay/'),
    }),
  ],
  i18n: {
    defaultLocale: 'ku',
    locales: ['ku', 'en', 'ar'],
    routing: {
      prefixDefaultLocale: false, // / → ku (default), /en/, /ar/
      redirectToDefaultLocale: false,
    },
    fallback: {
      en: 'ku',
      ar: 'ku',
    },
  },
  vite: {
    ssr: {
      noExternal: ['i18next'],
    },
  },
});
