import React from 'react';
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
import IntegrationHealthSection from './IntegrationHealthSection';

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
    {active === 'integrations_health' && <IntegrationHealthSection />}
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
