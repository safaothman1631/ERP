import { palette } from './tokens';
import type { NavProfileId, QuickAction, RoleTheme, RoleThemeId } from '../personas/types';

const QA = {
  newInvoice: { id: 'new_invoice', labelKey: 'new_invoice', fallbackLabel: 'New invoice', route: '/invoices/new' },
  newQuote: { id: 'new_quote', labelKey: 'new_quote', fallbackLabel: 'New quote', route: '/quotes/new' },
  openPos: { id: 'open_pos', labelKey: 'pos.open_terminal', fallbackLabel: 'Open POS', route: '/pos' },
  settings: { id: 'settings', labelKey: 'settings', fallbackLabel: 'Settings', route: '/settings?s=organization' },
  moduleReq: { id: 'modules', labelKey: 'modreq_page_title', fallbackLabel: 'Module requests', route: '/settings/module-requests' },
  users: { id: 'users', labelKey: 'users', fallbackLabel: 'Users', route: '/settings?s=users' },
  journal: { id: 'journal', labelKey: 'journals', fallbackLabel: 'Journals', route: '/journals' },
  inventory: { id: 'inventory', labelKey: 'inventory', fallbackLabel: 'Inventory', route: '/inventory' },
  purchase: { id: 'po', labelKey: 'purchase_orders', fallbackLabel: 'Purchase orders', route: '/purchase-orders' },
  crm: { id: 'crm', labelKey: 'crm', fallbackLabel: 'CRM', route: '/crm/leads' },
  hr: { id: 'hr', labelKey: 'hr', fallbackLabel: 'HR', route: '/hr' },
  projects: { id: 'projects', labelKey: 'projects', fallbackLabel: 'Projects', route: '/projects' },
} satisfies Record<string, QuickAction>;

function buildRoleTheme(
  id: RoleThemeId,
  accent: string,
  accentMuted: string,
  navProfile: NavProfileId,
  defaultRoute: string,
  quickActions: QuickAction[],
  opts?: { isOwnerAccent?: boolean },
): RoleTheme {
  return {
    id,
    accent,
    accentMuted,
    glassBorderGlow: `0 0 0 1px ${accentMuted}, 0 12px 40px ${accent}26`,
    // Richer two-stop accent wash so each role's home reads as distinctly "theirs".
    heroGradientLight: `linear-gradient(135deg, ${accent}24 0%, ${accent}0D 38%, transparent 72%)`,
    heroGradientDark: `linear-gradient(135deg, ${accent}38 0%, ${accent}16 42%, transparent 74%)`,
    defaultRoute,
    navProfile,
    quickActions,
    isOwnerAccent: opts?.isOwnerAccent,
  };
}

export const ROLE_THEMES: Record<RoleThemeId, RoleTheme> = {
  executive: buildRoleTheme('executive', '#D97706', 'rgba(217,119,6,0.35)', 'full_admin', '/dashboard', [QA.settings, QA.moduleReq, QA.users], { isOwnerAccent: true }),
  administrator: buildRoleTheme('administrator', palette.primary500, 'rgba(31,111,235,0.35)', 'full_admin', '/dashboard', [QA.users, QA.settings, QA.moduleReq]),
  manager: buildRoleTheme('manager', '#0D9488', 'rgba(13,148,136,0.35)', 'manager_business', '/dashboard', [QA.newInvoice, QA.purchase]),
  finance: buildRoleTheme('finance', palette.success600, 'rgba(22,163,74,0.35)', 'finance_cluster', '/dashboard', [QA.journal, QA.newInvoice]),
  sales: buildRoleTheme('sales', palette.primary500, 'rgba(31,111,235,0.35)', 'sales_cluster', '/crm/leads', [QA.newQuote, QA.crm]),
  purchase: buildRoleTheme('purchase', '#7C3AED', 'rgba(124,58,237,0.35)', 'warehouse_cluster', '/purchase-orders', [QA.purchase]),
  inventory: buildRoleTheme('inventory', '#0891B2', 'rgba(8,145,178,0.35)', 'warehouse_cluster', '/inventory', [QA.inventory]),
  pos: buildRoleTheme('pos', palette.error500, 'rgba(220,38,38,0.35)', 'pos_minimal', '/pos', [QA.openPos]),
  hr: buildRoleTheme('hr', '#8B5CF6', 'rgba(139,92,246,0.35)', 'hr_cluster', '/hr', [QA.hr]),
  projects: buildRoleTheme('projects', '#6366F1', 'rgba(99,102,241,0.35)', 'personal_minimal', '/projects', [QA.projects]),
  personal: buildRoleTheme('personal', palette.ink500, 'rgba(100,116,139,0.25)', 'personal_minimal', '/dashboard', []),
  readonly: buildRoleTheme('readonly', '#94A3B8', 'rgba(148,163,184,0.2)', 'readonly', '/dashboard', []),
};

const ROLE_CODE_TO_THEME: Record<string, RoleThemeId> = {
  owner: 'executive',
  admin: 'administrator',
  super_admin: 'administrator',
  manager: 'manager',
  accountant: 'finance',
  sales: 'sales',
  sales_rep: 'sales',
  purchaser: 'purchase',
  inventory: 'inventory',
  inventory_manager: 'inventory',
  cashier: 'pos',
  pos_cashier: 'pos',
  pos_manager: 'pos',
  pos_admin: 'pos',
  hr: 'hr',
  hr_manager: 'hr',
  hr_employee: 'personal',
  project_manager: 'projects',
  viewer: 'readonly',
  user: 'personal',
};

export function resolveRoleThemeId(role: string | null, permissions: string[]): RoleThemeId {
  if (role && ROLE_CODE_TO_THEME[role]) {
    return ROLE_CODE_TO_THEME[role];
  }
  const set = new Set(permissions);
  if (set.has('settings.fiscal') || set.has('accounts.budget')) return 'finance';
  if (set.has('crm.read') || set.has('invoices.read')) return 'sales';
  if (set.has('pos.read') || set.has('pos.view')) return 'pos';
  if (set.has('hr.read')) return 'hr';
  if (set.has('settings.read') && !set.has('settings.update')) return 'readonly';
  return 'personal';
}

export function resolveRoleTheme(role: string | null, permissions: string[]): RoleTheme {
  return ROLE_THEMES[resolveRoleThemeId(role, permissions)];
}
