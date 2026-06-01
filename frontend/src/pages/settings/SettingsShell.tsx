/**
 * SettingsShell — Phase P5 (Settings decomposition).
 *
 * Per design.md §1.9 — < 150 LOC. Responsibilities:
 *   1. Read the section registry (`./sections.registry`).
 *   2. Render a localized sidebar grouped by `SectionGroup`.
 *   3. Reflect / control the active section via URL ?section=<key>.
 *   4. Lazy-render the active section body inside a `<Suspense>` boundary.
 *
 * Spec: R8.1, R8.3 (lazy load), R8.4 (file size budget).
 */

import React, { Suspense, useMemo } from 'react';
import { Layout, Menu, Spin, Typography, Result, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import {
  SECTIONS,
  GROUP_ORDER,
  DEFAULT_SECTION_KEY,
  getSection,
  type SectionDef,
  type SectionGroup,
} from './sections.registry';

const { Sider, Content } = Layout;

// ─────────────────────────────────────────────────────────────────────────────
// Role-based section visibility (Vertex Step 2 — thin, guarded filter layer)
//
// SAFETY CONTRACT:
//   • Owner / admin / super_admin / any unknown-or-empty role → ALL sections.
//     This is a hard guardrail: we NEVER hide settings from an admin/owner, and
//     an unrecognised role always falls through to "show everything".
//   • Only a small set of explicitly-known non-admin roles get a reduced menu,
//     and even then the filter is biased toward showing MORE: when a role has no
//     entry, or the mapping is unsure, the section stays visible.
//   • This layer ONLY trims the sidebar menu — it does not gate the ability to
//     render a section body (deep-links via ?section=… still resolve for all
//     roles), so it cannot break section loading or the not-found behaviour.
// ─────────────────────────────────────────────────────────────────────────────

/** Personal sections every authenticated user may see. */
const PERSONAL_KEYS: readonly string[] = [
  'account.profile',
  'account.security',
  'account.notifications',
  'account.preferences',
];

/**
 * Domain sections per known non-admin role, expressed as our real registry
 * keys (`group.section`). Keys absent from the registry are simply ignored.
 * Mapped from the Vertex kit role map; ambiguous kit keys err toward inclusion.
 */
const ROLE_DOMAIN_KEYS: Record<string, readonly string[]> = {
  accountant: [
    // general
    'general.company',
    'general.localization',
    'general.branding',
    'general.appearance',
    'general.feature_flags',
    // localization
    'localization.currencies',
    'localization.languages',
    'localization.formats',
    // finance & compliance
    'finance.fiscal',
    'finance.budgets',
    'finance.taxes',
    'finance.banking',
    'finance.payment_methods',
    'finance.einvoice',
    'finance.templates',
    'finance.reminders',
    // documents
    'content.documents',
  ],
  sales: [
    'commerce.sales',
    'commerce.crm',
    'commerce.ecommerce',
    'commerce.helpdesk',
    'operations.marketing',
    'finance.reminders',
    'finance.templates',
  ],
  inventory: [
    'commerce.purchases',
    'commerce.inventory',
    'commerce.mrp',
    'commerce.pos',
    // warehouses ≈ branches/working-hours/holidays (no exact section) → include
    'organization.branches',
    'organization.working_hours',
    'organization.holidays',
  ],
  cashier: [
    'commerce.pos',
    'finance.payment_methods',
  ],
  hr: [
    'operations.hr',
    'operations.payroll',
    'operations.projects',
    'content.documents',
  ],
};

// `finance` is an alias of `accountant` per the kit.
ROLE_DOMAIN_KEYS.finance = ROLE_DOMAIN_KEYS.accountant;

/**
 * Returns a predicate deciding whether a given section key is visible for the
 * supplied role. Falls back to "show everything" for admin/owner/unknown roles.
 */
function buildSectionVisibility(
  role: string | null,
  isPrivileged: boolean,
): (key: string) => boolean {
  // Guardrail: admin/owner/super_admin (or anything we can't classify) → all.
  if (isPrivileged) return () => true;
  const normalized = (role ?? '').trim().toLowerCase();
  const domainKeys = normalized ? ROLE_DOMAIN_KEYS[normalized] : undefined;
  // Unknown / empty / unmapped role → bias toward showing everything.
  if (!domainKeys) return () => true;
  const allowed = new Set<string>([...PERSONAL_KEYS, ...domainKeys]);
  return (key: string) => allowed.has(key);
}

interface MenuGroupItem {
  key: string;
  label: React.ReactNode;
  type: 'group';
  children: Array<{ key: string; label: React.ReactNode }>;
}

const SettingsShell: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  const [params, setParams] = useSearchParams();
  const activeKey = params.get('section') ?? DEFAULT_SECTION_KEY;

  // Role-based, guarded visibility for the sidebar (admins/unknown → all).
  const { role, isOwner, isAdmin, isSuperAdmin, isTenantOrgAdmin } = usePermission();
  const isVisible = useMemo(
    () =>
      buildSectionVisibility(
        role,
        isOwner || isAdmin || isSuperAdmin || isTenantOrgAdmin,
      ),
    [role, isOwner, isAdmin, isSuperAdmin, isTenantOrgAdmin],
  );

  const groupTitles: Record<SectionGroup, string> = useMemo(
    () => ({
      account: t('settings:groups.account', { defaultValue: 'Account' }),
      general: t('settings:groups.general', { defaultValue: 'General' }),
      organization: t('settings:groups.organization', { defaultValue: 'Organization' }),
      users: t('settings:groups.users', { defaultValue: 'Users & access' }),
      localization: t('settings:groups.localization', { defaultValue: 'Localization' }),
      finance: t('settings:groups.finance', { defaultValue: 'Finance & compliance' }),
      commerce: t('settings:groups.commerce', { defaultValue: 'Commerce' }),
      operations: t('settings:groups.operations', { defaultValue: 'Operations' }),
      automation: t('settings:groups.automation', { defaultValue: 'Automation & API' }),
      content: t('settings:groups.content', { defaultValue: 'Content & messaging' }),
      system: t('settings:groups.system', { defaultValue: 'System' }),
    }),
    [t],
  );

  const menuItems: MenuGroupItem[] = useMemo(() => {
    const byGroup = new Map<SectionGroup, Array<[string, SectionDef]>>();
    for (const [key, def] of Object.entries(SECTIONS)) {
      if (def.enabled && !def.enabled()) continue;
      if (!isVisible(key)) continue;
      const arr = byGroup.get(def.group) ?? [];
      arr.push([key, def]);
      byGroup.set(def.group, arr);
    }
    return GROUP_ORDER.filter((g) => byGroup.has(g)).map((g) => ({
      key: `group:${g}`,
      type: 'group' as const,
      label: groupTitles[g],
      children: (byGroup.get(g) ?? []).map(([key, def]) => ({
        key,
        label: (
          <span>
            {t(def.titleKey, { defaultValue: def.fallbackTitle })}
            {def.badge ? (
              <Tag color={def.badge === 'soon' ? 'default' : 'blue'} style={{ marginInlineStart: 8 }}>
                {t(`common:badge.${def.badge}`, { defaultValue: def.badge })}
              </Tag>
            ) : null}
          </span>
        ),
      })),
    }));
  }, [t, groupTitles, isVisible]);

  const active = getSection(activeKey);
  const ActiveComponent = active?.loader ?? null;

  const handleSelect = (info: { key: string }) => {
    if (info.key.startsWith('group:')) return;
    const next = new URLSearchParams(params);
    next.set('section', info.key);
    setParams(next, { replace: true });
  };

  return (
    <Layout style={{ background: 'transparent', minHeight: 'calc(100vh - 120px)' }}>
      <Sider
        width={260}
        breakpoint="lg"
        collapsedWidth={0}
        style={{ background: 'var(--color-surface, #fff)', borderInlineEnd: '1px solid var(--color-border, #f0f0f0)' }}
      >
        <Menu
          mode="inline"
          selectedKeys={[activeKey]}
          onClick={handleSelect}
          items={menuItems}
          style={{ borderInlineEnd: 0, paddingBlock: 8 }}
        />
      </Sider>
      <Content style={{ padding: '24px 32px' }}>
        {active && ActiveComponent ? (
          <>
            <Typography.Title level={3} style={{ marginTop: 0 }}>
              {t(active.titleKey, { defaultValue: active.fallbackTitle })}
            </Typography.Title>
            {active.subtitleKey ? (
              <Typography.Paragraph type="secondary">
                {t(active.subtitleKey, { defaultValue: '' })}
              </Typography.Paragraph>
            ) : null}
            <Suspense fallback={<Spin tip={t('common:loading', { defaultValue: 'Loading…' })} style={{ marginTop: 32 }} />}>
              <ActiveComponent />
            </Suspense>
          </>
        ) : (
          <Result
            status="404"
            title={t('settings:not_found.title', { defaultValue: 'Section not found' })}
            subTitle={t('settings:not_found.subtitle', {
              defaultValue: 'The requested settings section is unknown or disabled.',
            })}
          />
        )}
      </Content>
    </Layout>
  );
};

export default SettingsShell;
