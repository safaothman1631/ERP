import type { ModuleKey } from '../../onboarding/industries';

export type SettingsTier = 'personal' | 'org_read' | 'org_write' | 'platform_only';

export type SectionGroup =
  | 'account'
  | 'general_app'
  | 'organization'
  | 'users'
  | 'localization'
  | 'finance'
  | 'commerce'
  | 'operations'
  | 'automation'
  | 'content'
  | 'system'
  | 'platform';

export type SectionKey =
  | 'profile'
  | 'security'
  | 'notifications'
  | 'preferences'
  | 'general'
  | 'appearance'
  | 'organization'
  | 'branches'
  | 'branding'
  | 'working_hours'
  | 'holidays'
  | 'users'
  | 'roles'
  | 'permissions'
  | 'sso'
  | 'portals'
  | 'localization'
  | 'currencies'
  | 'languages'
  | 'formats'
  | 'fiscal'
  | 'budgets'
  | 'taxes'
  | 'banking'
  | 'payment_methods'
  | 'einvoice'
  | 'templates'
  | 'reminders'
  | 'sales'
  | 'crm'
  | 'purchases'
  | 'inventory'
  | 'mrp'
  | 'pos'
  | 'ecommerce'
  | 'helpdesk'
  | 'hr'
  | 'payroll'
  | 'projects'
  | 'marketing'
  | 'workflows'
  | 'approvals'
  | 'integrations'
  | 'integrations_health'
  | 'webhooks'
  | 'api_tokens'
  | 'documents'
  | 'numbering'
  | 'email'
  | 'sms_whatsapp'
  | 'modules'
  | 'module_requests'
  | 'backup'
  | 'activity'
  | 'audit'
  | 'gdpr'
  | 'mobile'
  | 'system'
  | 'feature_flags';

export interface SectionBinding {
  key: SectionKey;
  group: SectionGroup;
  tier: SettingsTier;
  labelKey: string;
  fallbackLabel: string;
  moduleGate?: readonly ModuleKey[];
  permission?: string;
  route?: string;
}

export type SettingsRole = string | null | undefined;
