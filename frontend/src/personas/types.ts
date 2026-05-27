export type RoleThemeId =
  | 'executive'
  | 'administrator'
  | 'manager'
  | 'finance'
  | 'sales'
  | 'purchase'
  | 'inventory'
  | 'pos'
  | 'hr'
  | 'projects'
  | 'personal'
  | 'readonly';

export type NavProfileId =
  | 'full_admin'
  | 'manager_business'
  | 'sales_cluster'
  | 'finance_cluster'
  | 'warehouse_cluster'
  | 'pos_minimal'
  | 'hr_cluster'
  | 'personal_minimal'
  | 'readonly';

export interface QuickAction {
  id: string;
  labelKey: string;
  fallbackLabel: string;
  route: string;
  permission?: string;
}

export interface RoleTheme {
  id: RoleThemeId;
  accent: string;
  accentMuted: string;
  glassBorderGlow: string;
  heroGradientLight: string;
  heroGradientDark: string;
  defaultRoute: string;
  navProfile: NavProfileId;
  quickActions: QuickAction[];
  isOwnerAccent?: boolean;
}

export interface RolePersona {
  roleCode: string;
  labelKey: string;
  fallbackLabel: string;
  descriptionKey: string;
  canKeys: readonly string[];
  cannotKeys: readonly string[];
}

export interface RoleUxContext {
  theme: RoleTheme;
  persona: RolePersona;
  roleLabel: string;
}
