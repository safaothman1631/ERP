#!/usr/bin/env python3
"""Split Settings.tsx into SettingsShell + section bodies."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend/src/pages/Settings.tsx"
BODIES = ROOT / "frontend/src/settings/sections/bodies.tsx"
SHELL = ROOT / "frontend/src/settings/shell/SettingsShell.tsx"
PAGE = ROOT / "frontend/src/pages/Settings.tsx"
PANEL = ROOT / "frontend/src/settings/sections/SettingsSectionPanel.tsx"
CSS_OUT = ROOT / "frontend/src/settings/shell/settingsStyles.ts"

text = SRC.read_text(encoding="utf-8")
lines = text.splitlines()

# Find settingsCss block
css_start = next(i for i, l in enumerate(lines) if l.strip().startswith("const settingsCss"))
css_end = next(i for i in range(css_start, len(lines)) if lines[i].strip() == "`;")
css_content = "\n".join(lines[css_start:css_end + 1])
css_content = css_content.replace("const settingsCss = `", "export const settingsCss = `")

CSS_OUT.write_text(
    "// Auto-generated from Settings.tsx\n" + css_content + "\n",
    encoding="utf-8",
)

body_lines = lines[399:4842]
body_lines = [
    l.replace("React.useContext(SettingsEditContext)", "useSettingsEdit()")
    for l in body_lines
]

IMPORTS = '''/* eslint-disable -- extracted section bodies from legacy Settings.tsx */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Tag, Form, Input, InputNumber, DatePicker, Space,
  Row, Col, Popconfirm, Switch, Select, Tabs, TimePicker, Alert, Tooltip,
  Divider, Segmented, Result, Drawer } from 'antd';
import { message } from '../../utils/message';
import {
  PlusOutlined, DownloadOutlined, CloudOutlined, DeleteOutlined, LockOutlined,
  UserOutlined, BankOutlined, SafetyOutlined, BellOutlined, FileProtectOutlined,
  CalendarOutlined, FundOutlined, DollarOutlined, MailOutlined, DatabaseOutlined,
  HistoryOutlined, ClockCircleOutlined, FileTextOutlined, InfoCircleOutlined,
  AppstoreOutlined, SettingOutlined, KeyOutlined, GlobalOutlined,
  ThunderboltOutlined, RocketOutlined, CheckCircleOutlined,
  TeamOutlined, ApartmentOutlined, BgColorsOutlined, FieldTimeOutlined,
  GiftOutlined, IdcardOutlined, ClusterOutlined, SafetyCertificateOutlined,
  UsergroupAddOutlined, TranslationOutlined, NumberOutlined, PercentageOutlined,
  CreditCardOutlined, WalletOutlined, ShoppingCartOutlined, ShopOutlined,
  TagsOutlined, InboxOutlined, BuildOutlined, DesktopOutlined,
  ContactsOutlined, NotificationOutlined, MessageOutlined, ApiOutlined,
  CodeOutlined, BranchesOutlined, AuditOutlined, EyeInvisibleOutlined,
  MobileOutlined, FolderOpenOutlined, BookOutlined, CustomerServiceOutlined,
  HddOutlined, ProjectOutlined, SoundOutlined, RobotOutlined,
  PartitionOutlined, BulbOutlined, ExperimentOutlined,
  MenuOutlined, CloseOutlined, RightOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { buildEffectiveOptions, handleAddOptionChange } from '../../utils/buildAddOption';
import api from '../../api';
import dayjs from 'dayjs';
import { useOnboardingStore } from '../../onboarding/store';
import { INDUSTRIES, MODULES } from '../../onboarding/industries';
import { useAuthStore } from '../../store';
import { useSettingsStore } from '../../store/settingsStore';
import { usePermission } from '../../hooks/usePermission';
import type { SectionKey } from '../registry/types';
import ModuleSettingsCard from '../components/ModuleSettingsCard';
import SettingsModulesEmptyState from '../components/SettingsModulesEmptyState';
import FeatureFlagMirror from './system/FeatureFlagMirror';
import SectionCard from '../../components/ui/SectionCard';
import SettingsRow from '../../components/ui/SettingsRow';
import SectionHelpPopover from '../../components/ui/SectionHelpPopover';
import PremiumModal from '../../components/ui/PremiumModal';
import { palette, radius, space, fontSize } from '../../theme/tokens';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';
import { ComingSoon } from '../../components/feedback/ComingSoon';
import { useSettingsEdit } from '../shell/SettingsEditContext';

const { RangePicker } = DatePicker;

'''

EXPORTS = '''
export {
  sectionSubtitle,
  ProfileSettings,
  OrganizationSettings,
  SecuritySettings,
  NotificationSettings,
  PreferencesSettings,
  GeneralSettings,
  AppearanceSettings,
  BranchesSettings,
  BrandingSettings,
  WorkingHoursSettings,
  HolidaysSettings,
  UsersSettings,
  RolesSettings,
  PermissionsSettings,
  SsoSettings,
  PortalsSettings,
  LocalizationSettings,
  LanguagesSettings,
  FormatsSettings,
  ModulesSettings,
  FiscalYears,
  Budgets,
  Currencies,
  TaxesSettings,
  BankingSettings,
  PaymentMethodsSettings,
  InvoiceTemplates,
  ReminderSettings,
  EInvoiceSettings,
  SalesSettings,
  CrmSettings,
  PurchasesSettings,
  InventorySettings,
  MrpSettings,
  PosSettings,
  EcommerceSettings,
  HelpdeskSettings,
  HrSettings,
  PayrollSettings,
  ProjectsSettings,
  MarketingSettings,
  WorkflowsSettings,
  ApprovalsSettings,
  IntegrationsSettings,
  WebhooksSettings,
  ApiTokensSettings,
  DocumentsSettings,
  EmailSettings,
  SmsWhatsappSettings,
  BackupRestore,
  ActivityLog,
  AuditSettings,
  GdprSettings,
  MobileSettings,
  SystemInfo,
  SaveBar,
};
'''

body_text = IMPORTS + "\n".join(body_lines) + "\n" + EXPORTS
# Inject FeatureFlagMirror into ModulesSettings before closing SectionCard
body_text = body_text.replace(
    "      </SectionCard>\n    </Space>\n  );\n};\n\n// ─────────────────────── Fiscal",
    "        {(isAdmin || isOwner) && <FeatureFlagMirror />}\n      </SectionCard>\n    </Space>\n  );\n};\n\n// ─────────────────────── Fiscal",
    1,
)
# If pattern didn't match, try after enabled modules block
if "FeatureFlagMirror" not in body_text:
    body_text = body_text.replace(
        "        )}\n      </SectionCard>\n    </Space>\n  );\n};\n\n// ─────────────────────── Fiscal",
        "        )}\n        {(isAdmin || isOwner) && <FeatureFlagMirror />}\n      </SectionCard>\n    </Space>\n  );\n};\n\n// ─────────────────────── Fiscal",
        1,
    )

BODIES.write_text(body_text, encoding="utf-8")

PANEL.write_text(
    '''import React from 'react';
import type { SectionKey } from '../registry/types';
import {
  ProfileSettings,
  OrganizationSettings,
  SecuritySettings,
  NotificationSettings,
  PreferencesSettings,
  GeneralSettings,
  AppearanceSettings,
  BranchesSettings,
  BrandingSettings,
  WorkingHoursSettings,
  HolidaysSettings,
  UsersSettings,
  RolesSettings,
  PermissionsSettings,
  SsoSettings,
  PortalsSettings,
  LocalizationSettings,
  LanguagesSettings,
  FormatsSettings,
  ModulesSettings,
  FiscalYears,
  Budgets,
  Currencies,
  TaxesSettings,
  BankingSettings,
  PaymentMethodsSettings,
  InvoiceTemplates,
  ReminderSettings,
  EInvoiceSettings,
  SalesSettings,
  CrmSettings,
  PurchasesSettings,
  InventorySettings,
  MrpSettings,
  PosSettings,
  EcommerceSettings,
  HelpdeskSettings,
  HrSettings,
  PayrollSettings,
  ProjectsSettings,
  MarketingSettings,
  WorkflowsSettings,
  ApprovalsSettings,
  IntegrationsSettings,
  WebhooksSettings,
  ApiTokensSettings,
  DocumentsSettings,
  EmailSettings,
  SmsWhatsappSettings,
  BackupRestore,
  ActivityLog,
  AuditSettings,
  GdprSettings,
  MobileSettings,
  SystemInfo,
} from './bodies';

interface Props {
  active: SectionKey;
}

const SettingsSectionPanel: React.FC<Props> = ({ active }) => (
  <>
    {active === 'profile' && <ProfileSettings />}
    {active === 'organization' && <OrganizationSettings />}
    {active === 'security' && <SecuritySettings />}
    {active === 'notifications' && <NotificationSettings />}
    {active === 'preferences' && <PreferencesSettings />}
    {active === 'general' && <GeneralSettings />}
    {active === 'appearance' && <AppearanceSettings />}
    {active === 'branches' && <BranchesSettings />}
    {active === 'branding' && <BrandingSettings />}
    {active === 'working_hours' && <WorkingHoursSettings />}
    {active === 'holidays' && <HolidaysSettings />}
    {active === 'users' && <UsersSettings />}
    {active === 'roles' && <RolesSettings />}
    {active === 'permissions' && <PermissionsSettings />}
    {active === 'sso' && <SsoSettings />}
    {active === 'portals' && <PortalsSettings />}
    {active === 'localization' && <LocalizationSettings />}
    {active === 'languages' && <LanguagesSettings />}
    {active === 'formats' && <FormatsSettings />}
    {active === 'modules' && <ModulesSettings />}
    {active === 'fiscal' && <FiscalYears />}
    {active === 'budgets' && <Budgets />}
    {active === 'currencies' && <Currencies />}
    {active === 'taxes' && <TaxesSettings />}
    {active === 'banking' && <BankingSettings />}
    {active === 'payment_methods' && <PaymentMethodsSettings />}
    {active === 'templates' && <InvoiceTemplates />}
    {active === 'reminders' && <ReminderSettings />}
    {active === 'einvoice' && <EInvoiceSettings />}
    {active === 'sales' && <SalesSettings />}
    {active === 'crm' && <CrmSettings />}
    {active === 'purchases' && <PurchasesSettings />}
    {active === 'inventory' && <InventorySettings />}
    {active === 'mrp' && <MrpSettings />}
    {active === 'pos' && <PosSettings />}
    {active === 'ecommerce' && <EcommerceSettings />}
    {active === 'helpdesk' && <HelpdeskSettings />}
    {active === 'hr' && <HrSettings />}
    {active === 'payroll' && <PayrollSettings />}
    {active === 'projects' && <ProjectsSettings />}
    {active === 'marketing' && <MarketingSettings />}
    {active === 'workflows' && <WorkflowsSettings />}
    {active === 'approvals' && <ApprovalsSettings />}
    {active === 'integrations' && <IntegrationsSettings />}
    {active === 'webhooks' && <WebhooksSettings />}
    {active === 'api_tokens' && <ApiTokensSettings />}
    {active === 'documents' && <DocumentsSettings />}
    {active === 'email' && <EmailSettings />}
    {active === 'sms_whatsapp' && <SmsWhatsappSettings />}
    {active === 'backup' && <BackupRestore />}
    {active === 'activity' && <ActivityLog />}
    {active === 'audit' && <AuditSettings />}
    {active === 'gdpr' && <GdprSettings />}
    {active === 'mobile' && <MobileSettings />}
    {active === 'system' && <SystemInfo />}
  </>
);

export default SettingsSectionPanel;
''',
    encoding="utf-8",
)

SHELL.write_text(
    '''import React, { useEffect, useMemo, useState } from 'react';
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
  const { isAuthenticated, role, permissions, isTenantOrgAdmin } = usePermission();
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

  const sectionIconMap = useMemo(
    () => ({
      profile: <UserOutlined />,
      security: <LockOutlined />,
      notifications: <SettingOutlined />,
      preferences: <SettingOutlined />,
      general: <SettingOutlined />,
      appearance: <SettingOutlined />,
      organization: <SettingOutlined />,
      branches: <SettingOutlined />,
      branding: <SettingOutlined />,
      working_hours: <SettingOutlined />,
      holidays: <SettingOutlined />,
      users: <SettingOutlined />,
      roles: <SettingOutlined />,
      permissions: <SettingOutlined />,
      sso: <SettingOutlined />,
      portals: <SettingOutlined />,
      localization: <SettingOutlined />,
      currencies: <SettingOutlined />,
      languages: <SettingOutlined />,
      formats: <SettingOutlined />,
      fiscal: <SettingOutlined />,
      budgets: <SettingOutlined />,
      taxes: <SettingOutlined />,
      banking: <SettingOutlined />,
      payment_methods: <SettingOutlined />,
      einvoice: <SettingOutlined />,
      templates: <SettingOutlined />,
      reminders: <SettingOutlined />,
      sales: <SettingOutlined />,
      crm: <SettingOutlined />,
      purchases: <SettingOutlined />,
      inventory: <SettingOutlined />,
      mrp: <SettingOutlined />,
      pos: <SettingOutlined />,
      ecommerce: <SettingOutlined />,
      helpdesk: <SettingOutlined />,
      hr: <SettingOutlined />,
      payroll: <SettingOutlined />,
      projects: <SettingOutlined />,
      marketing: <SettingOutlined />,
      workflows: <SettingOutlined />,
      approvals: <SettingOutlined />,
      integrations: <SettingOutlined />,
      webhooks: <SettingOutlined />,
      api_tokens: <SettingOutlined />,
      documents: <SettingOutlined />,
      numbering: <SettingOutlined />,
      email: <SettingOutlined />,
      sms_whatsapp: <SettingOutlined />,
      modules: <SettingOutlined />,
      module_requests: <SettingOutlined />,
      backup: <SettingOutlined />,
      activity: <SettingOutlined />,
      audit: <SettingOutlined />,
      gdpr: <SettingOutlined />,
      mobile: <SettingOutlined />,
      system: <SettingOutlined />,
    }),
    [],
  );

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
''',
    encoding="utf-8",
)

PAGE.write_text(
    "export { default } from '../settings/shell/SettingsShell';\n",
    encoding="utf-8",
)

print(f"Wrote {BODIES} ({len(body_lines)} lines)")
print(f"Wrote {SHELL}")
print(f"Wrote {PAGE}")
