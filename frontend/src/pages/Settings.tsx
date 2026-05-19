import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button, Tag, Form, Input, InputNumber, DatePicker, Space,
  Row, Col, Popconfirm, Switch, Select, Tabs, TimePicker, Alert, Tooltip,
  Divider, Segmented, Result, Drawer } from 'antd';
import { message } from '../utils/message';
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
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { buildEffectiveOptions, handleAddOptionChange } from '../utils/buildAddOption';
import api from '../api';
import dayjs from 'dayjs';
import { useOnboardingStore } from '../onboarding/store';
import { INDUSTRIES, MODULES } from '../onboarding/industries';
import { useAuthStore } from '../store';
import { useSettingsStore } from '../store/settingsStore';
import { usePermission } from '../hooks/usePermission';
import SectionCard from '../components/ui/SectionCard';
import SettingsRow from '../components/ui/SettingsRow';
import SectionHelpPopover from '../components/ui/SectionHelpPopover';
import PremiumModal from '../components/ui/PremiumModal';
import PremiumPageHeader from '../components/ui/PremiumPageHeader';
import { palette, radius, space, fontSize } from '../theme/tokens';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { ResponsiveForm } from '../components/responsive/ResponsiveForm';
import { ComingSoon } from '../components/feedback/ComingSoon';

const { RangePicker } = DatePicker;

// ───────────────────────────────────────────────────────────────────────
// Settings shell: vertical sidebar nav + deep-link via ?s=<key>.
// ───────────────────────────────────────────────────────────────────────

type SectionKey =
  // Account & personal
  | 'profile' | 'security' | 'notifications' | 'preferences'
  // General & appearance (Requirement 12.2)
  | 'general' | 'appearance' | 'feature_flags'
  // Organization
  | 'organization' | 'branches' | 'branding' | 'working_hours' | 'holidays'
  // Users & access
  | 'users' | 'roles' | 'permissions' | 'sso' | 'portals'
  // Localization
  | 'localization' | 'currencies' | 'languages' | 'formats'
  // Finance & compliance
  | 'fiscal' | 'budgets' | 'taxes' | 'banking' | 'payment_methods' | 'einvoice'
  | 'templates' | 'reminders'
  // Commerce
  | 'sales' | 'crm' | 'purchases' | 'inventory' | 'mrp' | 'pos' | 'ecommerce'
  | 'helpdesk'
  // Operations
  | 'hr' | 'payroll' | 'projects' | 'marketing'
  // Automation & integrations
  | 'workflows' | 'approvals' | 'integrations' | 'webhooks' | 'api_tokens'
  // Content & comms
  | 'documents' | 'numbering' | 'email' | 'sms_whatsapp'
  // System
  | 'modules' | 'backup' | 'activity' | 'audit' | 'gdpr' | 'mobile' | 'system';

type SectionGroup =
  | 'account' | 'general_app' | 'organization' | 'users' | 'localization'
  | 'finance' | 'commerce' | 'operations' | 'automation'
  | 'content' | 'system';

interface SectionDef {
  key: SectionKey;
  label: string;
  icon: React.ReactNode;
  description?: string;
  group: SectionGroup;
  link?: string; // external route (instead of inline render)
  badge?: 'beta' | 'new' | 'soon';
}

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const initial = (params.get('s') as SectionKey) || 'profile';
  const [active, setActive] = useState<SectionKey>(initial);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 1024);
  useEffect(() => {
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const isMobile = windowWidth < 900;
  const isDark = useAuthStore(s => s.theme) === 'dark';

  // Requirement 12.4 — Changes SHALL require appropriate permission (admin/owner).
  const { hasSettingsAccess, isAuthenticated, role } = usePermission();

  useEffect(() => {
    const next = (params.get('s') as SectionKey) || 'profile';
    if (next !== active) setActive(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const goto = (key: SectionKey) => {
    setActive(key);
    setParams({ s: key }, { replace: true });
    setNavDrawerOpen(false);
  };

  const sections: SectionDef[] = useMemo(() => [
    // ── Account & personal ────────────────────────────────────────────
    { key: 'profile',        group: 'account',      label: t('profile'),                         icon: <UserOutlined /> },
    { key: 'security',       group: 'account',      label: t('security_settings'),               icon: <SafetyOutlined /> },
    { key: 'notifications',  group: 'account',      label: t('notification_preferences'),        icon: <BellOutlined /> },
    { key: 'preferences',    group: 'account',      label: t('settings_pref', 'Preferences'),    icon: <BgColorsOutlined /> },
    // ── General & Appearance (Requirement 12.2) ───────────────────────
    { key: 'general',        group: 'general_app',  label: t('settings_general', 'General'),     icon: <SettingOutlined /> },
    { key: 'appearance',     group: 'general_app',  label: t('settings_appearance', 'Appearance'), icon: <BgColorsOutlined /> },
    { key: 'feature_flags',  group: 'general_app',  label: t('settings_feature_flags', 'Feature flags'), icon: <ExperimentOutlined /> },
    // ── Organization ──────────────────────────────────────────────────
    { key: 'organization',   group: 'organization', label: t('organization_settings'),           icon: <BankOutlined /> },
    { key: 'branches',       group: 'organization', label: t('branches', 'Branches'),            icon: <ApartmentOutlined /> },
    { key: 'branding',       group: 'organization', label: t('branding', 'Branding'),            icon: <BgColorsOutlined /> },
    { key: 'working_hours',  group: 'organization', label: t('working_hours', 'Working hours'),  icon: <FieldTimeOutlined /> },
    { key: 'holidays',       group: 'organization', label: t('holidays', 'Public holidays'),     icon: <GiftOutlined /> },
    // ── Users & access ────────────────────────────────────────────────
    { key: 'users',          group: 'users',        label: t('users', 'Users'),                  icon: <TeamOutlined /> },
    { key: 'roles',          group: 'users',        label: t('roles', 'Roles'),                  icon: <IdcardOutlined /> },
    { key: 'permissions',    group: 'users',        label: t('permissions', 'Permissions'),      icon: <SafetyCertificateOutlined /> },
    { key: 'sso',            group: 'users',        label: t('sso', 'Single sign-on'),           icon: <KeyOutlined /> },
    { key: 'portals',        group: 'users',        label: t('portals', 'Customer / Vendor portals'), icon: <UsergroupAddOutlined /> },
    // ── Localization ──────────────────────────────────────────────────
    { key: 'localization',   group: 'localization', label: t('localization', 'Localization'),    icon: <GlobalOutlined /> },
    { key: 'currencies',     group: 'localization', label: t('currencies'),                      icon: <DollarOutlined /> },
    { key: 'languages',      group: 'localization', label: t('languages', 'Languages'),          icon: <TranslationOutlined /> },
    { key: 'formats',        group: 'localization', label: t('formats', 'Date & number formats'), icon: <ClockCircleOutlined /> },
    // ── Finance & compliance ──────────────────────────────────────────
    { key: 'fiscal',         group: 'finance',      label: t('fiscal_years'),                    icon: <CalendarOutlined /> },
    { key: 'budgets',        group: 'finance',      label: t('budgets'),                         icon: <FundOutlined /> },
    { key: 'taxes',          group: 'finance',      label: t('taxes', 'Taxes'),                  icon: <PercentageOutlined /> },
    { key: 'banking',        group: 'finance',      label: t('banking_settings', 'Banking'),     icon: <BankOutlined /> },
    { key: 'payment_methods',group: 'finance',      label: t('payment_methods', 'Payment methods'), icon: <CreditCardOutlined /> },
    { key: 'einvoice',       group: 'finance',      label: t('einvoice_settings'),               icon: <FileProtectOutlined /> },
    { key: 'templates',      group: 'finance',      label: t('invoice_templates'),               icon: <FileTextOutlined /> },
    { key: 'reminders',      group: 'finance',      label: t('reminder_settings'),               icon: <ClockCircleOutlined /> },
    // ── Commerce ──────────────────────────────────────────────────────
    { key: 'sales',          group: 'commerce',     label: t('sales_settings', 'Sales'),         icon: <ShoppingCartOutlined /> },
    { key: 'crm',            group: 'commerce',     label: t('crm_settings', 'CRM'),             icon: <ContactsOutlined /> },
    { key: 'purchases',      group: 'commerce',     label: t('purchases_settings', 'Purchases'), icon: <ShopOutlined /> },
    { key: 'inventory',      group: 'commerce',     label: t('inventory_settings', 'Inventory'), icon: <InboxOutlined /> },
    { key: 'mrp',            group: 'commerce',     label: t('mrp_settings', 'Manufacturing'),   icon: <BuildOutlined /> },
    { key: 'pos',            group: 'commerce',     label: t('pos_settings', 'Point of Sale'),   icon: <DesktopOutlined /> },
    { key: 'ecommerce',      group: 'commerce',     label: t('ecommerce_settings', 'E-commerce'), icon: <RocketOutlined /> },
    { key: 'helpdesk',       group: 'commerce',     label: t('helpdesk_settings', 'Helpdesk'),   icon: <CustomerServiceOutlined /> },
    // ── Operations ────────────────────────────────────────────────────
    { key: 'hr',             group: 'operations',   label: t('hr_settings', 'Human resources'),  icon: <TeamOutlined /> },
    { key: 'payroll',        group: 'operations',   label: t('payroll_settings', 'Payroll'),     icon: <WalletOutlined /> },
    { key: 'projects',       group: 'operations',   label: t('projects_settings', 'Projects'),   icon: <ProjectOutlined /> },
    { key: 'marketing',      group: 'operations',   label: t('marketing_settings', 'Marketing'), icon: <SoundOutlined /> },
    // ── Automation & integrations ─────────────────────────────────────
    { key: 'workflows',      group: 'automation',   label: t('workflows', 'Workflows'),          icon: <PartitionOutlined /> },
    { key: 'approvals',      group: 'automation',   label: t('approvals', 'Approvals'),          icon: <CheckCircleOutlined /> },
    { key: 'integrations',   group: 'automation',   label: t('integrations', 'Integrations'),   icon: <ClusterOutlined /> },
    { key: 'webhooks',       group: 'automation',   label: t('webhooks', 'Webhooks'),            icon: <BranchesOutlined /> },
    { key: 'api_tokens',     group: 'automation',   label: t('api_tokens', 'API tokens'),        icon: <ApiOutlined /> },
    // ── Content & comms ───────────────────────────────────────────────
    { key: 'documents',      group: 'content',      label: t('documents', 'Documents'),          icon: <FolderOpenOutlined /> },
    { key: 'numbering',      group: 'content',      label: t('numbering_sequences', 'Numbering'), icon: <NumberOutlined />, link: '/settings/numbering' },
    { key: 'email',          group: 'content',      label: t('email_settings'),                  icon: <MailOutlined /> },
    { key: 'sms_whatsapp',   group: 'content',      label: t('sms_whatsapp', 'SMS & WhatsApp'),  icon: <MessageOutlined /> },
    // ── System ────────────────────────────────────────────────────────
    { key: 'modules',        group: 'system',       label: t('settings_additions.modules'),      icon: <AppstoreOutlined /> },
    { key: 'backup',         group: 'system',       label: t('backup_settings'),                 icon: <DatabaseOutlined /> },
    { key: 'activity',       group: 'system',       label: t('system_log'),                      icon: <HistoryOutlined /> },
    { key: 'audit',          group: 'system',       label: t('audit_compliance', 'Audit & compliance'), icon: <AuditOutlined /> },
    { key: 'gdpr',           group: 'system',       label: t('gdpr', 'Data privacy'),            icon: <EyeInvisibleOutlined /> },
    { key: 'mobile',         group: 'system',       label: t('mobile_app', 'Mobile app'),        icon: <MobileOutlined /> },
    { key: 'system',         group: 'system',       label: t('system_info'),                     icon: <InfoCircleOutlined /> },
  ], [t]);

  const groupLabels: Record<SectionGroup, string> = {
    account:      t('settings_group_account', 'Account'),
    general_app:  t('settings_group_general', 'General'),
    organization: t('settings_group_org', 'Organization'),
    users:        t('settings_group_users', 'Users & access'),
    localization: t('settings_group_l10n', 'Localization'),
    finance:      t('settings_group_finance', 'Finance & compliance'),
    commerce:     t('settings_group_commerce', 'Sales, CRM & operations'),
    operations:   t('settings_group_ops', 'HR, projects & marketing'),
    automation:   t('settings_group_auto', 'Automation & API'),
    content:      t('settings_group_content', 'Content & messaging'),
    system:       t('settings_group_system', 'System'),
  };

  const activeDef = sections.find(s => s.key === active) ?? sections[0];

  // Shared nav list — used in both desktop sidebar and mobile drawer
  const navList = (
    <nav className="st-aside-nav">
      {(['account','general_app','organization','users','localization','finance','commerce','operations','automation','content','system'] as const).map(group => {
        const items = sections.filter(s => s.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="st-group">
            <div className="st-group-label">{groupLabels[group]}</div>
            {items.map(s => {
              const isActive = s.key === active;
              const badgeNode = s.badge ? (
                <span className={`st-nav-badge st-nav-badge--${s.badge}`}>
                  {s.badge === 'soon' ? t('coming_soon_short', 'soon')
                    : s.badge === 'beta' ? 'beta'
                    : 'new'}
                </span>
              ) : null;
              if (s.link) {
                return (
                  <Link key={s.key} to={s.link} className="st-nav-item" onClick={() => setNavDrawerOpen(false)}>
                    <span className="st-nav-icon">{s.icon}</span>
                    <span className="st-nav-label">{s.label}</span>
                    {badgeNode}
                    <span className="st-nav-arrow">↗</span>
                  </Link>
                );
              }
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => goto(s.key)}
                  className={`st-nav-item${isActive ? ' is-active' : ''}`}
                >
                  <span className="st-nav-icon">{s.icon}</span>
                  <span className="st-nav-label">{s.label}</span>
                  {badgeNode}
                  {isActive && <span className="st-nav-active-bar" aria-hidden />}
                </button>
              );
            })}
          </div>
        );
      })}
    </nav>
  );

  // Requirement 12.4 — Settings access requires admin or owner role.
  // Show an access-denied message for authenticated users without the right role.
  // Note: if role is null (token not decodable), we allow access and let the
  // backend enforce the permission check on write operations.
  if (isAuthenticated && role !== null && !hasSettingsAccess) {
    return (
      <Result
        status="403"
        title={t('access_denied', 'Access Denied')}
        subTitle={t(
          'settings_access_denied',
          'You need administrator or owner privileges to access Settings.',
        )}
        icon={<LockOutlined style={{ color: palette.primary500 }} />}
      />
    );
  }

  return (
    <>
      <style>{settingsCss}</style>

      {/* ── Mobile: bottom-sheet nav drawer ─────────────────────── */}
      {isMobile && (
        <Drawer
          open={navDrawerOpen}
          onClose={() => setNavDrawerOpen(false)}
          placement="bottom"
          height="82vh"
          closable={false}
          styles={{
            body: { padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column',
              background: isDark ? '#0B1220' : '#FAFBFC' },
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0 32px' }}>
            {navList}
          </div>
        </Drawer>
      )}

      <div className="st-shell">
        {/* Left: vertical nav — desktop only */}
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

        {/* Right: content */}
        <main className="st-main">
          {/* Mobile: sticky section picker */}
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
            subtitle={activeDef.description ?? sectionSubtitle(activeDef.key, t as unknown as (k: string, fb?: string) => unknown)}
            icon={activeDef.icon}
            sectionId={`settings.${activeDef.key}` as any}
          />

          <div className="st-content">
            {activeDef.badge === 'soon' ? (
              <ComingSoon featureNameKey={activeDef.key} />
            ) : (
              <>
            {active === 'profile'         && <ProfileSettings />}
            {active === 'organization'    && <OrganizationSettings />}
            {active === 'security'        && <SecuritySettings />}
            {active === 'notifications'   && <NotificationSettings />}
            {active === 'preferences'     && <PreferencesSettings />}
            {active === 'general'         && <GeneralSettings />}
            {active === 'appearance'      && <AppearanceSettings />}
            {active === 'feature_flags'   && <FeatureFlagsSettings />}
            {active === 'branches'        && <BranchesSettings />}
            {active === 'branding'        && <BrandingSettings />}
            {active === 'working_hours'   && <WorkingHoursSettings />}
            {active === 'holidays'        && <HolidaysSettings />}
            {active === 'users'           && <UsersSettings />}
            {active === 'roles'           && <RolesSettings />}
            {active === 'permissions'     && <PermissionsSettings />}
            {active === 'sso'             && <SsoSettings />}
            {active === 'portals'         && <PortalsSettings />}
            {active === 'localization'    && <LocalizationSettings />}
            {active === 'languages'       && <LanguagesSettings />}
            {active === 'formats'         && <FormatsSettings />}
            {active === 'modules'         && <ModulesSettings />}
            {active === 'fiscal'          && <FiscalYears />}
            {active === 'budgets'         && <Budgets />}
            {active === 'currencies'      && <Currencies />}
            {active === 'taxes'           && <TaxesSettings />}
            {active === 'banking'         && <BankingSettings />}
            {active === 'payment_methods' && <PaymentMethodsSettings />}
            {active === 'templates'       && <InvoiceTemplates />}
            {active === 'reminders'       && <ReminderSettings />}
            {active === 'einvoice'        && <EInvoiceSettings />}
            {active === 'sales'           && <SalesSettings />}
            {active === 'crm'             && <CrmSettings />}
            {active === 'purchases'       && <PurchasesSettings />}
            {active === 'inventory'       && <InventorySettings />}
            {active === 'mrp'             && <MrpSettings />}
            {active === 'pos'             && <PosSettings />}
            {active === 'ecommerce'       && <EcommerceSettings />}
            {active === 'helpdesk'        && <HelpdeskSettings />}
            {active === 'hr'              && <HrSettings />}
            {active === 'payroll'         && <PayrollSettings />}
            {active === 'projects'        && <ProjectsSettings />}
            {active === 'marketing'       && <MarketingSettings />}
            {active === 'workflows'       && <WorkflowsSettings />}
            {active === 'approvals'       && <ApprovalsSettings />}
            {active === 'integrations'    && <IntegrationsSettings />}
            {active === 'webhooks'        && <WebhooksSettings />}
            {active === 'api_tokens'      && <ApiTokensSettings />}
            {active === 'documents'       && <DocumentsSettings />}
            {active === 'email'           && <EmailSettings />}
            {active === 'sms_whatsapp'    && <SmsWhatsappSettings />}
            {active === 'backup'          && <BackupRestore />}
            {active === 'activity'        && <ActivityLog />}
            {active === 'audit'           && <AuditSettings />}
            {active === 'gdpr'            && <GdprSettings />}
            {active === 'mobile'          && <MobileSettings />}
            {active === 'system'          && <SystemInfo />}
              </>
            )}
          </div>
        </main>
      </div>
    </>
  );
};

const sectionSubtitle = (key: SectionKey, t: (k: string, fb?: string) => unknown): string => {
  const tt = (k: string, fb?: string) => String(t(k, fb));
  switch (key) {
    case 'profile':         return tt('settings_sub_profile', 'Manage your personal account, name, and password.');
    case 'organization':    return tt('settings_sub_org', 'Update company identity, address, and tax information.');
    case 'security':        return tt('settings_sub_security', 'Two-factor authentication and active sessions.');
    case 'notifications':   return tt('settings_sub_notif', 'Choose which events trigger email or in-app alerts.');
    case 'preferences':     return tt('settings_sub_pref', 'Personal display preferences: theme, density, language.');
    case 'general':         return tt('settings_sub_general', 'Application name, default language, and timezone.');
    case 'appearance':      return tt('settings_sub_appearance', 'Theme, layout mode, and display density.');
    case 'feature_flags':   return tt('settings_sub_feature_flags', 'Enable or disable features for your organization.');
    case 'branches':        return tt('settings_sub_branches', 'Manage warehouses, branches, and operating locations.');
    case 'branding':        return tt('settings_sub_branding', 'Logos, brand colors, favicon, and email theme.');
    case 'working_hours':   return tt('settings_sub_wh', 'Operating hours used for SLAs and service availability.');
    case 'holidays':        return tt('settings_sub_hol', 'Public holiday calendar by country and region.');
    case 'users':           return tt('settings_sub_users', 'Invite teammates, manage active users and licenses.');
    case 'roles':           return tt('settings_sub_roles', 'Define role bundles for fast permission assignment.');
    case 'permissions':     return tt('settings_sub_perm', 'Fine-grained access control by module and record.');
    case 'sso':             return tt('settings_sub_sso', 'SAML, OAuth, Microsoft Entra ID, and Google Workspace.');
    case 'portals':         return tt('settings_sub_portals', 'Customer and vendor self-service portals.');
    case 'localization':    return tt('settings_sub_l10n', 'Country pack, fiscal calendar, address, and tax format.');
    case 'currencies':      return tt('settings_sub_curr', 'Multi-currency support and live exchange rates.');
    case 'languages':       return tt('settings_sub_lang', 'Available UI languages and translation overrides.');
    case 'formats':         return tt('settings_sub_fmt', 'Date, time, number, and first-day-of-week.');
    case 'modules':         return tt('settings_sub_modules', 'Enable or disable modules and re-run onboarding.');
    case 'fiscal':          return tt('settings_sub_fiscal', 'Configure your fiscal years and closing periods.');
    case 'budgets':         return tt('settings_sub_budgets', 'Plan, track, and analyze budgets per fiscal year.');
    case 'taxes':           return tt('settings_sub_taxes', 'VAT, withholding, sales tax, and tax groups.');
    case 'banking':         return tt('settings_sub_bank', 'Bank accounts, feeds, and reconciliation rules.');
    case 'payment_methods': return tt('settings_sub_pm', 'Online and offline payment methods accepted.');
    case 'templates':       return tt('settings_sub_tmpl', 'Customize invoice, quote, and email layouts.');
    case 'reminders':       return tt('settings_sub_rem', 'Automated reminders for due and overdue invoices.');
    case 'einvoice':        return tt('settings_sub_einv', 'Iraq electronic invoicing portal configuration.');
    case 'sales':           return tt('settings_sub_sales', 'Quotation flow, pricing rules, discounts, and stages.');
    case 'crm':             return tt('settings_sub_crm', 'Lead pipelines, scoring, sources, and lost reasons.');
    case 'purchases':       return tt('settings_sub_purch', 'RFQ flow, vendor pricing, and approval thresholds.');
    case 'inventory':       return tt('settings_sub_inv', 'Warehouses, lots, serials, putaway, and removal.');
    case 'mrp':             return tt('settings_sub_mrp', 'Routings, work centers, BOMs, and quality checks.');
    case 'pos':             return tt('settings_sub_pos', 'Receipt printers, cash drawers, and tip rules.');
    case 'ecommerce':       return tt('settings_sub_ec', 'Storefront theme, checkout, shipping, and SEO.');
    case 'helpdesk':        return tt('settings_sub_hd', 'Ticket pipelines, SLA policies, and routing.');
    case 'hr':              return tt('settings_sub_hr', 'Departments, contracts, leave types, and approvals.');
    case 'payroll':         return tt('settings_sub_pay', 'Pay structures, allowances, deductions, and runs.');
    case 'projects':        return tt('settings_sub_proj', 'Project templates, billable rates, and timesheets.');
    case 'marketing':       return tt('settings_sub_mkt', 'Email campaigns, automations, and lead capture.');
    case 'workflows':       return tt('settings_sub_wf', 'No-code rules: when X, then Y. Triggers & actions.');
    case 'approvals':       return tt('settings_sub_appr', 'Multi-step approvals for bills, expenses, and POs.');
    case 'integrations':    return tt('settings_sub_int', 'Marketplace apps and 3rd-party connections.');
    case 'webhooks':        return tt('settings_sub_wh2', 'Outbound HTTP callbacks for external systems.');
    case 'api_tokens':      return tt('settings_sub_api', 'Personal access tokens and OAuth applications.');
    case 'documents':       return tt('settings_sub_docs', 'Centralized document storage, tags, and sharing.');
    case 'email':           return tt('settings_sub_email', 'SMTP credentials for outbound mail.');
    case 'sms_whatsapp':    return tt('settings_sub_sms', 'SMS providers and WhatsApp Business API.');
    case 'backup':          return tt('settings_sub_backup', 'Create and download full system backups.');
    case 'activity':        return tt('settings_sub_activity', 'Audit trail of every action across your workspace.');
    case 'audit':           return tt('settings_sub_audit', 'Compliance reports, retention policies, and exports.');
    case 'gdpr':            return tt('settings_sub_gdpr', 'Data privacy: consent, erasure, and DSR exports.');
    case 'mobile':          return tt('settings_sub_mob', 'Mobile app configuration and push notifications.');
    case 'system':          return tt('settings_sub_system', 'Build, runtime, and environment diagnostics.');
    default: return '';
  }
};

// ─────────────────────── General (Requirement 12.2) ───────────────────────
const GeneralSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const settingsConfig = useSettingsStore((s) => s.config);
  const setConfig = useSettingsStore((s) => s.setConfig);

  // Populate form from settingsStore + API on mount
  useEffect(() => {
    form.setFieldsValue({
      app_name: 'Zoho ERP',
      language: settingsConfig.languages?.default_lang || i18n.language || 'ku',
      timezone: settingsConfig.working_hours?.open_time ? 'Asia/Baghdad' : 'Asia/Baghdad',
    });
    api.get('/api/system/organization').then(r => {
      if (r.data?.name) form.setFieldValue('app_name', r.data.name);
    }).catch(() => {});
    api.get('/api/system/settings/general').then(r => {
      if (r.data) form.setFieldsValue(r.data);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields();
      await api.put('/api/system/settings/general', vals);
      // Sync language change to i18n and settingsStore
      if (vals.language && vals.language !== i18n.language) {
        await i18n.changeLanguage(vals.language);
        localStorage.setItem('app_language', vals.language);
        document.documentElement.lang = vals.language;
        document.documentElement.dir = ['ku', 'ar'].includes(vals.language) ? 'rtl' : 'ltr';
      }
      // Update settingsStore with new language preference
      setConfig({
        languages: {
          ...settingsConfig.languages,
          default_lang: vals.language,
        },
      });
      message.success(t('success'));
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const TIMEZONES = [
    { value: 'Asia/Baghdad', label: 'Asia/Baghdad (UTC+3)' },
    { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
    { value: 'Asia/Riyadh', label: 'Asia/Riyadh (UTC+3)' },
    { value: 'Asia/Kuwait', label: 'Asia/Kuwait (UTC+3)' },
    { value: 'Asia/Beirut', label: 'Asia/Beirut (UTC+2/+3)' },
    { value: 'Asia/Amman', label: 'Asia/Amman (UTC+2/+3)' },
    { value: 'Asia/Cairo', label: 'Africa/Cairo (UTC+2)' },
    { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
    { value: 'UTC', label: 'UTC (UTC+0)' },
    { value: 'Europe/London', label: 'Europe/London (UTC+0/+1)' },
    { value: 'America/New_York', label: 'America/New_York (UTC-5/-4)' },
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8/-7)' },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<SettingOutlined />}
        title={t('settings_general', 'General')}
        description={t('settings_sub_general', 'Application name, default language, and timezone.')}
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('app_name', 'Application name')}
                name="app_name"
                rules={[
                  { required: true, message: t('required') },
                  { min: 2, message: t('min_length_2', 'Must be at least 2 characters') },
                  { max: 100, message: t('max_length_100', 'Must be at most 100 characters') },
                ]}
              >
                <Input
                  placeholder="Zoho ERP"
                  prefix={<SettingOutlined style={{ color: palette.ink300 }} />}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('default_language', 'Default language')}
                name="language"
                rules={[{ required: true, message: t('required') }]}
              >
                <Select
                  style={{ width: '100%' }}
                  options={[
                    { value: 'ku', label: 'کوردی (Kurdish)' },
                    { value: 'ar', label: 'العربية (Arabic)' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item
                label={t('timezone', 'Timezone')}
                name="timezone"
                rules={[{ required: true, message: t('required') }]}
              >
                <Select
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="label"
                  options={TIMEZONES}
                />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('save')}
          </Button>
          </ResponsiveForm>
</Form>
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Appearance (Requirement 12.2) ───────────────────────
const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const currentTheme = useAuthStore((s) => s.theme);
  const toggleTheme = useAuthStore((s) => s.toggleTheme);
  const currentLayout = useAuthStore((s) => s.layoutMode);
  const setLayoutMode = useAuthStore((s) => s.setLayoutMode);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      theme: currentTheme,
      layout: currentLayout,
      density: 'default',
    });
    api.get('/api/system/settings/appearance').then(r => {
      if (r.data) form.setFieldsValue(r.data);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTheme, currentLayout]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields();
      // Apply theme change immediately
      if (vals.theme && vals.theme !== currentTheme) {
        toggleTheme();
      }
      // Apply layout change immediately
      if (vals.layout && vals.layout !== currentLayout) {
        setLayoutMode(vals.layout);
      }
      await api.put('/api/system/settings/appearance', vals).catch(() => {});
      message.success(t('success'));
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const LAYOUT_OPTIONS = [
    { value: 'classic-sidebar',    label: t('layout_classic_sidebar', 'Classic sidebar') },
    { value: 'top-megamenu',       label: t('layout_top_megamenu', 'Top mega-menu') },
    { value: 'dual-rail',          label: t('layout_dual_rail', 'Dual rail') },
    { value: 'icon-rail',          label: t('layout_icon_rail', 'Icon rail') },
    { value: 'dashboard-first',    label: t('layout_dashboard_first', 'Dashboard first') },
    { value: 'command-centric',    label: t('layout_command_centric', 'Command centric') },
    { value: 'workspace-tabs',     label: t('layout_workspace_tabs', 'Workspace tabs') },
    { value: 'apps-launcher',      label: t('layout_apps_launcher', 'Apps launcher') },
    { value: 'split-master-detail',label: t('layout_split_master', 'Split master-detail') },
    { value: 'mobile-bottom-nav',  label: t('layout_mobile_bottom', 'Mobile bottom nav') },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<BgColorsOutlined />}
        title={t('settings_appearance', 'Appearance')}
        description={t('settings_sub_appearance', 'Theme, layout mode, and display density.')}
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item
                label={t('pref_theme', 'Theme')}
                name="theme"
                rules={[{ required: true, message: t('required') }]}
              >
                <Select
                  style={{ width: '100%' }}
                  options={[
                    { value: 'light', label: t('theme_light', 'Light') },
                    { value: 'dark', label: t('theme_dark', 'Dark') },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label={t('layout_mode', 'Layout mode')}
                name="layout"
                rules={[{ required: true, message: t('required') }]}
              >
                <Select
                  style={{ width: '100%' }}
                  options={LAYOUT_OPTIONS}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label={t('pref_density', 'Density')}
                name="density"
                rules={[{ required: true, message: t('required') }]}
              >
                <Select
                  style={{ width: '100%' }}
                  options={[
                    { value: 'compact', label: t('density_compact', 'Compact') },
                    { value: 'default', label: t('density_default', 'Default') },
                    { value: 'comfort', label: t('density_comfort', 'Comfort') },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('save')}
          </Button>
          </ResponsiveForm>
</Form>
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Feature Flags (Requirement 12.2) ───────────────────────
interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  rollout_pct?: number;
}

const FeatureFlagsSettings: React.FC = () => {
  const { t } = useTranslation();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const DEFAULT_FLAGS: FeatureFlag[] = [
    { key: 'ai_assist',        label: t('ff_ai_assist', 'AI Assist'),           description: t('ff_ai_assist_desc', 'Enable AI-powered suggestions and anomaly detection.'), enabled: false, rollout_pct: 0 },
    { key: 'ocr_receipts',     label: t('ff_ocr', 'OCR Receipts'),              description: t('ff_ocr_desc', 'Automatic receipt scanning and data extraction.'), enabled: false, rollout_pct: 0 },
    { key: 'advanced_reports', label: t('ff_adv_reports', 'Advanced Reports'),  description: t('ff_adv_reports_desc', 'Custom report builder and scheduled reports.'), enabled: true, rollout_pct: 100 },
    { key: 'pos_module',       label: t('ff_pos', 'Point of Sale'),             description: t('ff_pos_desc', 'POS terminal, sessions, and floor plans.'), enabled: false, rollout_pct: 0 },
    { key: 'ecommerce',        label: t('ff_ecommerce', 'E-commerce Storefront'), description: t('ff_ecommerce_desc', 'Public storefront and customer portal.'), enabled: false, rollout_pct: 0 },
    { key: 'iot_telemetry',    label: t('ff_iot', 'IoT Telemetry'),             description: t('ff_iot_desc', 'Device management and real-time sensor data.'), enabled: false, rollout_pct: 0 },
    { key: 'multi_entity',     label: t('ff_multi_entity', 'Multi-Entity'),     description: t('ff_multi_entity_desc', 'Manage multiple companies and intercompany transactions.'), enabled: false, rollout_pct: 0 },
    { key: 'whatsapp_integration', label: t('ff_whatsapp', 'WhatsApp Integration'), description: t('ff_whatsapp_desc', 'Send invoices and notifications via WhatsApp Business API.'), enabled: false, rollout_pct: 0 },
  ];

  useEffect(() => {
    setLoading(true);
    api.get('/api/feature-flags').then(r => {
      const serverFlags: FeatureFlag[] = r.data || [];
      // Merge server flags with defaults
      const merged = DEFAULT_FLAGS.map(def => {
        const server = serverFlags.find(f => f.key === def.key);
        return server ? { ...def, ...server } : def;
      });
      setFlags(merged);
    }).catch(() => {
      setFlags(DEFAULT_FLAGS);
    }).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (flagKey: string, enabled: boolean) => {
    setSaving(flagKey);
    try {
      // Backend only supports POST (upsert) — no PUT route exists
      const current = flags.find(f => f.key === flagKey);
      await api.post(`/api/feature-flags/${flagKey}`, {
        enabled,
        rollout_pct: current?.rollout_pct ?? 100,
      });
      setFlags(prev => prev.map(f => f.key === flagKey ? { ...f, enabled } : f));
      message.success(t('success'));
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(null);
    }
  };

  const handleRolloutChange = async (flagKey: string, rollout_pct: number) => {
    // Validate rollout percentage
    if (rollout_pct < 0 || rollout_pct > 100) {
      message.error(t('rollout_pct_invalid', 'Rollout percentage must be between 0 and 100'));
      return;
    }
    setSaving(flagKey);
    try {
      // Backend only supports POST (upsert) — no PUT route exists
      const current = flags.find(f => f.key === flagKey);
      await api.post(`/api/feature-flags/${flagKey}`, {
        enabled: current?.enabled ?? true,
        rollout_pct,
      });
      setFlags(prev => prev.map(f => f.key === flagKey ? { ...f, rollout_pct } : f));
      message.success(t('success'));
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(null);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<ExperimentOutlined />}
        title={t('settings_feature_flags', 'Feature flags')}
        description={t('settings_sub_feature_flags', 'Enable or disable features for your organization.')}
        loading={loading}
      >
        {flags.map((flag, idx) => (
          <SettingsRow
            key={flag.key}
            label={flag.label}
            description={flag.description}
            divider={idx < flags.length - 1}
          >
            <Space>
              <Switch
                checked={flag.enabled}
                loading={saving === flag.key}
                onChange={(checked) => handleToggle(flag.key, checked)}
              />
              {flag.enabled && (
                <Tooltip title={t('rollout_pct_tooltip', 'Percentage of users who see this feature (0–100)')}>
                  <InputNumber
                    min={0}
                    max={100}
                    value={flag.rollout_pct ?? 100}
                    onChange={(v) => { if (v !== null) handleRolloutChange(flag.key, v); }}
                    addonAfter="%"
                    style={{ width: 110 }}
                    disabled={saving === flag.key}
                  />
                </Tooltip>
              )}
            </Space>
          </SettingsRow>
        ))}
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Profile ───────────────────────
const ProfileSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [pwForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/profile').then(r => form.setFieldsValue(r.data))
      .catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields();
      await api.put('/api/system/profile', { display_name: vals.display_name, phone: vals.phone });
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const handleChangePassword = async () => {
    setChangingPw(true);
    try {
      const vals = await pwForm.validateFields();
      if (vals.new_password !== vals.confirm_password) {
        message.error(t('confirm_password') + ' — ' + t('error'));
        return;
      }
      await api.put('/api/system/profile/password', {
        current_password: vals.current_password,
        new_password: vals.new_password,
      });
      message.success(t('success'));
      pwForm.resetFields();
    } catch { message.error(t('error')); } finally { setChangingPw(false); }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<UserOutlined />}
        title={t('profile_settings')}
        description={t('settings_sub_profile', 'Manage your personal account, name, and password.')}
        loading={loading}
        actions={
          <SectionHelpPopover
            what={t('settings.help.profile.what')}
            why={t('settings.help.profile.why')}
            steps={[
              t('settings.help.profile.step_1'),
              t('settings.help.profile.step_2'),
              t('settings.help.profile.step_3'),
            ]}
          />
        }
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item label={t('email')} name="email">
                <Input disabled prefix={<MailOutlined style={{ color: palette.ink300 }} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('name')} name="display_name" rules={[{ required: true, message: t('required') }]}>
                <Input placeholder={t('name')} prefix={<UserOutlined style={{ color: palette.ink300 }} />} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('phone')} name="phone">
                <Input placeholder={t('phone')} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
          </ResponsiveForm>
</Form>
      </SectionCard>

      <SectionCard
        icon={<KeyOutlined />}
        title={t('change_password')}
        description={t('settings_sub_password', 'Use a strong, unique password (8+ characters).')}
        accent="warning"
      >
        <Form form={pwForm} layout="vertical">
          <ResponsiveForm layout="single">
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item label={t('current_password')} name="current_password" rules={[{ required: true, message: t('required') }]}>
                <Input.Password prefix={<LockOutlined />} placeholder={t('current_password')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('new_password')} name="new_password" rules={[{ required: true, message: t('required') }, { min: 8, message: t('error') }]}>
                <Input.Password prefix={<LockOutlined />} placeholder={t('new_password')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('confirm_password')} name="confirm_password" rules={[{ required: true, message: t('required') }]}>
                <Input.Password prefix={<LockOutlined />} placeholder={t('confirm_password')} />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" onClick={handleChangePassword} loading={changingPw}>{t('save')}</Button>
          </ResponsiveForm>
</Form>
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Organization ───────────────────────
const OrganizationSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/organization').then(r => form.setFieldsValue(r.data))
      .catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = await form.validateFields();
      await api.put('/api/system/organization', vals);
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<BankOutlined />}
        title={t('org_identity', 'Identity')}
        description={t('settings_sub_org_id', 'Public-facing name and contact details.')}
        loading={loading}
        actions={
          <SectionHelpPopover
            what={t('settings.help.company.what')}
            why={t('settings.help.company.why')}
            steps={[
              t('settings.help.company.step_1'),
              t('settings.help.company.step_2'),
              t('settings.help.company.step_3'),
            ]}
          />
        }
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item label={t('organization_name')} name="name" rules={[{ required: true, message: t('required') }]}>
                <Input placeholder={t('organization_name')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('phone')} name="phone"><Input placeholder={t('phone')} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('email')} name="email"><Input placeholder={t('email')} /></Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('country')} name="country"><Input placeholder={t('country')} /></Form.Item>
            </Col>
          </Row>

          <div style={{ height: 1, background: palette.border, margin: `${space.md}px 0 ${space.lg}px` }} />

          <div style={{ fontSize: fontSize.sm, fontWeight: 600, color: palette.ink500, marginBottom: space.md }}>
            {t('org_address', 'Address')}
          </div>
          <Row gutter={24}>
            <Col xs={24} md={12}><Form.Item label={t('city')} name="city"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('address_line1')} name="address_line1"><Input /></Form.Item></Col>
            <Col xs={24} md={24}><Form.Item label={t('address_line2')} name="address_line2"><Input /></Form.Item></Col>
          </Row>

          <div style={{ height: 1, background: palette.border, margin: `${space.md}px 0 ${space.lg}px` }} />

          <div style={{ fontSize: fontSize.sm, fontWeight: 600, color: palette.ink500, marginBottom: space.md }}>
            {t('org_tax', 'Tax & Registration')}
          </div>
          <Row gutter={24}>
            <Col xs={24} md={12}><Form.Item label={t('tax_number')} name="tax_number"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('registration_number')} name="registration_number"><Input /></Form.Item></Col>
          </Row>

          <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
          </ResponsiveForm>
</Form>
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Security ───────────────────────
const SecuritySettings: React.FC = () => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [setupOpen, setSetupOpen] = useState<boolean>(false);
  const [disableOpen, setDisableOpen] = useState<boolean>(false);
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [code, setCode] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const userName = useAuthStore(s => s.userName);

  useEffect(() => {
    api.get('/api/auth/me').then(r => setEnabled(Boolean(r.data?.is_2fa_enabled))).catch(() => {});
  }, []);

  const handleToggle = async (checked: boolean) => {
    if (checked) {
      setLoading(true);
      try {
        const r = await api.post('/api/auth/2fa/setup');
        setQrCode(r.data?.qr_code || '');
        setSecret(r.data?.secret || '');
        setCode('');
        setSetupOpen(true);
      } catch (e: any) {
        message.error(e?.response?.data?.detail || t('error') || 'Error');
      } finally { setLoading(false); }
    } else { setPassword(''); setDisableOpen(true); }
  };

  const verifySetup = async () => {
    if (!code || code.length < 6) { message.warning(t('enter_6_digit_code') || 'Enter 6-digit code'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/2fa/verify', { code });
      message.success(t('two_factor_enabled') || '2FA enabled');
      setEnabled(true); setSetupOpen(false);
    } catch (e: any) { message.error(e?.response?.data?.detail || t('invalid_code') || 'Invalid code'); }
    finally { setLoading(false); }
  };

  const confirmDisable = async () => {
    if (!password || password.length < 6) { message.warning(t('enter_6_digit_code') || 'Enter 6-digit code'); return; }
    setLoading(true);
    try {
      await api.post('/api/auth/2fa/disable', { code: password });
      message.success(t('two_factor_disabled') || '2FA disabled');
      setEnabled(false); setDisableOpen(false);
    } catch (e: any) { message.error(e?.response?.data?.detail || t('invalid_code') || 'Invalid code'); }
    finally { setLoading(false); }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<SafetyOutlined />}
        title={t('two_factor_auth')}
        description={t('settings_sub_2fa', 'Add an extra verification step at sign-in.')}
        accent={enabled ? 'success' : 'warning'}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.security.what')}
              why={t('settings.help.security.why')}
              steps={[
                t('settings.help.security.step_1'),
                t('settings.help.security.step_2'),
                t('settings.help.security.step_3'),
              ]}
            />
            {enabled
              ? <Tag color="success" icon={<CheckCircleOutlined />}>{t('enabled', 'Enabled')}</Tag>
              : <Tag>{t('disabled', 'Disabled')}</Tag>}
          </Space>
        }
      >
        <SettingsRow
          label={t('enable_2fa')}
          description={t('settings_sub_2fa_row', 'Use an authenticator app (Google Authenticator, Authy, 1Password).')}
          divider={false}
        >
          <Switch checked={enabled} loading={loading} onChange={handleToggle} />
        </SettingsRow>
      </SectionCard>

      <SectionCard
        icon={<GlobalOutlined />}
        title={t('session_management')}
        description={t('settings_sub_session', 'Sign out from every device except this one.')}
      >
        <SettingsRow
          label={t('active_sessions')}
          description={userName ? `${t('signed_in_as', 'Signed in as')} ${userName}` : ''}
          divider={false}
        >
          <Button disabled icon={<ThunderboltOutlined />}>{t('logout_all')}</Button>
        </SettingsRow>
      </SectionCard>

      {/* 2FA setup modal */}
      <PremiumModal
        open={setupOpen}
        onCancel={() => setSetupOpen(false)}
        onOk={verifySetup}
        okLoading={loading}
        okText={t('verify') || 'Verify'}
        cancelText={t('cancel') || 'Cancel'}
        icon={<SafetyOutlined />}
        title={t('two_factor_auth')}
        subtitle={t('scan_qr_with_app') || 'Scan the QR code with your authenticator app, then enter the 6-digit code.'}
        width={460}
      >
        {qrCode && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: space.lg }}>
            <div style={{ padding: space.md, background: '#fff', border: `1px solid ${palette.border}`, borderRadius: radius.md }}>
              <img src={qrCode} alt="2FA QR" loading="lazy" decoding="async" style={{ width: 200, height: 200, display: 'block' }} />
            </div>
          </div>
        )}
        {secret && (
          <div
            style={{
              direction: 'ltr',
              fontFamily: 'monospace',
              textAlign: 'center',
              userSelect: 'all',
              padding: space.sm,
              borderRadius: radius.sm,
              background: 'rgba(15,23,42,0.04)',
              fontSize: fontSize.sm,
              marginBottom: space.lg,
              wordBreak: 'break-all',
            }}
          >
            {secret}
          </div>
        )}
        <Input
          placeholder={t('enter_6_digit_code') || '6-digit code'}
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          style={{ direction: 'ltr', textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 600 }}
        />
      </PremiumModal>

      {/* 2FA disable modal */}
      <PremiumModal
        open={disableOpen}
        onCancel={() => setDisableOpen(false)}
        onOk={confirmDisable}
        okLoading={loading}
        okText={t('disable') || 'Disable'}
        okDanger
        cancelText={t('cancel') || 'Cancel'}
        icon={<SafetyOutlined />}
        title={t('disable_2fa') || 'Disable 2FA'}
        subtitle={t('confirm_disable_2fa') || 'Enter the 6-digit code from your authenticator to disable 2FA.'}
        width={460}
      >
        <Input
          placeholder={t('enter_6_digit_code') || '6-digit code'}
          maxLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
          style={{ direction: 'ltr', textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: 600 }}
        />
      </PremiumModal>
    </Space>
  );
};

// ─────────────────────── Notifications (Enterprise) ───────────────────────
// Channel × Event matrix + digest, quiet hours, do-not-disturb, test send.
// Backwards compatible with legacy 4-bool backend payload.

type NotifChannel = 'in_app' | 'email' | 'sms' | 'push' | 'whatsapp' | 'slack';

interface NotifEvent {
  key: string;
  category: 'sales' | 'purchases' | 'inventory' | 'accounting' | 'hr' | 'crm' | 'projects' | 'system';
  label: string;
  desc: string;
  /** Default channels enabled. */
  defaults: NotifChannel[];
  /** Critical events cannot be fully muted. */
  critical?: boolean;
}

type ChannelMatrix = Record<string, Record<NotifChannel, boolean>>;

interface NotifPrefsV2 {
  // Legacy fields (kept for backend compatibility).
  invoice_overdue: boolean;
  payment_received: boolean;
  quote_accepted: boolean;
  expense_approved: boolean;
  // V2 fields (forwards-compatible — backend stores as JSON blob).
  matrix?: ChannelMatrix;
  digest?: 'instant' | 'hourly' | 'daily' | 'weekly';
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string; // "22:00"
  quiet_hours_end?: string;   // "07:00"
  weekend_mute?: boolean;
  channels_meta?: {
    email?: string;
    sms_phone?: string;
    push_devices?: number;
    slack_workspace?: string;
    whatsapp_phone?: string;
  };
}

const NOTIF_EVENTS: NotifEvent[] = [
  // Sales
  { key: 'invoice_created',     category: 'sales', label: 'Invoice created',     desc: 'A new invoice was issued.', defaults: ['in_app'] },
  { key: 'invoice_overdue',     category: 'sales', label: 'Invoice overdue',     desc: 'An invoice has passed its due date.', defaults: ['in_app', 'email'], critical: true },
  { key: 'payment_received',    category: 'sales', label: 'Payment received',    desc: 'A customer payment was recorded.', defaults: ['in_app', 'email'] },
  { key: 'quote_accepted',      category: 'sales', label: 'Quote accepted',      desc: 'A customer accepted a quotation.', defaults: ['in_app', 'email'] },
  { key: 'quote_expired',       category: 'sales', label: 'Quote expired',       desc: 'A quote passed its expiry date without action.', defaults: ['in_app'] },
  { key: 'sales_order_confirmed', category: 'sales', label: 'Sales order confirmed', desc: 'A new sales order was confirmed.', defaults: ['in_app'] },
  { key: 'refund_processed',    category: 'sales', label: 'Refund processed',    desc: 'A refund was issued for a customer.', defaults: ['in_app', 'email'] },
  // Purchases
  { key: 'po_approved',         category: 'purchases', label: 'PO approved',     desc: 'A purchase order was approved.', defaults: ['in_app'] },
  { key: 'bill_received',       category: 'purchases', label: 'Bill received',   desc: 'A vendor bill was uploaded or imported.', defaults: ['in_app'] },
  { key: 'bill_overdue',        category: 'purchases', label: 'Bill overdue',    desc: 'A vendor bill has passed its due date.', defaults: ['in_app', 'email'], critical: true },
  { key: 'vendor_credit_received', category: 'purchases', label: 'Vendor credit received', desc: 'A vendor issued a credit note.', defaults: ['in_app'] },
  // Inventory
  { key: 'stock_low',           category: 'inventory', label: 'Stock low',       desc: 'Stock for an item dropped below its reorder level.', defaults: ['in_app'] },
  { key: 'stock_out',           category: 'inventory', label: 'Out of stock',    desc: 'An item is fully out of stock.', defaults: ['in_app', 'email'], critical: true },
  { key: 'transfer_received',   category: 'inventory', label: 'Transfer received', desc: 'A warehouse transfer was completed.', defaults: ['in_app'] },
  { key: 'lot_expiring',        category: 'inventory', label: 'Lot expiring soon', desc: 'A tracked lot is approaching expiry.', defaults: ['in_app', 'email'] },
  // Accounting
  { key: 'journal_posted',      category: 'accounting', label: 'Manual journal posted', desc: 'A user manually posted a journal entry.', defaults: ['in_app'] },
  { key: 'period_closing',      category: 'accounting', label: 'Period closing', desc: 'A fiscal period is about to close.', defaults: ['in_app', 'email'] },
  { key: 'expense_approved',    category: 'accounting', label: 'Expense approved', desc: 'An expense claim was approved.', defaults: ['in_app'] },
  { key: 'budget_threshold',    category: 'accounting', label: 'Budget threshold reached', desc: 'A budget hit its warning threshold.', defaults: ['in_app', 'email'] },
  // HR
  { key: 'leave_requested',     category: 'hr', label: 'Leave requested',         desc: 'An employee submitted a leave request.', defaults: ['in_app'] },
  { key: 'leave_approved',      category: 'hr', label: 'Leave approved',          desc: 'A leave request was approved.', defaults: ['in_app', 'email'] },
  { key: 'payslip_ready',       category: 'hr', label: 'Payslip ready',           desc: 'A new payslip is available.', defaults: ['in_app', 'email'] },
  { key: 'anniversary_today',   category: 'hr', label: 'Work anniversary',       desc: 'A teammate has a work anniversary today.', defaults: ['in_app'] },
  // CRM
  { key: 'lead_assigned',       category: 'crm', label: 'Lead assigned to me',    desc: 'A new lead was assigned to you.', defaults: ['in_app', 'email'] },
  { key: 'opportunity_won',     category: 'crm', label: 'Opportunity won',        desc: 'A deal in your pipeline closed-won.', defaults: ['in_app', 'email'] },
  { key: 'opportunity_lost',    category: 'crm', label: 'Opportunity lost',       desc: 'A deal in your pipeline closed-lost.', defaults: ['in_app'] },
  // Projects
  { key: 'task_assigned',       category: 'projects', label: 'Task assigned',     desc: 'A task was assigned to you.', defaults: ['in_app', 'email'] },
  { key: 'task_due_soon',       category: 'projects', label: 'Task due soon',     desc: 'A task is due within 24 hours.', defaults: ['in_app'] },
  { key: 'milestone_reached',   category: 'projects', label: 'Milestone reached', desc: 'A project milestone was completed.', defaults: ['in_app'] },
  { key: 'timesheet_reminder',  category: 'projects', label: 'Timesheet reminder', desc: 'Your weekly timesheet has not been submitted.', defaults: ['in_app', 'email'] },
  // System
  { key: 'backup_complete',     category: 'system', label: 'Backup complete',     desc: 'A scheduled backup finished successfully.', defaults: ['in_app'] },
  { key: 'login_new_device',    category: 'system', label: 'Login from new device', desc: 'Sign-in from an unrecognized device.', defaults: ['in_app', 'email'], critical: true },
  { key: 'password_changed',    category: 'system', label: 'Password changed',    desc: 'Your password was changed.', defaults: ['in_app', 'email'], critical: true },
  { key: 'integration_failed',  category: 'system', label: 'Integration failed',  desc: 'A 3rd-party integration is failing.', defaults: ['in_app', 'email'] },
];

const NOTIF_CHANNELS: { key: NotifChannel; label: string; icon: React.ReactNode; available: boolean }[] = [
  { key: 'in_app',   label: 'In-app',   icon: <BellOutlined />,         available: true  },
  { key: 'email',    label: 'Email',    icon: <MailOutlined />,         available: true  },
  { key: 'push',     label: 'Push',     icon: <NotificationOutlined />, available: true  },
  { key: 'sms',      label: 'SMS',      icon: <MessageOutlined />,      available: false },
  { key: 'whatsapp', label: 'WhatsApp', icon: <MessageOutlined />,      available: false },
  { key: 'slack',    label: 'Slack',    icon: <ApiOutlined />,          available: false },
];

const NOTIF_CATEGORIES: { key: NotifEvent['category']; label: string; color: string }[] = [
  { key: 'sales',      label: 'Sales',      color: 'blue'    },
  { key: 'purchases',  label: 'Purchases',  color: 'cyan'    },
  { key: 'inventory',  label: 'Inventory',  color: 'gold'    },
  { key: 'accounting', label: 'Accounting', color: 'purple'  },
  { key: 'hr',         label: 'HR',         color: 'magenta' },
  { key: 'crm',        label: 'CRM',        color: 'green'   },
  { key: 'projects',   label: 'Projects',   color: 'geekblue'},
  { key: 'system',     label: 'System',     color: 'red'     },
];

const parseHHmm = (s?: string) => {
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return dayjs().hour(Number(m[1])).minute(Number(m[2])).second(0).millisecond(0);
};

const buildDefaultMatrix = (): ChannelMatrix => {
  const m: ChannelMatrix = {};
  for (const ev of NOTIF_EVENTS) {
    m[ev.key] = { in_app: false, email: false, sms: false, push: false, whatsapp: false, slack: false };
    for (const ch of ev.defaults) m[ev.key][ch] = true;
  }
  return m;
};

const NotificationSettings: React.FC = () => {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<NotifPrefsV2>({
    invoice_overdue: true, payment_received: true, quote_accepted: true, expense_approved: true,
    matrix: buildDefaultMatrix(),
    digest: 'instant',
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '07:00',
    weekend_mute: false,
    channels_meta: {},
  });
  const [saving, setSaving]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'channels' | 'schedule'>('events');
  const [filterCat, setFilterCat] = useState<'all' | NotifEvent['category']>('all');
  const [search, setSearch] = useState('');
  const isDark = useAuthStore(s => s.theme) === 'dark';

  // Load
  useEffect(() => {
    setLoading(true);
    api.get('/api/system/notification-preferences').then(r => {
      const matrix = r.data.matrix && typeof r.data.matrix === 'object' ? r.data.matrix : buildDefaultMatrix();
      // Make sure every event has all channel keys.
      for (const ev of NOTIF_EVENTS) {
        if (!matrix[ev.key]) matrix[ev.key] = { in_app: false, email: false, sms: false, push: false, whatsapp: false, slack: false };
        for (const ch of NOTIF_CHANNELS) {
          if (typeof matrix[ev.key][ch.key] !== 'boolean') matrix[ev.key][ch.key] = false;
        }
      }
      // Sync legacy fields → matrix.email defaults if matrix is brand-new.
      setPrefs({
        invoice_overdue:   r.data.invoice_overdue   ?? true,
        payment_received:  r.data.payment_received  ?? true,
        quote_accepted:    r.data.quote_accepted    ?? true,
        expense_approved:  r.data.expense_approved  ?? true,
        matrix,
        digest:              r.data.digest              ?? 'instant',
        quiet_hours_enabled: r.data.quiet_hours_enabled ?? false,
        quiet_hours_start:   r.data.quiet_hours_start   ?? '22:00',
        quiet_hours_end:     r.data.quiet_hours_end     ?? '07:00',
        weekend_mute:        r.data.weekend_mute        ?? false,
        channels_meta:       r.data.channels_meta       ?? {},
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Mirror matrix back into legacy bools (any-channel-on for that event).
      const legacy = {
        invoice_overdue:  Object.values(prefs.matrix?.invoice_overdue  ?? {}).some(Boolean),
        payment_received: Object.values(prefs.matrix?.payment_received ?? {}).some(Boolean),
        quote_accepted:   Object.values(prefs.matrix?.quote_accepted   ?? {}).some(Boolean),
        expense_approved: Object.values(prefs.matrix?.expense_approved ?? {}).some(Boolean),
      };
      await api.put('/api/system/notification-preferences', { ...prefs, ...legacy });
      message.success(t('saved_successfully', 'Preferences saved'));
    } catch {
      message.error(t('error'));
    } finally {
      setSaving(false);
    }
  };

  const toggleCell = (eventKey: string, channel: NotifChannel) => {
    setPrefs(prev => {
      const matrix = { ...(prev.matrix ?? buildDefaultMatrix()) };
      matrix[eventKey] = { ...matrix[eventKey], [channel]: !matrix[eventKey][channel] };
      return { ...prev, matrix };
    });
  };

  const setColumn = (channel: NotifChannel, on: boolean) => {
    setPrefs(prev => {
      const matrix = { ...(prev.matrix ?? buildDefaultMatrix()) };
      for (const ev of filteredEvents) {
        matrix[ev.key] = { ...matrix[ev.key], [channel]: on };
      }
      return { ...prev, matrix };
    });
  };

  const setRow = (eventKey: string, on: boolean) => {
    setPrefs(prev => {
      const matrix = { ...(prev.matrix ?? buildDefaultMatrix()) };
      const next: Record<NotifChannel, boolean> = { in_app: on, email: on, sms: on, push: on, whatsapp: on, slack: on };
      // Critical events keep in_app on always.
      const ev = NOTIF_EVENTS.find(e => e.key === eventKey);
      if (ev?.critical) next.in_app = true;
      matrix[eventKey] = next;
      return { ...prev, matrix };
    });
  };

  const filteredEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return NOTIF_EVENTS.filter(ev => {
      if (filterCat !== 'all' && ev.category !== filterCat) return false;
      if (!q) return true;
      return ev.key.toLowerCase().includes(q) || ev.label.toLowerCase().includes(q) || ev.desc.toLowerCase().includes(q);
    });
  }, [filterCat, search]);

  const handleTest = async (channel: NotifChannel) => {
    try {
      await api.post('/api/system/notification-preferences/test', { channel }).catch(() => {});
      message.success(t('test_sent', `Test ${channel} notification sent`));
    } catch {
      message.info(t('test_queued', 'Test notification queued'));
    }
  };

  const cardBg     = isDark ? '#0f1525' : '#ffffff';
  const headerBg   = isDark ? '#1a2438' : '#FBFCFD';
  const borderClr  = isDark ? '#1f2a40' : palette.border;
  const mutedClr   = isDark ? palette.darkInkMuted : palette.ink500;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<BellOutlined />}
        title={t('notification_preferences', 'Notification preferences')}
        description={t('notif_long_desc', 'Choose exactly which events reach you, on which channel, and when. Critical security and overdue alerts always show in-app.')}
        loading={loading}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.notifications.what')}
              why={t('settings.help.notifications.why')}
              steps={[
                t('settings.help.notifications.step_1'),
                t('settings.help.notifications.step_2'),
                t('settings.help.notifications.step_3'),
              ]}
            />
            <Button type="primary" onClick={handleSave} loading={saving}>{t('save', 'Save')}</Button>
          </Space>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as typeof activeTab)}
          items={[
            { key: 'events',   label: <span><BellOutlined /> {t('events_matrix', 'Events')}</span> },
            { key: 'channels', label: <span><ApiOutlined /> {t('channels', 'Channels')}</span> },
            { key: 'schedule', label: <span><ClockCircleOutlined /> {t('schedule_quiet', 'Schedule & quiet hours')}</span> },
          ]}
        />

        {/* ── EVENTS TAB ────────────────────────────────────────────── */}
        {activeTab === 'events' && (
          <div>
            {/* Filter row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.md, marginBottom: space.lg, alignItems: 'center' }}>
              <Input.Search
                placeholder={t('search_events', 'Search events...')}
                allowClear
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ maxWidth: 320 }}
              />
              <Segmented
                value={filterCat}
                onChange={(v) => setFilterCat(v as typeof filterCat)}
                options={[
                  { label: t('all', 'All'), value: 'all' },
                  ...NOTIF_CATEGORIES.map(c => ({ label: t(`notif_cat_${c.key}`, c.label), value: c.key })),
                ]}
              />
              <span style={{ color: mutedClr, fontSize: fontSize.sm }}>
                {filteredEvents.length} / {NOTIF_EVENTS.length}
              </span>
            </div>

            {/* Matrix */}
            <div style={{
              border: `1px solid ${borderClr}`,
              borderRadius: radius.lg,
              overflow: 'hidden',
              background: cardBg,
            }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: headerBg }}>
                      <th style={{ textAlign: 'start', padding: `${space.md}px ${space.lg}px`, fontSize: fontSize.sm, fontWeight: 600, color: mutedClr, borderBottom: `1px solid ${borderClr}`, position: 'sticky', insetInlineStart: 0, background: headerBg, zIndex: 1 }}>
                        {t('event', 'Event')}
                      </th>
                      {NOTIF_CHANNELS.map(ch => (
                        <th key={ch.key} style={{ padding: `${space.sm}px ${space.md}px`, textAlign: 'center', fontSize: fontSize.sm, fontWeight: 600, color: ch.available ? mutedClr : palette.ink300, borderBottom: `1px solid ${borderClr}`, minWidth: 90 }}>
                          <Tooltip title={ch.available ? t('toggle_column', 'Click header to toggle column') : t('channel_unavailable', 'Channel not yet available')}>
                            <div
                              onClick={() => ch.available && setColumn(ch.key, !filteredEvents.every(ev => prefs.matrix?.[ev.key]?.[ch.key]))}
                              style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2, cursor: ch.available ? 'pointer' : 'not-allowed', opacity: ch.available ? 1 : 0.45 }}
                            >
                              <span style={{ fontSize: 16 }}>{ch.icon}</span>
                              <span>{t(`channel_${ch.key}`, ch.label)}</span>
                            </div>
                          </Tooltip>
                        </th>
                      ))}
                      <th style={{ padding: `${space.sm}px ${space.md}px`, fontSize: fontSize.sm, fontWeight: 600, color: mutedClr, borderBottom: `1px solid ${borderClr}` }}>
                        {t('all', 'All')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEvents.map((ev, idx) => {
                      const cat = NOTIF_CATEGORIES.find(c => c.key === ev.category);
                      const row = prefs.matrix?.[ev.key] ?? { in_app: false, email: false, sms: false, push: false, whatsapp: false, slack: false };
                      const allOn = NOTIF_CHANNELS.every(c => !c.available || row[c.key]);
                      return (
                        <tr key={ev.key} style={{ background: idx % 2 === 1 ? (isDark ? 'rgba(255,255,255,0.015)' : 'rgba(15,21,37,0.015)') : 'transparent' }}>
                          <td style={{ padding: `${space.md}px ${space.lg}px`, borderBottom: `1px solid ${borderClr}`, position: 'sticky', insetInlineStart: 0, background: idx % 2 === 1 ? (isDark ? '#121b2e' : '#FAFBFC') : cardBg, zIndex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
                                <Tag color={cat?.color}>{t(`notif_cat_${ev.category}`, cat?.label ?? ev.category)}</Tag>
                                <span style={{ fontWeight: 600, fontSize: fontSize.sm, color: isDark ? palette.darkInk : palette.ink900 }}>
                                  {t(`notif_ev_${ev.key}`, ev.label)}
                                </span>
                                {ev.critical && (
                                  <Tooltip title={t('critical_event', 'Critical — in-app cannot be disabled.')}>
                                    <Tag color="red" style={{ marginInlineStart: 0 }}>{t('critical', 'Critical')}</Tag>
                                  </Tooltip>
                                )}
                              </div>
                              <div style={{ fontSize: fontSize.xs, color: mutedClr, lineHeight: 1.4 }}>
                                {t(`notif_ev_${ev.key}_desc`, ev.desc)}
                              </div>
                            </div>
                          </td>
                          {NOTIF_CHANNELS.map(ch => {
                            const checked = !!row[ch.key];
                            const lockedOn = !!ev.critical && ch.key === 'in_app';
                            return (
                              <td key={ch.key} style={{ textAlign: 'center', padding: `${space.sm}px`, borderBottom: `1px solid ${borderClr}` }}>
                                <Tooltip title={lockedOn ? t('locked_critical', 'Locked — critical event') : (!ch.available ? t('channel_unavailable', 'Channel not yet available') : '')}>
                                  <Switch
                                    size="small"
                                    checked={checked}
                                    disabled={lockedOn || !ch.available}
                                    onChange={() => toggleCell(ev.key, ch.key)}
                                  />
                                </Tooltip>
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', padding: `${space.sm}px`, borderBottom: `1px solid ${borderClr}` }}>
                            <Switch size="small" checked={allOn} onChange={(v) => setRow(ev.key, v)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <Alert
              type="info"
              showIcon
              style={{ marginTop: space.lg }}
              message={t('notif_legacy_note', 'Legacy compatibility')}
              description={t('notif_legacy_desc', 'For backward compatibility, four core events (overdue, payment, quote, expense) also persist as plain booleans for older API consumers.')}
            />
          </div>
        )}

        {/* ── CHANNELS TAB ──────────────────────────────────────────── */}
        {activeTab === 'channels' && (
          <div>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: space.lg }}
              message={t('channels_intro', 'Configure each delivery channel below. Each channel can be tested with a sample notification.')}
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: space.lg }}>
              {NOTIF_CHANNELS.map(ch => (
                <div
                  key={ch.key}
                  style={{
                    border: `1px solid ${borderClr}`,
                    borderRadius: radius.lg,
                    padding: space.lg,
                    background: cardBg,
                    opacity: ch.available ? 1 : 0.7,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: space.md }}>
                      <div style={{ width: 36, height: 36, borderRadius: radius.md, background: 'rgba(31,111,235,0.10)', color: palette.primary500, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                        {ch.icon}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: fontSize.md, color: isDark ? palette.darkInk : palette.ink900 }}>
                          {t(`channel_${ch.key}`, ch.label)}
                        </div>
                        <div style={{ fontSize: fontSize.xs, color: mutedClr }}>
                          {ch.available ? t(`channel_${ch.key}_status`, 'Active') : t('channel_soon', 'Coming soon')}
                        </div>
                      </div>
                    </div>
                    {ch.available
                      ? <Tag color="success">{t('enabled', 'Enabled')}</Tag>
                      : <Tag>{t('coming_soon', 'Coming soon')}</Tag>}
                  </div>

                  {ch.key === 'email' && (
                    <Form layout="vertical" size="small" disabled={!ch.available}>
                      <ResponsiveForm layout="single">
                      <Form.Item label={t('reply_to_address', 'Reply-to address')}>
                        <Input
                          placeholder="you@company.com"
                          value={prefs.channels_meta?.email ?? ''}
                          onChange={(e) => setPrefs(p => ({ ...p, channels_meta: { ...p.channels_meta, email: e.target.value } }))}
                        />
                      </Form.Item>
                      </ResponsiveForm>
</Form>
                  )}
                  {ch.key === 'sms' && (
                    <Form layout="vertical" size="small" disabled={!ch.available}>
                      <ResponsiveForm layout="single">
                      <Form.Item label={t('mobile_number', 'Mobile number')}>
                        <Input
                          placeholder="+964 750 000 0000"
                          value={prefs.channels_meta?.sms_phone ?? ''}
                          onChange={(e) => setPrefs(p => ({ ...p, channels_meta: { ...p.channels_meta, sms_phone: e.target.value } }))}
                        />
                      </Form.Item>
                      </ResponsiveForm>
</Form>
                  )}
                  {ch.key === 'whatsapp' && (
                    <Form layout="vertical" size="small" disabled={!ch.available}>
                      <ResponsiveForm layout="single">
                      <Form.Item label={t('whatsapp_number', 'WhatsApp number')}>
                        <Input
                          placeholder="+964 750 000 0000"
                          value={prefs.channels_meta?.whatsapp_phone ?? ''}
                          onChange={(e) => setPrefs(p => ({ ...p, channels_meta: { ...p.channels_meta, whatsapp_phone: e.target.value } }))}
                        />
                      </Form.Item>
                      </ResponsiveForm>
</Form>
                  )}
                  {ch.key === 'slack' && (
                    <Form layout="vertical" size="small" disabled={!ch.available}>
                      <ResponsiveForm layout="single">
                      <Form.Item label={t('slack_workspace', 'Slack workspace')}>
                        <Input
                          placeholder="acme.slack.com"
                          value={prefs.channels_meta?.slack_workspace ?? ''}
                          onChange={(e) => setPrefs(p => ({ ...p, channels_meta: { ...p.channels_meta, slack_workspace: e.target.value } }))}
                        />
                      </Form.Item>
                      </ResponsiveForm>
</Form>
                  )}
                  {ch.key === 'push' && (
                    <div style={{ fontSize: fontSize.sm, color: mutedClr }}>
                      {t('push_devices_count', 'Registered devices')}: <strong>{prefs.channels_meta?.push_devices ?? 0}</strong>
                    </div>
                  )}
                  {ch.key === 'in_app' && (
                    <div style={{ fontSize: fontSize.sm, color: mutedClr }}>
                      {t('in_app_always', 'In-app notifications appear in the bell menu, top-right.')}
                    </div>
                  )}

                  <Divider style={{ margin: `${space.md}px 0` }} />
                  <Button size="small" icon={<ThunderboltOutlined />} disabled={!ch.available} onClick={() => handleTest(ch.key)}>
                    {t('send_test', 'Send test')}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SCHEDULE TAB ──────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <SettingsRow
                label={t('email_digest_freq', 'Email digest frequency')}
                description={t('email_digest_desc', 'Bundle non-critical email notifications to reduce noise.')}
              >
                <Select
                  style={{ minWidth: 200 }}
                  value={prefs.digest ?? 'instant'}
                  onChange={(v) => setPrefs(p => ({ ...p, digest: v as NotifPrefsV2['digest'] }))}
                  options={[
                    { value: 'instant', label: t('digest_instant', 'Instant — send each event') },
                    { value: 'hourly',  label: t('digest_hourly',  'Hourly digest') },
                    { value: 'daily',   label: t('digest_daily',   'Daily digest (08:00)') },
                    { value: 'weekly',  label: t('digest_weekly',  'Weekly digest (Mon 08:00)') },
                  ]}
                />
              </SettingsRow>
              <SettingsRow
                label={t('quiet_hours', 'Quiet hours')}
                description={t('quiet_hours_desc', 'Mute push and SMS during these hours. In-app and email continue normally.')}
              >
                <Switch
                  checked={!!prefs.quiet_hours_enabled}
                  onChange={(v) => setPrefs(p => ({ ...p, quiet_hours_enabled: v }))}
                />
              </SettingsRow>
              {prefs.quiet_hours_enabled && (
                <SettingsRow
                  label={t('quiet_hours_window', 'Quiet hours window')}
                  description={t('quiet_hours_window_desc', 'Push and SMS will be silenced during this window in your timezone.')}
                >
                  <Space>
                    <TimePicker
                      format="HH:mm"
                      value={parseHHmm(prefs.quiet_hours_start)}
                      onChange={(v) => setPrefs(p => ({ ...p, quiet_hours_start: v ? v.format('HH:mm') : '22:00' }))}
                    />
                    <span style={{ color: mutedClr }}>→</span>
                    <TimePicker
                      format="HH:mm"
                      value={parseHHmm(prefs.quiet_hours_end)}
                      onChange={(v) => setPrefs(p => ({ ...p, quiet_hours_end: v ? v.format('HH:mm') : '07:00' }))}
                    />
                  </Space>
                </SettingsRow>
              )}
              <SettingsRow
                label={t('weekend_mute', 'Weekend mute')}
                description={t('weekend_mute_desc', 'Silence non-critical push and SMS during Friday & Saturday (Iraq weekend).')}
                divider={false}
              >
                <Switch
                  checked={!!prefs.weekend_mute}
                  onChange={(v) => setPrefs(p => ({ ...p, weekend_mute: v }))}
                />
              </SettingsRow>
            </Space>
          </div>
        )}
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Modules ───────────────────────
const ModulesSettings: React.FC = () => {
  const { t } = useTranslation();
  const enabledModules = useOnboardingStore(s => s.enabledModules);
  const industryId = useOnboardingStore(s => s.industryId);
  const reset = useOnboardingStore(s => s.reset);
  const reopen = () => window.dispatchEvent(new Event('open-onboarding'));
  const ind = industryId ? INDUSTRIES.find(i => i.id === industryId) : null;
  const enabled = enabledModules
    ? (enabledModules.map(k => MODULES.find(m => m.key === k)).filter(Boolean) as typeof MODULES)
    : null;

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<AppstoreOutlined />}
        title={t('modules_active', 'Active modules')}
        description={t('settings_sub_modules', 'Enable or disable modules and re-run onboarding.')}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.modules.what')}
              why={t('settings.help.modules.why')}
              steps={[
                t('settings.help.modules.step_1'),
                t('settings.help.modules.step_2'),
                t('settings.help.modules.step_3'),
              ]}
            />
            <Button icon={<RocketOutlined />} type="primary" onClick={reopen}>
              {t('reopen_onboarding', 'Re-run onboarding')}
            </Button>
            <Popconfirm title={t('are_you_sure')} onConfirm={reset}>
              <Button danger>{t('reset', 'Reset')}</Button>
            </Popconfirm>
          </Space>
        }
      >
        {ind ? (
          <SettingsRow
            label={t('industry', 'Industry')}
            description={t('settings_sub_industry', 'Your selected business vertical.')}
          >
            <Tag color="blue" style={{ fontSize: fontSize.sm, padding: '2px 10px', borderRadius: radius.pill }}>
              {ind.icon} {ind.title}
            </Tag>
          </SettingsRow>
        ) : (
          <SettingsRow
            label={t('industry', 'Industry')}
            description={t('onboarding_not_complete', 'Onboarding has not been completed yet.')}
          >
            <Button onClick={reopen} icon={<RocketOutlined />}>{t('start_onboarding', 'Start onboarding')}</Button>
          </SettingsRow>
        )}

        {enabled && enabled.length > 0 && (
          <div style={{ paddingTop: space.lg }}>
            <div style={{ fontSize: fontSize.sm, fontWeight: 600, color: palette.ink500, marginBottom: space.md }}>
              {t('enabled_modules', 'Enabled modules')} <span style={{ color: palette.ink300 }}>({enabled.length})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: space.md }}>
              {enabled.map(m => (
                <div
                  key={m.key}
                  style={{
                    padding: space.md,
                    border: `1px solid ${palette.border}`,
                    borderRadius: radius.md,
                    background: palette.surface,
                    display: 'flex',
                    alignItems: 'center',
                    gap: space.sm,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{m.icon}</span>
                  <span style={{ fontWeight: 500, color: palette.ink900 }}>{m.title}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Fiscal Years ───────────────────────
const FiscalYears: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchData = () => {
    setLoading(true);
    api.get('/api/fiscal/years')
      .then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [])))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.post('/api/fiscal/years', {
        name: values.name,
        start_date: values.start_date.format('YYYY-MM-DD'),
        end_date: values.end_date.format('YYYY-MM-DD'),
      });
      message.success(t('success')); setModalOpen(false); fetchData();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const handleClose = async (id: string) => {
    try { await api.post(`/api/fiscal/years/${id}/close`); message.success(t('success')); fetchData(); }
    catch { message.error(t('error')); }
  };

  return (
    <SectionCard
      icon={<CalendarOutlined />}
      title={t('fiscal_years')}
      description={t('settings_sub_fiscal', 'Configure your fiscal years and closing periods.')}
      actions={
        <Space>
          <SectionHelpPopover
            what={t('settings.help.fiscal.what')}
            why={t('settings.help.fiscal.why')}
            steps={[
              t('settings.help.fiscal.step_1'),
              t('settings.help.fiscal.step_2'),
              t('settings.help.fiscal.step_3'),
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setModalOpen(true); }}>
            {t('new_fiscal_year')}
          </Button>
        </Space>
      }
      noPadding
    >
      <ResponsiveTableAdapter
        dataSource={data}
        size="middle"
        columns={[
          { title: t('name'), dataIndex: 'name', key: 'name' },
          { title: t('start_date'), dataIndex: 'start_date', key: 'start_date', render: (d: string) => d?.substring(0, 10) },
          { title: t('end_date'),   dataIndex: 'end_date',   key: 'end_date',   render: (d: string) => d?.substring(0, 10) },
          { title: t('status'),     dataIndex: 'status',     key: 'status',
            render: (s: string) => <Tag color={s === 'open' ? 'green' : 'red'}>{t(s)}</Tag> },
          { title: t('actions'), key: 'actions',
            render: (_: any, r: any) => r.status === 'open'
              ? <Button size="small" onClick={() => handleClose(r.id)}>{t('close_year')}</Button>
              : null },
        ]}
        rowKey="id"
        loading={loading}
      />
      <PremiumModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okLoading={saving}
        icon={<CalendarOutlined />}
        title={t('new_fiscal_year')}
        okText={t('save')}
        cancelText={t('cancel')}
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('start_date')} name="start_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('end_date')} name="end_date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </SectionCard>
  );
};

// ─────────────────────── Budgets ───────────────────────
const Budgets: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [fiscalYears, setFiscalYears] = useState<any[]>([]);

  const fetchData = () => {
    setLoading(true);
    api.get('/api/fiscal/budgets')
      .then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [])))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const openNew = async () => {
    try {
      const r = await api.get('/api/fiscal/years');
      setFiscalYears(Array.isArray(r.data) ? r.data : (r.data.items || []));
    } catch {}
    form.resetFields(); setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.post('/api/fiscal/budgets', { name: values.name, fiscal_year_id: values.fiscal_year_id, lines: [] });
      message.success(t('success')); setModalOpen(false); fetchData();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    try { await api.delete(`/api/fiscal/budgets/${id}`); message.success(t('success')); fetchData(); }
    catch { message.error(t('error')); }
  };

  return (
    <SectionCard
      icon={<FundOutlined />}
      title={t('budgets')}
      description={t('settings_sub_budgets', 'Plan, track, and analyze budgets per fiscal year.')}
      actions={
        <Space>
          <SectionHelpPopover
            what={t('settings.help.budgets.what')}
            why={t('settings.help.budgets.why')}
            steps={[
              t('settings.help.budgets.step_1'),
              t('settings.help.budgets.step_2'),
              t('settings.help.budgets.step_3'),
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>{t('new_budget')}</Button>
        </Space>
      }
      noPadding
    >
      <ResponsiveTableAdapter
        dataSource={data}
        size="middle"
        columns={[
          { title: t('name'), dataIndex: 'name', key: 'name' },
          { title: t('actions'), key: 'actions', render: (_: any, r: any) => (
            <Popconfirm title={t('are_you_sure')} onConfirm={() => handleDelete(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )},
        ]}
        rowKey="id"
        loading={loading}
      />
      <PremiumModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okLoading={saving}
        icon={<FundOutlined />}
        title={t('new_budget')}
        okText={t('save')}
        cancelText={t('cancel')}
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item label={t('name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('fiscal_year')} name="fiscal_year_id" rules={[{ required: true }]}>
            <Select
              placeholder={t('select')}
              options={buildEffectiveOptions(
                fiscalYears.map(fy => ({ label: fy.name, value: fy.id })),
                t('fiscal_year', 'Fiscal Year'),
                '/settings?s=fiscal',
                navigate,
              )}
              onChange={(value) => {
                if (handleAddOptionChange(value, '/settings?s=fiscal', navigate)) return;
              }}
            />
          </Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </SectionCard>
  );
};

// ─────────────────────── Currencies ───────────────────────
const Currencies: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.get('/api/system/currencies'), api.get('/api/system/exchange-rates')])
      .then(([c, r]) => {
        setCurrencies(Array.isArray(c.data) ? c.data : (c.data.items || c.data || []));
        setRates(Array.isArray(r.data) ? r.data : (r.data.items || []));
      })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.post('/api/system/exchange-rates', {
        from_currency: values.from_currency, to_currency: values.to_currency,
        rate: values.rate, date: values.date.format('YYYY-MM-DD'),
      });
      message.success(t('success')); setModalOpen(false);
      const r = await api.get('/api/system/exchange-rates');
      setRates(Array.isArray(r.data) ? r.data : (r.data.items || []));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<DollarOutlined />} title={t('currencies')} noPadding
        actions={
          <SectionHelpPopover
            what={t('settings.help.currencies.what')}
            why={t('settings.help.currencies.why')}
            steps={[
              t('settings.help.currencies.step_1'),
              t('settings.help.currencies.step_2'),
              t('settings.help.currencies.step_3'),
            ]}
          />
        }
      >
        <ResponsiveTableAdapter
          dataSource={currencies}
          columns={[
            { title: t('currency'), dataIndex: 'code', key: 'code' },
            { title: t('name'), dataIndex: 'name', key: 'name' },
            { title: t('symbol'), dataIndex: 'symbol', key: 'symbol' },
          ]}
          rowKey="code"
          loading={loading}
          pagination={false}
          size="middle"
        />
      </SectionCard>

      <SectionCard
        icon={<DollarOutlined />}
        title={t('exchange_rates')}
        actions={
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setModalOpen(true); }}>
            {t('new_rate')}
          </Button>
        }
        noPadding
      >
        <ResponsiveTableAdapter
          dataSource={rates}
          columns={[
            { title: t('from'), dataIndex: 'from_currency', key: 'from_currency' },
            { title: t('to'),   dataIndex: 'to_currency',   key: 'to_currency' },
            { title: t('rate'), dataIndex: 'rate',          key: 'rate' },
            { title: t('date'), dataIndex: 'date',          key: 'date',
              render: (d: string) => d?.substring(0, 10) },
          ]}
          rowKey="id"
          pagination={false}
          size="middle"
        />
      </SectionCard>

      <PremiumModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okLoading={saving}
        icon={<DollarOutlined />}
        title={t('new_rate')}
        okText={t('save')}
        cancelText={t('cancel')}
      >
        <Form form={form} layout="vertical" initialValues={{ date: dayjs() }}>
          <ResponsiveForm layout="single">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t('from')} name="from_currency" rules={[{ required: true }]}>
                <Select
                  placeholder="USD"
                  options={buildEffectiveOptions(
                    currencies.map(c => ({ label: `${c.code} — ${c.name}`, value: c.code })),
                    t('currencies', 'Currencies'),
                    '/settings?s=currencies',
                    navigate,
                  )}
                  onChange={(value) => {
                    if (handleAddOptionChange(value, '/settings?s=currencies', navigate)) return;
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t('to')} name="to_currency" rules={[{ required: true }]}>
                <Select
                  placeholder="IQD"
                  options={buildEffectiveOptions(
                    currencies.map(c => ({ label: `${c.code} — ${c.name}`, value: c.code })),
                    t('currencies', 'Currencies'),
                    '/settings?s=currencies',
                    navigate,
                  )}
                  onChange={(value) => {
                    if (handleAddOptionChange(value, '/settings?s=currencies', navigate)) return;
                  }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label={t('rate')} name="rate" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('date')} name="date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </Space>
  );
};

// ─────────────────────── Invoice Templates ───────────────────────
const InvoiceTemplates: React.FC = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<{id: string; name: string; layout: string; is_default: boolean}[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchTemplates = () => {
    setLoading(true);
    api.get('/api/system/invoice-templates')
      .then(r => setTemplates(Array.isArray(r.data) ? r.data : (r.data.items || [])))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.post('/api/system/invoice-templates', values);
      message.success(t('success')); setModalOpen(false); fetchTemplates();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const setDefault = async (id: string) => {
    try {
      await api.post(`/api/system/invoice-templates/${id}/set-default`);
      message.success(t('success')); fetchTemplates();
    } catch { message.error(t('error')); }
  };

  return (
    <SectionCard
      icon={<FileTextOutlined />}
      title={t('invoice_templates')}
      description={t('settings_sub_tmpl', 'Customize invoice layouts and branding.')}
      actions={
        <Space>
          <SectionHelpPopover
            what={t('settings.help.templates.what')}
            why={t('settings.help.templates.why')}
            steps={[
              t('settings.help.templates.step_1'),
              t('settings.help.templates.step_2'),
              t('settings.help.templates.step_3'),
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />}
            onClick={() => { form.resetFields(); setModalOpen(true); }}>
            {t('create')}
          </Button>
        </Space>
      }
      noPadding
    >
      <ResponsiveTableAdapter
        dataSource={templates}
        size="middle"
        columns={[
          { title: t('template_name'), dataIndex: 'name', key: 'name' },
          { title: t('layout'),        dataIndex: 'layout', key: 'layout' },
          { title: t('status'), key: 'default',
            render: (_: unknown, r: {is_default: boolean}) =>
              r.is_default ? <Tag color="green">{t('default_template')}</Tag> : null },
          { title: t('actions'), key: 'actions',
            render: (_: unknown, r: {id: string; is_default: boolean}) =>
              !r.is_default ? <Button size="small" onClick={() => setDefault(r.id)}>{t('set_default')}</Button> : null },
        ]}
        rowKey="id"
        loading={loading}
      />
      <PremiumModal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
        okLoading={saving}
        icon={<FileTextOutlined />}
        title={t('invoice_templates')}
        okText={t('save')}
        cancelText={t('cancel')}
      >
        <Form form={form} layout="vertical" initialValues={{ layout: 'classic', show_logo: true }}>
          <ResponsiveForm layout="single">
          <Form.Item label={t('template_name')} name="name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item label={t('layout')} name="layout">
            <Select
              options={[
                { label: t('classic'), value: 'classic' },
                { label: t('modern'),  value: 'modern' },
                { label: t('minimal'), value: 'minimal' },
                { label: t('rtl'),     value: 'rtl' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Colors" name="colors"><Input placeholder="#1677ff" /></Form.Item>
          <Form.Item label={t('show_logo')} name="show_logo" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label={t('footer_text')} name="footer_text"><Input.TextArea rows={2} /></Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </SectionCard>
  );
};

// ─────────────────────── Reminder Settings ───────────────────────
const ReminderSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/reminder-settings').then(r => form.setFieldsValue(r.data))
      .catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = form.getFieldsValue();
      await api.put('/api/system/reminder-settings', vals);
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <SectionCard
      icon={<ClockCircleOutlined />}
      title={t('reminder_settings')}
      description={t('settings_sub_rem', 'Automated reminders for due and overdue invoices.')}
      loading={loading}
      actions={
        <SectionHelpPopover
          what={t('settings.help.reminders.what')}
          why={t('settings.help.reminders.why')}
          steps={[
            t('settings.help.reminders.step_1'),
            t('settings.help.reminders.step_2'),
            t('settings.help.reminders.step_3'),
          ]}
        />
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <ResponsiveForm layout="single">
        <Row gutter={24}>
          <Col xs={24} md={12}>
            <Form.Item label={t('before_due_days')} name="before_due_days">
              <Input placeholder="3,7,14" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('after_due_days')} name="after_due_days">
              <Input placeholder="1,3,7" />
            </Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label={t('email_subject')} name="email_subject_template"><Input /></Form.Item>
          </Col>
          <Col span={24}>
            <Form.Item label={t('email_body')} name="email_body_template">
              <Input.TextArea rows={4} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label={t('active')} name="is_active" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        </ResponsiveForm>
</Form>
    </SectionCard>
  );
};

// ─────────────────────── E-Invoice ───────────────────────
type EInvoiceSummary = { generated: number; signed: number; submitted: number; accepted: number; rejected: number; cancelled: number };
type EInvoiceRecord  = { id: string; invoice_number?: string; fiscal_id?: string; status?: string; provider_uuid?: string; error_message?: string; submitted_at?: string };
const emptyEInvoiceSummary: EInvoiceSummary = { generated: 0, signed: 0, submitted: 0, accepted: 0, rejected: 0, cancelled: 0 };

const EInvoiceSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [summary, setSummary] = useState<EInvoiceSummary>(emptyEInvoiceSummary);
  const [errors, setErrors] = useState<EInvoiceRecord[]>([]);

  const fetchConfig = async () => {
    setLoading(true);
    try { const res = await api.get('/api/einvoice/config'); form.setFieldsValue(res.data); }
    catch { message.error(t('error')); } finally { setLoading(false); }
  };

  const fetchReports = async () => {
    setReportLoading(true);
    try {
      const [monthlyRes, errorRes] = await Promise.all([
        api.get('/api/einvoice/report/monthly'),
        api.get('/api/einvoice/report/errors', { params: { limit: 20 } }),
      ]);
      setSummary({ ...emptyEInvoiceSummary, ...(monthlyRes.data.summary || {}) });
      setErrors(errorRes.data.items || []);
    } catch { message.error(t('error')); } finally { setReportLoading(false); }
  };

  useEffect(() => { void fetchConfig(); void fetchReports(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const values = await form.validateFields();
      await api.put('/api/einvoice/config', values);
      message.success(t('success'));
      await fetchConfig(); await fetchReports();
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  const stats: Array<{ label: string; value: number; color?: string }> = [
    { label: t('generated'), value: summary.generated },
    { label: t('signed'),    value: summary.signed },
    { label: t('submitted'), value: summary.submitted },
    { label: t('accepted'),  value: summary.accepted, color: palette.success },
    { label: t('rejected'),  value: summary.rejected, color: summary.rejected > 0 ? palette.danger : undefined },
    { label: t('cancelled'), value: summary.cancelled },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<FileProtectOutlined />}
        title={t('einvoice_settings')}
        description={t('settings_sub_einv', 'Iraq electronic invoicing portal configuration.')}
        loading={loading}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.einvoice.what')}
              why={t('settings.help.einvoice.why')}
              steps={[
                t('settings.help.einvoice.step_1'),
                t('settings.help.einvoice.step_2'),
                t('settings.help.einvoice.step_3'),
              ]}
            />
            <Button icon={<CloudOutlined />}
              onClick={() => { void fetchConfig(); void fetchReports(); }}>
              {t('refresh')}
            </Button>
          </Space>
        }
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Row gutter={24}>
            <Col xs={24} md={8}>
              <Form.Item label={t('iraq_einvoice_enabled')} name="enabled" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('preview_mode')} name="preview_mode" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label={t('auto_submit_on_send')} name="auto_submit_on_send" valuePropName="checked"><Switch /></Form.Item>
            </Col>
            <Col xs={24} md={12}><Form.Item label={t('portal_url')} name="portal_url"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('status_url_template')} name="status_url_template"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('cancel_url')} name="cancel_url"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('iraq_seller_tax_id')} name="seller_tax_id"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('branch_code')} name="branch_code"><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('api_key')} name="api_key"><Input.Password /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item label={t('auth_token')} name="auth_token"><Input.Password /></Form.Item></Col>
            <Col span={24}>
              <Form.Item label={t('private_key_pem')} name="private_key_pem">
                <Input.TextArea rows={5} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label={t('private_key_password')} name="private_key_password">
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>
          </ResponsiveForm>
</Form>
      </SectionCard>

      <SectionCard
        icon={<FundOutlined />}
        title={t('einvoice_compliance_overview')}
        loading={reportLoading}
      >
        <Row gutter={[16, 16]}>
          {stats.map(s => (
            <Col xs={12} md={4} key={s.label}>
              <div style={{
                padding: space.md,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.md,
                background: palette.bg,
                textAlign: 'center',
              }}>
                <div style={{ fontSize: fontSize.xs, color: palette.ink500, fontWeight: 500 }}>{s.label}</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 700, color: s.color ?? palette.ink900 }}>
                  {s.value}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </SectionCard>

      <SectionCard
        icon={<HistoryOutlined />}
        title={t('einvoice_errors')}
        loading={reportLoading}
        accent="danger"
        noPadding
      >
        <ResponsiveTableAdapter<EInvoiceRecord>
          dataSource={errors}
          rowKey="id"
          pagination={false}
          size="middle"
          columns={[
            { title: '#', dataIndex: 'invoice_number', key: 'invoice_number' },
            { title: t('fiscal_id'), dataIndex: 'fiscal_id', key: 'fiscal_id' },
            { title: t('status'), dataIndex: 'status', key: 'status',
              render: (v: string | undefined) => <Tag color={v === 'rejected' ? 'red' : 'orange'}>{v || '-'}</Tag> },
            { title: t('error'), dataIndex: 'error_message', key: 'error_message',
              render: (v: string | undefined) => v || '-' },
            { title: t('date'), dataIndex: 'submitted_at', key: 'submitted_at',
              render: (v: string | undefined) => v?.substring(0, 19) || '-' },
          ]}
        />
      </SectionCard>
    </Space>
  );
};

// ─────────────────────── Email ───────────────────────
const EmailSettings: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get('/api/system/settings').then(r => {
      const vals: Record<string, string> = {};
      r.data.forEach((s: {key: string; value: string}) => { vals[s.key] = s.value; });
      form.setFieldsValue(vals);
    }).catch(() => {}).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const vals = form.getFieldsValue();
      for (const [key, value] of Object.entries(vals)) {
        if (value !== undefined && value !== null) {
          await api.post('/api/system/settings', { key, value: String(value), category: 'email' });
        }
      }
      message.success(t('success'));
    } catch { message.error(t('error')); } finally { setSaving(false); }
  };

  return (
    <SectionCard
      icon={<MailOutlined />}
      title={t('email_settings')}
      description={t('settings_sub_email', 'SMTP credentials for outbound mail.')}
      loading={loading}
      actions={
        <SectionHelpPopover
          what={t('settings.help.email.what')}
          why={t('settings.help.email.why')}
          steps={[
            t('settings.help.email.step_1'),
            t('settings.help.email.step_2'),
            t('settings.help.email.step_3'),
          ]}
        />
      }
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button type="primary" onClick={handleSave} loading={saving}>{t('save')}</Button>
        </div>
      }
    >
      <Form form={form} layout="vertical">
        <ResponsiveForm layout="single">
        <Row gutter={24}>
          <Col xs={24} md={12}><Form.Item label={t('smtp_host')} name="smtp_host"><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label={t('smtp_port')} name="smtp_port"><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label={t('smtp_user')} name="smtp_user"><Input /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label={t('smtp_password')} name="smtp_password"><Input.Password /></Form.Item></Col>
          <Col xs={24} md={12}><Form.Item label={t('email_from')} name="email_from"><Input /></Form.Item></Col>
        </Row>
        </ResponsiveForm>
</Form>
    </SectionCard>
  );
};

// ─────────────────────── Backup ───────────────────────
const BackupRestore: React.FC = () => {
  const { t } = useTranslation();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const fetchBackups = () => {
    setLoading(true);
    api.get('/api/system/backup/list')
      .then(r => setBackups(Array.isArray(r.data) ? r.data : (r.data.items || [])))
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchBackups(); }, []);

  const createBackup = async () => {
    setCreating(true);
    try { await api.post('/api/system/backup'); message.success(t('success')); fetchBackups(); }
    catch { message.error(t('error')); } finally { setCreating(false); }
  };

  const downloadBackup = async () => {
    try {
      const r = await api.get('/api/system/backup/download', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a'); a.href = url; a.download = 'backup.db'; a.click();
      window.URL.revokeObjectURL(url);
    } catch { message.error(t('error')); }
  };

  return (
    <SectionCard
      icon={<DatabaseOutlined />}
      title={t('backup_settings')}
      description={t('settings_sub_backup', 'Create and download full system backups.')}
      actions={
        <Space>
          <SectionHelpPopover
            what={t('settings.help.backup.what')}
            why={t('settings.help.backup.why')}
            steps={[
              t('settings.help.backup.step_1'),
              t('settings.help.backup.step_2'),
              t('settings.help.backup.step_3'),
            ]}
          />
          <Button type="primary" icon={<CloudOutlined />} onClick={createBackup} loading={creating}>
            {t('create_backup')}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={downloadBackup}>{t('download_backup')}</Button>
        </Space>
      }
      noPadding
    >
      <ResponsiveTableAdapter
        dataSource={backups}
        size="middle"
        columns={[
          { title: t('name'), dataIndex: 'filename', key: 'filename' },
          { title: t('date'), dataIndex: 'created',  key: 'created' },
          { title: t('size'), dataIndex: 'size',     key: 'size',
            render: (v: number) => `${(v / 1024).toFixed(1)} KB` },
        ]}
        rowKey="filename"
        loading={loading}
      />
    </SectionCard>
  );
};

// ─────────────────────── Activity Log ───────────────────────
const ActivityLog: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<{id: string; created_at: string; action: string; description: string; entity_type: string; user_name?: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [entityFilter, setEntityFilter] = useState<string | undefined>();
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null] | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params: Record<string, string | number> = { page, page_size: 20 };
    if (actionFilter) params.action = actionFilter;
    if (entityFilter) params.entity = entityFilter;
    if (dateRange?.[0]) params.from_date = dateRange[0].format('YYYY-MM-DD');
    if (dateRange?.[1]) params.to_date   = dateRange[1].format('YYYY-MM-DD');
    api.get('/api/system/activity-log', { params })
      .then(r => { setData(r.data.items || []); setTotal(r.data.total || 0); })
      .catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [page, actionFilter, entityFilter, dateRange]); // eslint-disable-line

  return (
    <SectionCard
      icon={<HistoryOutlined />}
      title={t('system_log')}
      description={t('settings_sub_activity', 'Audit trail of every action across your workspace.')}
      noPadding
    >
      <div style={{ padding: space.lg, borderBottom: `1px solid ${palette.border}` }}>
        <Row gutter={16}>
          <Col xs={24} md={6}>
            <Select
              allowClear
              placeholder={t('type')}
              style={{ width: '100%' }}
              value={actionFilter}
              onChange={v => { setActionFilter(v); setPage(1); }}
              options={[
                { label: t('create'), value: 'create' },
                { label: t('edit'),   value: 'update' },
                { label: t('delete'), value: 'delete' },
                { label: t('approve'), value: 'approve' },
              ]}
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              allowClear
              placeholder={t('entity')}
              style={{ width: '100%' }}
              value={entityFilter}
              onChange={v => { setEntityFilter(v); setPage(1); }}
              options={[
                { label: t('invoice'), value: 'invoice' },
                { label: t('expense'), value: 'expense' },
                { label: t('contact'), value: 'contact' },
                { label: t('item'),    value: 'item' },
                { label: t('payment'), value: 'payment' },
                { label: t('journal'), value: 'journal' },
              ]}
            />
          </Col>
          <Col xs={24} md={8}>
            <RangePicker
              style={{ width: '100%' }}
              onChange={(dates) => { setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null); setPage(1); }}
            />
          </Col>
        </Row>
      </div>
      <ResponsiveTableAdapter
        dataSource={data}
        size="middle"
        columns={[
          { title: t('date'), dataIndex: 'created_at', key: 'created_at',
            render: (d: string) => d?.substring(0, 19).replace('T', ' ') },
          { title: t('type'), dataIndex: 'action', key: 'action',
            render: (a: string) => <Tag>{a}</Tag> },
          { title: t('entity'),      dataIndex: 'entity_type', key: 'entity_type' },
          { title: t('description'), dataIndex: 'description', key: 'description' },
          { title: t('user'),        dataIndex: 'user_name',   key: 'user_name' },
        ]}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage }}
      />
    </SectionCard>
  );
};

// ─────────────────────── System Info ───────────────────────
const SystemInfo: React.FC = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const themeMode = useAuthStore(s => s.theme);
  const [now, setNow] = useState<string>(dayjs().format('YYYY-MM-DD HH:mm:ss'));
  const [online, setOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const i = setInterval(() => setNow(dayjs().format('YYYY-MM-DD HH:mm:ss')), 1000);
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => { clearInterval(i); window.removeEventListener('online', onUp); window.removeEventListener('offline', onDown); };
  }, []);

  const viewport = `${window.innerWidth}×${window.innerHeight}`;
  const ua = navigator.userAgent.length > 80 ? navigator.userAgent.slice(0, 80) + '…' : navigator.userAgent;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const info: Array<{ icon: React.ReactNode; label: string; value: React.ReactNode; accent?: 'success' | 'warning' | 'danger' }> = [
    { icon: <RocketOutlined />,  label: t('app_version'),                 value: '1.0.0' },
    { icon: <ThunderboltOutlined />, label: 'Frontend',                   value: 'React 19 · Vite 8 · AntD 6.3' },
    { icon: <CloudOutlined />,   label: 'Backend',                        value: 'FastAPI · Firestore · Python 3.11' },
    { icon: <GlobalOutlined />,  label: t('language', 'Language'),        value: <Tag color="blue">{lang.toUpperCase()}</Tag> },
    { icon: <SettingOutlined />, label: t('theme', 'Theme'),              value: <Tag>{themeMode}</Tag> },
    { icon: <ClockCircleOutlined />, label: t('current_time', 'Current time'), value: <span style={{ fontFamily: 'monospace' }}>{now}</span> },
    { icon: <GlobalOutlined />,  label: t('timezone', 'Timezone'),        value: tz },
    { icon: <InfoCircleOutlined />, label: t('viewport', 'Viewport'),     value: <span style={{ fontFamily: 'monospace' }}>{viewport}</span> },
    { icon: <CheckCircleOutlined />, label: t('connectivity', 'Connection'),
      value: <Tag color={online ? 'green' : 'red'}>{online ? t('online', 'Online') : t('offline', 'Offline')}</Tag>,
      accent: online ? 'success' : 'danger' },
  ];

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<InfoCircleOutlined />}
        title={t('system_info')}
        description={t('settings_sub_system', 'Build, runtime, and environment diagnostics.')}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: space.md }}>
          {info.map((it, idx) => (
            <div
              key={idx}
              style={{
                padding: space.md,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.md,
                background: palette.bg,
                display: 'flex',
                gap: space.sm,
                alignItems: 'center',
              }}
            >
              <span style={{
                width: 32, height: 32,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                borderRadius: radius.sm,
                background: 'rgba(31,111,235,0.10)',
                color: palette.primary500,
              }}>
                {it.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: fontSize.xs, color: palette.ink500, fontWeight: 500 }}>{it.label}</div>
                <div style={{ fontSize: fontSize.sm, color: palette.ink900, fontWeight: 600, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {it.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<InfoCircleOutlined />}
        title={t('user_agent', 'User agent')}
        accent="info"
      >
        <code style={{ fontSize: fontSize.sm, color: palette.ink700, wordBreak: 'break-all' }}>{ua}</code>
      </SectionCard>
    </Space>
  );
};

// ───────────────────────────────────────────────────────────────────────
// PreviewSection — Reusable "coming soon" / catalog stub used by the
// breadth-coverage settings sections. Renders a SectionCard with a clean
// grid of the planned sub-features so the user sees the scope clearly.
// ───────────────────────────────────────────────────────────────────────
interface PreviewSectionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  accent?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}
const PreviewSection: React.FC<PreviewSectionProps> = ({ icon, title, description, features, accent = 'default' }) => {
  const { t } = useTranslation();
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={icon}
        title={title}
        description={description}
        accent={accent}
        actions={<Tag color="processing">{t('coming_soon', 'Coming soon')}</Tag>}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: space.md,
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: space.sm,
                padding: `${space.md}px ${space.lg}px`,
                border: `1px solid ${palette.border}`,
                borderRadius: radius.md,
                background: palette.bg,
                fontSize: fontSize.sm,
                color: palette.ink700,
                lineHeight: 1.45,
              }}
            >
              <CheckCircleOutlined style={{ color: palette.primary500, flexShrink: 0 }} />
              <span>{f}</span>
            </div>
          ))}
        </div>
      </SectionCard>
    </Space>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Real, DB-connected settings sections.
//
// Architecture:
//  • CRUD-rich sections (Branches, Users, Roles, Taxes, Banking,
//    Workflows, Approvals) call dedicated REST endpoints.
//  • Configuration-only sections persist a single JSON blob row in the
//    generic /api/system/settings key/value store via useSettingsBag.
//
// Each section follows: load → edit → save with optimistic local state.
// The api.ts client emits "api:mutation" events on POST/PUT/DELETE — the
// hook listens to those to keep the UI in sync across mounted sections.
// ───────────────────────────────────────────────────────────────────────

// ── useSettingsBag: shared hook for JSON-blob configuration sections ───
function useSettingsBag<T extends Record<string, unknown>>(category: string, defaults: T) {
  const [values, setValues] = useState<T>(defaults);
  const [original, setOriginal] = useState<T>(defaults);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const dirty = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(original),
    [values, original],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/system/settings');
      const items: Array<{ key: string; value: unknown; category: string }> = res.data || [];
      const blob = items.find((x) => x.category === category && x.key === 'blob');
      let next = defaults;
      if (blob && typeof blob.value === 'string' && blob.value) {
        try {
          const parsed = JSON.parse(blob.value);
          next = { ...defaults, ...parsed } as T;
        } catch {
          next = defaults;
        }
      }
      setValues(next);
      setOriginal(next);
    } catch {
      setValues(defaults);
      setOriginal(defaults);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  useEffect(() => { load(); }, [load]);

  // Cross-component refresh on mutations
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { url?: string } | undefined;
      if (detail?.url?.includes('/api/system/settings')) load();
    };
    window.addEventListener('api:mutation', handler);
    return () => window.removeEventListener('api:mutation', handler);
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await api.post('/api/system/settings', {
        key: 'blob',
        category,
        value: JSON.stringify(values),
      });
      setOriginal(values);
      message.success('saved');
    } catch {
      message.error('save_failed');
    } finally {
      setSaving(false);
    }
  };

  const setValue = <K extends keyof T>(k: K, v: T[K]) =>
    setValues((prev) => ({ ...prev, [k]: v }));

  return { values, setValue, setValues, save, load, loading, saving, dirty };
}

// ── SaveBar: shared sticky save row used by configuration sections ─────
const SaveBar: React.FC<{ dirty: boolean; saving: boolean; onSave: () => void; onReset?: () => void }> = ({ dirty, saving, onSave, onReset }) => {
  const { t } = useTranslation();
  if (!dirty) return null;
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        zIndex: 10,
        marginTop: space.lg,
        padding: `${space.md}px ${space.lg}px`,
        background: palette.surface,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.md,
        display: 'flex',
        justifyContent: 'flex-end',
        gap: space.sm,
        boxShadow: '0 -4px 12px rgba(15,23,42,0.04)',
      }}
    >
      {onReset && (
        <Button onClick={onReset} disabled={saving}>{t('reset', 'Reset')}</Button>
      )}
      <Button type="primary" onClick={onSave} loading={saving}>
        {t('save_changes', 'Save changes')}
      </Button>
    </div>
  );
};

// ── Account: Preferences ───────────────────────────────────────────────
type PreferencesBag = {
  theme: 'system' | 'light' | 'dark';
  density: 'compact' | 'default' | 'comfort';
  landing_page: string;
  first_day_of_week: 'sunday' | 'monday' | 'saturday';
  keyboard_shortcuts: boolean;
  high_contrast: boolean;
  large_text: boolean;
  calendar_provider: 'none' | 'google' | 'outlook';
};
const PreferencesSettings: React.FC = () => {
  const { t } = useTranslation();
  const currentTheme = useAuthStore((s) => s.theme);
  const toggleTheme = useAuthStore((s) => s.toggleTheme);
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<PreferencesBag>('preferences', {
    theme: 'system',
    density: 'default',
    landing_page: '/dashboard',
    first_day_of_week: 'sunday',
    keyboard_shortcuts: true,
    high_contrast: false,
    large_text: false,
    calendar_provider: 'none',
  });
  const applyTheme = (v: PreferencesBag['theme']) => {
    setValue('theme', v);
    if ((v === 'light' || v === 'dark') && v !== currentTheme) toggleTheme();
  };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<BgColorsOutlined />}
        title={t('preferences_personal', 'Personal preferences')}
        description={t('preferences_desc', 'Theme, density, default landing page, and accessibility tweaks.')}
        actions={
          <SectionHelpPopover
            what={t('settings.help.appearance.what')}
            why={t('settings.help.appearance.why')}
            steps={[
              t('settings.help.appearance.step_1'),
              t('settings.help.appearance.step_2'),
              t('settings.help.appearance.step_3'),
            ]}
          />
        }
      >
        <SettingsRow label={t('pref_theme', 'Theme')}>
          <Select
            value={values.theme}
            onChange={applyTheme}
            disabled={loading}
            style={{ width: 220 }}
            options={[
              { value: 'system', label: t('theme_system', 'System') },
              { value: 'light', label: t('theme_light', 'Light') },
              { value: 'dark', label: t('theme_dark', 'Dark') },
            ]}
          />
        </SettingsRow>
        <SettingsRow label={t('pref_density', 'Density')}>
          <Segmented
            value={values.density}
            onChange={(v) => setValue('density', v as PreferencesBag['density'])}
            options={[
              { value: 'compact', label: t('density_compact', 'Compact') },
              { value: 'default', label: t('density_default', 'Default') },
              { value: 'comfort', label: t('density_comfort', 'Comfort') },
            ]}
            disabled={loading}
          />
        </SettingsRow>
        <SettingsRow label={t('pref_landing', 'Default landing page')}>
          <Select
            value={values.landing_page}
            onChange={(v) => setValue('landing_page', v)}
            disabled={loading}
            style={{ width: 280 }}
            options={[
              { value: '/dashboard', label: t('nav_dashboard', 'Dashboard') },
              { value: '/invoices', label: t('nav_invoices', 'Invoices') },
              { value: '/contacts', label: t('nav_contacts', 'Contacts') },
              { value: '/items', label: t('nav_items', 'Items') },
              { value: '/reports', label: t('nav_reports', 'Reports') },
              { value: '/pos', label: t('nav_pos', 'POS') },
            ]}
          />
        </SettingsRow>
        <SettingsRow label={t('pref_first_day', 'First day of week')}>
          <Segmented
            value={values.first_day_of_week}
            onChange={(v) => setValue('first_day_of_week', v as PreferencesBag['first_day_of_week'])}
            options={[
              { value: 'saturday', label: t('day_sat', 'Sat') },
              { value: 'sunday', label: t('day_sun', 'Sun') },
              { value: 'monday', label: t('day_mon', 'Mon') },
            ]}
            disabled={loading}
          />
        </SettingsRow>
        <SettingsRow label={t('pref_keyboard', 'Keyboard shortcuts')} description={t('pref_keyboard_desc', 'Enable Ctrl+K palette and global shortcuts.')}>
          <Switch checked={values.keyboard_shortcuts} onChange={(v) => setValue('keyboard_shortcuts', v)} disabled={loading} />
        </SettingsRow>
        <SettingsRow label={t('pref_high_contrast', 'High contrast')}>
          <Switch checked={values.high_contrast} onChange={(v) => setValue('high_contrast', v)} disabled={loading} />
        </SettingsRow>
        <SettingsRow label={t('pref_large_text', 'Larger text')}>
          <Switch checked={values.large_text} onChange={(v) => setValue('large_text', v)} disabled={loading} />
        </SettingsRow>
        <SettingsRow label={t('pref_calendar', 'Calendar integration')}>
          <Select
            value={values.calendar_provider}
            onChange={(v) => setValue('calendar_provider', v)}
            disabled={loading}
            style={{ width: 220 }}
            options={[
              { value: 'none', label: t('calendar_none', 'Disabled') },
              { value: 'google', label: 'Google Calendar' },
              { value: 'outlook', label: 'Microsoft Outlook' },
            ]}
          />
        </SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Organization: Branches (CRUD on /api/branches) ─────────────────────
interface BranchRow { id: string; name: string; code?: string; city?: string; country?: string; phone?: string; is_active?: boolean }
const BranchesSettings: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BranchRow | null>(null);
  const [form] = Form.useForm<BranchRow>();
  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/branches'); setRows(r.data || []); }
    catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = (row?: BranchRow) => { setEditing(row || { id: '', name: '', is_active: true }); form.setFieldsValue(row || { is_active: true }); };
  const close = () => { setEditing(null); form.resetFields(); };
  const submit = async () => {
    const v = await form.validateFields();
    try {
      if (editing?.id) await api.put(`/api/branches/${editing.id}`, v);
      else await api.post('/api/branches', v);
      message.success(t('saved', 'Saved'));
      close(); load();
    } catch { message.error(t('save_failed', 'Save failed')); }
  };
  const remove = async (id: string) => {
    try { await api.delete(`/api/branches/${id}`); message.success(t('deleted', 'Deleted')); load(); }
    catch { message.error(t('delete_failed', 'Delete failed')); }
  };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<ApartmentOutlined />}
        title={t('branches_title', 'Branches & locations')}
        description={t('branches_desc', 'Multiple branches, warehouses, and legal entities under one workspace.')}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.branches.what')}
              why={t('settings.help.branches.why')}
              steps={[
                t('settings.help.branches.step_1'),
                t('settings.help.branches.step_2'),
                t('settings.help.branches.step_3'),
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>{t('new_branch', 'New branch')}</Button>
          </Space>
        }
      >
        <ResponsiveTableAdapter<BranchRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Name'), dataIndex: 'name' },
            { title: t('code', 'Code'), dataIndex: 'code' },
            { title: t('city', 'City'), dataIndex: 'city' },
            { title: t('country', 'Country'), dataIndex: 'country' },
            { title: t('status', 'Status'), dataIndex: 'is_active', render: (v: boolean) => v === false ? <Tag color="default">{t('archived', 'Archived')}</Tag> : <Tag color="success">{t('active', 'Active')}</Tag> },
            { title: t('actions', 'Actions'), key: 'a', width: 160, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => open(r)}>{t('edit', 'Edit')}</Button>
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
      <PremiumModal
        open={!!editing}
        onCancel={close}
        onOk={submit}
        title={editing?.id ? t('edit_branch', 'Edit branch') : t('new_branch', 'New branch')}
      >
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item name="name" label={t('name', 'Name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="code" label={t('code', 'Code')}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="phone" label={t('phone', 'Phone')}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="city" label={t('city', 'City')}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="country" label={t('country', 'Country')}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="is_active" label={t('active', 'Active')} valuePropName="checked"><Switch /></Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </Space>
  );
};
// ── Organization: Branding (bag) ───────────────────────────────────────
type BrandingBag = { logo_url: string; logo_dark_url: string; favicon_url: string; primary_color: string; accent_color: string; font_family: string; document_theme: 'classic' | 'modern' | 'minimal'; email_theme: 'classic' | 'modern' | 'minimal'; login_bg_url: string };
const BrandingSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<BrandingBag>('branding', {
    logo_url: '', logo_dark_url: '', favicon_url: '', primary_color: '#1F6FEB', accent_color: '#22C55E',
    font_family: 'Inter', document_theme: 'modern', email_theme: 'modern', login_bg_url: '',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<BgColorsOutlined />} title={t('branding_title', 'Branding & theme')} description={t('branding_desc', 'Logos, brand colors, favicon, fonts, and document theme.')}>
        <SettingsRow label={t('br_logo_primary', 'Primary logo URL')}><Input value={values.logo_url} onChange={(e) => setValue('logo_url', e.target.value)} disabled={loading} placeholder="https://..." /></SettingsRow>
        <SettingsRow label={t('br_logo_dark', 'Logo (dark mode) URL')}><Input value={values.logo_dark_url} onChange={(e) => setValue('logo_dark_url', e.target.value)} disabled={loading} placeholder="https://..." /></SettingsRow>
        <SettingsRow label={t('br_favicon', 'Favicon URL')}><Input value={values.favicon_url} onChange={(e) => setValue('favicon_url', e.target.value)} disabled={loading} placeholder="https://..." /></SettingsRow>
        <SettingsRow label={t('br_color_primary', 'Primary brand color')}><Input type="color" value={values.primary_color} onChange={(e) => setValue('primary_color', e.target.value)} disabled={loading} style={{ width: 80 }} /></SettingsRow>
        <SettingsRow label={t('br_color_accent', 'Accent color')}><Input type="color" value={values.accent_color} onChange={(e) => setValue('accent_color', e.target.value)} disabled={loading} style={{ width: 80 }} /></SettingsRow>
        <SettingsRow label={t('br_font', 'UI font family')}><Select value={values.font_family} onChange={(v) => setValue('font_family', v)} disabled={loading} style={{ width: 220 }} options={[{ value: 'Inter', label: 'Inter' }, { value: 'Cairo', label: 'Cairo (RTL)' }, { value: 'Noto Sans Arabic', label: 'Noto Sans Arabic' }, { value: 'system-ui', label: 'System UI' }]} /></SettingsRow>
        <SettingsRow label={t('br_doc_theme', 'Document theme')}><Segmented value={values.document_theme} onChange={(v) => setValue('document_theme', v as BrandingBag['document_theme'])} options={[{ value: 'classic', label: t('theme_classic', 'Classic') }, { value: 'modern', label: t('theme_modern', 'Modern') }, { value: 'minimal', label: t('theme_minimal', 'Minimal') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('br_email_theme', 'Email theme')}><Segmented value={values.email_theme} onChange={(v) => setValue('email_theme', v as BrandingBag['email_theme'])} options={[{ value: 'classic', label: t('theme_classic', 'Classic') }, { value: 'modern', label: t('theme_modern', 'Modern') }, { value: 'minimal', label: t('theme_minimal', 'Minimal') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('br_login_bg', 'Login screen background URL')}><Input value={values.login_bg_url} onChange={(e) => setValue('login_bg_url', e.target.value)} disabled={loading} placeholder="https://..." /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Organization: Working hours (bag) ──────────────────────────────────
type WorkingHoursBag = { work_days: string[]; start_time: string; end_time: string; break_start: string; break_end: string; timezone: string; honor_holidays: boolean; sla_business_hours_only: boolean };
const WorkingHoursSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<WorkingHoursBag>('working_hours', {
    work_days: ['sun', 'mon', 'tue', 'wed', 'thu'], start_time: '09:00', end_time: '17:00',
    break_start: '12:00', break_end: '13:00', timezone: 'Asia/Baghdad', honor_holidays: true, sla_business_hours_only: true,
  });
  const dayOpts = [{ value: 'sat', label: t('day_sat', 'Sat') }, { value: 'sun', label: t('day_sun', 'Sun') }, { value: 'mon', label: t('day_mon', 'Mon') }, { value: 'tue', label: t('day_tue', 'Tue') }, { value: 'wed', label: t('day_wed', 'Wed') }, { value: 'thu', label: t('day_thu', 'Thu') }, { value: 'fri', label: t('day_fri', 'Fri') }];
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<FieldTimeOutlined />} title={t('wh_title', 'Working hours')} description={t('wh_desc', 'Operating schedule used for SLAs, helpdesk routing, and availability.')}>
        <SettingsRow label={t('wh_workweek', 'Work week')}><Select mode="multiple" value={values.work_days} onChange={(v) => setValue('work_days', v)} disabled={loading} options={dayOpts} style={{ minWidth: 320 }} /></SettingsRow>
        <SettingsRow label={t('wh_hours', 'Working hours')}><Space><TimePicker format="HH:mm" value={parseHHmm(values.start_time)} onChange={(d) => setValue('start_time', d ? d.format('HH:mm') : '09:00')} disabled={loading} /><span style={{ color: palette.ink500 }}>—</span><TimePicker format="HH:mm" value={parseHHmm(values.end_time)} onChange={(d) => setValue('end_time', d ? d.format('HH:mm') : '17:00')} disabled={loading} /></Space></SettingsRow>
        <SettingsRow label={t('wh_breaks', 'Break window')}><Space><TimePicker format="HH:mm" value={parseHHmm(values.break_start)} onChange={(d) => setValue('break_start', d ? d.format('HH:mm') : '12:00')} disabled={loading} /><span style={{ color: palette.ink500 }}>—</span><TimePicker format="HH:mm" value={parseHHmm(values.break_end)} onChange={(d) => setValue('break_end', d ? d.format('HH:mm') : '13:00')} disabled={loading} /></Space></SettingsRow>
        <SettingsRow label={t('wh_timezone', 'Default timezone')}><Select value={values.timezone} onChange={(v) => setValue('timezone', v)} disabled={loading} style={{ width: 280 }} options={[{ value: 'Asia/Baghdad', label: 'Asia/Baghdad' }, { value: 'Asia/Dubai', label: 'Asia/Dubai' }, { value: 'Asia/Riyadh', label: 'Asia/Riyadh' }, { value: 'Europe/Istanbul', label: 'Europe/Istanbul' }, { value: 'UTC', label: 'UTC' }]} /></SettingsRow>
        <SettingsRow label={t('wh_holidays', 'Honor public holidays')}><Switch checked={values.honor_holidays} onChange={(v) => setValue('honor_holidays', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('wh_sla', 'SLA business-hours only')}><Switch checked={values.sla_business_hours_only} onChange={(v) => setValue('sla_business_hours_only', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Organization: Holidays (bag) ───────────────────────────────────────
interface HolidayItem { date: string; name: string; paid: boolean }
type HolidaysBag = { country_preset: string; honor_regional: boolean; carry_next_year: boolean; items: HolidayItem[] };
const HolidaysSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<HolidaysBag>('holidays', {
    country_preset: 'IQ', honor_regional: false, carry_next_year: false, items: [],
  });
  const addItem = () => setValue('items', [...values.items, { date: dayjs().format('YYYY-MM-DD'), name: '', paid: true }]);
  const updateItem = (i: number, patch: Partial<HolidayItem>) => {
    const next = [...values.items]; next[i] = { ...next[i], ...patch }; setValue('items', next);
  };
  const removeItem = (i: number) => { const next = [...values.items]; next.splice(i, 1); setValue('items', next); };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<GiftOutlined />} title={t('hol_title', 'Public holidays')} description={t('hol_desc', 'Holiday calendars by country and region — drives leave and SLA timers.')}>
        <SettingsRow label={t('hol_country', 'Country preset')}><Select value={values.country_preset} onChange={(v) => setValue('country_preset', v)} disabled={loading} style={{ width: 240 }} options={[{ value: 'IQ', label: 'Iraq' }, { value: 'KRG', label: 'Kurdistan Region' }, { value: 'AE', label: 'UAE' }, { value: 'SA', label: 'Saudi Arabia' }, { value: 'TR', label: 'Türkiye' }, { value: 'NONE', label: t('none', 'None') }]} /></SettingsRow>
        <SettingsRow label={t('hol_regional', 'Honor regional holidays')}><Switch checked={values.honor_regional} onChange={(v) => setValue('honor_regional', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('hol_carry', 'Carry to next year')}><Switch checked={values.carry_next_year} onChange={(v) => setValue('carry_next_year', v)} disabled={loading} /></SettingsRow>
        <Divider titlePlacement="start">{t('hol_custom', 'Custom holidays')}</Divider>
        <ResponsiveTableAdapter<HolidayItem>
          rowKey={(_, i) => String(i)}
          dataSource={values.items}
          pagination={false}
          size="small"
          columns={[
            { title: t('date', 'Date'), dataIndex: 'date', width: 180, render: (_, r, i) => <DatePicker value={r.date ? dayjs(r.date) : null} onChange={(d) => updateItem(i, { date: d ? d.format('YYYY-MM-DD') : '' })} /> },
            { title: t('name', 'Name'), dataIndex: 'name', render: (_, r, i) => <Input value={r.name} onChange={(e) => updateItem(i, { name: e.target.value })} /> },
            { title: t('hol_paid', 'Paid'), dataIndex: 'paid', width: 80, render: (_, r, i) => <Switch checked={r.paid} onChange={(v) => updateItem(i, { paid: v })} /> },
            { title: '', key: 'a', width: 60, render: (_, _r, i) => <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(i)} /> },
          ]}
          footer={() => <Button icon={<PlusOutlined />} onClick={addItem}>{t('add_holiday', 'Add holiday')}</Button>}
        />
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Users & access: Users (CRUD on /api/users) ──────────────────────────
interface UserRow { id: string; email: string; display_name?: string; role?: string; status?: string; suspended?: boolean }
const UsersSettings: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [form] = Form.useForm<{ email: string; display_name: string; role: string }>();
  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/users'); setRows(r.data?.items || r.data || []); }
    catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const invite = async () => {
    const v = await form.validateFields();
    try { await api.post('/api/users/invite', v); message.success(t('invite_sent', 'Invitation sent')); setInviting(false); form.resetFields(); load(); }
    catch { message.error(t('invite_failed', 'Invite failed')); }
  };
  const suspend = async (id: string) => { try { await api.post(`/api/users/${id}/suspend`); message.success(t('user_suspended', 'User suspended')); load(); } catch { message.error(t('action_failed', 'Action failed')); } };
  const activate = async (id: string) => { try { await api.post(`/api/users/${id}/activate`); message.success(t('user_activated', 'User activated')); load(); } catch { message.error(t('action_failed', 'Action failed')); } };
  const remove = async (id: string) => { try { await api.delete(`/api/users/${id}`); message.success(t('deleted', 'Deleted')); load(); } catch { message.error(t('delete_failed', 'Delete failed')); } };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<TeamOutlined />}
        title={t('users_title', 'Users & licenses')}
        description={t('users_desc', 'Invite teammates, assign roles, manage licenses and deactivation.')}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.users.what')}
              why={t('settings.help.users.why')}
              steps={[
                t('settings.help.users.step_1'),
                t('settings.help.users.step_2'),
                t('settings.help.users.step_3'),
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviting(true)}>{t('invite_user', 'Invite user')}</Button>
          </Space>
        }
      >
        <ResponsiveTableAdapter<UserRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 12, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Name'), dataIndex: 'display_name', render: (v: string, r) => v || r.email },
            { title: t('email', 'Email'), dataIndex: 'email' },
            { title: t('role', 'Role'), dataIndex: 'role', render: (v: string) => v ? <Tag>{v}</Tag> : '—' },
            { title: t('status', 'Status'), key: 's', render: (_, r) => r.suspended ? <Tag color="warning">{t('suspended', 'Suspended')}</Tag> : <Tag color="success">{t('active', 'Active')}</Tag> },
            { title: t('actions', 'Actions'), key: 'a', width: 220, render: (_, r) => (
              <Space>
                {r.suspended
                  ? <Button size="small" onClick={() => activate(r.id)}>{t('activate', 'Activate')}</Button>
                  : <Button size="small" onClick={() => suspend(r.id)}>{t('suspend', 'Suspend')}</Button>}
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
      <PremiumModal open={inviting} onCancel={() => setInviting(false)} onOk={invite} title={t('invite_user', 'Invite user')}>
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item name="email" label={t('email', 'Email')} rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="display_name" label={t('name', 'Name')}><Input /></Form.Item>
          <Form.Item name="role" label={t('role', 'Role')} initialValue="user"><Select options={[{ value: 'admin', label: t('role_admin', 'Administrator') }, { value: 'manager', label: t('role_manager', 'Manager') }, { value: 'user', label: t('role_user', 'User') }, { value: 'accountant', label: t('role_accountant', 'Accountant') }]} /></Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </Space>
  );
};
// ── Users & access: Roles (CRUD on /api/rbac/roles) ──────────────────────
interface RoleRow { id: string; name: string; description?: string; permissions?: string[]; is_system?: boolean }
const RolesSettings: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form] = Form.useForm<RoleRow>();
  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/rbac/roles'); setRows(r.data || []); }
    catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = (row?: RoleRow) => { setEditing(row || { id: '', name: '', permissions: [] }); form.setFieldsValue(row || { permissions: [] }); };
  const submit = async () => {
    const v = await form.validateFields();
    try {
      if (editing?.id) await api.put(`/api/rbac/roles/${editing.id}`, v);
      else await api.post('/api/rbac/roles', v);
      message.success(t('saved', 'Saved')); setEditing(null); form.resetFields(); load();
    } catch { message.error(t('save_failed', 'Save failed')); }
  };
  const remove = async (id: string) => { try { await api.delete(`/api/rbac/roles/${id}`); message.success(t('deleted', 'Deleted')); load(); } catch { message.error(t('delete_failed', 'Delete failed')); } };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<IdcardOutlined />}
        title={t('roles_title', 'Roles')}
        description={t('roles_desc', 'Pre-built and custom roles for fast permission assignment.')}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.roles.what')}
              why={t('settings.help.roles.why')}
              steps={[
                t('settings.help.roles.step_1'),
                t('settings.help.roles.step_2'),
                t('settings.help.roles.step_3'),
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>{t('new_role', 'New role')}</Button>
          </Space>
        }
      >
        <ResponsiveTableAdapter<RoleRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Name'), dataIndex: 'name', render: (v: string, r) => <Space>{v}{r.is_system ? <Tag color="blue">{t('system', 'System')}</Tag> : null}</Space> },
            { title: t('description', 'Description'), dataIndex: 'description', ellipsis: true },
            { title: t('permissions', 'Permissions'), dataIndex: 'permissions', render: (v: string[]) => <Tag>{(v || []).length}</Tag> },
            { title: t('actions', 'Actions'), key: 'a', width: 160, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => open(r)} disabled={r.is_system}>{t('edit', 'Edit')}</Button>
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)} disabled={r.is_system}>
                  <Button size="small" danger icon={<DeleteOutlined />} disabled={r.is_system} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
      <PremiumModal open={!!editing} onCancel={() => setEditing(null)} onOk={submit} title={editing?.id ? t('edit_role', 'Edit role') : t('new_role', 'New role')}>
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item name="name" label={t('name', 'Name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="description" label={t('description', 'Description')}><Input.TextArea rows={2} /></Form.Item>
          <Alert type="info" showIcon message={t('role_perm_hint', 'Use the Permissions section to fine-tune capabilities for this role.')} />
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </Space>
  );
};
// ── Users & access: Permissions matrix ─────────────────────────────────
const PermissionsSettings: React.FC = () => {
  const { t } = useTranslation();
  const [perms, setPerms] = useState<string[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>({});
  const [original, setOriginal] = useState<Record<string, string>>({});
  const load = async () => {
    setLoading(true);
    try {
      const [p, r] = await Promise.all([api.get('/api/rbac/permissions'), api.get('/api/rbac/roles')]);
      // Backend returns { permissions: string[], count: N } — extract the array
      const rawPerms: unknown[] = Array.isArray(p.data)
        ? p.data
        : (p.data?.permissions ?? []);
      const permList: string[] = rawPerms
        .map((x: unknown) => {
          if (typeof x === 'string') return x;
          if (x && typeof x === 'object') {
            const o = x as { code?: string; name?: string };
            return o.code || o.name || '';
          }
          return '';
        })
        .filter(Boolean);
      setPerms(permList);
      const roleList: RoleRow[] = r.data || [];
      setRoles(roleList);
      const m: Record<string, Set<string>> = {};
      const orig: Record<string, string> = {};
      roleList.forEach((role) => {
        m[role.id] = new Set(role.permissions || []);
        orig[role.id] = JSON.stringify((role.permissions || []).slice().sort());
      });
      setMatrix(m); setOriginal(orig);
    } catch { setPerms([]); setRoles([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = (roleId: string, perm: string) => {
    setMatrix((prev) => {
      const next = { ...prev }; const set = new Set(next[roleId] || []);
      if (set.has(perm)) set.delete(perm); else set.add(perm);
      next[roleId] = set; return next;
    });
  };
  const dirty = useMemo(() => roles.some((r) => JSON.stringify(Array.from(matrix[r.id] || []).sort()) !== original[r.id]), [matrix, roles, original]);
  const save = async () => {
    setSaving(true);
    try {
      for (const role of roles) {
        if (role.is_system) continue;
        const next = Array.from(matrix[role.id] || []).sort();
        if (JSON.stringify(next) !== original[role.id]) {
          await api.put(`/api/rbac/roles/${role.id}`, { permissions: next });
        }
      }
      message.success(t('saved', 'Saved')); load();
    } catch { message.error(t('save_failed', 'Save failed')); } finally { setSaving(false); }
  };
  const grouped = useMemo(() => {
    const g: Record<string, string[]> = {};
    perms.forEach((p) => { const k = p.split('.')[0] || 'other'; (g[k] = g[k] || []).push(p); });
    return g;
  }, [perms]);
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<SafetyCertificateOutlined />} title={t('perm_title', 'Permissions matrix')} description={t('perm_desc', 'Module / action / record-level access control matrix.')}>
        {loading ? <div style={{ padding: 24, color: palette.ink500 }}>{t('loading', 'Loading...')}</div> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: fontSize.sm }}>
              <thead><tr style={{ background: palette.bg }}>
                <th style={{ position: 'sticky', insetInlineStart: 0, background: palette.bg, padding: 8, textAlign: 'start', minWidth: 220 }}>{t('permission', 'Permission')}</th>
                {roles.map((r) => <th key={r.id} style={{ padding: 8, textAlign: 'center', minWidth: 100 }}>{r.name}{r.is_system ? <Tag style={{ marginInlineStart: 4 }}>S</Tag> : null}</th>)}
              </tr></thead>
              <tbody>
                {Object.entries(grouped).map(([group, ps]) => (
                  <React.Fragment key={group}>
                    <tr><td colSpan={roles.length + 1} style={{ background: palette.bg, padding: '6px 8px', fontWeight: 600, color: palette.ink700 }}>{group}</td></tr>
                    {ps.map((p) => (
                      <tr key={p} style={{ borderTop: `1px solid ${palette.border}` }}>
                        <td style={{ position: 'sticky', insetInlineStart: 0, background: palette.surface, padding: 8 }}>{p}</td>
                        {roles.map((r) => (
                          <td key={r.id} style={{ textAlign: 'center', padding: 4 }}>
                            <Switch size="small" checked={(matrix[r.id] || new Set()).has(p)} onChange={() => toggle(r.id, p)} disabled={r.is_system} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Users & access: SSO (bag) ────────────────────────────────────────────
type SsoBag = { provider: 'none' | 'saml' | 'oidc' | 'google' | 'microsoft'; metadata_url: string; client_id: string; client_secret: string; jit_provisioning: boolean; enforce_domain: string; attribute_email: string; attribute_name: string };
const SsoSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<SsoBag>('sso', {
    provider: 'none', metadata_url: '', client_id: '', client_secret: '', jit_provisioning: true, enforce_domain: '', attribute_email: 'email', attribute_name: 'name',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<KeyOutlined />} title={t('sso_title', 'Single sign-on (SSO)')} description={t('sso_desc', 'Federated authentication with SAML 2.0, OIDC, Google, and Microsoft.')}>
        <SettingsRow label={t('sso_provider', 'Identity provider')}><Select value={values.provider} onChange={(v) => setValue('provider', v)} disabled={loading} style={{ width: 280 }} options={[{ value: 'none', label: t('disabled', 'Disabled') }, { value: 'saml', label: 'SAML 2.0' }, { value: 'oidc', label: 'OIDC / OAuth 2.0' }, { value: 'google', label: 'Google Workspace' }, { value: 'microsoft', label: 'Microsoft Entra ID' }]} /></SettingsRow>
        {values.provider !== 'none' && <>
          <SettingsRow label={t('sso_metadata', 'Metadata / discovery URL')}><Input value={values.metadata_url} onChange={(e) => setValue('metadata_url', e.target.value)} disabled={loading} placeholder="https://..." /></SettingsRow>
          <SettingsRow label={t('sso_client_id', 'Client ID')}><Input value={values.client_id} onChange={(e) => setValue('client_id', e.target.value)} disabled={loading} /></SettingsRow>
          <SettingsRow label={t('sso_client_secret', 'Client secret')}><Input.Password value={values.client_secret} onChange={(e) => setValue('client_secret', e.target.value)} disabled={loading} /></SettingsRow>
          <SettingsRow label={t('sso_attr_email', 'Attribute mapping: email')}><Input value={values.attribute_email} onChange={(e) => setValue('attribute_email', e.target.value)} disabled={loading} style={{ width: 240 }} /></SettingsRow>
          <SettingsRow label={t('sso_attr_name', 'Attribute mapping: name')}><Input value={values.attribute_name} onChange={(e) => setValue('attribute_name', e.target.value)} disabled={loading} style={{ width: 240 }} /></SettingsRow>
          <SettingsRow label={t('sso_jit', 'Just-in-time provisioning')}><Switch checked={values.jit_provisioning} onChange={(v) => setValue('jit_provisioning', v)} disabled={loading} /></SettingsRow>
          <SettingsRow label={t('sso_enforce', 'Enforce SSO for email domain')}><Input value={values.enforce_domain} onChange={(e) => setValue('enforce_domain', e.target.value)} disabled={loading} placeholder="example.com" style={{ width: 280 }} /></SettingsRow>
        </>}
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Users & access: Portals (bag) ───────────────────────────────────────
type PortalsBag = { customer_portal_enabled: boolean; vendor_portal_enabled: boolean; subdomain: string; allow_invoice_download: boolean; allow_quote_acceptance: boolean; allow_document_share: boolean; require_terms_acceptance: boolean; terms_url: string };
const PortalsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<PortalsBag>('portals', {
    customer_portal_enabled: true, vendor_portal_enabled: false, subdomain: '', allow_invoice_download: true,
    allow_quote_acceptance: true, allow_document_share: false, require_terms_acceptance: false, terms_url: '',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<UsergroupAddOutlined />} title={t('portals_title', 'Customer & vendor portals')} description={t('portals_desc', 'Self-service portals for customers and vendors with branded login.')}>
        <SettingsRow label={t('po_cust', 'Customer portal')}><Switch checked={values.customer_portal_enabled} onChange={(v) => setValue('customer_portal_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_vendor', 'Vendor portal')}><Switch checked={values.vendor_portal_enabled} onChange={(v) => setValue('vendor_portal_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_subdomain', 'Custom subdomain')} description={t('po_subdomain_desc', 'e.g. portal.your-company.com')}><Input value={values.subdomain} onChange={(e) => setValue('subdomain', e.target.value)} disabled={loading} placeholder="portal.example.com" style={{ width: 320 }} /></SettingsRow>
        <Divider titlePlacement="start">{t('portal_capabilities', 'Capabilities')}</Divider>
        <SettingsRow label={t('po_inv', 'Invoice download & pay')}><Switch checked={values.allow_invoice_download} onChange={(v) => setValue('allow_invoice_download', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_quote', 'Quote acceptance')}><Switch checked={values.allow_quote_acceptance} onChange={(v) => setValue('allow_quote_acceptance', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_doc', 'Document sharing')}><Switch checked={values.allow_document_share} onChange={(v) => setValue('allow_document_share', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_terms', 'Require terms acceptance')}><Switch checked={values.require_terms_acceptance} onChange={(v) => setValue('require_terms_acceptance', v)} disabled={loading} /></SettingsRow>
        {values.require_terms_acceptance && <SettingsRow label={t('po_terms_url', 'Terms URL')}><Input value={values.terms_url} onChange={(e) => setValue('terms_url', e.target.value)} disabled={loading} placeholder="https://..." /></SettingsRow>}
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Localization ─────────────────────────────────────────────────────────
// ── Localization (bag) ───────────────────────────────────────────
type LocalizationBag = { country_pack: string; coa_template: string; address_format: string; phone_format: string; postal_code_format: string; iban_validation: boolean };
const LocalizationSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<LocalizationBag>('localization', {
    country_pack: 'IQ', coa_template: 'iraq_standard', address_format: '{name}\n{line1}\n{line2}\n{city}, {country}',
    phone_format: '+964 ## ### ####', postal_code_format: '#####', iban_validation: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<GlobalOutlined />} title={t('l10n_title', 'Localization package')} description={t('l10n_desc', 'Country pack with chart of accounts, taxes, and document templates.')}
        actions={
          <SectionHelpPopover
            what={t('settings.help.localization.what')}
            why={t('settings.help.localization.why')}
            steps={[
              t('settings.help.localization.step_1'),
              t('settings.help.localization.step_2'),
              t('settings.help.localization.step_3'),
            ]}
          />
        }
      >
        <SettingsRow label={t('l_country', 'Country pack')}><Select value={values.country_pack} onChange={(v) => setValue('country_pack', v)} disabled={loading} style={{ width: 280 }} options={[{ value: 'IQ', label: 'Iraq' }, { value: 'KRG', label: 'Kurdistan Region' }, { value: 'AE', label: 'UAE' }, { value: 'SA', label: 'Saudi Arabia' }, { value: 'TR', label: 'Türkiye' }, { value: 'GENERIC', label: 'Generic' }]} /></SettingsRow>
        <SettingsRow label={t('l_coa', 'Chart of accounts template')}><Select value={values.coa_template} onChange={(v) => setValue('coa_template', v)} disabled={loading} style={{ width: 280 }} options={[{ value: 'iraq_standard', label: t('coa_iraq', 'Iraq standard') }, { value: 'gcc_standard', label: t('coa_gcc', 'GCC standard') }, { value: 'ifrs', label: 'IFRS' }, { value: 'custom', label: t('coa_custom', 'Custom') }]} /></SettingsRow>
        <SettingsRow label={t('l_address', 'Address format')}><Input.TextArea value={values.address_format} onChange={(e) => setValue('address_format', e.target.value)} disabled={loading} rows={3} /></SettingsRow>
        <SettingsRow label={t('l_phone', 'Phone format')}><Input value={values.phone_format} onChange={(e) => setValue('phone_format', e.target.value)} disabled={loading} style={{ width: 280 }} /></SettingsRow>
        <SettingsRow label={t('l_postal', 'Postal code format')}><Input value={values.postal_code_format} onChange={(e) => setValue('postal_code_format', e.target.value)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('l_iban', 'IBAN / SWIFT validation')}><Switch checked={values.iban_validation} onChange={(v) => setValue('iban_validation', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Languages (bag) ───────────────────────────────────────────────────────
type LanguagesBag = { active: string[]; default_lang: string; document_lang: string; rtl: boolean };
const LanguagesSettings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<LanguagesBag>('languages', {
    active: ['ku', 'en', 'ar'], default_lang: 'ku', document_lang: 'en', rtl: true,
  });
  const langOpts = [{ value: 'ku', label: 'کوردی' }, { value: 'ar', label: 'العربية' }, { value: 'en', label: 'English' }, { value: 'tr', label: 'Türkçe' }, { value: 'fa', label: 'فارسی' }];
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<TranslationOutlined />} title={t('lang_title', 'Languages')} description={t('lang_desc', 'Available UI languages and translation overrides.')}>
        <SettingsRow label={t('lg_active', 'Active languages')}><Select mode="multiple" value={values.active} onChange={(v) => setValue('active', v)} disabled={loading} options={langOpts} style={{ minWidth: 320 }} /></SettingsRow>
        <SettingsRow label={t('lg_default', 'Default workspace language')}><Select value={values.default_lang} onChange={(v) => { setValue('default_lang', v); i18n.changeLanguage(v); }} disabled={loading} options={langOpts.filter((l) => values.active.includes(l.value))} style={{ width: 240 }} /></SettingsRow>
        <SettingsRow label={t('lg_doc', 'Document language')}><Select value={values.document_lang} onChange={(v) => setValue('document_lang', v)} disabled={loading} options={langOpts.filter((l) => values.active.includes(l.value))} style={{ width: 240 }} /></SettingsRow>
        <SettingsRow label={t('lg_rtl', 'RTL support')}><Switch checked={values.rtl} onChange={(v) => setValue('rtl', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Formats (bag) ─────────────────────────────────────────────────────────
type FormatsBag = { date_format: string; time_format: '12h' | '24h'; thousand_sep: ',' | '.' | ' ' | '٬'; decimal_sep: '.' | ','; first_day_of_week: 'sat' | 'sun' | 'mon'; units: 'metric' | 'imperial'; paper_size: 'A4' | 'Letter' };
const FormatsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<FormatsBag>('formats', {
    date_format: 'YYYY-MM-DD', time_format: '24h', thousand_sep: ',', decimal_sep: '.', first_day_of_week: 'sun', units: 'metric', paper_size: 'A4',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ClockCircleOutlined />} title={t('fmt_title', 'Date, time & number formats')} description={t('fmt_desc', 'Regional formatting for dates, times, numbers, and units.')}>
        <SettingsRow label={t('f_date', 'Date format')}><Select value={values.date_format} onChange={(v) => setValue('date_format', v)} disabled={loading} style={{ width: 240 }} options={[{ value: 'YYYY-MM-DD', label: '2026-05-04' }, { value: 'DD/MM/YYYY', label: '04/05/2026' }, { value: 'MM/DD/YYYY', label: '05/04/2026' }, { value: 'DD MMM YYYY', label: '04 May 2026' }]} /></SettingsRow>
        <SettingsRow label={t('f_time', 'Time format')}><Segmented value={values.time_format} onChange={(v) => setValue('time_format', v as FormatsBag['time_format'])} options={[{ value: '12h', label: '12h (1:30 PM)' }, { value: '24h', label: '24h (13:30)' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('f_thousand', 'Thousand separator')}><Segmented value={values.thousand_sep} onChange={(v) => setValue('thousand_sep', v as FormatsBag['thousand_sep'])} options={[{ value: ',', label: ',' }, { value: '.', label: '.' }, { value: ' ', label: 'space' }, { value: '٬', label: '٬ (Arabic)' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('f_decimal', 'Decimal separator')}><Segmented value={values.decimal_sep} onChange={(v) => setValue('decimal_sep', v as FormatsBag['decimal_sep'])} options={[{ value: '.', label: '.' }, { value: ',', label: ',' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('f_first_day', 'First day of week')}><Segmented value={values.first_day_of_week} onChange={(v) => setValue('first_day_of_week', v as FormatsBag['first_day_of_week'])} options={[{ value: 'sat', label: t('day_sat', 'Sat') }, { value: 'sun', label: t('day_sun', 'Sun') }, { value: 'mon', label: t('day_mon', 'Mon') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('f_units', 'Measurement units')}><Segmented value={values.units} onChange={(v) => setValue('units', v as FormatsBag['units'])} options={[{ value: 'metric', label: t('units_metric', 'Metric') }, { value: 'imperial', label: t('units_imperial', 'Imperial') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('f_paper', 'Paper size')}><Segmented value={values.paper_size} onChange={(v) => setValue('paper_size', v as FormatsBag['paper_size'])} options={[{ value: 'A4', label: 'A4' }, { value: 'Letter', label: 'Letter' }]} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Finance ──────────────────────────────────────────────────────────────
// ── Finance: Taxes (CRUD on /api/taxes/rates) ────────────────────────────
interface TaxRow { id: string; name: string; rate: number; tax_type?: string; is_inclusive?: boolean; account_id?: string }
const TaxesSettings: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<TaxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<TaxRow | null>(null);
  const [form] = Form.useForm<TaxRow>();
  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/api/taxes/rates'); setRows(r.data || []); }
    catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = (row?: TaxRow) => { setEditing(row || { id: '', name: '', rate: 0 }); form.setFieldsValue(row || { rate: 0, tax_type: 'vat', is_inclusive: false }); };
  const submit = async () => {
    const v = await form.validateFields();
    try {
      if (editing?.id) await api.put(`/api/taxes/rates/${editing.id}`, v);
      else await api.post('/api/taxes/rates', v);
      message.success(t('saved', 'Saved')); setEditing(null); form.resetFields(); load();
    } catch { message.error(t('save_failed', 'Save failed')); }
  };
  const remove = async (id: string) => { try { await api.delete(`/api/taxes/rates/${id}`); message.success(t('deleted', 'Deleted')); load(); } catch { message.error(t('delete_failed', 'Delete failed')); } };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<PercentageOutlined />}
        title={t('tax_title', 'Taxes')}
        description={t('tax_desc', 'VAT, withholding, sales tax, exemptions, and tax groups.')}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.taxes.what')}
              why={t('settings.help.taxes.why')}
              steps={[
                t('settings.help.taxes.step_1'),
                t('settings.help.taxes.step_2'),
                t('settings.help.taxes.step_3'),
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>{t('new_tax', 'New tax')}</Button>
          </Space>
        }
      >
        <ResponsiveTableAdapter<TaxRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Name'), dataIndex: 'name' },
            { title: t('tax_rate', 'Rate'), dataIndex: 'rate', width: 120, render: (v: number) => `${v}%` },
            { title: t('tax_type', 'Type'), dataIndex: 'tax_type', width: 140, render: (v: string) => <Tag>{v || 'vat'}</Tag> },
            { title: t('tax_inclusive', 'Inclusive'), dataIndex: 'is_inclusive', width: 100, render: (v: boolean) => v ? <Tag color="blue">{t('yes', 'Yes')}</Tag> : '—' },
            { title: t('actions', 'Actions'), key: 'a', width: 160, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => open(r)}>{t('edit', 'Edit')}</Button>
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
      <PremiumModal open={!!editing} onCancel={() => setEditing(null)} onOk={submit} title={editing?.id ? t('edit_tax', 'Edit tax') : t('new_tax', 'New tax')}>
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item name="name" label={t('name', 'Name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="rate" label={t('tax_rate', 'Rate (%)')} rules={[{ required: true }]}><InputNumber min={0} max={100} step={0.01} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item name="tax_type" label={t('tax_type', 'Type')}><Select options={[{ value: 'vat', label: 'VAT' }, { value: 'sales', label: t('tax_sales', 'Sales tax') }, { value: 'withholding', label: t('tax_wht', 'Withholding') }, { value: 'service', label: t('tax_service', 'Service') }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="is_inclusive" label={t('tax_inclusive', 'Tax inclusive')} valuePropName="checked"><Switch /></Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </Space>
  );
};
// ── Finance: Banking (CRUD on /api/banking/accounts) ──────────────────────
interface BankRow { id: string; name: string; account_number?: string; iban?: string; swift?: string; currency?: string; bank_name?: string; opening_balance?: number; is_active?: boolean }
const BankingSettings: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BankRow[]>([]);
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BankRow | null>(null);
  const [form] = Form.useForm<BankRow>();
  const load = async () => {
    setLoading(true);
    try {
      const [bankRes, currRes] = await Promise.all([
        api.get('/api/banking/accounts'),
        api.get('/api/system/currencies'),
      ]);
      setRows(bankRes.data || []);
      setCurrencies(Array.isArray(currRes.data) ? currRes.data : (currRes.data.items || currRes.data || []));
    }
    catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const open = (row?: BankRow) => { setEditing(row || { id: '', name: '' }); form.setFieldsValue(row || { currency: 'IQD', is_active: true, opening_balance: 0 }); };
  const submit = async () => {
    const v = await form.validateFields();
    try {
      if (editing?.id) await api.put(`/api/banking/accounts/${editing.id}`, v);
      else await api.post('/api/banking/accounts', v);
      message.success(t('saved', 'Saved')); setEditing(null); form.resetFields(); load();
    } catch { message.error(t('save_failed', 'Save failed')); }
  };
  const remove = async (id: string) => { try { await api.delete(`/api/banking/accounts/${id}`); message.success(t('deleted', 'Deleted')); load(); } catch { message.error(t('delete_failed', 'Delete failed')); } };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<BankOutlined />}
        title={t('bank_title', 'Banking')}
        description={t('bank_desc', 'Bank accounts, statement feeds, and reconciliation rules.')}
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.banking.what')}
              why={t('settings.help.banking.why')}
              steps={[
                t('settings.help.banking.step_1'),
                t('settings.help.banking.step_2'),
                t('settings.help.banking.step_3'),
              ]}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => open()}>{t('new_bank_account', 'New bank account')}</Button>
          </Space>
        }
      >
        <ResponsiveTableAdapter<BankRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 10, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Account name'), dataIndex: 'name' },
            { title: t('bank_name', 'Bank'), dataIndex: 'bank_name' },
            { title: t('iban', 'IBAN'), dataIndex: 'iban', ellipsis: true },
            { title: t('currency', 'Currency'), dataIndex: 'currency', width: 100, render: (v: string) => <Tag>{v || 'IQD'}</Tag> },
            { title: t('actions', 'Actions'), key: 'a', width: 160, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => open(r)}>{t('edit', 'Edit')}</Button>
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
      <PremiumModal open={!!editing} onCancel={() => setEditing(null)} onOk={submit} title={editing?.id ? t('edit_bank_account', 'Edit account') : t('new_bank_account', 'New bank account')}>
        <Form form={form} layout="vertical">
          <ResponsiveForm layout="single">
          <Form.Item name="name" label={t('name', 'Account name')} rules={[{ required: true }]}><Input /></Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="bank_name" label={t('bank_name', 'Bank')}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="currency" label={t('currency', 'Currency')}><Select
              options={buildEffectiveOptions(
                currencies.map(c => ({ label: c.code, value: c.code })),
                t('currencies', 'Currencies'),
                '/settings?s=currencies',
                navigate,
              )}
              onChange={(value) => {
                if (handleAddOptionChange(value, '/settings?s=currencies', navigate)) return;
              }}
            /></Form.Item></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><Form.Item name="account_number" label={t('account_number', 'Account number')}><Input /></Form.Item></Col>
            <Col span={12}><Form.Item name="swift" label={t('swift', 'SWIFT/BIC')}><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="iban" label={t('iban', 'IBAN')}><Input /></Form.Item>
          <Form.Item name="opening_balance" label={t('opening_balance', 'Opening balance')}><InputNumber min={0} step={0.01} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="is_active" label={t('active', 'Active')} valuePropName="checked"><Switch /></Form.Item>
          </ResponsiveForm>
</Form>
      </PremiumModal>
    </Space>
  );
};
// ── Finance: Payment methods (bag) ──────────────────────────────────────
type PaymentMethodsBag = { cash: boolean; bank_transfer: boolean; cheque: boolean; card_visa_mc: boolean; fib: boolean; zaincash: boolean; asiahawala: boolean; stripe: boolean; paypal: boolean; qr: boolean; installments: boolean; default_method: string };
const PaymentMethodsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<PaymentMethodsBag>('payment_methods', {
    cash: true, bank_transfer: true, cheque: true, card_visa_mc: false, fib: false, zaincash: false, asiahawala: false, stripe: false, paypal: false, qr: false, installments: false, default_method: 'cash',
  });
  const Row2 = ({ k, label }: { k: keyof PaymentMethodsBag; label: string }) => (
    <SettingsRow label={label}><Switch checked={Boolean(values[k])} onChange={(v) => setValue(k, v as PaymentMethodsBag[typeof k])} disabled={loading} /></SettingsRow>
  );
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<CreditCardOutlined />} title={t('pm_title', 'Payment methods')} description={t('pm_desc', 'Online and offline payment methods accepted by your business.')}
        actions={
          <SectionHelpPopover
            what={t('settings.help.payment_methods.what')}
            why={t('settings.help.payment_methods.why')}
            steps={[
              t('settings.help.payment_methods.step_1'),
              t('settings.help.payment_methods.step_2'),
              t('settings.help.payment_methods.step_3'),
            ]}
          />
        }
      >
        <Divider titlePlacement="start">{t('pm_offline', 'Offline')}</Divider>
        <Row2 k="cash" label={t('pm_cash', 'Cash')} />
        <Row2 k="bank_transfer" label={t('pm_bank', 'Bank transfer')} />
        <Row2 k="cheque" label={t('pm_cheque', 'Cheque')} />
        <Divider titlePlacement="start">{t('pm_online', 'Online')}</Divider>
        <Row2 k="card_visa_mc" label={t('pm_card', 'Cards (Visa / MasterCard)')} />
        <Row2 k="fib" label="FIB" />
        <Row2 k="zaincash" label="Zain Cash" />
        <Row2 k="asiahawala" label="AsiaHawala" />
        <Row2 k="stripe" label="Stripe" />
        <Row2 k="paypal" label="PayPal" />
        <Row2 k="qr" label={t('pm_qr', 'QR code payments')} />
        <Row2 k="installments" label={t('pm_install', 'Installment plans')} />
        <Divider titlePlacement="start">{t('default', 'Default')}</Divider>
        <SettingsRow label={t('pm_default', 'Default payment method')}><Select value={values.default_method} onChange={(v) => setValue('default_method', v)} disabled={loading} style={{ width: 240 }} options={[{ value: 'cash', label: t('pm_cash', 'Cash') }, { value: 'bank_transfer', label: t('pm_bank', 'Bank transfer') }, { value: 'cheque', label: t('pm_cheque', 'Cheque') }, { value: 'card_visa_mc', label: t('pm_card', 'Cards') }, { value: 'fib', label: 'FIB' }, { value: 'zaincash', label: 'Zain Cash' }]} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Commerce ─────────────────────────────────────────────────────────────
type SalesBag = { quote_expiry_days: number; auto_followup_quote: boolean; default_payment_terms_days: number; default_discount_pct: number; require_discount_approval: boolean; commission_pct: number; pipeline_stages: string };
const SalesSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<SalesBag>('sales', {
    quote_expiry_days: 30, auto_followup_quote: true, default_payment_terms_days: 30,
    default_discount_pct: 0, require_discount_approval: true, commission_pct: 0,
    pipeline_stages: 'New, Qualified, Proposal, Negotiation, Won, Lost',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ShoppingCartOutlined />} title={t('sales_title', 'Sales')} description={t('sales_desc', 'Quote → order → invoice flow, pricing, discounts, and stages.')}>
        <SettingsRow label={t('sl_quote_expiry', 'Quote expiry (days)')}><InputNumber min={1} max={365} value={values.quote_expiry_days} onChange={(v) => setValue('quote_expiry_days', Number(v) || 30)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('sl_auto_followup', 'Auto follow-up before expiry')}><Switch checked={values.auto_followup_quote} onChange={(v) => setValue('auto_followup_quote', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('sl_terms_days', 'Default payment terms (days)')}><InputNumber min={0} max={180} value={values.default_payment_terms_days} onChange={(v) => setValue('default_payment_terms_days', Number(v) || 30)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('sl_default_discount', 'Default discount (%)')}><InputNumber min={0} max={100} step={0.1} value={values.default_discount_pct} onChange={(v) => setValue('default_discount_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('sl_discount_approval', 'Require approval for discounts')}><Switch checked={values.require_discount_approval} onChange={(v) => setValue('require_discount_approval', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('sl_commission', 'Default sales commission (%)')}><InputNumber min={0} max={100} step={0.1} value={values.commission_pct} onChange={(v) => setValue('commission_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('sl_pipeline', 'Pipeline stages (comma-separated)')}><Input value={values.pipeline_stages} onChange={(e) => setValue('pipeline_stages', e.target.value)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: CRM (bag) ──────────────────────────────────────────────
type CrmBag = { pipelines: string; lead_sources: string; lost_reasons: string; scoring_high: number; scoring_medium: number; round_robin: boolean; duplicate_detection: boolean; default_owner_id: string };
const CrmSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<CrmBag>('crm', {
    pipelines: 'Sales, Partnerships, Renewals',
    lead_sources: 'Website, Referral, Cold call, Event, Social media, Advertisement',
    lost_reasons: 'Price, Competitor, Timing, No budget, No decision-maker',
    scoring_high: 80, scoring_medium: 50, round_robin: true, duplicate_detection: true, default_owner_id: '',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ContactsOutlined />} title={t('crm_title', 'CRM')} description={t('crm_desc', 'Lead pipelines, scoring, sources, lost reasons, and activities.')}>
        <SettingsRow label={t('cr_pipe', 'Pipelines (comma-separated)')}><Input value={values.pipelines} onChange={(e) => setValue('pipelines', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('cr_source', 'Lead sources (comma-separated)')}><Input value={values.lead_sources} onChange={(e) => setValue('lead_sources', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('cr_lost', 'Lost reasons (comma-separated)')}><Input value={values.lost_reasons} onChange={(e) => setValue('lost_reasons', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('cr_score_high', 'Hot lead score ≥')}><InputNumber min={0} max={100} value={values.scoring_high} onChange={(v) => setValue('scoring_high', Number(v) || 80)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('cr_score_med', 'Warm lead score ≥')}><InputNumber min={0} max={100} value={values.scoring_medium} onChange={(v) => setValue('scoring_medium', Number(v) || 50)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('cr_assign', 'Round-robin assignment')}><Switch checked={values.round_robin} onChange={(v) => setValue('round_robin', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('cr_dup', 'Duplicate detection')}><Switch checked={values.duplicate_detection} onChange={(v) => setValue('duplicate_detection', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: Purchases (bag) ─────────────────────────────────────────
type PurchasesBag = { rfq_required: boolean; three_way_match: boolean; approval_threshold: number; default_lead_time_days: number; default_payment_terms_days: number; allow_dropship: boolean; over_receipt_pct: number };
const PurchasesSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<PurchasesBag>('purchases', {
    rfq_required: false, three_way_match: true, approval_threshold: 5000,
    default_lead_time_days: 7, default_payment_terms_days: 30, allow_dropship: false, over_receipt_pct: 5,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ShopOutlined />} title={t('purch_title', 'Purchases')} description={t('purch_desc', 'RFQ flow, vendor pricing, three-way match, and approval thresholds.')}>
        <SettingsRow label={t('pu_rfq', 'Require RFQ before PO')}><Switch checked={values.rfq_required} onChange={(v) => setValue('rfq_required', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('pu_3way', 'Three-way match (PO / receipt / bill)')}><Switch checked={values.three_way_match} onChange={(v) => setValue('three_way_match', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('pu_appr', 'Approval threshold (amount)')}><InputNumber min={0} step={100} value={values.approval_threshold} onChange={(v) => setValue('approval_threshold', Number(v) || 0)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('pu_lead', 'Default lead time (days)')}><InputNumber min={0} max={365} value={values.default_lead_time_days} onChange={(v) => setValue('default_lead_time_days', Number(v) || 7)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('pu_terms_days', 'Default payment terms (days)')}><InputNumber min={0} max={180} value={values.default_payment_terms_days} onChange={(v) => setValue('default_payment_terms_days', Number(v) || 30)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('pu_drop', 'Allow drop-shipping')}><Switch checked={values.allow_dropship} onChange={(v) => setValue('allow_dropship', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('pu_over_receipt', 'Allow over-receipt (%)')}><InputNumber min={0} max={100} step={1} value={values.over_receipt_pct} onChange={(v) => setValue('over_receipt_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: Inventory (bag) ────────────────────────────────────────
type InventoryBag = { default_warehouse: string; removal_strategy: 'fifo' | 'lifo' | 'fefo'; allow_negative_stock: boolean; lot_tracking: boolean; serial_tracking: boolean; barcode_required: boolean; reorder_enabled: boolean; reorder_lead_days: number };
const InventorySettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<InventoryBag>('inventory', {
    default_warehouse: 'WH-001', removal_strategy: 'fifo', allow_negative_stock: false,
    lot_tracking: true, serial_tracking: false, barcode_required: false, reorder_enabled: true, reorder_lead_days: 7,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<InboxOutlined />} title={t('inv_title', 'Inventory')} description={t('inv_desc', 'Warehouses, lots, serials, putaway, removal strategies, and routes.')}>
        <SettingsRow label={t('iv_default_wh', 'Default warehouse code')}><Input value={values.default_warehouse} onChange={(e) => setValue('default_warehouse', e.target.value)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('iv_strategy', 'Removal strategy')}><Segmented value={values.removal_strategy} onChange={(v) => setValue('removal_strategy', v as InventoryBag['removal_strategy'])} options={[{ value: 'fifo', label: 'FIFO' }, { value: 'lifo', label: 'LIFO' }, { value: 'fefo', label: 'FEFO' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('iv_neg', 'Allow negative stock')}><Switch checked={values.allow_negative_stock} onChange={(v) => setValue('allow_negative_stock', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('iv_lot', 'Lot tracking')}><Switch checked={values.lot_tracking} onChange={(v) => setValue('lot_tracking', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('iv_serial', 'Serial tracking')}><Switch checked={values.serial_tracking} onChange={(v) => setValue('serial_tracking', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('iv_barcode', 'Barcode required')}><Switch checked={values.barcode_required} onChange={(v) => setValue('barcode_required', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('iv_reorder', 'Auto-reorder rules enabled')}><Switch checked={values.reorder_enabled} onChange={(v) => setValue('reorder_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('iv_reorder_lead', 'Reorder lead time (days)')}><InputNumber min={0} max={365} value={values.reorder_lead_days} onChange={(v) => setValue('reorder_lead_days', Number(v) || 7)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: MRP (bag) ─────────────────────────────────────────────────
type MrpBag = { quality_checks_required: boolean; auto_create_work_orders: boolean; allow_subcontracting: boolean; allow_byproducts: boolean; bom_default_qty: number; default_workcenter_capacity_hours: number };
const MrpSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<MrpBag>('mrp', {
    quality_checks_required: true, auto_create_work_orders: true, allow_subcontracting: false,
    allow_byproducts: false, bom_default_qty: 1, default_workcenter_capacity_hours: 8,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<BuildOutlined />} title={t('mrp_title', 'Manufacturing (MRP)')} description={t('mrp_desc', 'BOMs, work centers, routings, and quality checks.')}>
        <SettingsRow label={t('mr_qc', 'Quality checks required')}><Switch checked={values.quality_checks_required} onChange={(v) => setValue('quality_checks_required', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mr_auto_wo', 'Auto-create work orders from MO')}><Switch checked={values.auto_create_work_orders} onChange={(v) => setValue('auto_create_work_orders', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mr_sub', 'Allow subcontracting')}><Switch checked={values.allow_subcontracting} onChange={(v) => setValue('allow_subcontracting', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mr_byproduct', 'Allow by-products')}><Switch checked={values.allow_byproducts} onChange={(v) => setValue('allow_byproducts', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mr_bom_qty', 'Default BOM quantity')}><InputNumber min={0.01} step={0.1} value={values.bom_default_qty} onChange={(v) => setValue('bom_default_qty', Number(v) || 1)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('mr_wc', 'Default work center capacity (hours/day)')}><InputNumber min={1} max={24} value={values.default_workcenter_capacity_hours} onChange={(v) => setValue('default_workcenter_capacity_hours', Number(v) || 8)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: POS (bag) ────────────────────────────────────────────────
type PosBag = { receipt_printer_url: string; cash_drawer_enabled: boolean; barcode_scanner_enabled: boolean; card_terminal_enabled: boolean; tip_default_pct: number; service_charge_pct: number; offline_mode: boolean; restaurant_mode: boolean; require_cashier_pin: boolean };
const PosSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<PosBag>('pos', {
    receipt_printer_url: '', cash_drawer_enabled: true, barcode_scanner_enabled: true, card_terminal_enabled: false,
    tip_default_pct: 0, service_charge_pct: 0, offline_mode: true, restaurant_mode: false, require_cashier_pin: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<DesktopOutlined />} title={t('pos_title', 'Point of Sale')} description={t('pos_desc', 'Receipt printers, cash drawers, payment terminals, and tip rules.')}>
        <SettingsRow label={t('po_printer', 'Receipt printer URL (ESC/POS)')}><Input value={values.receipt_printer_url} onChange={(e) => setValue('receipt_printer_url', e.target.value)} disabled={loading} placeholder="http://192.168.1.20:9100" /></SettingsRow>
        <SettingsRow label={t('po_drawer', 'Cash drawer')}><Switch checked={values.cash_drawer_enabled} onChange={(v) => setValue('cash_drawer_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_scan', 'Barcode scanner')}><Switch checked={values.barcode_scanner_enabled} onChange={(v) => setValue('barcode_scanner_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_card', 'Card terminal')}><Switch checked={values.card_terminal_enabled} onChange={(v) => setValue('card_terminal_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_tip', 'Default tip (%)')}><InputNumber min={0} max={50} step={0.5} value={values.tip_default_pct} onChange={(v) => setValue('tip_default_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('po_service', 'Service charge (%)')}><InputNumber min={0} max={50} step={0.5} value={values.service_charge_pct} onChange={(v) => setValue('service_charge_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('po_offline', 'Offline mode & sync')}><Switch checked={values.offline_mode} onChange={(v) => setValue('offline_mode', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_table', 'Restaurant mode (tables & courses)')}><Switch checked={values.restaurant_mode} onChange={(v) => setValue('restaurant_mode', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('po_pin', 'Require cashier PIN')}><Switch checked={values.require_cashier_pin} onChange={(v) => setValue('require_cashier_pin', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: E-commerce (bag) ───────────────────────────────────────
type EcommerceBag = { storefront_theme: string; checkout_steps: 1 | 2 | 3; abandoned_cart_recovery: boolean; abandoned_cart_hours: number; reviews_enabled: boolean; wishlist_enabled: boolean; seo_default_title: string; seo_default_description: string };
const EcommerceSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<EcommerceBag>('ecommerce', {
    storefront_theme: 'classic', checkout_steps: 2, abandoned_cart_recovery: true, abandoned_cart_hours: 24,
    reviews_enabled: true, wishlist_enabled: true, seo_default_title: '', seo_default_description: '',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<RocketOutlined />} title={t('ec_title', 'E-commerce & website')} description={t('ec_desc', 'Storefront theme, checkout, shipping, abandoned cart, and SEO.')}>
        <SettingsRow label={t('e_theme', 'Storefront theme')}><Select value={values.storefront_theme} onChange={(v) => setValue('storefront_theme', v)} disabled={loading} style={{ width: 220 }} options={[{ value: 'classic', label: 'Classic' }, { value: 'modern', label: 'Modern' }, { value: 'minimal', label: 'Minimal' }, { value: 'elegant', label: 'Elegant' }]} /></SettingsRow>
        <SettingsRow label={t('e_checkout_steps', 'Checkout steps')}><Segmented value={values.checkout_steps} onChange={(v) => setValue('checkout_steps', Number(v) as EcommerceBag['checkout_steps'])} options={[{ value: 1, label: '1 (one-page)' }, { value: 2, label: '2' }, { value: 3, label: '3' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('e_abandon', 'Abandoned cart recovery')}><Switch checked={values.abandoned_cart_recovery} onChange={(v) => setValue('abandoned_cart_recovery', v)} disabled={loading} /></SettingsRow>
        {values.abandoned_cart_recovery && <SettingsRow label={t('e_abandon_hours', 'Trigger after (hours)')}><InputNumber min={1} max={168} value={values.abandoned_cart_hours} onChange={(v) => setValue('abandoned_cart_hours', Number(v) || 24)} disabled={loading} style={{ width: 160 }} /></SettingsRow>}
        <SettingsRow label={t('e_review', 'Product reviews')}><Switch checked={values.reviews_enabled} onChange={(v) => setValue('reviews_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('e_wishlist', 'Wishlists')}><Switch checked={values.wishlist_enabled} onChange={(v) => setValue('wishlist_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('e_seo_title', 'Default SEO title')}><Input value={values.seo_default_title} onChange={(e) => setValue('seo_default_title', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('e_seo_desc', 'Default SEO description')}><Input.TextArea value={values.seo_default_description} onChange={(e) => setValue('seo_default_description', e.target.value)} disabled={loading} rows={2} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
// ── Commerce: Helpdesk (bag) ──────────────────────────────────────────
type HelpdeskBag = { default_pipeline: string; sla_first_response_hours: number; sla_resolve_hours: number; auto_assign: 'round_robin' | 'load_balance' | 'manual'; csat_enabled: boolean; kb_enabled: boolean; email_alias: string };
const HelpdeskSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<HelpdeskBag>('helpdesk', {
    default_pipeline: 'Support', sla_first_response_hours: 4, sla_resolve_hours: 48,
    auto_assign: 'round_robin', csat_enabled: true, kb_enabled: true, email_alias: 'support@example.com',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<CustomerServiceOutlined />} title={t('hd_title', 'Helpdesk')} description={t('hd_desc', 'Ticket pipelines, SLA policies, routing rules, and CSAT.')}>
        <SettingsRow label={t('h_pipe', 'Default pipeline')}><Input value={values.default_pipeline} onChange={(e) => setValue('default_pipeline', e.target.value)} disabled={loading} style={{ width: 240 }} /></SettingsRow>
        <SettingsRow label={t('h_sla_first', 'SLA: first response (hours)')}><InputNumber min={1} max={168} value={values.sla_first_response_hours} onChange={(v) => setValue('sla_first_response_hours', Number(v) || 4)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('h_sla_resolve', 'SLA: resolution (hours)')}><InputNumber min={1} max={720} value={values.sla_resolve_hours} onChange={(v) => setValue('sla_resolve_hours', Number(v) || 48)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('h_route', 'Auto-assignment strategy')}><Segmented value={values.auto_assign} onChange={(v) => setValue('auto_assign', v as HelpdeskBag['auto_assign'])} options={[{ value: 'manual', label: t('manual', 'Manual') }, { value: 'round_robin', label: t('round_robin', 'Round-robin') }, { value: 'load_balance', label: t('load_balance', 'Load balance') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('h_csat', 'CSAT surveys')}><Switch checked={values.csat_enabled} onChange={(v) => setValue('csat_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('h_kb', 'Knowledge base')}><Switch checked={values.kb_enabled} onChange={(v) => setValue('kb_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('h_email', 'Support email alias')}><Input value={values.email_alias} onChange={(e) => setValue('email_alias', e.target.value)} disabled={loading} placeholder="support@example.com" /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Operations ───────────────────────────────────────────────────────────
type HrBag = { default_contract_type: string; probation_days: number; annual_leave_days: number; sick_leave_days: number; weekly_off_days: number; max_overtime_hours: number; require_check_in: boolean; geofence_enabled: boolean };
const HrSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<HrBag>('hr', {
    default_contract_type: 'full_time', probation_days: 90, annual_leave_days: 21, sick_leave_days: 10,
    weekly_off_days: 1, max_overtime_hours: 40, require_check_in: true, geofence_enabled: false,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<TeamOutlined />} title={t('hr_title', 'Human resources')} description={t('hr_desc', 'Departments, contracts, leave types, and employee self-service.')}>
        <SettingsRow label={t('hr_contract', 'Default contract type')}><Select value={values.default_contract_type} onChange={(v) => setValue('default_contract_type', v)} disabled={loading} style={{ width: 240 }} options={[{ value: 'full_time', label: t('full_time', 'Full-time') }, { value: 'part_time', label: t('part_time', 'Part-time') }, { value: 'contractor', label: t('contractor', 'Contractor') }, { value: 'intern', label: t('intern', 'Intern') }]} /></SettingsRow>
        <SettingsRow label={t('hr_probation', 'Probation period (days)')}><InputNumber min={0} max={365} value={values.probation_days} onChange={(v) => setValue('probation_days', Number(v) || 90)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('hr_annual', 'Annual leave (days/year)')}><InputNumber min={0} max={60} value={values.annual_leave_days} onChange={(v) => setValue('annual_leave_days', Number(v) || 21)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('hr_sick', 'Sick leave (days/year)')}><InputNumber min={0} max={60} value={values.sick_leave_days} onChange={(v) => setValue('sick_leave_days', Number(v) || 10)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('hr_off', 'Weekly off days')}><InputNumber min={0} max={3} value={values.weekly_off_days} onChange={(v) => setValue('weekly_off_days', Number(v) || 1)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('hr_overtime', 'Max overtime (hours/month)')}><InputNumber min={0} max={200} value={values.max_overtime_hours} onChange={(v) => setValue('max_overtime_hours', Number(v) || 40)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('hr_attend', 'Require attendance check-in')}><Switch checked={values.require_check_in} onChange={(v) => setValue('require_check_in', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('hr_geofence', 'Geofence enforcement')}><Switch checked={values.geofence_enabled} onChange={(v) => setValue('geofence_enabled', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type PayrollBag = { pay_period: 'monthly' | 'biweekly' | 'weekly'; pay_day: number; tax_withholding_pct: number; social_security_pct: number; overtime_multiplier: number; allowance_default: number; deduction_default: number; payslip_email_enabled: boolean };
const PayrollSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<PayrollBag>('payroll', {
    pay_period: 'monthly', pay_day: 25, tax_withholding_pct: 5, social_security_pct: 5,
    overtime_multiplier: 1.5, allowance_default: 0, deduction_default: 0, payslip_email_enabled: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<WalletOutlined />} title={t('pay_title', 'Payroll')} description={t('pay_desc', 'Pay structures, allowances, deductions, and run schedules.')}>
        <SettingsRow label={t('p_run', 'Pay period')}><Segmented value={values.pay_period} onChange={(v) => setValue('pay_period', v as PayrollBag['pay_period'])} options={[{ value: 'weekly', label: t('weekly', 'Weekly') }, { value: 'biweekly', label: t('biweekly', 'Bi-weekly') }, { value: 'monthly', label: t('monthly', 'Monthly') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('p_payday', 'Pay day (day of month)')}><InputNumber min={1} max={31} value={values.pay_day} onChange={(v) => setValue('pay_day', Number(v) || 25)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('p_tax', 'Tax withholding (%)')}><InputNumber min={0} max={50} step={0.1} value={values.tax_withholding_pct} onChange={(v) => setValue('tax_withholding_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('p_social', 'Social security (%)')}><InputNumber min={0} max={50} step={0.1} value={values.social_security_pct} onChange={(v) => setValue('social_security_pct', Number(v) || 0)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('p_ot', 'Overtime multiplier')}><InputNumber min={1} max={3} step={0.1} value={values.overtime_multiplier} onChange={(v) => setValue('overtime_multiplier', Number(v) || 1.5)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('p_allow', 'Default allowance amount')}><InputNumber min={0} step={50} value={values.allowance_default} onChange={(v) => setValue('allowance_default', Number(v) || 0)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('p_deduct', 'Default deduction amount')}><InputNumber min={0} step={50} value={values.deduction_default} onChange={(v) => setValue('deduction_default', Number(v) || 0)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('p_payslip', 'Email payslips automatically')}><Switch checked={values.payslip_email_enabled} onChange={(v) => setValue('payslip_email_enabled', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type ProjectsBag = { default_billing: 'fixed' | 'time_material' | 'milestone'; require_timesheet_approval: boolean; default_hourly_rate: number; budget_alert_pct: number; gantt_enabled: boolean; kanban_enabled: boolean };
const ProjectsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<ProjectsBag>('projects', {
    default_billing: 'time_material', require_timesheet_approval: true, default_hourly_rate: 25,
    budget_alert_pct: 80, gantt_enabled: true, kanban_enabled: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ProjectOutlined />} title={t('proj_title', 'Projects & timesheets')} description={t('proj_desc', 'Project templates, task workflows, billable rates, and Gantt.')}>
        <SettingsRow label={t('pj_billable', 'Default billing model')}><Segmented value={values.default_billing} onChange={(v) => setValue('default_billing', v as ProjectsBag['default_billing'])} options={[{ value: 'fixed', label: t('fixed_price', 'Fixed price') }, { value: 'time_material', label: t('time_material', 'Time & material') }, { value: 'milestone', label: t('milestone', 'Milestone') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('pj_ts', 'Require timesheet approval')}><Switch checked={values.require_timesheet_approval} onChange={(v) => setValue('require_timesheet_approval', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('pj_rate', 'Default hourly rate')}><InputNumber min={0} step={1} value={values.default_hourly_rate} onChange={(v) => setValue('default_hourly_rate', Number(v) || 25)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('pj_budget', 'Budget alert threshold (%)')}><InputNumber min={1} max={100} value={values.budget_alert_pct} onChange={(v) => setValue('budget_alert_pct', Number(v) || 80)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('pj_gantt', 'Gantt scheduling view')}><Switch checked={values.gantt_enabled} onChange={(v) => setValue('gantt_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('pj_kanban', 'Kanban for tasks')}><Switch checked={values.kanban_enabled} onChange={(v) => setValue('kanban_enabled', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type MarketingBag = { default_sender_name: string; default_sender_email: string; double_opt_in: boolean; unsubscribe_footer: string; track_opens: boolean; track_clicks: boolean; max_emails_per_day: number; ab_testing_enabled: boolean };
const MarketingSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<MarketingBag>('marketing', {
    default_sender_name: '', default_sender_email: '', double_opt_in: true,
    unsubscribe_footer: 'You received this email because you subscribed. Unsubscribe anytime.',
    track_opens: true, track_clicks: true, max_emails_per_day: 1000, ab_testing_enabled: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<SoundOutlined />} title={t('mkt_title', 'Marketing')} description={t('mkt_desc', 'Email campaigns, automations, segments, and lead capture.')}>
        <SettingsRow label={t('mk_sender_name', 'Default sender name')}><Input value={values.default_sender_name} onChange={(e) => setValue('default_sender_name', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mk_sender_email', 'Default sender email')}><Input value={values.default_sender_email} onChange={(e) => setValue('default_sender_email', e.target.value)} disabled={loading} placeholder="hello@example.com" /></SettingsRow>
        <SettingsRow label={t('mk_optin', 'Double opt-in')}><Switch checked={values.double_opt_in} onChange={(v) => setValue('double_opt_in', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mk_unsub', 'Unsubscribe footer')}><Input.TextArea value={values.unsubscribe_footer} onChange={(e) => setValue('unsubscribe_footer', e.target.value)} disabled={loading} rows={2} /></SettingsRow>
        <SettingsRow label={t('mk_open', 'Track email opens')}><Switch checked={values.track_opens} onChange={(v) => setValue('track_opens', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mk_click', 'Track link clicks')}><Switch checked={values.track_clicks} onChange={(v) => setValue('track_clicks', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('mk_max', 'Max emails per day')}><InputNumber min={0} max={1000000} step={100} value={values.max_emails_per_day} onChange={(v) => setValue('max_emails_per_day', Number(v) || 0)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('mk_ab', 'A/B testing')}><Switch checked={values.ab_testing_enabled} onChange={(v) => setValue('ab_testing_enabled', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Automation ───────────────────────────────────────────────────────────
interface WfRow { id: string; name: string; trigger_type?: string; is_active?: boolean }
const WorkflowsSettings: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<WfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await api.get('/api/automation/workflows'); setRows(Array.isArray(r.data) ? r.data : (r.data?.items ?? [])); }
    catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 429 ? t('error_quota', 'Service temporarily busy. Please try again.') : t('error_load', 'Failed to load workflows.'));
      setRows([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (row: WfRow) => { try { await api.post(`/api/automation/workflows/${row.id}/toggle`); load(); } catch { message.error(t('action_failed', 'Action failed')); } };
  const remove = async (id: string) => { try { await api.delete(`/api/automation/workflows/${id}`); message.success(t('deleted', 'Deleted')); load(); } catch { message.error(t('delete_failed', 'Delete failed')); } };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<PartitionOutlined />}
        title={t('wf_title', 'Workflows')}
        description={t('wf_desc', 'No-code business rules: when X happens, then do Y.')}
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => window.location.assign('/automation/workflows')}>{t('open_builder', 'Open builder')}</Button>}
      >
        {error && <Alert type="warning" showIcon message={error} action={<Button size="small" onClick={load}>{t('retry', 'Retry')}</Button>} style={{ marginBottom: 16 }} />}
        <ResponsiveTableAdapter<WfRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Name'), dataIndex: 'name' },
            { title: t('w_trigger', 'Trigger'), dataIndex: 'trigger_type', width: 180, render: (v: string) => <Tag>{v || '—'}</Tag> },
            { title: t('status', 'Status'), dataIndex: 'is_active', width: 120, render: (v: boolean) => v ? <Tag color="green">{t('active', 'Active')}</Tag> : <Tag>{t('paused', 'Paused')}</Tag> },
            { title: t('actions', 'Actions'), key: 'a', width: 200, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => toggle(r)}>{r.is_active ? t('pause', 'Pause') : t('activate', 'Activate')}</Button>
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
    </Space>
  );
};
interface ApprRow { id: string; name: string; entity_type?: string; threshold_amount?: number; is_active?: boolean }
const ApprovalsSettings: React.FC = () => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<ApprRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = async () => {
    setLoading(true); setError(null);
    try { const r = await api.get('/api/approvals/approval-rules'); setRows(Array.isArray(r.data) ? r.data : (r.data?.items ?? [])); }
    catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 429 ? t('error_quota', 'Service temporarily busy. Please try again.') : t('error_load', 'Failed to load approval rules.'));
      setRows([]);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const toggle = async (row: ApprRow) => { try { await api.post(`/api/approvals/approval-rules/${row.id}/toggle`); load(); } catch { message.error(t('action_failed', 'Action failed')); } };
  const remove = async (id: string) => { try { await api.delete(`/api/approvals/approval-rules/${id}`); message.success(t('deleted', 'Deleted')); load(); } catch { message.error(t('delete_failed', 'Delete failed')); } };
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard
        icon={<CheckCircleOutlined />}
        title={t('appr_title', 'Approvals')}
        description={t('appr_desc', 'Multi-step approvals for bills, expenses, POs, and time off.')}
        actions={<Button type="primary" icon={<PlusOutlined />} onClick={() => window.location.assign('/approvals')}>{t('open_approvals', 'Open approvals')}</Button>}
      >
        {error && <Alert type="warning" showIcon message={error} action={<Button size="small" onClick={load}>{t('retry', 'Retry')}</Button>} style={{ marginBottom: 16 }} />}
        <ResponsiveTableAdapter<ApprRow>
          rowKey="id"
          dataSource={rows}
          loading={loading}
          pagination={{ pageSize: 8, hideOnSinglePage: true }}
          size="middle"
          columns={[
            { title: t('name', 'Rule name'), dataIndex: 'name' },
            { title: t('a_entity', 'Entity'), dataIndex: 'entity_type', width: 160, render: (v: string) => <Tag>{v || '—'}</Tag> },
            { title: t('a_thresh', 'Threshold'), dataIndex: 'threshold_amount', width: 140, render: (v: number) => v != null ? v.toLocaleString() : '—' },
            { title: t('status', 'Status'), dataIndex: 'is_active', width: 120, render: (v: boolean) => v ? <Tag color="green">{t('active', 'Active')}</Tag> : <Tag>{t('paused', 'Paused')}</Tag> },
            { title: t('actions', 'Actions'), key: 'a', width: 200, render: (_, r) => (
              <Space>
                <Button size="small" onClick={() => toggle(r)}>{r.is_active ? t('pause', 'Pause') : t('activate', 'Activate')}</Button>
                <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => remove(r.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} />
                </Popconfirm>
              </Space>
            )},
          ]}
        />
      </SectionCard>
    </Space>
  );
};
type IntegrationsBag = { whatsapp_enabled: boolean; whatsapp_phone_id: string; google_calendar: boolean; google_drive: boolean; dropbox: boolean; slack_webhook: string; teams_webhook: string; openai_enabled: boolean; ocr_enabled: boolean; stripe_enabled: boolean; shopify_enabled: boolean };
const IntegrationsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<IntegrationsBag>('integrations', {
    whatsapp_enabled: false, whatsapp_phone_id: '', google_calendar: false, google_drive: false, dropbox: false,
    slack_webhook: '', teams_webhook: '', openai_enabled: false, ocr_enabled: false, stripe_enabled: false, shopify_enabled: false,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ClusterOutlined />} title={t('int_title', 'Integrations')} description={t('int_desc', 'Marketplace apps and 3rd-party connections.')}
        actions={
          <SectionHelpPopover
            what={t('settings.help.integrations.what')}
            why={t('settings.help.integrations.why')}
            steps={[
              t('settings.help.integrations.step_1'),
              t('settings.help.integrations.step_2'),
              t('settings.help.integrations.step_3'),
            ]}
          />
        }
      >
        <SettingsRow label={t('i_whatsapp', 'WhatsApp Business API')}><Switch checked={values.whatsapp_enabled} onChange={(v) => setValue('whatsapp_enabled', v)} disabled={loading} /></SettingsRow>
        {values.whatsapp_enabled && <SettingsRow label={t('i_wa_phone', 'WhatsApp Phone Number ID')}><Input value={values.whatsapp_phone_id} onChange={(e) => setValue('whatsapp_phone_id', e.target.value)} disabled={loading} /></SettingsRow>}
        <SettingsRow label={t('i_google', 'Google Calendar sync')}><Switch checked={values.google_calendar} onChange={(v) => setValue('google_calendar', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_drive', 'Google Drive')}><Switch checked={values.google_drive} onChange={(v) => setValue('google_drive', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_dropbox', 'Dropbox')}><Switch checked={values.dropbox} onChange={(v) => setValue('dropbox', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_slack', 'Slack webhook URL')}><Input value={values.slack_webhook} onChange={(e) => setValue('slack_webhook', e.target.value)} disabled={loading} placeholder="https://hooks.slack.com/..." /></SettingsRow>
        <SettingsRow label={t('i_microsoft', 'MS Teams webhook URL')}><Input value={values.teams_webhook} onChange={(e) => setValue('teams_webhook', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_stripe', 'Stripe / PayPal')}><Switch checked={values.stripe_enabled} onChange={(v) => setValue('stripe_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_shopify', 'Shopify / WooCommerce')}><Switch checked={values.shopify_enabled} onChange={(v) => setValue('shopify_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_openai', 'OpenAI / LLM features')}><Switch checked={values.openai_enabled} onChange={(v) => setValue('openai_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('i_ocr', 'OCR for receipts & invoices')}><Switch checked={values.ocr_enabled} onChange={(v) => setValue('ocr_enabled', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type WebhooksBag = { endpoints: string; signing_secret: string; retry_attempts: number; retry_backoff_seconds: number; timeout_seconds: number; events: string[] };
const WebhooksSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<WebhooksBag>('webhooks', {
    endpoints: '', signing_secret: '', retry_attempts: 3, retry_backoff_seconds: 60, timeout_seconds: 30,
    events: ['invoice.created', 'invoice.paid', 'order.created'],
  });
  const eventOpts = [
    'invoice.created', 'invoice.updated', 'invoice.paid', 'invoice.cancelled',
    'order.created', 'order.updated', 'order.shipped',
    'customer.created', 'customer.updated',
    'payment.received', 'payment.refunded',
    'inventory.low_stock', 'inventory.out_of_stock',
  ].map((v) => ({ value: v, label: v }));
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<BranchesOutlined />} title={t('wh_title2', 'Webhooks')} description={t('wh_desc2', 'Outbound HTTP callbacks for external systems.')}>
        <SettingsRow label={t('wb_endpoint', 'Endpoint URLs (one per line)')}><Input.TextArea value={values.endpoints} onChange={(e) => setValue('endpoints', e.target.value)} disabled={loading} rows={3} placeholder="https://example.com/hook" /></SettingsRow>
        <SettingsRow label={t('wb_sign', 'HMAC signing secret')}><Input.Password value={values.signing_secret} onChange={(e) => setValue('signing_secret', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('wb_event', 'Subscribed events')}><Select mode="multiple" value={values.events} onChange={(v) => setValue('events', v)} disabled={loading} options={eventOpts} style={{ minWidth: 360 }} /></SettingsRow>
        <SettingsRow label={t('wb_retry', 'Retry attempts')}><InputNumber min={0} max={10} value={values.retry_attempts} onChange={(v) => setValue('retry_attempts', Number(v) || 3)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('wb_backoff', 'Retry backoff (seconds)')}><InputNumber min={1} max={3600} value={values.retry_backoff_seconds} onChange={(v) => setValue('retry_backoff_seconds', Number(v) || 60)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('wb_timeout', 'Request timeout (seconds)')}><InputNumber min={1} max={300} value={values.timeout_seconds} onChange={(v) => setValue('timeout_seconds', Number(v) || 30)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type ApiTokensBag = { rate_limit_per_min: number; default_token_ttl_days: number; require_ip_whitelist: boolean; ip_whitelist: string; require_2fa_for_token_creation: boolean };
const ApiTokensSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<ApiTokensBag>('api_tokens', {
    rate_limit_per_min: 600, default_token_ttl_days: 90, require_ip_whitelist: false, ip_whitelist: '', require_2fa_for_token_creation: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<ApiOutlined />} title={t('api_title', 'API tokens & OAuth')} description={t('api_desc', 'Personal access tokens, OAuth applications, and scoped keys.')}>
        <SettingsRow label={t('ap_rate', 'Rate limit (requests/minute)')}><InputNumber min={1} max={100000} value={values.rate_limit_per_min} onChange={(v) => setValue('rate_limit_per_min', Number(v) || 600)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
        <SettingsRow label={t('ap_rotate', 'Default token TTL (days)')}><InputNumber min={1} max={3650} value={values.default_token_ttl_days} onChange={(v) => setValue('default_token_ttl_days', Number(v) || 90)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('ap_ip', 'Require IP allowlist')}><Switch checked={values.require_ip_whitelist} onChange={(v) => setValue('require_ip_whitelist', v)} disabled={loading} /></SettingsRow>
        {values.require_ip_whitelist && <SettingsRow label={t('ap_ip_list', 'Allowlist (comma-separated CIDRs)')}><Input.TextArea value={values.ip_whitelist} onChange={(e) => setValue('ip_whitelist', e.target.value)} disabled={loading} rows={2} placeholder="10.0.0.0/8, 192.168.1.0/24" /></SettingsRow>}
        <SettingsRow label={t('ap_2fa', 'Require 2FA to mint tokens')}><Switch checked={values.require_2fa_for_token_creation} onChange={(v) => setValue('require_2fa_for_token_creation', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── Content ──────────────────────────────────────────────────────────────
type DocumentsBag = { storage_backend: 'local' | 's3' | 'gcs'; max_file_size_mb: number; ocr_enabled: boolean; share_link_expiry_days: number; require_signin_for_share: boolean; allowed_extensions: string };
const DocumentsSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<DocumentsBag>('documents', {
    storage_backend: 'local', max_file_size_mb: 25, ocr_enabled: false, share_link_expiry_days: 7,
    require_signin_for_share: false, allowed_extensions: 'pdf, docx, xlsx, jpg, jpeg, png, csv, zip',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<FolderOpenOutlined />} title={t('docs_title', 'Documents (DMS)')} description={t('docs_desc', 'Centralized document storage with tagging, sharing, and versioning.')} actions={<Button onClick={() => window.location.assign('/dms')}>{t('open_documents', 'Open documents')}</Button>}>
        <SettingsRow label={t('d_storage', 'Storage backend')}><Segmented value={values.storage_backend} onChange={(v) => setValue('storage_backend', v as DocumentsBag['storage_backend'])} options={[{ value: 'local', label: 'Local' }, { value: 's3', label: 'AWS S3' }, { value: 'gcs', label: 'Google Cloud Storage' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('d_max_size', 'Max upload size (MB)')}><InputNumber min={1} max={1024} value={values.max_file_size_mb} onChange={(v) => setValue('max_file_size_mb', Number(v) || 25)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('d_ocr', 'OCR & full-text search')}><Switch checked={values.ocr_enabled} onChange={(v) => setValue('ocr_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('d_share', 'Default share link expiry (days)')}><InputNumber min={1} max={365} value={values.share_link_expiry_days} onChange={(v) => setValue('share_link_expiry_days', Number(v) || 7)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('d_share_signin', 'Require sign-in for shared links')}><Switch checked={values.require_signin_for_share} onChange={(v) => setValue('require_signin_for_share', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('d_ext', 'Allowed file extensions (comma-separated)')}><Input value={values.allowed_extensions} onChange={(e) => setValue('allowed_extensions', e.target.value)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type SmsWaBag = { provider: 'twilio' | 'vonage' | 'local' | 'meta_wa'; sender_id: string; account_sid: string; auth_token: string; wa_phone_number_id: string; otp_template: string; daily_quota: number };
const SmsWhatsappSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<SmsWaBag>('sms_whatsapp', {
    provider: 'local', sender_id: '', account_sid: '', auth_token: '', wa_phone_number_id: '',
    otp_template: 'Your code is {{code}}. It expires in 10 minutes.', daily_quota: 1000,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<MessageOutlined />} title={t('sms_title', 'SMS & WhatsApp')} description={t('sms_desc', 'SMS gateway and WhatsApp Business API for transactional messages.')}
        actions={
          <SectionHelpPopover
            what={t('settings.help.sms.what')}
            why={t('settings.help.sms.why')}
            steps={[
              t('settings.help.sms.step_1'),
              t('settings.help.sms.step_2'),
              t('settings.help.sms.step_3'),
            ]}
          />
        }
      >
        <SettingsRow label={t('sm_provider', 'Provider')}><Segmented value={values.provider} onChange={(v) => setValue('provider', v as SmsWaBag['provider'])} options={[{ value: 'local', label: t('local_provider', 'Local') }, { value: 'twilio', label: 'Twilio' }, { value: 'vonage', label: 'Vonage' }, { value: 'meta_wa', label: 'Meta WhatsApp' }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('sm_sender', 'Sender ID')}><Input value={values.sender_id} onChange={(e) => setValue('sender_id', e.target.value)} disabled={loading} style={{ width: 240 }} /></SettingsRow>
        <SettingsRow label={t('sm_sid', 'Account SID / API key')}><Input value={values.account_sid} onChange={(e) => setValue('account_sid', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('sm_auth', 'Auth token')}><Input.Password value={values.auth_token} onChange={(e) => setValue('auth_token', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('sm_wa_api', 'WhatsApp Phone Number ID')}><Input value={values.wa_phone_number_id} onChange={(e) => setValue('wa_phone_number_id', e.target.value)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('sm_otp', 'OTP message template')}><Input.TextArea value={values.otp_template} onChange={(e) => setValue('otp_template', e.target.value)} disabled={loading} rows={2} /></SettingsRow>
        <SettingsRow label={t('sm_quota', 'Daily quota')}><InputNumber min={0} max={1000000} step={100} value={values.daily_quota} onChange={(v) => setValue('daily_quota', Number(v) || 0)} disabled={loading} style={{ width: 200 }} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ── System ───────────────────────────────────────────────────────────────
type AuditBag = { retention_days: number; export_format: 'csv' | 'json' | 'both'; anomaly_alerts: boolean; alert_email: string; immutable_log: boolean };
const AuditSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<AuditBag>('audit', {
    retention_days: 365, export_format: 'csv', anomaly_alerts: true, alert_email: '', immutable_log: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<AuditOutlined />} title={t('audit_title', 'Audit & compliance')} description={t('audit_desc', 'Compliance reports, retention policies, and tamper-evident logs.')} accent="warning"
        actions={
          <Space>
            <SectionHelpPopover
              what={t('settings.help.audit.what')}
              why={t('settings.help.audit.why')}
              steps={[
                t('settings.help.audit.step_1'),
                t('settings.help.audit.step_2'),
                t('settings.help.audit.step_3'),
              ]}
            />
            <Button onClick={() => window.location.assign('/audit-log-viewer')}>{t('open_audit', 'Open audit log')}</Button>
          </Space>
        }
      >
        <SettingsRow label={t('au_retain', 'Retention period (days)')}><InputNumber min={30} max={3650} value={values.retention_days} onChange={(v) => setValue('retention_days', Number(v) || 365)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('au_export', 'Compliance export format')}><Segmented value={values.export_format} onChange={(v) => setValue('export_format', v as AuditBag['export_format'])} options={[{ value: 'csv', label: 'CSV' }, { value: 'json', label: 'JSON' }, { value: 'both', label: t('both', 'Both') }]} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('au_anom', 'Anomaly alerts')}><Switch checked={values.anomaly_alerts} onChange={(v) => setValue('anomaly_alerts', v)} disabled={loading} /></SettingsRow>
        {values.anomaly_alerts && <SettingsRow label={t('au_alert_email', 'Alert email')}><Input value={values.alert_email} onChange={(e) => setValue('alert_email', e.target.value)} disabled={loading} placeholder="security@example.com" /></SettingsRow>}
        <SettingsRow label={t('au_log', 'Tamper-evident immutable log')}><Switch checked={values.immutable_log} onChange={(v) => setValue('immutable_log', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type GdprBag = { consent_required: boolean; dsr_email: string; default_retention_days: number; allow_self_export: boolean; allow_self_delete: boolean; breach_notify_within_hours: number; breach_notify_email: string };
const GdprSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<GdprBag>('gdpr', {
    consent_required: true, dsr_email: '', default_retention_days: 730, allow_self_export: true, allow_self_delete: true,
    breach_notify_within_hours: 72, breach_notify_email: '',
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<EyeInvisibleOutlined />} title={t('gdpr_title', 'Data privacy (GDPR/CCPA)')} description={t('gdpr_desc', 'Consent management, data subject requests, and erasure workflows.')} accent="danger">
        <SettingsRow label={t('g_consent', 'Require explicit consent at signup')}><Switch checked={values.consent_required} onChange={(v) => setValue('consent_required', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('g_dsr', 'Data subject request email')}><Input value={values.dsr_email} onChange={(e) => setValue('dsr_email', e.target.value)} disabled={loading} placeholder="privacy@example.com" /></SettingsRow>
        <SettingsRow label={t('g_retain', 'Default retention period (days)')}><InputNumber min={30} max={3650} value={values.default_retention_days} onChange={(v) => setValue('default_retention_days', Number(v) || 730)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('g_self_export', 'Allow self-service data export')}><Switch checked={values.allow_self_export} onChange={(v) => setValue('allow_self_export', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('g_self_delete', 'Allow self-service account deletion')}><Switch checked={values.allow_self_delete} onChange={(v) => setValue('allow_self_delete', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('g_breach_hours', 'Breach notification window (hours)')}><InputNumber min={1} max={168} value={values.breach_notify_within_hours} onChange={(v) => setValue('breach_notify_within_hours', Number(v) || 72)} disabled={loading} style={{ width: 160 }} /></SettingsRow>
        <SettingsRow label={t('g_breach_email', 'Breach notification email')}><Input value={values.breach_notify_email} onChange={(e) => setValue('breach_notify_email', e.target.value)} disabled={loading} placeholder="dpo@example.com" /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};
type MobileBag = { push_enabled: boolean; biometric_required: boolean; force_min_version: string; deep_link_scheme: string; offline_sync_enabled: boolean; camera_barcode_enabled: boolean };
const MobileSettings: React.FC = () => {
  const { t } = useTranslation();
  const { values, setValue, save, dirty, saving, loading } = useSettingsBag<MobileBag>('mobile', {
    push_enabled: true, biometric_required: false, force_min_version: '1.0.0', deep_link_scheme: 'zoho://',
    offline_sync_enabled: true, camera_barcode_enabled: true,
  });
  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <SectionCard icon={<MobileOutlined />} title={t('mob_title', 'Mobile app')} description={t('mob_desc', 'Mobile app configuration, push notifications, and offline behavior.')}>
        <SettingsRow label={t('m_push', 'Push notifications enabled')}><Switch checked={values.push_enabled} onChange={(v) => setValue('push_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('m_biometric', 'Require biometric unlock')}><Switch checked={values.biometric_required} onChange={(v) => setValue('biometric_required', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('m_force', 'Minimum app version (force update)')}><Input value={values.force_min_version} onChange={(e) => setValue('force_min_version', e.target.value)} disabled={loading} style={{ width: 200 }} placeholder="1.0.0" /></SettingsRow>
        <SettingsRow label={t('m_deeplink', 'Deep link scheme')}><Input value={values.deep_link_scheme} onChange={(e) => setValue('deep_link_scheme', e.target.value)} disabled={loading} style={{ width: 240 }} placeholder="app://" /></SettingsRow>
        <SettingsRow label={t('m_offline', 'Offline data sync')}><Switch checked={values.offline_sync_enabled} onChange={(v) => setValue('offline_sync_enabled', v)} disabled={loading} /></SettingsRow>
        <SettingsRow label={t('m_camera', 'Camera & barcode scanning')}><Switch checked={values.camera_barcode_enabled} onChange={(v) => setValue('camera_barcode_enabled', v)} disabled={loading} /></SettingsRow>
      </SectionCard>
      <SaveBar dirty={dirty} saving={saving} onSave={save} />
    </Space>
  );
};

// ─────────────────────── CSS ───────────────────────
const settingsCss = `
.st-shell {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 0;
  min-height: calc(100vh - 120px);
  background: ${palette.bg};
  margin: -24px;
}
[data-theme="dark"] .st-shell { background: ${palette.darkBg}; }

.st-aside {
  background: ${palette.surface};
  border-inline-end: 1px solid ${palette.border};
  padding: 16px 0;
  position: sticky;
  top: 60px;
  height: calc(100vh - 60px);
  overflow-y: auto;
}
[data-theme="dark"] .st-aside { background: ${palette.darkSurface}; border-color: ${palette.darkBorder}; }

.st-aside-head {
  padding: 8px 16px 16px;
  border-bottom: 1px solid ${palette.border};
  margin-bottom: 12px;
}
[data-theme="dark"] .st-aside-head { border-color: ${palette.darkBorder}; }

.st-aside-title {
  font-size: 16px;
  font-weight: 700;
  color: ${palette.ink900};
  display: flex;
  align-items: center;
}
[data-theme="dark"] .st-aside-title { color: ${palette.darkInk}; }

.st-aside-nav { padding: 0 8px; }

.st-group { margin-bottom: 16px; }

.st-group-label {
  font-size: 11px;
  font-weight: 600;
  color: ${palette.ink300};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  padding: 8px 12px 4px;
}

.st-nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: ${palette.ink700};
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  text-align: start;
  text-decoration: none;
  transition: background 160ms cubic-bezier(0.2,0,0,1), color 160ms;
}
[data-theme="dark"] .st-nav-item { color: ${palette.darkInkMuted}; }

.st-nav-item:hover {
  background: rgba(15,23,42,0.04);
  color: ${palette.ink900};
}
[data-theme="dark"] .st-nav-item:hover {
  background: rgba(255,255,255,0.04);
  color: ${palette.darkInk};
}

.st-nav-item.is-active {
  background: rgba(31,111,235,0.08);
  color: ${palette.primary600};
  font-weight: 600;
}
[data-theme="dark"] .st-nav-item.is-active {
  background: rgba(31,111,235,0.16);
  color: ${palette.primary300};
}

.st-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  font-size: 15px;
  color: inherit;
  opacity: 0.85;
}

.st-nav-label { flex: 1; }
.st-nav-arrow { font-size: 11px; opacity: 0.6; }

.st-nav-badge {
  font-size: 9.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  margin-inline-start: 4px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  line-height: 1.4;
  flex-shrink: 0;
}
.st-nav-badge--soon { background: rgba(245,158,11,0.14); color: #B45309; }
.st-nav-badge--beta { background: rgba(31,111,235,0.14); color: #1858BF; }
.st-nav-badge--new  { background: rgba(22,163,74,0.14);  color: #15803D; }
[data-theme="dark"] .st-nav-badge--soon { background: rgba(245,158,11,0.18); color: #FBBF24; }
[data-theme="dark"] .st-nav-badge--beta { background: rgba(96,165,250,0.18); color: #93C5FD; }
[data-theme="dark"] .st-nav-badge--new  { background: rgba(74,222,128,0.18); color: #86EFAC; }

.st-nav-active-bar {
  position: absolute;
  inset-inline-start: -8px;
  top: 6px;
  bottom: 6px;
  width: 3px;
  border-radius: 2px;
  background: linear-gradient(180deg, ${palette.primary500}, ${palette.primary700});
}

.st-main {
  padding: 24px 32px 48px;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
}

.st-content { padding-bottom: 24px; }

@media (max-width: 900px) {
  .st-shell {
    grid-template-columns: 1fr;
    margin: 0;
    min-height: auto;
  }
  .st-aside { display: none; }
  .st-main { padding: 0 0 64px; }
  .st-mobile-nav-bar { margin: 0 0 16px; }
  .st-content { padding: 0; }
}

/* ── Mobile: sticky section picker bar ─────────────────────── */
.st-mobile-nav-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 16px;
  margin: 0 0 16px;
  border: none;
  background: linear-gradient(135deg, rgba(31,111,235,0.07) 0%, rgba(99,102,241,0.05) 100%);
  border-radius: 14px;
  border: 1.5px solid rgba(31,111,235,0.18);
  cursor: pointer;
  text-align: start;
  box-shadow: 0 2px 12px rgba(31,111,235,0.08);
  transition: background 0.18s, box-shadow 0.18s, border-color 0.18s, transform 0.12s;
  -webkit-tap-highlight-color: transparent;
}
[data-theme="dark"] .st-mobile-nav-bar {
  background: linear-gradient(135deg, rgba(31,111,235,0.12) 0%, rgba(99,102,241,0.08) 100%);
  border-color: rgba(99,102,241,0.28);
  box-shadow: 0 2px 12px rgba(31,111,235,0.14);
}
.st-mobile-nav-bar:hover {
  background: linear-gradient(135deg, rgba(31,111,235,0.11) 0%, rgba(99,102,241,0.08) 100%);
  border-color: rgba(31,111,235,0.30);
  box-shadow: 0 4px 16px rgba(31,111,235,0.13);
}
.st-mobile-nav-bar:active {
  transform: scale(0.985);
  box-shadow: 0 1px 6px rgba(31,111,235,0.10);
}

.st-mobile-nav-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #1F6FEB 0%, #6366F1 100%);
  color: #fff;
  font-size: 17px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(31,111,235,0.30);
}

.st-mobile-nav-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.st-mobile-nav-eyebrow {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.7px;
  color: ${palette.primary600};
  line-height: 1;
  opacity: 0.75;
}
[data-theme="dark"] .st-mobile-nav-eyebrow { color: ${palette.primary300}; }

.st-mobile-nav-label {
  font-size: 15px;
  font-weight: 700;
  color: ${palette.ink900};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
}
[data-theme="dark"] .st-mobile-nav-label { color: ${palette.darkInk}; }

.st-mobile-nav-hint {
  font-size: 11px;
  color: ${palette.ink300};
  font-weight: 400;
  line-height: 1;
  margin-top: 1px;
}
[data-theme="dark"] .st-mobile-nav-hint { color: rgba(255,255,255,0.30); }

.st-mobile-nav-chevron-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(31,111,235,0.10);
  color: ${palette.primary600};
  font-size: 11px;
  flex-shrink: 0;
  transition: background 0.15s;
}
[data-theme="dark"] .st-mobile-nav-chevron-wrap {
  background: rgba(99,102,241,0.18);
  color: ${palette.primary300};
}
.st-mobile-nav-bar:hover .st-mobile-nav-chevron-wrap {
  background: rgba(31,111,235,0.18);
}

/* ── Mobile: bottom-sheet drawer header ─────────────────────── */
.st-drawer-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px 10px;
  border-bottom: 1px solid ${palette.border};
  flex-shrink: 0;
}
[data-theme="dark"] .st-drawer-header { border-color: ${palette.darkBorder}; }

.st-drawer-handle {
  position: absolute;
  top: 8px;
  left: 50%;
  transform: translateX(-50%);
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: rgba(15,23,42,0.15);
}
[data-theme="dark"] .st-drawer-handle { background: rgba(255,255,255,0.18); }

.st-drawer-title {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: ${palette.ink900};
  display: flex;
  align-items: center;
  margin-top: 8px;
}
[data-theme="dark"] .st-drawer-title { color: ${palette.darkInk}; }

.st-drawer-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(15,23,42,0.06);
  border-radius: 8px;
  cursor: pointer;
  color: ${palette.ink700};
  font-size: 13px;
  margin-top: 8px;
  transition: background 0.15s;
}
[data-theme="dark"] .st-drawer-close {
  background: rgba(255,255,255,0.08);
  color: ${palette.darkInkMuted};
}
.st-drawer-close:active { background: rgba(31,111,235,0.10); }

.sc-card:hover { border-color: rgba(31,111,235,0.20); }
[data-theme="dark"] .sc-card:hover { border-color: rgba(96,165,250,0.30); }
`;

export default Settings;
