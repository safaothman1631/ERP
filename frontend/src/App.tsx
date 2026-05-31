import React, { Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, useRoutes, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './store';
import { useSettingsStore } from './store/settingsStore';
import PageTransition from './components/PageTransition';
import { setMessageInstance } from './utils/message';
import { routes } from './App.routes';
import { LoadingSkeleton } from './design-system/LoadingSkeleton';
import { isRTLLanguage, resolveLanguage } from './utils/language';
// Vertex "Slate & Signal" theme — the single root ConfigProvider builds from
// this so the whole app (AntD + custom components) renders in violet + slate.
import { buildVertexTheme, vertexCssVars, PALETTE } from './theme/vertexTheme';
import { controlHeight as densityControlHeight } from './theme/tokens';
import { useUiStore } from './stores/uiStore';
import { usePermission } from './hooks/usePermission';
import { useRoleUx } from './hooks/useRoleUx';

/**
 * Global React Query client — configured per design spec:
 * - staleTime: 5 minutes (data stays fresh for 5 min before background refetch)
 * - gcTime: 30 minutes (unused cache entries are garbage-collected after 30 min)
 * - stale-while-revalidate: refetchOnWindowFocus keeps data fresh
 * - retry: 2 attempts on failure
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,   // 5 خولەک
      gcTime: 30 * 60 * 1000,      // 30 خولەک
      refetchOnWindowFocus: true,
      retry: 2,
    },
  },
});

/**
 * Drives the global `<Routes>` from the JS-importable `routes` array exported
 * from `./App.routes`. Using `useRoutes` (instead of `<Routes>`/`<Route>` JSX)
 * means the audit (`scripts/nav-audit.mjs`) and the Playwright sweep
 * (`tests/e2e/nav-sweep.spec.ts`) can import the same array and apply
 * `matchRoutes` with semantics identical to the runtime.
 *
 * AnimatePresence is keyed on the pathname so that exit animations fire
 * when navigating between pages (Requirement 4.2).
 */
const RoutesElement: React.FC = () => {
  const location = useLocation();
  const element = useRoutes(routes, location);
  return (
    <AnimatePresence mode="wait" initial={false}>
      {element && React.cloneElement(element, { key: location.pathname })}
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const { i18n } = useTranslation();
  const { theme: appTheme, isAuthenticated } = useAuthStore();
  const loadSettings = useSettingsStore((s) => s.load);
  // Resolve language and determine RTL — supports ku, en, ar (Requirements 3.5, 3.6, 10.3)
  const currentLang = resolveLanguage(i18n.language || 'ku');
  const isRTL = isRTLLanguage(currentLang);
  const isDark = appTheme === 'dark';
  const density = useUiStore((s) => s.density);

  // colorPrimary follows the active role's Vertex accent; before a role is known
  // (e.g. the login screen) it falls back to the brand violet.
  const { role } = usePermission();
  const roleUx = useRoleUx();
  const accent = role ? roleUx.theme.accent : PALETTE.accent;

  const vertexThemeConfig = useMemo(
    () =>
      buildVertexTheme({
        dark: isDark,
        accent,
        isRTL,
        controlHeight: densityControlHeight[density] ?? 36,
      }),
    [isDark, accent, isRTL, density],
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

  // Inject the Vertex token CSS variables once so custom (non-AntD) components
  // resolve --accent-*/--bg/--surface/--ink-* from the same source as AntD. The
  // dark override keys off [data-theme="dark"] (set above); re-injects on accent change.
  useEffect(() => {
    const STYLE_ID = 'vertex-tokens';
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = vertexCssVars(accent);
  }, [accent]);

  // Apply RTL/LTR direction and lang attribute on language change (Requirements 3.5, 3.6)
  useEffect(() => {
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
    document.documentElement.setAttribute('lang', currentLang);
  }, [currentLang, isRTL]);

  useEffect(() => {
    if (isAuthenticated) loadSettings();
  }, [isAuthenticated, loadSettings]);

  return (
    <QueryClientProvider client={queryClient}>
    <ConfigProvider
      direction={isRTL ? 'rtl' : 'ltr'}
      theme={vertexThemeConfig}
    >
      <AntApp>
        <AppInitializer />
      <BrowserRouter>
        <Suspense fallback={<PageTransition><LoadingSkeleton variant="table" /></PageTransition>}>
          <RoutesElement />
        </Suspense>
      </BrowserRouter>
      </AntApp>
    </ConfigProvider>
    </QueryClientProvider>
  );
};

/**
 * Registers the App.useApp() message instance globally so pages can import
 * from '../utils/message' without hooks.
 */
const AppInitializer: React.FC = () => {
  const { message } = AntApp.useApp();
  useEffect(() => { setMessageInstance(message); }, [message]);
  return null;
};

export default App;
