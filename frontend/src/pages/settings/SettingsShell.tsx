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
import {
  SECTIONS,
  GROUP_ORDER,
  DEFAULT_SECTION_KEY,
  getSection,
  type SectionDef,
  type SectionGroup,
} from './sections.registry';

const { Sider, Content } = Layout;

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
  }, [t, groupTitles]);

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
