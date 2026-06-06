import React, { useState, useEffect, useCallback } from 'react';
import { Layout, Drawer } from 'antd';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';
import api from '../api';
import { useOnboardingStore } from '../onboarding/store';
import { selectIsPendingModuleApproval } from '../onboarding/selectors';
import OnboardingWizard from '../onboarding/OnboardingWizard';
import ErrorBoundary from '../components/ErrorBoundary';
import { ModuleGuard } from '../components/ModuleGuard';
import { TwoFactorSetupGuard } from '../components/TwoFactorSetupGuard';
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
import { ConnectionStatus } from '../design-system';
import { useUiStore } from '../stores/uiStore';
import { useCommandStore } from '../stores/commandStore';
import { useToastBridge } from '../design-system/Toast';
import {
  TopMegaMenu, BottomNav, WorkspaceTabs, AppsLauncher, CommandHero, LayoutQuickDock,
  SplitMasterPanel, DashboardKpiStrip,
  SIDEBAR_HIDDEN_MODES, FORCE_COLLAPSED_MODES, SHOW_TABS_MODES,
} from './LayoutChrome';
import { palette, space, motion, densityPagePadding } from '../theme/tokens';
import ImpersonationBanner from '../platform/components/ImpersonationBanner';
import PlatformAnnouncementBanner from '../platform/components/PlatformAnnouncementBanner';
// growth-to-100 § G2 (support): global help launcher + NPS survey. Both defer
// their network/SDK work until interaction, so they are safe to always mount.
import HelpWidget from '../components/help/HelpWidget';
import NPSSurvey from '../components/NPSSurvey';
// growth-to-100 § G2 — tenant (RFC-8693 read-only) impersonation banner. Distinct
// from the platform "view as user" banner above; the two are driven by separate
// token systems and never display at the same time. Self-hides when no G2 token.
import TenantImpersonationBanner from '../components/ImpersonationBanner';
import { RoleAccentProvider } from '../components/role/RoleAccentProvider';
import RoleWelcomeSheet from '../components/role/RoleWelcomeSheet';
import { useViewport } from '../hooks/useViewport';
import { usePermission } from '../hooks/usePermission';

/**
 * Sidebar width constants per spec requirements 4.2, 4.3.
 * Expanded: 248px (Vertex), Collapsed: 64px.
 */
const SIDER_WIDTH_COMFORTABLE = 248;
const SIDER_WIDTH_COMPACT = 248;
const SIDER_COLLAPSED = 64;

/**
 * AppShell — modern shell: SideNav + TopBar + Content + CommandPalette ⌘K.
 * Replaces legacy AppLayout. Token-driven, RTL-aware, dark-mode-aware.
 */
export const AppShell: React.FC = () => {
  const { i18n: _i18n, t } = useTranslation();
  const { theme: appTheme } = useAuthStore();
  const { isMobile, isTablet } = useViewport();
  const orgId = useAuthStore(s => s.orgId);
  const layoutMode = useAuthStore(s => s.layoutMode);
  const { isTenantOrgAdmin, hasPerm } = usePermission();
  const canManageSettings = isTenantOrgAdmin || hasPerm('settings.update');
  // Use uiStore.language as reactive source — i18n.language alone doesn't trigger re-render
  const storeLanguage = useUiStore(s => s.language);
  const isRTL = storeLanguage === 'ku' || storeLanguage === 'ar';
  const isDark = appTheme === 'dark';
  const sidebarHidden = SIDEBAR_HIDDEN_MODES.includes(layoutMode) || isMobile;
  const forceCollapsed = FORCE_COLLAPSED_MODES.includes(layoutMode);
  const showTabs = SHOW_TABS_MODES.includes(layoutMode);
  const showBottomNav = layoutMode === 'mobile-bottom-nav' || isMobile;
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
  const isPendingLocked = useOnboardingStore(selectIsPendingModuleApproval);
  const loadMyRequest = useOnboardingStore(s => s.loadMyRequest);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Re-hydrate onboarding state whenever the active org changes (login/signup/switch).
  useEffect(() => {
    if (orgId && orgId !== storeOrgId) {
      void loadForOrg(orgId, { canManageSettings });
    }
  }, [orgId, storeOrgId, loadForOrg, canManageSettings]);

  // Auto-open the wizard whenever the store decides we must (fresh signup or never-onboarded).
  // Skip while mandatory 2FA setup is pending — user must reach Security settings first.
  const [needs2faSetup, setNeeds2faSetup] = useState(false);
  useEffect(() => {
    if (!orgId) return;
    api.get('/api/auth/me')
      .then((r) => setNeeds2faSetup(Boolean(r.data?.requires_2fa_setup)))
      .catch(() => setNeeds2faSetup(false));
  }, [orgId]);

  useEffect(() => {
    const on2faDone = () => setNeeds2faSetup(false);
    window.addEventListener('2fa-setup-complete', on2faDone);
    return () => window.removeEventListener('2fa-setup-complete', on2faDone);
  }, []);

  useEffect(() => {
    if (needs2faSetup) return;
    if (forceOpen || isPendingLocked) {
      const t = setTimeout(() => setWizardOpen(true), 300);
      return () => clearTimeout(t);
    }
  }, [forceOpen, isPendingLocked, needs2faSetup]);

  // Poll for approval status while locked on pending screen.
  useEffect(() => {
    if (!isPendingLocked) return;
    const id = window.setInterval(() => { void loadMyRequest(); }, 30000);
    return () => window.clearInterval(id);
  }, [isPendingLocked, loadMyRequest]);

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
  // Page padding follows the density token (compact 16 / comfortable 20 / spacious 24)
  // so the user's density setting actually affects the content gutter, not just
  // control height + sider width. Falls back to space.xl (24) for any unknown value.
  const pagePad = densityPagePadding[densityFull] ?? space.xl;
  const handleSideDensity = (d: 'compact' | 'comfortable') => setDensity(d);
  // Command palette state — driven by commandStore (session-only, no persist)
  const paletteOpen = useCommandStore(s => s.open);
  const openPalette = useCommandStore(s => s.openPalette);
  const closePalette = useCommandStore(s => s.closePalette);
  const setPaletteOpen = (v: boolean) => v ? openPalette() : closePalette();
  const [sectionDocsKey, setSectionDocsKey] = useState<string | null>(null);

  // Mobile SideNav drawer state — Requirement 1.3, 4.1
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Auto-collapse sidebar on tablet — Requirement 1.9
  useEffect(() => {
    if (isTablet && !collapsed) {
      setSidebarCollapsed(true);
    }
  }, [isTablet]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Use CSS logical property marginInlineStart so RTL/LTR is handled automatically.
  // Requirements: 4.1, 10.1

  const toggle = useCallback(() => {
    if (isMobile) {
      // On mobile: toggle the drawer overlay — Requirement 1.3
      setDrawerOpen(prev => !prev);
      return;
    }
    if (forceCollapsed) return;
    setSidebarCollapsed(!collapsed);
  }, [isMobile, forceCollapsed, collapsed, setSidebarCollapsed]);
  // Vertex kit: flat canvas (no glass/gradient). Content cards provide the surfaces.
  const shellBg = isDark ? palette.darkBg : palette.bg;

  // Pending module approval — hide app chrome; only wizard + account controls.
  if (isPendingLocked) {
    return (
      <Layout
        className="responsive-shell responsive-shell--pending-lock"
        style={{
          minHeight: '100vh',
          background: shellBg,
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <OnboardingWizard
          open
          firstTime={false}
          onClose={() => {}}
          onComplete={() => setWizardOpen(false)}
        />
        {toastHolder}
      </Layout>
    );
  }

  return (
    <RoleAccentProvider>
    <Layout className="responsive-shell" style={{
      minHeight: '100vh',
      background: shellBg,
      direction: isRTL ? 'rtl' : 'ltr',
      // Safe-area insets on root — Requirements 1.6, 1.7, 10.1
      paddingInlineStart: 'env(safe-area-inset-left, 0px)',
      paddingInlineEnd: 'env(safe-area-inset-right, 0px)',
      paddingBlockStart: 'env(safe-area-inset-top, 0px)',
    }}>
      <SkipToContent />
      <ImpersonationBanner />
      <PlatformAnnouncementBanner />

      {/* Desktop/Tablet: SideNav inline — hidden on mobile */}
      {!sidebarHidden && !isMobile && (
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

      {/* Mobile: SideNav as Drawer overlay — Requirements 1.3, 1.4, 4.3–4.6, 16.6 */}
      {isMobile && (
        <Drawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          placement={isRTL ? 'right' : 'left'}
          width={Math.min(320, window.innerWidth * 0.92)}
          closable={false}
          rootStyle={{ top: 'calc(56px + env(safe-area-inset-top, 0px))', height: 'calc(100% - 56px - env(safe-area-inset-top, 0px))' }}
          mask={true}
          maskStyle={{ top: 'calc(56px + env(safe-area-inset-top, 0px))' }}
          styles={{
            body: {
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              background: 'var(--surface)',
            },
          }}
          role="navigation"
          aria-label={t('nav.main', 'Main navigation')}
        >
          <SideNav
            collapsed={false}
            width={Math.min(320, window.innerWidth * 0.92)}
            collapsedWidth={SIDER_COLLAPSED}
            isRTL={isRTL}
            isDark={isDark}
            density={density}
            onDensityChange={handleSideDensity}
            onOpenPalette={() => { setPaletteOpen(true); setDrawerOpen(false); }}
            onOpenSectionDocs={(key) => { setSectionDocsKey(key); setDrawerOpen(false); }}
          />
        </Drawer>
      )}

      {showSplitMaster && <SplitMasterPanel isDark={isDark} isRTL={isRTL} />}
      <Layout style={{ marginInlineStart: isMobile ? 0 : sideOffset, transition: `margin-inline-start ${motion.durBase}ms ${motion.easeStandard}`, background: 'transparent' }}>
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
            drawerOpen={drawerOpen}
          />
        )}
        {/* Offline indicator banner — Requirement 4.12 */}
        <ConnectionStatus variant="banner" />
        {showTabs && <WorkspaceTabs isDark={isDark} isRTL={isRTL} />}
        {showDashboardKpis && <DashboardKpiStrip isDark={isDark} />}
        <Layout.Content id="main-content" style={{
          // Vertex kit: flat, flush content canvas — no floating glass panel.
          // Cards/tables inside (var(--surface)) provide the raised surfaces.
          margin: 0,
          marginBottom: showBottomNav ? 80 : 0,
          paddingInlineStart: isMobile ? `max(16px, env(safe-area-inset-left, 0px))` : `max(${pagePad}px, env(safe-area-inset-left, 0px))`,
          paddingInlineEnd:   isMobile ? `max(16px, env(safe-area-inset-right, 0px))` : `max(${pagePad}px, env(safe-area-inset-right, 0px))`,
          paddingBlockStart:  isMobile ? '16px' : `${pagePad}px`,
          // On mobile: extra bottom padding to clear BottomNav + safe-area
          paddingBlockEnd: isMobile
            ? 'calc(80px + env(safe-area-inset-bottom, 0px))'
            : `${pagePad}px`,
          background: isDark ? palette.darkBg : palette.bg,
          borderRadius: 0,
          minHeight: isMobile ? 'calc(100dvh - 56px)' : 'calc(100vh - 56px)',
          border: 'none',
          boxShadow: 'none',
          backdropFilter: 'none',
          overflow: isMobile ? 'visible' : 'hidden',
          maxInlineSize: '100%',
          boxSizing: 'border-box',
        }}>
          <ErrorBoundary>
            <TwoFactorSetupGuard>
            <ModuleGuard>
              {showAppsLauncher && window.location.pathname === '/' ? (
                <AppsLauncher isDark={isDark} />
              ) : (
                <Outlet />
              )}
            </ModuleGuard>
            </TwoFactorSetupGuard>
          </ErrorBoundary>
        </Layout.Content>
        {!showBottomNav && <Footer isDark={isDark} isRTL={isRTL} />}
      </Layout>
      {showBottomNav && <BottomNav isDark={isDark} onOpenPalette={() => setPaletteOpen(true)} />}
      {showCommandHero && <CommandHero isDark={isDark} onOpenPalette={() => setPaletteOpen(true)} />}
      {sidebarHidden && !showTopMega && !isMobile && (
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
      <RoleWelcomeSheet />
      {/* growth-to-100 § G2 — global support UX + tenant impersonation banner */}
      <TenantImpersonationBanner />
      <HelpWidget />
      <NPSSurvey />
    </Layout>
    </RoleAccentProvider>
  );
};

export default AppShell;
