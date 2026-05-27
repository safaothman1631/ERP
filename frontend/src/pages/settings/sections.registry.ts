/**
 * Settings sections registry — Phase P5 (Settings decomposition).
 *
 * Maps each settings sectionKey to a lazy importer and metadata. The
 * SettingsShell reads this registry, renders sidebar entries, and lazy-loads
 * the active section body via React.lazy + Suspense.
 *
 * Spec: world-class-performance R8.1 (one file per section), R8.3 (lazy load).
 *
 * NOTE: This is the new, in-progress registry created during P5. The existing
 * monolithic `frontend/src/settings/sections/bodies.tsx` (4,605 LOC) is the
 * legacy path; sections are migrated here one-by-one per the plan in
 * `docs/settings/migration-plan.md`. Sections not yet migrated point at a
 * placeholder importer that renders a `TODO: migrate` notice.
 */

import type { ComponentType, LazyExoticComponent } from 'react';
import { lazy } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Top-level grouping in the sidebar. Mirrors the legacy `SectionGroup`. */
export type SectionGroup =
  | 'account'
  | 'general'
  | 'organization'
  | 'users'
  | 'localization'
  | 'finance'
  | 'commerce'
  | 'operations'
  | 'automation'
  | 'content'
  | 'system';

/** A single registry entry. */
export interface SectionDef {
  /** i18n key for the section's display title (namespace `settings`). */
  titleKey: string;
  /** Fallback English label, used if the i18n key is missing. */
  fallbackTitle: string;
  /** i18n key for a one-line subtitle (optional). */
  subtitleKey?: string;
  /** Group used for sidebar grouping. */
  group: SectionGroup;
  /** React.lazy importer for the section body. */
  loader: LazyExoticComponent<ComponentType<Record<string, never>>>;
  /** Optional feature-flag gate. Returning `false` hides the entry. */
  enabled?: () => boolean;
  /** Optional permission gate (RBAC code, e.g. `settings.users.manage`). */
  permission?: string;
  /** Optional badge to render next to the title. */
  badge?: 'new' | 'beta' | 'soon';
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy importers
// ─────────────────────────────────────────────────────────────────────────────

// Migrated sections (real implementations exist under `./sections/`)
const CompanyInfo = lazy(() => import('./sections/general/CompanyInfo'));
const Localization = lazy(() => import('./sections/general/Localization'));
const Branding = lazy(() => import('./sections/general/Branding'));

// Placeholder for not-yet-migrated sections — keeps the registry shape valid
// and produces a friendly "TODO: migrate from bodies.tsx" notice at runtime.
const TODO = lazy(() => import('./sections/_template/TodoPlaceholder'));

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const SECTIONS: Record<string, SectionDef> = {
  // ── Account ────────────────────────────────────────────────────────────
  'account.profile': {
    titleKey: 'settings.profile',
    fallbackTitle: 'Profile',
    subtitleKey: 'settings.profile.subtitle',
    group: 'account',
    loader: TODO,
  },
  'account.security': {
    titleKey: 'settings.security',
    fallbackTitle: 'Security',
    group: 'account',
    loader: TODO,
  },
  'account.notifications': {
    titleKey: 'settings.notifications',
    fallbackTitle: 'Notifications',
    group: 'account',
    loader: TODO,
  },
  'account.preferences': {
    titleKey: 'settings.preferences',
    fallbackTitle: 'Preferences',
    group: 'account',
    loader: TODO,
  },

  // ── General ────────────────────────────────────────────────────────────
  'general.company': {
    titleKey: 'settings.company',
    fallbackTitle: 'Company',
    subtitleKey: 'settings.company.subtitle',
    group: 'general',
    loader: CompanyInfo,
  },
  'general.localization': {
    titleKey: 'settings.localization',
    fallbackTitle: 'Localization',
    subtitleKey: 'settings.localization.subtitle',
    group: 'general',
    loader: Localization,
  },
  'general.branding': {
    titleKey: 'settings.branding',
    fallbackTitle: 'Branding',
    subtitleKey: 'settings.branding.subtitle',
    group: 'general',
    loader: Branding,
  },
  'general.appearance': {
    titleKey: 'settings.appearance',
    fallbackTitle: 'Appearance',
    group: 'general',
    loader: TODO,
  },
  'general.feature_flags': {
    titleKey: 'settings.feature_flags',
    fallbackTitle: 'Feature flags',
    group: 'general',
    loader: TODO,
  },

  // ── Organization ───────────────────────────────────────────────────────
  'organization.branches': {
    titleKey: 'settings.branches',
    fallbackTitle: 'Branches',
    group: 'organization',
    loader: TODO,
  },
  'organization.working_hours': {
    titleKey: 'settings.working_hours',
    fallbackTitle: 'Working hours',
    group: 'organization',
    loader: TODO,
  },
  'organization.holidays': {
    titleKey: 'settings.holidays',
    fallbackTitle: 'Holidays',
    group: 'organization',
    loader: TODO,
  },

  // ── Users & access ─────────────────────────────────────────────────────
  'users.users': {
    titleKey: 'settings.users',
    fallbackTitle: 'Users',
    group: 'users',
    loader: TODO,
    permission: 'settings.users.manage',
  },
  'users.roles': {
    titleKey: 'settings.roles',
    fallbackTitle: 'Roles',
    group: 'users',
    loader: TODO,
  },
  'users.permissions': {
    titleKey: 'settings.permissions',
    fallbackTitle: 'Permissions',
    group: 'users',
    loader: TODO,
  },
  'users.sso': {
    titleKey: 'settings.sso',
    fallbackTitle: 'SSO',
    group: 'users',
    loader: TODO,
    badge: 'beta',
  },
  'users.portals': {
    titleKey: 'settings.portals',
    fallbackTitle: 'Portals',
    group: 'users',
    loader: TODO,
  },

  // ── Localization ───────────────────────────────────────────────────────
  'localization.currencies': {
    titleKey: 'settings.currencies',
    fallbackTitle: 'Currencies',
    group: 'localization',
    loader: TODO,
  },
  'localization.languages': {
    titleKey: 'settings.languages',
    fallbackTitle: 'Languages',
    group: 'localization',
    loader: TODO,
  },
  'localization.formats': {
    titleKey: 'settings.formats',
    fallbackTitle: 'Formats',
    group: 'localization',
    loader: TODO,
  },

  // ── Finance & compliance ───────────────────────────────────────────────
  'finance.fiscal': {
    titleKey: 'settings.fiscal',
    fallbackTitle: 'Fiscal years',
    group: 'finance',
    loader: TODO,
  },
  'finance.budgets': {
    titleKey: 'settings.budgets',
    fallbackTitle: 'Budgets',
    group: 'finance',
    loader: TODO,
  },
  'finance.taxes': {
    titleKey: 'settings.taxes',
    fallbackTitle: 'Taxes',
    group: 'finance',
    loader: TODO,
  },
  'finance.banking': {
    titleKey: 'settings.banking',
    fallbackTitle: 'Banking',
    group: 'finance',
    loader: TODO,
  },
  'finance.payment_methods': {
    titleKey: 'settings.payment_methods',
    fallbackTitle: 'Payment methods',
    group: 'finance',
    loader: TODO,
  },
  'finance.einvoice': {
    titleKey: 'settings.einvoice',
    fallbackTitle: 'E-invoice (Iraq)',
    group: 'finance',
    loader: TODO,
  },
  'finance.templates': {
    titleKey: 'settings.templates',
    fallbackTitle: 'Invoice templates',
    group: 'finance',
    loader: TODO,
  },
  'finance.reminders': {
    titleKey: 'settings.reminders',
    fallbackTitle: 'Reminders',
    group: 'finance',
    loader: TODO,
  },

  // ── Commerce ───────────────────────────────────────────────────────────
  'commerce.sales': {
    titleKey: 'settings.sales',
    fallbackTitle: 'Sales',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.crm': {
    titleKey: 'settings.crm',
    fallbackTitle: 'CRM',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.purchases': {
    titleKey: 'settings.purchases',
    fallbackTitle: 'Purchases',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.inventory': {
    titleKey: 'settings.inventory',
    fallbackTitle: 'Inventory',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.mrp': {
    titleKey: 'settings.mrp',
    fallbackTitle: 'Manufacturing',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.pos': {
    titleKey: 'settings.pos',
    fallbackTitle: 'POS',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.ecommerce': {
    titleKey: 'settings.ecommerce',
    fallbackTitle: 'E-commerce',
    group: 'commerce',
    loader: TODO,
  },
  'commerce.helpdesk': {
    titleKey: 'settings.helpdesk',
    fallbackTitle: 'Helpdesk',
    group: 'commerce',
    loader: TODO,
  },

  // ── Operations ─────────────────────────────────────────────────────────
  'operations.hr': {
    titleKey: 'settings.hr',
    fallbackTitle: 'HR',
    group: 'operations',
    loader: TODO,
  },
  'operations.payroll': {
    titleKey: 'settings.payroll',
    fallbackTitle: 'Payroll',
    group: 'operations',
    loader: TODO,
  },
  'operations.projects': {
    titleKey: 'settings.projects',
    fallbackTitle: 'Projects',
    group: 'operations',
    loader: TODO,
  },
  'operations.marketing': {
    titleKey: 'settings.marketing',
    fallbackTitle: 'Marketing',
    group: 'operations',
    loader: TODO,
  },

  // ── Automation & API ───────────────────────────────────────────────────
  'automation.workflows': {
    titleKey: 'settings.workflows',
    fallbackTitle: 'Workflows',
    group: 'automation',
    loader: TODO,
  },
  'automation.approvals': {
    titleKey: 'settings.approvals',
    fallbackTitle: 'Approvals',
    group: 'automation',
    loader: TODO,
  },
  'automation.integrations': {
    titleKey: 'settings.integrations',
    fallbackTitle: 'Integrations',
    group: 'automation',
    loader: TODO,
  },
  'automation.webhooks': {
    titleKey: 'settings.webhooks',
    fallbackTitle: 'Webhooks',
    group: 'automation',
    loader: TODO,
  },
  'automation.api_tokens': {
    titleKey: 'settings.api_tokens',
    fallbackTitle: 'API tokens',
    group: 'automation',
    loader: TODO,
  },

  // ── Content ────────────────────────────────────────────────────────────
  'content.documents': {
    titleKey: 'settings.documents',
    fallbackTitle: 'Documents',
    group: 'content',
    loader: TODO,
  },
  'content.email': {
    titleKey: 'settings.email',
    fallbackTitle: 'Email (SMTP)',
    group: 'content',
    loader: TODO,
  },
  'content.sms_whatsapp': {
    titleKey: 'settings.sms_whatsapp',
    fallbackTitle: 'SMS & WhatsApp',
    group: 'content',
    loader: TODO,
  },

  // ── System ─────────────────────────────────────────────────────────────
  'system.modules': {
    titleKey: 'settings.modules',
    fallbackTitle: 'Modules',
    group: 'system',
    loader: TODO,
  },
  'system.backup': {
    titleKey: 'settings.backup',
    fallbackTitle: 'Backup & restore',
    group: 'system',
    loader: TODO,
  },
  'system.activity': {
    titleKey: 'settings.activity',
    fallbackTitle: 'Activity log',
    group: 'system',
    loader: TODO,
  },
  'system.audit': {
    titleKey: 'settings.audit',
    fallbackTitle: 'Audit',
    group: 'system',
    loader: TODO,
  },
  'system.gdpr': {
    titleKey: 'settings.gdpr',
    fallbackTitle: 'GDPR',
    group: 'system',
    loader: TODO,
  },
  'system.mobile': {
    titleKey: 'settings.mobile',
    fallbackTitle: 'Mobile',
    group: 'system',
    loader: TODO,
  },
  'system.system_info': {
    titleKey: 'settings.system',
    fallbackTitle: 'System info',
    group: 'system',
    loader: TODO,
  },
};

/** Ordered list of groups for rendering. */
export const GROUP_ORDER: readonly SectionGroup[] = [
  'account',
  'general',
  'organization',
  'users',
  'localization',
  'finance',
  'commerce',
  'operations',
  'automation',
  'content',
  'system',
] as const;

/** Default section key (first visible in the registry). */
export const DEFAULT_SECTION_KEY = 'general.company';

/** Resolve a section by key, or `null` if unknown / gated off. */
export function getSection(key: string): SectionDef | null {
  const def = SECTIONS[key];
  if (!def) return null;
  if (def.enabled && !def.enabled()) return null;
  return def;
}

/** All section keys in stable, group-aware order. */
export function listSectionKeys(): string[] {
  const byGroup = new Map<SectionGroup, string[]>();
  for (const [key, def] of Object.entries(SECTIONS)) {
    if (def.enabled && !def.enabled()) continue;
    const arr = byGroup.get(def.group) ?? [];
    arr.push(key);
    byGroup.set(def.group, arr);
  }
  const out: string[] = [];
  for (const g of GROUP_ORDER) out.push(...(byGroup.get(g) ?? []));
  return out;
}
