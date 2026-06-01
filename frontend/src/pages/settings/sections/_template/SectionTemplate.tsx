/**
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │  SECTION TEMPLATE — copy this file when migrating a section out of       │
 * │  `frontend/src/settings/sections/bodies.tsx` into its own per-section    │
 * │  file. Replace XxxSection with the real name and wire it in              │
 * │  `pages/settings/sections.registry.ts`.                                  │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Conventions (R8.1, R8.2):
 *
 *   1. EXPORTS — exactly one default React.memo-wrapped component, plus
 *      its types if they need to be shared.
 *
 *   2. QUERIES — use `useClassedQuery` with the right class:
 *        - A  → realtime / never persisted (rare in settings)
 *        - B  → list / detail data (e.g. users list)
 *        - C  → slow-changing config (most settings) ← default
 *        - D  → static reference data (timezones, currencies)
 *      Direct `useQuery` calls are blocked by the
 *      `local/require-query-class` ESLint rule.
 *
 *   3. HANDLERS — `useCallback` with explicit deps. No inline lambdas in
 *      props of memoized children.
 *
 *   4. OPTIMISTIC UPDATE — on save, mutate the query cache immediately
 *      via `qc.setQueryData`; roll back on failure.
 *
 *   5. i18n — always use the `settings` namespace plus `common` for shared
 *      keys. Every visible string gets a key + sensible default.
 *
 *   6. SIZE BUDGET — keep each section file ≤ 300 LOC. Split sub-forms
 *      into co-located helper components if needed.
 *
 *   7. NO SIDE EFFECTS AT IMPORT — anything that touches `document`,
 *      `localStorage`, or globals must live inside the component, never at
 *      module scope (lazy chunks run earlier than you think).
 *
 *   8. RTL — never hard-code `marginLeft`/`paddingRight`. Use logical
 *      properties: `marginInlineStart`, `paddingInlineEnd`. Antd's `gutter`,
 *      `Space`, and `Form` already handle RTL via the document `dir`.
 *
 *   9. DELETE THIS FILE'S HEADER COMMENT after copying — it is for human
 *      reference only.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Form, Input, Button, Space, Spin, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../api';
import { useClassedQuery } from '../../../../data/useClassedQuery';
import { SectionCard } from '../../../../design-system';
import { message } from '../../../../utils/message';

// ── Types ─────────────────────────────────────────────────────────────────
interface ExampleConfig {
  some_field: string;
}

const QUERY_KEY = ['settings', 'group', 'example'] as const;

// ── Component ─────────────────────────────────────────────────────────────
const SectionTemplate: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const qc = useQueryClient();
  const [form] = Form.useForm<ExampleConfig>();
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useClassedQuery<ExampleConfig>(
    QUERY_KEY,
    () => api.get<ExampleConfig>('/api/system/settings/example').then((r) => r.data),
    'C',
  );

  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);

  const handleSave = useCallback(async () => {
    let values: ExampleConfig;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const previous = qc.getQueryData<ExampleConfig>(QUERY_KEY);
    qc.setQueryData<ExampleConfig>(QUERY_KEY, values); // optimistic
    setSaving(true);
    try {
      await api.put('/api/system/settings/example', values);
      message.success(t('common:saved', { defaultValue: 'Saved' }));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch {
      if (previous) qc.setQueryData(QUERY_KEY, previous);
      message.error(t('common:save_failed', { defaultValue: 'Save failed' }));
    } finally {
      setSaving(false);
    }
  }, [form, qc, t]);

  if (isLoading && !data) return <Spin tip={t('common:loading', { defaultValue: 'Loading…' })} />;
  if (error && !data) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('common:load_failed', { defaultValue: 'Failed to load' })}
        description={(error as Error).message}
      />
    );
  }

  return (
    <SectionCard style={{ marginBottom: 0 }}>
      <Form<ExampleConfig> form={form} layout="vertical">
        <Form.Item
          name="some_field"
          label={t('settings:example.field', { defaultValue: 'Example field' })}
          rules={[{ required: true }]}
        >
          <Input />
        </Form.Item>
        <Space>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('common:save', { defaultValue: 'Save' })}
          </Button>
        </Space>
      </Form>
    </SectionCard>
  );
});

SectionTemplate.displayName = 'SectionTemplate';

export default SectionTemplate;
