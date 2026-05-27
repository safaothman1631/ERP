import type { ModuleKey } from '../../onboarding/industries';
import { isModuleEnabled } from '../../onboarding/store';
import { PLATFORM_ONLY_KEYS } from './platformOnlySections';
import {
  bindingMatchesAccountantScope,
  bindingMatchesSpecialistScope,
  isAccountantRole,
  isBasicEmployeeRole,
  isSpecialistRole,
} from './roleModuleScope';
import type { SectionBinding, SectionKey, SettingsRole } from './types';

const COMMERCE_OR_OPS_MODULES: readonly ModuleKey[] = [
  'sales',
  'crm',
  'purchase',
  'inventory',
  'manufacturing',
  'pos',
  'hr',
  'projects',
];

export const SECTION_BINDINGS: readonly SectionBinding[] = [
  // 4.1 Personal
  { key: 'profile', group: 'account', tier: 'personal', labelKey: 'profile', fallbackLabel: 'Profile' },
  { key: 'security', group: 'account', tier: 'personal', labelKey: 'security_settings', fallbackLabel: 'Security' },
  { key: 'notifications', group: 'account', tier: 'personal', labelKey: 'notification_preferences', fallbackLabel: 'Notifications' },
  { key: 'preferences', group: 'account', tier: 'personal', labelKey: 'settings_pref', fallbackLabel: 'Preferences' },

  // 4.2 General & organization
  { key: 'general', group: 'general_app', tier: 'org_write', labelKey: 'settings_general', fallbackLabel: 'General', permission: 'settings.update' },
  { key: 'appearance', group: 'general_app', tier: 'org_write', labelKey: 'settings_appearance', fallbackLabel: 'Appearance', permission: 'settings.update' },
  { key: 'organization', group: 'organization', tier: 'org_write', labelKey: 'organization_settings', fallbackLabel: 'Organization', permission: 'org.manage' },
  { key: 'branches', group: 'organization', tier: 'org_write', labelKey: 'branches', fallbackLabel: 'Branches', permission: 'settings.update' },
  { key: 'branding', group: 'organization', tier: 'org_write', labelKey: 'branding', fallbackLabel: 'Branding', permission: 'settings.update' },
  { key: 'working_hours', group: 'organization', tier: 'org_write', labelKey: 'working_hours', fallbackLabel: 'Working hours', permission: 'settings.update' },
  { key: 'holidays', group: 'organization', tier: 'org_write', labelKey: 'holidays', fallbackLabel: 'Public holidays', permission: 'settings.update' },

  // 4.3 Users & access
  { key: 'users', group: 'users', tier: 'org_write', labelKey: 'users', fallbackLabel: 'Users', permission: 'rbac.manage' },
  { key: 'roles', group: 'users', tier: 'org_write', labelKey: 'roles', fallbackLabel: 'Roles', permission: 'rbac.manage' },
  { key: 'permissions', group: 'users', tier: 'org_write', labelKey: 'permissions', fallbackLabel: 'Permissions', permission: 'rbac.manage' },
  { key: 'sso', group: 'users', tier: 'org_write', labelKey: 'sso', fallbackLabel: 'Single sign-on', permission: 'settings.update' },
  { key: 'portals', group: 'users', tier: 'org_write', labelKey: 'portals', fallbackLabel: 'Customer / Vendor portals', permission: 'settings.update' },

  // 4.4 Localization
  { key: 'localization', group: 'localization', tier: 'org_write', labelKey: 'localization', fallbackLabel: 'Localization', permission: 'settings.update' },
  { key: 'currencies', group: 'localization', tier: 'org_write', labelKey: 'currencies', fallbackLabel: 'Currencies', moduleGate: ['accounting'], permission: 'settings.update' },
  { key: 'languages', group: 'localization', tier: 'org_write', labelKey: 'languages', fallbackLabel: 'Languages', permission: 'settings.update' },
  { key: 'formats', group: 'localization', tier: 'org_write', labelKey: 'formats', fallbackLabel: 'Date & number formats', permission: 'settings.update' },

  // 4.5 Finance & compliance
  { key: 'fiscal', group: 'finance', tier: 'org_write', labelKey: 'fiscal_years', fallbackLabel: 'Fiscal years', moduleGate: ['accounting'], permission: 'settings.fiscal' },
  { key: 'budgets', group: 'finance', tier: 'org_write', labelKey: 'budgets', fallbackLabel: 'Budgets', moduleGate: ['accounting'], permission: 'accounts.budget' },
  { key: 'taxes', group: 'finance', tier: 'org_write', labelKey: 'taxes', fallbackLabel: 'Taxes', moduleGate: ['accounting'], permission: 'taxes.update' },
  { key: 'banking', group: 'finance', tier: 'org_write', labelKey: 'banking_settings', fallbackLabel: 'Banking', moduleGate: ['banking'], permission: 'bank.write' },
  { key: 'payment_methods', group: 'finance', tier: 'org_write', labelKey: 'payment_methods', fallbackLabel: 'Payment methods', moduleGate: ['sales', 'pos'], permission: 'settings.update' },
  { key: 'einvoice', group: 'finance', tier: 'org_write', labelKey: 'einvoice_settings', fallbackLabel: 'E-Invoice', moduleGate: ['einvoice'], permission: 'settings.update' },
  { key: 'templates', group: 'finance', tier: 'org_write', labelKey: 'invoice_templates', fallbackLabel: 'Invoice templates', moduleGate: ['sales'], permission: 'settings.update' },
  { key: 'reminders', group: 'finance', tier: 'org_write', labelKey: 'reminder_settings', fallbackLabel: 'Reminder settings', moduleGate: ['sales'], permission: 'settings.update' },

  // 4.6 Commerce
  { key: 'sales', group: 'commerce', tier: 'org_write', labelKey: 'sales_settings', fallbackLabel: 'Sales', moduleGate: ['sales'], permission: 'settings.update' },
  { key: 'crm', group: 'commerce', tier: 'org_write', labelKey: 'crm_settings', fallbackLabel: 'CRM', moduleGate: ['crm'], permission: 'settings.update' },
  { key: 'purchases', group: 'commerce', tier: 'org_write', labelKey: 'purchases_settings', fallbackLabel: 'Purchases', moduleGate: ['purchase'], permission: 'settings.update' },
  { key: 'inventory', group: 'commerce', tier: 'org_write', labelKey: 'inventory_settings', fallbackLabel: 'Inventory', moduleGate: ['inventory'], permission: 'settings.update' },
  { key: 'mrp', group: 'commerce', tier: 'org_write', labelKey: 'mrp_settings', fallbackLabel: 'Manufacturing', moduleGate: ['manufacturing'], permission: 'settings.update' },
  { key: 'pos', group: 'commerce', tier: 'org_write', labelKey: 'pos_settings', fallbackLabel: 'Point of Sale', moduleGate: ['pos'], permission: 'settings.update' },
  { key: 'ecommerce', group: 'commerce', tier: 'org_write', labelKey: 'ecommerce_settings', fallbackLabel: 'E-commerce', moduleGate: ['ext.subscriptions'], permission: 'settings.update' },
  { key: 'helpdesk', group: 'commerce', tier: 'org_write', labelKey: 'helpdesk_settings', fallbackLabel: 'Helpdesk', moduleGate: ['ext.helpdesk'], permission: 'settings.update' },

  // 4.7 Operations
  { key: 'hr', group: 'operations', tier: 'org_write', labelKey: 'hr_settings', fallbackLabel: 'Human resources', moduleGate: ['hr'], permission: 'settings.update' },
  { key: 'payroll', group: 'operations', tier: 'org_write', labelKey: 'payroll_settings', fallbackLabel: 'Payroll', moduleGate: ['hr'], permission: 'settings.update' },
  { key: 'projects', group: 'operations', tier: 'org_write', labelKey: 'projects_settings', fallbackLabel: 'Projects', moduleGate: ['projects'], permission: 'settings.update' },
  { key: 'marketing', group: 'operations', tier: 'org_write', labelKey: 'marketing_settings', fallbackLabel: 'Marketing', moduleGate: ['crm', 'sales'], permission: 'settings.update' },

  // 4.8 Automation & integrations
  { key: 'workflows', group: 'automation', tier: 'org_write', labelKey: 'workflows', fallbackLabel: 'Workflows', moduleGate: COMMERCE_OR_OPS_MODULES, permission: 'settings.update' },
  { key: 'approvals', group: 'automation', tier: 'org_write', labelKey: 'approvals', fallbackLabel: 'Approvals', moduleGate: ['sales', 'purchase', 'hr'], permission: 'settings.update' },
  { key: 'integrations', group: 'automation', tier: 'org_write', labelKey: 'integrations', fallbackLabel: 'Integrations', permission: 'settings.update' },
  { key: 'integrations_health', group: 'system', tier: 'org_read', labelKey: 'int_health_title', fallbackLabel: 'Integration health', permission: 'settings.read' },
  { key: 'webhooks', group: 'automation', tier: 'org_write', labelKey: 'webhooks', fallbackLabel: 'Webhooks', permission: 'settings.update' },
  { key: 'api_tokens', group: 'automation', tier: 'org_write', labelKey: 'api_tokens', fallbackLabel: 'API tokens', permission: 'settings.update' },

  // 4.9 Content & messaging
  { key: 'documents', group: 'content', tier: 'org_write', labelKey: 'documents', fallbackLabel: 'Documents', moduleGate: ['ext.documents'], permission: 'settings.update' },
  { key: 'numbering', group: 'content', tier: 'org_write', labelKey: 'numbering_sequences', fallbackLabel: 'Numbering', moduleGate: ['sales', 'purchase', 'inventory', 'hr'], permission: 'settings.numbering', route: '/settings/numbering' },
  { key: 'email', group: 'content', tier: 'org_write', labelKey: 'email_settings', fallbackLabel: 'Email', permission: 'settings.update' },
  { key: 'sms_whatsapp', group: 'content', tier: 'org_write', labelKey: 'sms_whatsapp', fallbackLabel: 'SMS & WhatsApp', moduleGate: ['whatsapp', 'ext.comms'], permission: 'settings.update' },

  // 4.10 System (tenant scope)
  { key: 'modules', group: 'system', tier: 'personal', labelKey: 'settings_additions.modules', fallbackLabel: 'Modules' },
  { key: 'module_requests', group: 'system', tier: 'org_write', labelKey: 'modreq_page_title', fallbackLabel: 'Module requests', permission: 'settings.update', route: '/settings/module-requests' },
  { key: 'backup', group: 'system', tier: 'org_write', labelKey: 'backup_settings', fallbackLabel: 'Backup', permission: 'settings.update' },
  { key: 'activity', group: 'system', tier: 'org_read', labelKey: 'system_log', fallbackLabel: 'Activity', permission: 'settings.read' },
  { key: 'audit', group: 'system', tier: 'org_write', labelKey: 'audit_compliance', fallbackLabel: 'Audit & compliance', permission: 'settings.update' },
  { key: 'gdpr', group: 'system', tier: 'org_write', labelKey: 'gdpr', fallbackLabel: 'Data privacy', permission: 'settings.update' },
  { key: 'mobile', group: 'system', tier: 'org_write', labelKey: 'mobile_app', fallbackLabel: 'Mobile app', moduleGate: ['ext.mobile'], permission: 'settings.update' },
  { key: 'system', group: 'system', tier: 'personal', labelKey: 'system_info', fallbackLabel: 'System info' },

  // 4.11 Platform-only
  { key: 'feature_flags', group: 'platform', tier: 'platform_only', labelKey: 'settings_feature_flags', fallbackLabel: 'Feature flags', permission: 'platform.admin', route: '/platform/feature-flags' },
];

export const MODULE_PRIMARY_SECTION: Partial<Record<ModuleKey, SectionKey>> = {
  accounting: 'fiscal',
  banking: 'banking',
  crm: 'crm',
  einvoice: 'einvoice',
  hr: 'hr',
  inventory: 'inventory',
  'l10n_iq': 'localization',
  manufacturing: 'mrp',
  pos: 'pos',
  projects: 'projects',
  purchase: 'purchases',
  sales: 'sales',
  whatsapp: 'sms_whatsapp',
  'ext.comms': 'sms_whatsapp',
  'ext.documents': 'documents',
  'ext.helpdesk': 'helpdesk',
  'ext.mobile': 'mobile',
  'ext.subscriptions': 'ecommerce',
};

const SECTION_BY_KEY: ReadonlyMap<SectionKey, SectionBinding> = new Map(
  SECTION_BINDINGS.map((binding) => [binding.key, binding]),
);

const TENANT_ADMIN_ROLES = new Set(['admin', 'owner', 'super_admin']);

function normalizePermissions(permissions: Iterable<string> | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!permissions) return out;
  for (const permission of permissions) {
    const normalized = permission.trim();
    if (normalized) out.add(normalized);
  }
  return out;
}

function hasPermission(permissionSet: Set<string>, required?: string): boolean {
  if (!required) return true;
  if (permissionSet.has('*') || permissionSet.has(required)) return true;
  const [prefix] = required.split('.');
  return permissionSet.has(`${prefix}.*`);
}

function isTenantOrgAdminRole(role: SettingsRole): boolean {
  return !!role && TENANT_ADMIN_ROLES.has(role);
}

function isEnabledForModules(binding: SectionBinding, enabledModules: ModuleKey[] | null | undefined): boolean {
  if (!binding.moduleGate || binding.moduleGate.length === 0) return true;
  const normalizedEnabled = enabledModules ?? [];
  return binding.moduleGate.some((moduleKey) => isModuleEnabled(moduleKey, normalizedEnabled));
}

function canReadOrgSettings(role: SettingsRole, permissionSet: Set<string>): boolean {
  return isTenantOrgAdminRole(role) || role === 'manager' || hasPermission(permissionSet, 'settings.update') || hasPermission(permissionSet, 'settings.read');
}

function canWriteOrgSettings(role: SettingsRole, permissionSet: Set<string>): boolean {
  return isTenantOrgAdminRole(role) || hasPermission(permissionSet, 'settings.update');
}

export function getBinding(sectionKey: SectionKey): SectionBinding | undefined {
  return SECTION_BY_KEY.get(sectionKey);
}

export function getSectionsForModule(moduleKey: ModuleKey): SectionBinding[] {
  return SECTION_BINDINGS.filter((binding) => binding.moduleGate?.includes(moduleKey));
}

export function getVisibleBindings(
  enabledModules: ModuleKey[] | null | undefined,
  role: SettingsRole,
  permissions: Iterable<string> | null | undefined,
  tenant = true,
): SectionBinding[] {
  const permissionSet = normalizePermissions(permissions);
  const canRead = canReadOrgSettings(role, permissionSet);

  return SECTION_BINDINGS.filter((binding) => {
    const isPlatformOnly = binding.tier === 'platform_only' || PLATFORM_ONLY_KEYS.includes(binding.key);
    if (tenant && isPlatformOnly) return false;
    if (!tenant && isPlatformOnly) {
      return hasPermission(permissionSet, binding.permission);
    }

    if (!isEnabledForModules(binding, enabledModules)) {
      return false;
    }

    switch (binding.tier) {
      case 'personal':
        return true;
      case 'org_read':
        return canRead || hasPermission(permissionSet, binding.permission);
      case 'org_write':
        if (isBasicEmployeeRole(role)) return false;
        if (isAccountantRole(role)) {
          return bindingMatchesAccountantScope(binding) && isEnabledForModules(binding, enabledModules);
        }
        if (isSpecialistRole(role)) {
          return bindingMatchesSpecialistScope(role, binding, enabledModules);
        }
        return canRead || hasPermission(permissionSet, binding.permission);
      case 'platform_only':
      default:
        return !tenant && hasPermission(permissionSet, binding.permission);
    }
  });
}

export function canEditBinding(
  binding: SectionBinding,
  role: SettingsRole,
  permissions: Iterable<string> | null | undefined,
): boolean {
  if (binding.tier === 'platform_only' || binding.tier === 'org_read') return false;
  if (binding.tier === 'personal') return true;
  const permissionSet = normalizePermissions(permissions);
  return canWriteOrgSettings(role, permissionSet) || hasPermission(permissionSet, binding.permission);
}
