import React, { Suspense, useEffect } from 'react';
import { BrowserRouter, useRoutes, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, theme as antTheme } from 'antd';
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

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', appTheme);
  }, [appTheme]);

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
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: isDark ? {
          colorPrimary: '#60A5FA',
          colorBgBase: '#0a0a0f',
          colorBgContainer: 'rgba(255,255,255,0.03)',
          colorBgElevated: 'rgba(255,255,255,0.06)',
          colorBgLayout: '#0a0a0f',
          colorBorder: 'rgba(255,255,255,0.08)',
          colorBorderSecondary: 'rgba(255,255,255,0.05)',
          colorText: '#f8fafc',
          colorTextSecondary: '#94a3b8',
          colorTextTertiary: '#64748b',
          borderRadius: 12,
          fontFamily: isRTL ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif",
        } : {
          colorPrimary: '#1F6FEB',
          colorInfo: '#0EA5E9',
          colorSuccess: '#16A34A',
          colorWarning: '#F59E0B',
          colorError: '#DC2626',
          colorBgBase: '#FFFFFF',
          colorBgLayout: '#F8FAFC',
          colorBgContainer: '#FFFFFF',
          colorBgElevated: '#FFFFFF',
          colorBorder: '#E5E7EB',
          colorBorderSecondary: '#EEF1F5',
          colorText: '#0F172A',
          colorTextSecondary: '#334155',
          colorTextTertiary: '#64748B',
          colorTextQuaternary: '#94A3B8',
          borderRadius: 8,
          borderRadiusLG: 14,
          borderRadiusSM: 6,
          fontSize: 14,
          fontFamily: isRTL ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif",          controlHeight: 36,
          wireframe: false,
        },
        components: isDark ? {
          Card: { colorBgContainer: 'rgba(255,255,255,0.03)', borderRadiusLG: 16 },
          Table: { colorBgContainer: 'transparent', headerBg: 'rgba(255,255,255,0.04)' },
          Menu: { darkItemBg: 'transparent', darkItemSelectedBg: 'rgba(99,102,241,0.15)' },
          Button: { primaryShadow: '0 4px 12px rgba(99,102,241,0.3)' },
          Input: { colorBgContainer: 'rgba(255,255,255,0.03)' },
          Select: { colorBgContainer: 'rgba(255,255,255,0.03)' },
          Modal: { contentBg: '#12121a' },
        } : {
          Card: { borderRadiusLG: 14, paddingLG: 20 },
          Table: { headerBg: '#FBFCFD', headerColor: '#334155', rowHoverBg: 'rgba(31,111,235,0.04)', borderRadius: 10, headerSplitColor: 'transparent' },
          Button: { borderRadius: 6, controlHeight: 36, fontWeight: 500 },
          Modal: { borderRadiusLG: 14, paddingContentHorizontalLG: 24 },
          Drawer: { paddingLG: 24 },
          Menu: { itemBorderRadius: 8, subMenuItemBg: 'transparent', itemHeight: 38 },
          Tabs: { titleFontSize: 14, horizontalItemPadding: '10px 4px', inkBarColor: '#1F6FEB' },
          Input: { borderRadius: 6, controlHeight: 36 },
          Select: { borderRadius: 6, controlHeight: 36 },
          DatePicker: { borderRadius: 6 },
          Tag: { borderRadiusSM: 6 },
          Tooltip: { borderRadius: 6, colorBgSpotlight: 'rgba(15,23,42,0.92)' },
          Popover: { borderRadiusLG: 10 },
          Dropdown: { borderRadiusLG: 10, paddingBlock: 6 },
          Segmented: { borderRadius: 6 },
        },
      }}
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
