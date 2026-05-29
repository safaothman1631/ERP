import type { ModuleKey } from '../../onboarding/industries';
import { isModuleEnabled } from '../../onboarding/store';
import { getSectionsForModule, MODULE_PRIMARY_SECTION } from './moduleSettingsRegistry';
import type { SectionBinding, SectionKey, SettingsRole } from './types';

const ROLE_ALIASES: Record<string, string> = {
  sales_rep: 'sales',
  inventory_manager: 'inventory',
  cashier: 'pos_cashier',
  pos_manager: 'pos_cashier',
  hr_manager: 'hr',
  warehouse: 'inventory',
};

/** Map legacy JWT role codes to canonical settings specialist roles. */
export function normalizeSettingsRole(role: string): string {
  return ROLE_ALIASES[role] ?? role;
}

/** Primary module a specialist role may view (read-only) in Settings. */
export const ROLE_MODULE_SCOPE: Partial<Record<string, ModuleKey>> = {
  sales: 'sales',
  sales_rep: 'sales',
  purchaser: 'purchase',
  inventory: 'inventory',
  inventory_manager: 'inventory',
  warehouse: 'inventory',
  pos_cashier: 'pos',
  cashier: 'pos',
  pos_manager: 'pos',
  hr: 'hr',
  hr_manager: 'hr',
};

export const BASIC_EMPLOYEE_ROLES = new Set(['viewer', 'user']);

export const SPECIALIST_ROLES = new Set([
  'sales',
  'purchaser',
  'inventory',
  'warehouse',
  'pos_cashier',
  'accountant',
  'hr',
]);

export const ACCOUNTANT_FINANCE_SECTIONS: readonly SectionKey[] = [
  'fiscal',
  'budgets',
  'taxes',
  'banking',
  'currencies',
];

export function isBasicEmployeeRole(role: SettingsRole): boolean {
  return !!role && BASIC_EMPLOYEE_ROLES.has(role);
}

export function isSpecialistRole(role: SettingsRole): boolean {
  return !!role && SPECIALIST_ROLES.has(normalizeSettingsRole(role));
}

export function isAccountantRole(role: SettingsRole): boolean {
  return role === 'accountant';
}

export function bindingMatchesAccountantScope(binding: SectionBinding): boolean {
  return ACCOUNTANT_FINANCE_SECTIONS.includes(binding.key);
}

export function bindingMatchesSpecialistScope(
  role: SettingsRole,
  binding: SectionBinding,
  enabledModules: ModuleKey[] | null | undefined,
): boolean {
  if (!role) return false;
  const scopedModule = ROLE_MODULE_SCOPE[normalizeSettingsRole(role)];
  if (!scopedModule) return false;
  if (!isModuleEnabled(scopedModule, enabledModules ?? [])) return false;
  if (binding.key === MODULE_PRIMARY_SECTION[scopedModule]) return true;
  if (binding.moduleGate?.includes(scopedModule)) return true;
  return getSectionsForModule(scopedModule).some((section) => section.key === binding.key);
}
