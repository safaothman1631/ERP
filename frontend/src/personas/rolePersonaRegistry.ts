import type { RolePersona } from './types';

const PERSONAS: Record<string, RolePersona> = {
  owner: {
    roleCode: 'owner',
    labelKey: 'roles.owner',
    fallbackLabel: 'Owner',
    descriptionKey: 'persona.owner.desc',
    canKeys: ['persona.owner.can_1', 'persona.owner.can_2', 'persona.owner.can_3'],
    cannotKeys: ['persona.owner.cannot_1', 'persona.owner.cannot_2'],
  },
  admin: {
    roleCode: 'admin',
    labelKey: 'roles.admin',
    fallbackLabel: 'Administrator',
    descriptionKey: 'persona.admin.desc',
    canKeys: ['persona.admin.can_1', 'persona.admin.can_2', 'persona.admin.can_3'],
    cannotKeys: ['persona.admin.cannot_1'],
  },
  manager: {
    roleCode: 'manager',
    labelKey: 'roles.manager',
    fallbackLabel: 'Manager',
    descriptionKey: 'persona.manager.desc',
    canKeys: ['persona.manager.can_1', 'persona.manager.can_2'],
    cannotKeys: ['persona.manager.cannot_1'],
  },
  accountant: {
    roleCode: 'accountant',
    labelKey: 'roles.accountant',
    fallbackLabel: 'Accountant',
    descriptionKey: 'persona.finance.desc',
    canKeys: ['persona.finance.can_1', 'persona.finance.can_2'],
    cannotKeys: ['persona.finance.cannot_1'],
  },
  sales: {
    roleCode: 'sales',
    labelKey: 'roles.sales',
    fallbackLabel: 'Sales',
    descriptionKey: 'persona.sales.desc',
    canKeys: ['persona.sales.can_1', 'persona.sales.can_2'],
    cannotKeys: ['persona.sales.cannot_1'],
  },
  sales_rep: {
    roleCode: 'sales_rep',
    labelKey: 'roles.sales_rep',
    fallbackLabel: 'Sales representative',
    descriptionKey: 'persona.sales.desc',
    canKeys: ['persona.sales.can_1', 'persona.sales.can_2'],
    cannotKeys: ['persona.sales.cannot_1'],
  },
  purchaser: {
    roleCode: 'purchaser',
    labelKey: 'roles.purchaser',
    fallbackLabel: 'Purchaser',
    descriptionKey: 'persona.purchase.desc',
    canKeys: ['persona.purchase.can_1'],
    cannotKeys: ['persona.purchase.cannot_1'],
  },
  inventory: {
    roleCode: 'inventory',
    labelKey: 'roles.inventory',
    fallbackLabel: 'Inventory manager',
    descriptionKey: 'persona.inventory.desc',
    canKeys: ['persona.inventory.can_1'],
    cannotKeys: ['persona.inventory.cannot_1'],
  },
  cashier: {
    roleCode: 'cashier',
    labelKey: 'roles.cashier',
    fallbackLabel: 'Cashier',
    descriptionKey: 'persona.pos.desc',
    canKeys: ['persona.pos.can_1'],
    cannotKeys: ['persona.pos.cannot_1'],
  },
  pos_cashier: {
    roleCode: 'pos_cashier',
    labelKey: 'roles.pos_cashier',
    fallbackLabel: 'POS cashier',
    descriptionKey: 'persona.pos.desc',
    canKeys: ['persona.pos.can_1'],
    cannotKeys: ['persona.pos.cannot_1'],
  },
  hr: {
    roleCode: 'hr',
    labelKey: 'roles.hr',
    fallbackLabel: 'HR',
    descriptionKey: 'persona.hr.desc',
    canKeys: ['persona.hr.can_1'],
    cannotKeys: ['persona.hr.cannot_1'],
  },
  hr_manager: {
    roleCode: 'hr_manager',
    labelKey: 'roles.hr_manager',
    fallbackLabel: 'HR manager',
    descriptionKey: 'persona.hr.desc',
    canKeys: ['persona.hr.can_1'],
    cannotKeys: ['persona.hr.cannot_1'],
  },
  viewer: {
    roleCode: 'viewer',
    labelKey: 'roles.viewer',
    fallbackLabel: 'Viewer',
    descriptionKey: 'persona.viewer.desc',
    canKeys: ['persona.viewer.can_1'],
    cannotKeys: ['persona.viewer.cannot_1', 'persona.viewer.cannot_2'],
  },
  user: {
    roleCode: 'user',
    labelKey: 'roles.user',
    fallbackLabel: 'Employee',
    descriptionKey: 'persona.personal.desc',
    canKeys: ['persona.personal.can_1'],
    cannotKeys: ['persona.personal.cannot_1'],
  },
};

const DEFAULT_PERSONA: RolePersona = PERSONAS.user;

export function resolveRolePersona(role: string | null): RolePersona {
  if (!role) return DEFAULT_PERSONA;
  return PERSONAS[role] ?? DEFAULT_PERSONA;
}
