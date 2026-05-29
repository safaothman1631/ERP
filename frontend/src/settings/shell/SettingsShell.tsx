import React, { useEffect, useMemo, useState } from 'react';
import { Drawer, Result } from 'antd';
import { LockOutlined, SettingOutlined, UserOutlined, CloseOutlined, RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useOnboardingStore } from '../../onboarding/store';
import { useAuthStore } from '../../store';
import { usePermission } from '../../hooks/usePermission';
import { useVisibleSections } from '../hooks/useVisibleSections';
import { useSettingsAccess, getDefaultSettingsSection } from '../hooks/useSettingsAccess';
import { useSettingsSectionsSync } from '../hooks/useSettingsSectionsSync';
import type { SectionKey, SectionGroup } from '../registry/types';
import SettingsGateBanner from '../components/SettingsGateBanner';
import SettingsNav from './SettingsNav';
import { useSettingsRouteGuard } from './SettingsRouteGuard';
import { SettingsEditContext } from './SettingsEditContext';
import { sectionSubtitle } from '../sections/bodies';
import SettingsSectionPanel from '../sections/SettingsSectionPanel';
import PremiumPageHeader from '../../components/ui/PremiumPageHeader';
import { palette } from '../../theme/tokens';
import { ComingSoon } from '../../components/feedback/ComingSoon';
import { settingsCss } from './settingsStyles';
import { buildSectionIconMap } from './sectionIcons';

interface SectionDef {
  key: SectionKey;
  label: string;
  icon: React.ReactNode;
  description?: string;
  group: SectionGroup;
  link?: string;
  badge?: 'beta' | 'new' | 'soon';
}

const SettingsShell: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const { isAuthenticated, role, permissions } = usePermission();
  const enabledModules = useOnboardingStore((s) => s.enabledModules);

  const defaultSection = useMemo(
    () => getDefaultSettingsSection(role, enabledModules, permissions),
    [role, enabledModules, permissions],
  );

  const requested = (params.get('s') as SectionKey) || defaultSection;
  const [active, setActive] = useState<SectionKey>(requested);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1024,
  );

  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = windowWidth < 900;
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const sectionIconMap = useMemo(() => buildSectionIconMap(), []);

  const visibleBindings = useVisibleSections(
    t as (key: string, fallback?: string) => unknown,
    sectionIconMap,
    enabledModules,
    role,
    permissions,
    true,
  );

  const sections: SectionDef[] = useMemo(
    () =>
      visibleBindings.map((b) => ({
        key: b.key,
        group: b.group as SectionGroup,
        label: b.label,
        icon: b.icon ?? <SettingOutlined />,
        link: b.route,
      })),
    [visibleBindings],
  );

  useSettingsSectionsSync(sections.map((s) => s.key));

  const sectionAccess = useSettingsAccess(active);

  useEffect(() => {
    const next = (params.get('s') as SectionKey) || defaultSection;
    if (next !== active) setActive(next);
  }, [params, defaultSection, active]);

  const goto = (key: SectionKey) => {
    setActive(key);
    setParams({ s: key }, { replace: true });
    setNavDrawerOpen(false);
  };

  const groupLabels: Record<SectionGroup, string> = {
    account: t('settings_group_account', 'Account'),
    general_app: t('settings_group_general', 'General'),
    organization: t('settings_group_org', 'Organization'),
    users: t('settings_group_users', 'Users & access'),
    localization: t('settings_group_l10n', 'Localization'),
    finance: t('settings_group_finance', 'Finance & compliance'),
    commerce: t('settings_group_commerce', 'Sales, CRM & operations'),
    operations: t('settings_group_ops', 'HR, projects & marketing'),
    automation: t('settings_group_auto', 'Automation & API'),
    content: t('settings_group_content', 'Content & messaging'),
    system: t('settings_group_system', 'System'),
  };

  const activeDef = sections.find((s) => s.key === active) ??
    sections[0] ?? {
      key: 'profile' as SectionKey,
      group: 'account' as SectionGroup,
      label: t('profile'),
      icon: <UserOutlined />,
    };

  useSettingsRouteGuard({
    isAuthenticated,
    requested: (params.get('s') as SectionKey) || defaultSection,
    enabledModules,
    role,
    permissions,
    setActive,
    setParams: (next, opts) => setParams(next, opts),
    t,
  });

  const navList = (
    <SettingsNav
      sections={sections}
      active={active}
      groupLabels={groupLabels}
      onSelect={goto}
      onExternalNav={() => setNavDrawerOpen(false)}
      t={t}
    />
  );

  if (!isAuthenticated) {
    return (
      <Result
        status="403"
        title={t('access_denied', 'Access Denied')}
        subTitle={t('login_required', 'Please sign in to access Settings.')}
        icon={<LockOutlined style={{ color: palette.primary500 }} />}
      />
    );
  }

  return (
    <>
      <style>{settingsCss}</style>
      {isMobile && (
        <Drawer
          open={navDrawerOpen}
          onClose={() => setNavDrawerOpen(false)}
          placement="bottom"
          height="82vh"
          closable={false}
          styles={{
            body: {
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: isDark ? '#0B1220' : '#FAFBFC',
            },
            wrapper: { borderRadius: '20px 20px 0 0', overflow: 'hidden' },
          }}
          rootStyle={{ zIndex: 1100 }}
        >
          <div className="st-drawer-header">
            <div className="st-drawer-handle" />
            <div className="st-drawer-title">
              <SettingOutlined style={{ fontSize: 16, color: palette.primary500, marginInlineEnd: 8 }} />
              {t('settings', 'Settings')}
            </div>
            <button className="st-drawer-close" onClick={() => setNavDrawerOpen(false)} aria-label="Close">
              <CloseOutlined />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 32px' }}>{navList}</div>
        </Drawer>
      )}

      <div className="st-shell">
        {!isMobile && (
          <aside className="st-aside">
            <div className="st-aside-head">
              <div className="st-aside-title">
                <SettingOutlined style={{ fontSize: 18, color: palette.primary500, marginInlineEnd: 8 }} />
                {t('settings', 'Settings')}
              </div>
            </div>
            {navList}
          </aside>
        )}

        <main className="st-main">
          {isMobile && (
            <button
              className="st-mobile-nav-bar"
              onClick={() => setNavDrawerOpen(true)}
              aria-label={t('settings_open_nav', 'Open settings navigation')}
            >
              <span className="st-mobile-nav-icon">{activeDef.icon}</span>
              <span className="st-mobile-nav-text">
                <span className="st-mobile-nav-eyebrow">{t('settings', 'Settings')}</span>
                <span className="st-mobile-nav-label">{activeDef.label}</span>
                <span className="st-mobile-nav-hint">{t('settings_tap_to_switch', 'Tap to switch section')}</span>
              </span>
              <span className="st-mobile-nav-chevron-wrap">
                <RightOutlined />
              </span>
            </button>
          )}

          <PremiumPageHeader
            eyebrow={t('settings', 'Settings')}
            title={activeDef.label}
            subtitle={
              activeDef.description ??
              sectionSubtitle(activeDef.key, t as unknown as (k: string, fb?: string) => unknown)
            }
            icon={activeDef.icon}
            sectionId={`settings.${activeDef.key}` as never}
          />

          <div className="st-content">
            <SettingsEditContext.Provider value={sectionAccess.canEdit}>
              <SettingsGateBanner reason={sectionAccess.denyReason} />
              {!sectionAccess.canView ? (
                <Result
                  status="403"
                  title={t('access_denied', 'Access Denied')}
                  subTitle={
                    sectionAccess.denyReason === 'module_disabled'
                      ? t('settings.gate.module_disabled', 'This section requires a module that is not enabled.')
                      : t('settings.gate.permission_denied', 'You do not have permission to view this section.')
                  }
                />
              ) : activeDef.badge === 'soon' ? (
                <ComingSoon featureNameKey={activeDef.key} />
              ) : (
                <SettingsSectionPanel active={active} />
              )}
            </SettingsEditContext.Provider>
          </div>
        </main>
      </div>
    </>
  );
};

export default SettingsShell;
