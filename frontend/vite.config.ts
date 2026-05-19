import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
  },
  server: {
    port: 5173,
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
    rollupOptions: {
      output: {
        // Code splitting: داواکاری ٥.٤، ٥.١٠
        // Chunks are ordered from most specific to least specific to avoid
        // a module matching multiple buckets (first match wins).
        manualChunks(id: string) {
          // help: lazy-loaded Help_Registry chunk
          // (system-wide-ux-overhaul, R8.1, R8.3, R15.5, R16.1, task 2.2).
          // The registry module is dynamically imported by `useHelp` on first
          // Help_Icon activation; isolating it as its own chunk keeps the
          // initial bundle under the per-route budget defined in
          // `frontend/perf-budgets.json` (R5.6, R15.1) and lets the help
          // payload fail independently from the rest of the app — `useHelp`
          // falls back to the always-bundled `help.unavailable.message` key
          // when this chunk fails to load (R6.1, R8.4). The registry's only
          // sibling (`sectionIds.ts`) is intentionally excluded so it remains
          // tree-shakeable for type-only consumers.
          if (id.includes('/src/help/registry')) {
            return 'help';
          }
          // vendor-antd: Ant Design components and icons
          if (
            id.includes('node_modules/antd') ||
            id.includes('node_modules/@ant-design/')
          ) {
            return 'vendor-antd';
          }
          // vendor-charts: Recharts and any chart-related deps
          if (id.includes('node_modules/recharts')) {
            return 'vendor-charts';
          }
          // vendor-motion: Framer Motion
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-motion';
          }
          // vendor-react: React core, React DOM, React Router, and
          // all remaining React-ecosystem packages (react-i18next, etc.)
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/react-router-dom') ||
            id.includes('node_modules/react-i18next') ||
            id.includes('node_modules/@tanstack/react-query')
          ) {
            return 'vendor-react';
          }
          // vendor-firebase: Firebase SDK
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';
          }
          // vendor-utils: remaining utility libraries
          if (
            id.includes('node_modules/dayjs') ||
            id.includes('node_modules/i18next') ||
            id.includes('node_modules/axios') ||
            id.includes('node_modules/zustand')
          ) {
            return 'vendor-utils';
          }
        },
      },
    },
  },
})
