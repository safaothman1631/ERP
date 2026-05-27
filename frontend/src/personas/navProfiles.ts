import type { NavProfileId } from './types';
import type { NavSection } from '../layouts/navigation';

export interface NavProfileConfig {
  sectionOrder: string[];
  optionalSections?: string[];
  defaultCollapsed?: boolean;
  hideCreateFooter?: boolean;
  pinRoutes?: string[];
}

const ALL_SECTIONS = [
  'overview', 'sales', 'purchases', 'banking', 'inventory', 'manufacturing', 'pos',
  'hotel', 'restaurant', 'field-service', 'crm', 'marketing', 'hr', 'projects',
  'accounting', 'reports-mgt', 'multi-entity', 'iraq-int', 'ext-engagement',
  'ext-ops', 'rental', 'repairs', 'ext-platform', 'ext-vertical', 'setup',
] as const;

export const NAV_PROFILES: Record<NavProfileId, NavProfileConfig> = {
  full_admin: {
    sectionOrder: [...ALL_SECTIONS],
  },
  manager_business: {
    sectionOrder: ['overview', 'sales', 'purchases', 'inventory', 'crm', 'reports-mgt', 'accounting', 'setup'],
    optionalSections: ['banking', 'hr', 'projects'],
  },
  sales_cluster: {
    sectionOrder: ['overview', 'crm', 'sales', 'marketing', 'reports-mgt', 'setup'],
    optionalSections: ['inventory'],
    pinRoutes: ['/crm/leads', '/quotes/new'],
  },
  finance_cluster: {
    sectionOrder: ['overview', 'accounting', 'banking', 'sales', 'purchases', 'reports-mgt', 'iraq-int', 'setup'],
    optionalSections: ['multi-entity'],
    pinRoutes: ['/journals', '/banking/reconciliation'],
  },
  warehouse_cluster: {
    sectionOrder: ['overview', 'inventory', 'purchases', 'sales', 'manufacturing', 'setup'],
    optionalSections: ['pos'],
    pinRoutes: ['/inventory', '/purchase-orders'],
  },
  pos_minimal: {
    sectionOrder: ['overview', 'pos', 'sales', 'inventory', 'setup'],
    defaultCollapsed: true,
    pinRoutes: ['/pos'],
  },
  hr_cluster: {
    sectionOrder: ['overview', 'hr', 'projects', 'reports-mgt', 'setup'],
    optionalSections: ['accounting'],
    pinRoutes: ['/hr'],
  },
  personal_minimal: {
    sectionOrder: ['overview', 'projects', 'hr', 'purchases', 'setup'],
    optionalSections: ['ext-engagement'],
    hideCreateFooter: true,
  },
  readonly: {
    sectionOrder: ['overview', 'reports-mgt', 'accounting', 'sales', 'purchases', 'inventory', 'crm', 'hr'],
    hideCreateFooter: true,
  },
};

export function applyNavProfile(sections: NavSection[], profileId: NavProfileId): NavSection[] {
  const config = NAV_PROFILES[profileId] ?? NAV_PROFILES.full_admin;
  const allowed = new Set([...config.sectionOrder, ...(config.optionalSections ?? [])]);
  const order = new Map(config.sectionOrder.map((key, index) => [key, index]));

  return sections
    .filter((sec) => allowed.has(sec.key))
    .sort((a, b) => (order.get(a.key) ?? 999) - (order.get(b.key) ?? 999));
}

export function getNavProfileConfig(profileId: NavProfileId): NavProfileConfig {
  return NAV_PROFILES[profileId] ?? NAV_PROFILES.full_admin;
}
