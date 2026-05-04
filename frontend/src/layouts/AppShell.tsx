import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from 'antd';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';
import { useOnboardingStore } from '../onboarding/store';
import OnboardingWizard from '../onboarding/OnboardingWizard';
import ErrorBoundary from '../components/ErrorBoundary';
import { ModuleGuard } from '../components/ModuleGuard';
import SideNav from './SideNav';
import TopBar from './TopBar';
import CommandPalette from './CommandPalette';
import SectionDocsDrawer from '../components/SectionDocsDrawer';
import SkipToContent from '../components/SkipToContent';
import Footer from './Footer';
import NotificationsDrawer from './NotificationsDrawer';
import QuickCreateMenu, { useQuickCreateKeyboard } from './QuickCreateMenu';
import ShortcutCheatsheet from './ShortcutCheatsheet';
import { QuickSearch } from '../design-system';
import { useUiStore } from '../stores/uiStore';
import { useToastBridge } from '../design-system/Toast';
import {
  TopMegaMenu, BottomNav, WorkspaceTabs, AppsLauncher, CommandHero, LayoutQuickDock,
  SplitMasterPanel, DashboardKpiStrip,
  SIDEBAR_HIDDEN_MODES, FORCE_COLLAPSED_MODES, SHOW_TABS_MODES,
} from './LayoutChrome';
import { palette, space, radius, motion, shadow } from '../theme/tokens';

const SIDER_WIDTH_COMFORTABLE = 248;
const SIDER_WIDTH_COMPACT = 224;
const SIDER_COLLAPSED = 56;

/**
 * AppShell — modern shell: SideNav + TopBar + Content + CommandPalette ⌘K.
 * Replaces legacy AppLayout. Token-driven, RTL-aware, dark-mode-aware.
 */
export const AppShell: React.FC = () => {
  const { i18n } = useTranslation();
  const { theme: appTheme } = useAuthStore();
  const orgId = useAuthStore(s => s.orgId);
  const layoutMode = useAuthStore(s => s.layoutMode);
  const isRTL = i18n.language === 'ku' || i18n.language === 'ar';
  const isDark = appTheme === 'dark';
  const sidebarHidden = SIDEBAR_HIDDEN_MODES.includes(layoutMode);
  const forceCollapsed = FORCE_COLLAPSED_MODES.includes(layoutMode);
  const showTabs = SHOW_TABS_MODES.includes(layoutMode);
  const showBottomNav = layoutMode === 'mobile-bottom-nav';
  const showTopMega = layoutMode === 'top-megamenu';
  const showAppsLauncher = layoutMode === 'apps-launcher';
  const showCommandHero = layoutMode === 'command-centric';
  const showSplitMaster = layoutMode === 'split-master-detail';
  const showDashboardKpis = layoutMode === 'dashboard-first';
  const isAppsLauncherHome = showAppsLauncher && typeof window !== 'undefined' && window.location.pathname === '/';

  // Reflect on <html> for theming hooks
  useEffect(() => {
    document.documentElement.setAttribute('data-layout', layoutMode);
  }, [layoutMode]);

  // ── Onboarding (org-scoped, backend-synced) ───────────────────────
  const onboardingCompleted = useOnboardingStore(s => s.completed);
  const forceOpen = useOnboardingStore(s => s.forceOpen);
  const loadForOrg = useOnboardingStore(s => s.loadForOrg);
  const clearForceOpen = useOnboardingStore(s => s.clearForceOpen);
  const storeOrgId = useOnboardingStore(s => s.orgId);
  const hydrateFromStorageEvent = useOnboardingStore(s => s.hydrateFromStorageEvent);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Re-hydrate onboarding state whenever the active org changes (login/signup/switch).
  useEffect(() => {
    if (orgId && orgId !== storeOrgId) {
      void loadForOrg(orgId);
    }
  }, [orgId, storeOrgId, loadForOrg]);

  // Auto-open the wizard whenever the store decides we must (fresh signup or never-onboarded).
  useEffect(() => {
    if (forceOpen) {
      const t = setTimeout(() => setWizardOpen(true), 300);
      return () => clearTimeout(t);
    }
  }, [forceOpen]);

  // External "open onboarding" button (Settings page).
  useEffect(() => {
    const handler = () => setWizardOpen(true);
    window.addEventListener('open-onboarding', handler);
    return () => window.removeEventListener('open-onboarding', handler);
  }, []);

  // Cross-tab sync: another tab finished onboarding → mirror its cache.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('zoho_onboarding_cache_v1:')) hydrateFromStorageEvent();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [hydrateFromStorageEvent]);

  const collapsed = useUiStore(s => s.sidebarCollapsed);
  const setSidebarCollapsed = useUiStore(s => s.setSidebarCollapsed);
  const densityFull = useUiStore(s => s.density);
  const setDensity = useUiStore(s => s.setDensity);
  // SideNav only supports compact|comfortable; spacious widens like comfortable
  const density: 'compact' | 'comfortable' = densityFull === 'compact' ? 'compact' : 'comfortable';
  const handleSideDensity = (d: 'compact' | 'comfortable') => setDensity(d);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sectionDocsKey, setSectionDocsKey] = useState<string | null>(null);

  // Keyboard: c-then-X quick create sequences + ? cheatsheet (latter inside ShortcutCheatsheet)
  useQuickCreateKeyboard();

  // Toast bridge holder
  const toastHolder = useToastBridge();

  const SIDER_WIDTH = densityFull === 'compact' ? SIDER_WIDTH_COMPACT : SIDER_WIDTH_COMFORTABLE;

  // ⌘K / Ctrl K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const effectiveCollapsed = forceCollapsed || collapsed;
  const sideOffset = sidebarHidden ? 0 : (effectiveCollapsed ? SIDER_COLLAPSED : SIDER_WIDTH);
  const marginProp = isRTL ? 'marginRight' : 'marginLeft';

  const toggle = useCallback(() => {
    if (forceCollapsed) return;
    setSidebarCollapsed(!collapsed);
  }, [forceCollapsed, collapsed, setSidebarCollapsed]);
  const shellBg = isDark
    ? `radial-gradient(circle at top ${isRTL ? 'right' : 'left'}, rgba(31, 111, 235, 0.14), transparent 32%), ${palette.darkBg}`
    : `radial-gradient(circle at top ${isRTL ? 'right' : 'left'}, rgba(31, 111, 235, 0.09), transparent 28%), ${palette.bg}`;

  return (
    <Layout style={{ minHeight: '100vh', background: shellBg, direction: isRTL ? 'rtl' : 'ltr' }}>
      <SkipToContent />
      {!sidebarHidden && (
        <SideNav
          collapsed={effectiveCollapsed}
          width={SIDER_WIDTH}
          collapsedWidth={SIDER_COLLAPSED}
          isRTL={isRTL}
          isDark={isDark}
          density={density}
          onDensityChange={handleSideDensity}
          onOpenPalette={() => setPaletteOpen(true)}
          onOpenSectionDocs={(key) => setSectionDocsKey(key)}
        />
      )}
      {showSplitMaster && <SplitMasterPanel isDark={isDark} isRTL={isRTL} />}
      <Layout style={{ [marginProp]: sideOffset, transition: `margin ${motion.durBase}ms ${motion.easeStandard}`, background: 'transparent' }}>
        {showTopMega && (
          <TopMegaMenu isDark={isDark} isRTL={isRTL} onOpenPalette={() => setPaletteOpen(true)} />
        )}
        {!showTopMega && !showCommandHero && !isAppsLauncherHome && (
          <TopBar
            collapsed={effectiveCollapsed}
            onToggle={toggle}
            isRTL={isRTL}
            isDark={isDark}
            onOpenPalette={() => setPaletteOpen(true)}
          />
        )}
        {showTabs && <WorkspaceTabs isDark={isDark} isRTL={isRTL} />}
        {showDashboardKpis && <DashboardKpiStrip isDark={isDark} />}
        <Layout.Content id="main-content" style={{
          margin: space.lg,
          marginBottom: showBottomNav ? 80 : space.lg,
          padding: space.xl,
          background: isDark ? 'linear-gradient(180deg, rgba(17,26,46,0.98), rgba(17,26,46,0.94))' : 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.92))',
          borderRadius: radius.lg,
          minHeight: 'calc(100vh - 60px - 32px)',
          border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
          boxShadow: shadow.lg,
          backdropFilter: 'blur(18px)',
          overflow: 'hidden',
        }}>
          <ErrorBoundary>
            <ModuleGuard>
              {showAppsLauncher && window.location.pathname === '/' ? (
                <AppsLauncher isDark={isDark} />
              ) : (
                <Outlet />
              )}
            </ModuleGuard>
          </ErrorBoundary>
        </Layout.Content>
        {!showBottomNav && <Footer isDark={isDark} isRTL={isRTL} />}
      </Layout>
      {showBottomNav && <BottomNav isDark={isDark} onOpenPalette={() => setPaletteOpen(true)} />}
      {showCommandHero && <CommandHero isDark={isDark} onOpenPalette={() => setPaletteOpen(true)} />}
      {sidebarHidden && !showTopMega && (
        <LayoutQuickDock
          isDark={isDark}
          isRTL={isRTL}
          topOffset={showCommandHero ? 12 : 72}
        />
      )}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <SectionDocsDrawer
        sectionKey={sectionDocsKey}
        onClose={() => setSectionDocsKey(null)}
        isDark={isDark}
        isRTL={isRTL}
      />
      <OnboardingWizard
        open={wizardOpen}
        firstTime={!onboardingCompleted}
        onClose={() => { setWizardOpen(false); clearForceOpen(); }}
        onComplete={() => { setWizardOpen(false); clearForceOpen(); }}
      />
      {/* UI v2 chrome */}
      <NotificationsDrawer isDark={isDark} isRTL={isRTL} />
      <QuickCreateMenu isDark={isDark} />
      <ShortcutCheatsheet isDark={isDark} />
      <QuickSearch />
      {toastHolder}
    </Layout>
  );
};

export default AppShell;
