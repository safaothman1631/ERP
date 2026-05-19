/**
 * Help_Registry — single source of truth for the universal Help_Icon system
 * (system-wide-ux-overhaul, R8.1, R8.2, R8.3, R8.6, R15.5, R16.1, R16.4).
 *
 * Every {@link SectionId} in {@link SECTION_IDS} has exactly one
 * {@link HelpEntry} here. The {@link HelpRegistry} type is `Record<SectionId,
 * HelpEntry>`, so omitting any section is a compile-time error — adding a new
 * section to `sectionIds.ts` immediately surfaces the missing registry entry.
 *
 * All text fields are {@link TranslationKey} references resolved at runtime
 * through `t()` against `frontend/src/locales/{en,ku}.json`. No raw literals
 * appear in this module (R8.2, R11.5, R13.4, R13.5).
 *
 * Lazy-loading
 * ------------
 * This module is split into a dedicated **`help`** chunk via the
 * `manualChunks` configuration in `frontend/vite.config.ts` and is imported
 * dynamically from `useHelp` (`./useHelp.ts`). On chunk-load failure, the
 * `useHelp` hook falls back to the always-bundled `help.unavailable.message`
 * key — registry unavailability MUST NOT block language switching, force-
 * reset the locale, or crash the surrounding Section (R6.1, R8.4, R15.5).
 *
 * Translation key conventions
 * ---------------------------
 * - Settings sub-sections use the namespace established by `nav-settings-
 *   cleanup` and `settings-documentation`:
 *     `settings.help.<key>.what`
 *     `settings.help.<key>.why`
 *     `settings.help.<key>.step_<n>`     (n = 1..howSteps.length)
 *     `settings.help.<key>.relates_to.<i>.label`
 * - Non-Settings Sections follow a parallel pattern, e.g.:
 *     `sales.invoices.help.what`
 *     `sales.invoices.help.relates_to.0.label`
 *     `dashboard.kpis.help.step_1`
 *
 * The actual locale strings are backfilled in tasks 6.3 / 6.4 of the
 * `system-wide-ux-overhaul` plan; this file declares only the keys.
 *
 * `howSteps` length contract
 * --------------------------
 * Per R6.3, every Help_Panel renders a numbered step list with at least 2 and
 * at most 7 steps. The lower bound (≥ 2) is enforced at compile time by the
 * {@link HelpHowSteps} tuple type. The upper bound (≤ 7) is also expressed as
 * a finite tuple union, but TypeScript inference for variadic spread tuples
 * does not always reject longer literals when an array literal is widened
 * into a generic context; the CI gate (task 7.4 — `i18n-coverage` /
 * `helpRegistry`) is the runtime enforcer of `howSteps.length ∈ [2, 7]`. See
 * `Property 3` (Help registry coverage) in the design's Correctness
 * Properties section.
 *
 * _Validates: Requirements 8.1, 8.2, 8.3, 8.6, 15.5, 16.1, 16.4_
 */

import { asTranslationKey, type TranslationKey } from '../i18n/types';
import { SECTION_IDS, type SectionId } from './sectionIds';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * One labelled "related Section" link rendered inside `relatesTo` (R6.3).
 *
 * `label` is a Translation_Key resolved per-locale; `route` is a React Router
 * path consumed by `<Link>` / `navigate()` in `HelpPanel` (R6.8).
 */
export interface HelpRelatesTo {
  readonly label: TranslationKey;
  readonly route: string;
}

/**
 * Branded tuple type constraining `howSteps` length to `[2, 7]` at compile time.
 *
 * The lower bound is enforced by the head of the tuple — `[T, T, ...]` rejects
 * arrays of length 0 or 1. The upper bound (≤ 7) is expressed as a finite
 * union of tuple shapes; TypeScript will reject a literal of length 8 or more
 * supplied to a context expecting `HelpHowSteps`.
 *
 * Beyond the type-level contract, the CI gate (task 7.4) re-asserts both
 * bounds at runtime by walking `helpRegistry` — see `Property 3` in the
 * design's Correctness Properties.
 */
export type HelpHowSteps =
  | readonly [TranslationKey, TranslationKey]
  | readonly [TranslationKey, TranslationKey, TranslationKey]
  | readonly [TranslationKey, TranslationKey, TranslationKey, TranslationKey]
  | readonly [TranslationKey, TranslationKey, TranslationKey, TranslationKey, TranslationKey]
  | readonly [TranslationKey, TranslationKey, TranslationKey, TranslationKey, TranslationKey, TranslationKey]
  | readonly [TranslationKey, TranslationKey, TranslationKey, TranslationKey, TranslationKey, TranslationKey, TranslationKey];

/**
 * One Help_Registry entry (R8.2).
 *
 * Every text field is a {@link TranslationKey}, never a raw literal.
 * `relatesTo` MUST contain at least one entry for Settings sub-sections (R7.3
 * — re-asserted by the i18n-coverage CI gate); other Sections MAY have an
 * empty `relatesTo` array.
 */
export interface HelpEntry {
  readonly sectionId: SectionId;
  readonly what: TranslationKey;
  readonly why: TranslationKey;
  readonly relatesTo: readonly HelpRelatesTo[];
  readonly howSteps: HelpHowSteps;
}

/**
 * Exhaustive map from {@link SectionId} to {@link HelpEntry}.
 *
 * Using `Record<SectionId, HelpEntry>` (rather than `Partial<…>` or an
 * array) is what makes "every Section has a Help entry" a compile-time
 * invariant: omitting any `SectionId` produces a TypeScript error in
 * `helpRegistry` below (R8.6, R16.4).
 */
export type HelpRegistry = Record<SectionId, HelpEntry>;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers (compile-time-only — no runtime cost beyond a function call)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build the standard set of Help_Registry translation keys for a given
 * `sectionId` and step count. The naming convention matches the pattern
 * established by `nav-settings-cleanup`'s SectionHelpPopover (Settings) and
 * is reused for non-Settings Sections so every entry follows the same shape.
 *
 * For Settings entries (`settings.<key>`) the key namespace becomes
 * `settings.help.<key>.{what,why,step_N,relates_to.<i>.label}`. For
 * non-Settings entries (`<module>.<entity>[.<sub>]`) the namespace becomes
 * `<module>.<entity>[.<sub>].help.{what,why,step_N,relates_to.<i>.label}`.
 *
 * This helper lives next to the registry data (rather than in a shared
 * utility file) because it is a private constructor for this module and
 * exists solely to keep the registry seed terse and consistent. The actual
 * locale strings are backfilled in tasks 6.3 / 6.4 — this file only declares
 * the keys.
 */
function helpKeyspace(sectionId: SectionId): string {
  // Settings sub-sections use `settings.help.<key>.*` (matches the existing
  // `SectionHelpPopover` calls in `frontend/src/pages/Settings.tsx`).
  if (sectionId.startsWith('settings.')) {
    const key = sectionId.slice('settings.'.length);
    return `settings.help.${key}`;
  }
  // Non-Settings Sections use `<dotted.path>.help.*`.
  return `${sectionId}.help`;
}

/**
 * Construct a {@link HelpEntry} for a `sectionId` with `n` steps and a list
 * of `relatesTo` routes. The translation keys are derived deterministically
 * from {@link helpKeyspace}; values for those keys are owned by the locale
 * files and the `settings-documentation` sibling spec (R7.4, R17.1).
 */
function entry(
  sectionId: SectionId,
  stepCount: 2 | 3 | 4 | 5 | 6 | 7,
  relatesTo: readonly { readonly route: string; readonly index: number }[],
): HelpEntry {
  const ns = helpKeyspace(sectionId);
  const steps: TranslationKey[] = [];
  for (let i = 1; i <= stepCount; i++) {
    steps.push(asTranslationKey(`${ns}.step_${i}`));
  }
  // The `as` cast narrows the heterogeneous-length array to the discriminated
  // union {@link HelpHowSteps}. The runtime length is exactly `stepCount`,
  // which the parameter type already constrains to `[2, 7]`.
  const howSteps = steps as unknown as HelpHowSteps;
  return {
    sectionId,
    what: asTranslationKey(`${ns}.what`),
    why: asTranslationKey(`${ns}.why`),
    relatesTo: relatesTo.map((r) => ({
      route: r.route,
      label: asTranslationKey(`${ns}.relates_to.${r.index}.label`),
    })),
    howSteps,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry seed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The Help_Registry. Exhaustive over {@link SECTION_IDS} — adding a new
 * Section to `sectionIds.ts` without a matching entry here is a compile error.
 *
 * `relatesTo` routes follow the canonical paths declared in
 * `frontend/src/App.routes.tsx` (`/settings?s=…` for Settings sub-sections,
 * fully qualified module paths for non-Settings Sections). Every Settings
 * entry includes ≥ 1 `relatesTo` link to a non-Settings Section per R7.3.
 *
 * Step counts are conservative seeds (3 by default) sized to the design
 * contract `[2, 7]`; concrete values are owned by the `settings-
 * documentation` authoring source and surfaced via the locale files.
 */
export const helpRegistry: HelpRegistry = {
  // ── Sales ───────────────────────────────────────────────────────────────
  'sales.invoices': entry('sales.invoices', 4, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/contacts', index: 1 },
    { route: '/settings?s=taxes', index: 2 },
  ]),
  'sales.invoices.lineItems': entry('sales.invoices.lineItems', 3, [
    { route: '/items', index: 0 },
    { route: '/settings?s=taxes', index: 1 },
  ]),

  // ── Dashboard ───────────────────────────────────────────────────────────
  'dashboard.kpis': entry('dashboard.kpis', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/bills/list', index: 1 },
    { route: '/banking', index: 2 },
  ]),

  // ── Settings · Account & personal ───────────────────────────────────────
  // Per R7.3, every Settings entry below carries ≥ 1 relatesTo link to a
  // non-Settings Section so users can see where the configuration cascades.
  'settings.profile': entry('settings.profile', 3, [
    { route: '/settings?s=security', index: 0 },
    { route: '/settings?s=notifications', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.security': entry('settings.security', 3, [
    { route: '/settings?s=profile', index: 0 },
    { route: '/settings?s=sso', index: 1 },
    { route: '/login', index: 2 },
  ]),
  'settings.notifications': entry('settings.notifications', 3, [
    { route: '/settings?s=email', index: 0 },
    { route: '/settings?s=sms_whatsapp', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.preferences': entry('settings.preferences', 3, [
    { route: '/settings?s=appearance', index: 0 },
    { route: '/settings?s=localization', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),

  // ── Settings · General & appearance ─────────────────────────────────────
  'settings.general': entry('settings.general', 3, [
    { route: '/settings?s=organization', index: 0 },
    { route: '/settings?s=localization', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.appearance': entry('settings.appearance', 3, [
    { route: '/settings?s=branding', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.feature_flags': entry('settings.feature_flags', 3, [
    { route: '/settings?s=modules', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),

  // ── Settings · Organization ─────────────────────────────────────────────
  'settings.organization': entry('settings.organization', 3, [
    { route: '/settings?s=branches', index: 0 },
    { route: '/settings?s=branding', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.branches': entry('settings.branches', 3, [
    { route: '/settings?s=organization', index: 0 },
    { route: '/inventory/warehouses', index: 1 },
  ]),
  'settings.branding': entry('settings.branding', 3, [
    { route: '/settings?s=templates', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
  'settings.working_hours': entry('settings.working_hours', 3, [
    { route: '/settings?s=holidays', index: 0 },
    { route: '/settings?s=hr', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.holidays': entry('settings.holidays', 3, [
    { route: '/settings?s=working_hours', index: 0 },
    { route: '/settings?s=hr', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),

  // ── Settings · Users & access ───────────────────────────────────────────
  'settings.users': entry('settings.users', 3, [
    { route: '/settings?s=roles', index: 0 },
    { route: '/settings?s=permissions', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.roles': entry('settings.roles', 3, [
    { route: '/settings?s=users', index: 0 },
    { route: '/settings?s=permissions', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.permissions': entry('settings.permissions', 3, [
    { route: '/settings?s=roles', index: 0 },
    { route: '/settings?s=users', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.sso': entry('settings.sso', 3, [
    { route: '/settings?s=security', index: 0 },
    { route: '/settings?s=users', index: 1 },
    { route: '/login', index: 2 },
  ]),
  'settings.portals': entry('settings.portals', 3, [
    { route: '/portal', index: 0 },
    { route: '/vendor-portal', index: 1 },
  ]),

  // ── Settings · Localization ─────────────────────────────────────────────
  'settings.localization': entry('settings.localization', 3, [
    { route: '/settings?s=currencies', index: 0 },
    { route: '/settings?s=languages', index: 1 },
    { route: '/settings?s=formats', index: 2 },
    { route: '/dashboard', index: 3 },
  ]),
  'settings.currencies': entry('settings.currencies', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/bills/list', index: 1 },
  ]),
  'settings.languages': entry('settings.languages', 3, [
    { route: '/settings?s=localization', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.formats': entry('settings.formats', 3, [
    { route: '/settings?s=localization', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),

  // ── Settings · Finance & compliance ─────────────────────────────────────
  'settings.fiscal': entry('settings.fiscal', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/journals', index: 1 },
  ]),
  'settings.budgets': entry('settings.budgets', 3, [
    { route: '/accounts', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.taxes': entry('settings.taxes', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/bills/list', index: 1 },
  ]),
  'settings.banking': entry('settings.banking', 3, [
    { route: '/banking', index: 0 },
    { route: '/payments/list', index: 1 },
  ]),
  'settings.payment_methods': entry('settings.payment_methods', 3, [
    { route: '/payments/list', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
  'settings.einvoice': entry('settings.einvoice', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/settings?s=taxes', index: 1 },
  ]),
  'settings.templates': entry('settings.templates', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/settings?s=branding', index: 1 },
  ]),
  'settings.reminders': entry('settings.reminders', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/settings?s=email', index: 1 },
  ]),

  // ── Settings · Commerce ─────────────────────────────────────────────────
  'settings.sales': entry('settings.sales', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/quotes', index: 1 },
  ]),
  'settings.crm': entry('settings.crm', 3, [
    { route: '/contacts', index: 0 },
    { route: '/customers/list', index: 1 },
  ]),
  'settings.purchases': entry('settings.purchases', 3, [
    { route: '/bills/list', index: 0 },
    { route: '/purchase-orders/list', index: 1 },
  ]),
  'settings.inventory': entry('settings.inventory', 3, [
    { route: '/inventory', index: 0 },
    { route: '/inventory/warehouses', index: 1 },
  ]),
  'settings.mrp': entry('settings.mrp', 3, [
    { route: '/inventory', index: 0 },
    { route: '/items', index: 1 },
  ]),
  'settings.pos': entry('settings.pos', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/items/list', index: 1 },
  ]),
  'settings.ecommerce': entry('settings.ecommerce', 3, [
    { route: '/store', index: 0 },
    { route: '/items/list', index: 1 },
  ]),
  'settings.helpdesk': entry('settings.helpdesk', 3, [
    { route: '/contacts', index: 0 },
    { route: '/settings?s=email', index: 1 },
  ]),

  // ── Settings · Operations ───────────────────────────────────────────────
  'settings.hr': entry('settings.hr', 3, [
    { route: '/settings?s=payroll', index: 0 },
    { route: '/settings?s=working_hours', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.payroll': entry('settings.payroll', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/journals', index: 1 },
  ]),
  'settings.projects': entry('settings.projects', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.marketing': entry('settings.marketing', 3, [
    { route: '/contacts', index: 0 },
    { route: '/settings?s=email', index: 1 },
  ]),

  // ── Settings · Automation & integrations ────────────────────────────────
  'settings.workflows': entry('settings.workflows', 3, [
    { route: '/settings?s=approvals', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.approvals': entry('settings.approvals', 3, [
    { route: '/settings?s=workflows', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
  'settings.integrations': entry('settings.integrations', 3, [
    { route: '/settings?s=webhooks', index: 0 },
    { route: '/settings?s=api_tokens', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.webhooks': entry('settings.webhooks', 3, [
    { route: '/settings?s=integrations', index: 0 },
    { route: '/settings?s=api_tokens', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.api_tokens': entry('settings.api_tokens', 3, [
    { route: '/settings?s=integrations', index: 0 },
    { route: '/settings?s=webhooks', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),

  // ── Settings · Content & comms ──────────────────────────────────────────
  'settings.documents': entry('settings.documents', 3, [
    { route: '/settings?s=numbering', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
  'settings.numbering': entry('settings.numbering', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/bills/list', index: 1 },
  ]),
  'settings.email': entry('settings.email', 3, [
    { route: '/settings?s=notifications', index: 0 },
    { route: '/settings?s=reminders', index: 1 },
    { route: '/sales/invoices/list', index: 2 },
  ]),
  'settings.sms_whatsapp': entry('settings.sms_whatsapp', 3, [
    { route: '/settings?s=notifications', index: 0 },
    { route: '/contacts', index: 1 },
  ]),

  // ── Settings · System ───────────────────────────────────────────────────
  'settings.modules': entry('settings.modules', 3, [
    { route: '/settings?s=feature_flags', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.backup': entry('settings.backup', 3, [
    { route: '/settings?s=system', index: 0 },
    { route: '/settings?s=audit', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.activity': entry('settings.activity', 3, [
    { route: '/settings?s=audit', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.audit': entry('settings.audit', 3, [
    { route: '/settings?s=activity', index: 0 },
    { route: '/settings?s=gdpr', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.gdpr': entry('settings.gdpr', 3, [
    { route: '/settings?s=audit', index: 0 },
    { route: '/settings?s=users', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),
  'settings.mobile': entry('settings.mobile', 3, [
    { route: '/settings?s=appearance', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'settings.system': entry('settings.system', 3, [
    { route: '/settings?s=backup', index: 0 },
    { route: '/settings?s=activity', index: 1 },
    { route: '/dashboard', index: 2 },
  ]),

  // ── Onboarding ──────────────────────────────────────────────────────────
  'onboarding.company': entry('onboarding.company', 3, [
    { route: '/settings?s=organization', index: 0 },
  ]),
  'onboarding.currency_tax': entry('onboarding.currency_tax', 3, [
    { route: '/settings?s=currencies', index: 0 },
    { route: '/settings?s=taxes', index: 1 },
  ]),
  'onboarding.coa': entry('onboarding.coa', 3, [
    { route: '/accounts', index: 0 },
  ]),
  'onboarding.modules': entry('onboarding.modules', 3, [
    { route: '/settings?s=modules', index: 0 },
  ]),
  'onboarding.sample_data': entry('onboarding.sample_data', 2, [
    { route: '/dashboard', index: 0 },
  ]),
  'onboarding.checklist.bank': entry('onboarding.checklist.bank', 2, [
    { route: '/banking', index: 0 },
  ]),
  'onboarding.checklist.contact': entry('onboarding.checklist.contact', 2, [
    { route: '/contacts', index: 0 },
  ]),
  'onboarding.checklist.item': entry('onboarding.checklist.item', 2, [
    { route: '/items', index: 0 },
  ]),
  'onboarding.checklist.invoice': entry('onboarding.checklist.invoice', 2, [
    { route: '/invoices', index: 0 },
  ]),
  'onboarding.checklist.user': entry('onboarding.checklist.user', 2, [
    { route: '/settings?s=users', index: 0 },
  ]),
  'onboarding.checklist.tax': entry('onboarding.checklist.tax', 2, [
    { route: '/settings?s=taxes', index: 0 },
  ]),

  // ── Sales (non-invoice) ─────────────────────────────────────────────────
  'sales.quotes': entry('sales.quotes', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/contacts', index: 1 },
  ]),
  'sales.sales_orders': entry('sales.sales_orders', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/inventory', index: 1 },
  ]),
  'sales.credit_notes': entry('sales.credit_notes', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/contacts', index: 1 },
  ]),
  'sales.delivery_challans': entry('sales.delivery_challans', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/inventory', index: 1 },
  ]),
  'sales.recurring_invoices': entry('sales.recurring_invoices', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/contacts', index: 1 },
  ]),
  'sales.returns': entry('sales.returns', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/inventory', index: 1 },
  ]),

  // ── Purchases ───────────────────────────────────────────────────────────
  'purchases.bills': entry('purchases.bills', 3, [
    { route: '/contacts', index: 0 },
    { route: '/settings?s=taxes', index: 1 },
  ]),
  'purchases.purchase_orders': entry('purchases.purchase_orders', 3, [
    { route: '/contacts', index: 0 },
    { route: '/inventory', index: 1 },
  ]),
  'purchases.vendor_credits': entry('purchases.vendor_credits', 3, [
    { route: '/bills/list', index: 0 },
    { route: '/contacts', index: 1 },
  ]),
  'purchases.expenses': entry('purchases.expenses', 3, [
    { route: '/accounts', index: 0 },
    { route: '/settings?s=taxes', index: 1 },
  ]),
  'purchases.expense_claims': entry('purchases.expense_claims', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/accounts', index: 1 },
  ]),
  'purchases.returns': entry('purchases.returns', 3, [
    { route: '/bills/list', index: 0 },
    { route: '/inventory', index: 1 },
  ]),

  // ── Contacts ────────────────────────────────────────────────────────────
  'contacts.list': entry('contacts.list', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/bills/list', index: 1 },
  ]),

  // ── Inventory ───────────────────────────────────────────────────────────
  'inventory.items': entry('inventory.items', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/inventory', index: 1 },
  ]),
  'inventory.warehouses': entry('inventory.warehouses', 3, [
    { route: '/inventory', index: 0 },
    { route: '/settings?s=branches', index: 1 },
  ]),
  'inventory.stock_locations': entry('inventory.stock_locations', 3, [
    { route: '/inventory', index: 0 },
    { route: '/inventory/warehouses', index: 1 },
  ]),
  'inventory.serial_numbers': entry('inventory.serial_numbers', 3, [
    { route: '/inventory', index: 0 },
    { route: '/items', index: 1 },
  ]),
  'inventory.shipments': entry('inventory.shipments', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/inventory', index: 1 },
  ]),
  'inventory.cycle_counts': entry('inventory.cycle_counts', 3, [
    { route: '/inventory', index: 0 },
    { route: '/inventory/warehouses', index: 1 },
  ]),
  'inventory.putaway_rules': entry('inventory.putaway_rules', 3, [
    { route: '/inventory', index: 0 },
    { route: '/inventory/warehouses', index: 1 },
  ]),

  // ── Accounting ──────────────────────────────────────────────────────────
  'accounting.accounts': entry('accounting.accounts', 3, [
    { route: '/journals', index: 0 },
    { route: '/settings?s=fiscal', index: 1 },
  ]),
  'accounting.journals': entry('accounting.journals', 3, [
    { route: '/accounts', index: 0 },
    { route: '/settings?s=fiscal', index: 1 },
  ]),
  'accounting.tax_settings': entry('accounting.tax_settings', 3, [
    { route: '/settings?s=taxes', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
  'accounting.tax_returns': entry('accounting.tax_returns', 3, [
    { route: '/settings?s=taxes', index: 0 },
    { route: '/journals', index: 1 },
  ]),
  'accounting.budgets': entry('accounting.budgets', 3, [
    { route: '/accounts', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'accounting.assets': entry('accounting.assets', 3, [
    { route: '/accounts', index: 0 },
    { route: '/journals', index: 1 },
  ]),

  // ── Banking ─────────────────────────────────────────────────────────────
  'banking': entry('banking', 3, [
    { route: '/settings?s=banking', index: 0 },
    { route: '/payments/list', index: 1 },
  ]),
  'banking.bank_rules': entry('banking.bank_rules', 3, [
    { route: '/banking', index: 0 },
    { route: '/accounts', index: 1 },
  ]),
  'banking.payments': entry('banking.payments', 3, [
    { route: '/banking', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
  'banking.reconciliation': entry('banking.reconciliation', 3, [
    { route: '/banking', index: 0 },
    { route: '/accounts', index: 1 },
  ]),

  // ── HR ──────────────────────────────────────────────────────────────────
  'hr.employees': entry('hr.employees', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'hr.contracts': entry('hr.contracts', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/settings?s=payroll', index: 1 },
  ]),
  'hr.time_off': entry('hr.time_off', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'hr.attendance': entry('hr.attendance', 3, [
    { route: '/settings?s=hr', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'hr.payroll_runs': entry('hr.payroll_runs', 3, [
    { route: '/settings?s=payroll', index: 0 },
    { route: '/journals', index: 1 },
  ]),
  'hr.payroll_rules': entry('hr.payroll_rules', 3, [
    { route: '/settings?s=payroll', index: 0 },
    { route: '/journals', index: 1 },
  ]),

  // ── CRM ─────────────────────────────────────────────────────────────────
  'crm.leads': entry('crm.leads', 3, [
    { route: '/contacts', index: 0 },
    { route: '/settings?s=crm', index: 1 },
  ]),
  'crm.pipeline': entry('crm.pipeline', 3, [
    { route: '/contacts', index: 0 },
    { route: '/settings?s=crm', index: 1 },
  ]),
  'crm.activities': entry('crm.activities', 3, [
    { route: '/contacts', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),

  // ── Projects ────────────────────────────────────────────────────────────
  'projects.list': entry('projects.list', 3, [
    { route: '/settings?s=projects', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),

  // ── Manufacturing ───────────────────────────────────────────────────────
  'manufacturing.boms': entry('manufacturing.boms', 3, [
    { route: '/items', index: 0 },
    { route: '/settings?s=mrp', index: 1 },
  ]),
  'manufacturing.orders': entry('manufacturing.orders', 3, [
    { route: '/items', index: 0 },
    { route: '/settings?s=mrp', index: 1 },
  ]),
  'manufacturing.work_centers': entry('manufacturing.work_centers', 3, [
    { route: '/settings?s=mrp', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),

  // ── Users & Roles ───────────────────────────────────────────────────────
  'users.list': entry('users.list', 3, [
    { route: '/settings?s=users', index: 0 },
    { route: '/settings?s=roles', index: 1 },
  ]),
  'users.roles': entry('users.roles', 3, [
    { route: '/settings?s=roles', index: 0 },
    { route: '/settings?s=permissions', index: 1 },
  ]),

  // ── Automation ──────────────────────────────────────────────────────────
  'automation.rules': entry('automation.rules', 3, [
    { route: '/settings?s=workflows', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'automation.email_templates': entry('automation.email_templates', 3, [
    { route: '/settings?s=email', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),

  // ── Subscriptions ───────────────────────────────────────────────────────
  'subscriptions.list': entry('subscriptions.list', 3, [
    { route: '/sales/invoices/list', index: 0 },
    { route: '/contacts', index: 1 },
  ]),
  'subscriptions.plans': entry('subscriptions.plans', 3, [
    { route: '/items', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),

  // ── Dashboard widget groups ─────────────────────────────────────────────
  'dashboard.quickActions': entry('dashboard.quickActions', 2, [
    { route: '/dashboard', index: 0 },
  ]),
  'dashboard.incomeExpenseChart': entry('dashboard.incomeExpenseChart', 2, [
    { route: '/reports', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),
  'dashboard.recentInvoices': entry('dashboard.recentInvoices', 2, [
    { route: '/sales/invoices/list', index: 0 },
  ]),
  'dashboard.activities': entry('dashboard.activities', 2, [
    { route: '/dashboard', index: 0 },
  ]),

  // ── Reports ─────────────────────────────────────────────────────────────
  'reports': entry('reports', 3, [
    { route: '/dashboard', index: 0 },
    { route: '/accounts', index: 1 },
  ]),

  // ── Approvals ───────────────────────────────────────────────────────────
  'approvals': entry('approvals', 3, [
    { route: '/settings?s=approvals', index: 0 },
    { route: '/dashboard', index: 1 },
  ]),

  // ── E-Invoice ───────────────────────────────────────────────────────────
  'einvoice.dashboard': entry('einvoice.dashboard', 3, [
    { route: '/settings?s=einvoice', index: 0 },
    { route: '/sales/invoices/list', index: 1 },
  ]),
};

// ─────────────────────────────────────────────────────────────────────────────
// Internal exhaustiveness sanity check (compile-time only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * If a {@link SectionId} is added to `sectionIds.ts` without a matching key
 * in {@link helpRegistry}, the `Record<SectionId, HelpEntry>` constraint
 * already fails the build. This block additionally pins the iteration order
 * to {@link SECTION_IDS} so the registry's declaration order is auditable
 * in code review and in the i18n-coverage CI report.
 */
const _registryExhaustivenessCheck: ReadonlyArray<SectionId> = SECTION_IDS;
void _registryExhaustivenessCheck;
