/**
 * Localization settings — Phase P5 sample section.
 *
 * Lets the user pick language, currency, date / number format, RTL direction
 * override, and Arabic-Indic digit preference. Uses the same conventions as
 * `CompanyInfo`: `React.memo` + classed query + optimistic save + i18n.
 *
 * Spec: R8.1, R8.2, R9.5 (locale-aware formatting).
 */

import React, { useCallback, useEffect } from 'react';
import {
  Form,
  Select,
  Switch,
  Button,
  Row,
  Col,
  Space,
  Spin,
  Alert,
  Typography,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../api';
import i18n from '../../../../i18n';
import { useClassedQuery } from '../../../../data/useClassedQuery';
import { SectionCard } from '../../../../design-system';
import { message } from '../../../../utils/message';
import { formatCurrency } from '../../../../utils/formatCurrency';
import { formatNumber } from '../../../../utils/formatNumber';
import { formatDate } from '../../../../utils/formatDate';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type LangCode = 'ku' | 'ar' | 'en';
type CurrencyCode = 'IQD' | 'USD' | 'EUR' | 'SAR' | 'AED';
type DateFormat = 'YYYY-MM-DD' | 'DD/MM/YYYY' | 'MM/DD/YYYY';
type NumberFormat = 'western' | 'arabic-indic';

interface LocalizationConfig {
  language: LangCode;
  currency: CurrencyCode;
  date_format: DateFormat;
  number_format: NumberFormat;
  rtl_override: boolean;
}

const QUERY_KEY = ['settings', 'general', 'localization'] as const;

const LANGUAGE_OPTIONS: Array<{ value: LangCode; label: string }> = [
  { value: 'ku', label: 'کوردی (Kurdish)' },
  { value: 'ar', label: 'العربية (Arabic)' },
  { value: 'en', label: 'English' },
];

const CURRENCY_OPTIONS: Array<{ value: CurrencyCode; label: string }> = [
  { value: 'IQD', label: 'IQD — Iraqi Dinar' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'SAR', label: 'SAR — Saudi Riyal' },
  { value: 'AED', label: 'AED — UAE Dirham' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const Localization: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const qc = useQueryClient();
  const [form] = Form.useForm<LocalizationConfig>();
  const [saving, setSaving] = React.useState(false);
  const [preview, setPreview] = React.useState<LocalizationConfig | null>(null);

  const { data, isLoading, error } = useClassedQuery<LocalizationConfig>(
    QUERY_KEY,
    () => api.get<LocalizationConfig>('/api/system/settings/localization').then((r) => r.data),
    'C',
  );

  useEffect(() => {
    if (!data) return;
    form.setFieldsValue(data);
    setPreview(data);
  }, [data, form]);

  const handleValuesChange = useCallback(
    (_: Partial<LocalizationConfig>, all: LocalizationConfig) => {
      setPreview(all);
    },
    [],
  );

  const handleSave = useCallback(async () => {
    let values: LocalizationConfig;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const previousData = qc.getQueryData<LocalizationConfig>(QUERY_KEY);
    qc.setQueryData<LocalizationConfig>(QUERY_KEY, values);
    setSaving(true);
    try {
      await api.put('/api/system/settings/localization', values);
      // Apply language change to the running i18n instance.
      if (values.language && values.language !== i18n.language) {
        await i18n.changeLanguage(values.language);
      }
      message.success(t('common:saved', { defaultValue: 'Saved' }));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      if (previousData) qc.setQueryData(QUERY_KEY, previousData);
      message.error(t('common:save_failed', { defaultValue: 'Save failed' }));
       
      console.warn('[Localization] save failed', err);
    } finally {
      setSaving(false);
    }
  }, [form, qc, t]);

  if (isLoading && !data) {
    return <Spin tip={t('common:loading', { defaultValue: 'Loading…' })} />;
  }
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

  const previewLocale = preview?.language ?? 'en';
  const previewCurrency = preview?.currency ?? 'USD';
  const useArabicIndic = preview?.number_format === 'arabic-indic';

  return (
    <SectionCard style={{ marginBottom: 0 }}>
      <Form<LocalizationConfig>
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
      >
        <Row gutter={[24, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="language"
              label={t('settings:localization.language', { defaultValue: 'Language' })}
              rules={[{ required: true }]}
            >
              <Select options={LANGUAGE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="currency"
              label={t('settings:localization.currency', { defaultValue: 'Default currency' })}
              rules={[{ required: true }]}
            >
              <Select options={CURRENCY_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="date_format"
              label={t('settings:localization.date_format', { defaultValue: 'Date format' })}
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: 'YYYY-MM-DD', label: '2026-05-27' },
                  { value: 'DD/MM/YYYY', label: '27/05/2026' },
                  { value: 'MM/DD/YYYY', label: '05/27/2026' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="number_format"
              label={t('settings:localization.number_format', { defaultValue: 'Number digits' })}
              tooltip={t('settings:localization.number_format.help', {
                defaultValue: 'Use Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) instead of Western (0123456789).',
              })}
              rules={[{ required: true }]}
            >
              <Select
                options={[
                  { value: 'western', label: '0 1 2 3 4 5 6 7 8 9' },
                  { value: 'arabic-indic', label: '٠ ١ ٢ ٣ ٤ ٥ ٦ ٧ ٨ ٩' },
                ]}
              />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="rtl_override"
              label={t('settings:localization.rtl_override', { defaultValue: 'Force RTL layout' })}
              tooltip={t('settings:localization.rtl_override.help', {
                defaultValue:
                  'By default the page direction follows the active language. Enable to force RTL even in English.',
              })}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>

        <SectionCard
          title={t('settings:localization.preview', { defaultValue: 'Preview' })}
          style={{ marginBlock: 16 }}
        >
          <Typography.Paragraph style={{ marginBlock: 0 }}>
            <strong>{t('settings:localization.preview.currency', { defaultValue: 'Currency' })}:</strong>{' '}
            {formatCurrency(1234567.89, previewCurrency, previewLocale)}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBlock: 0 }}>
            <strong>{t('settings:localization.preview.number', { defaultValue: 'Number' })}:</strong>{' '}
            {formatNumber(1234567.89, previewLocale, { arabicIndic: useArabicIndic })}
          </Typography.Paragraph>
          <Typography.Paragraph style={{ marginBlock: 0 }}>
            <strong>{t('settings:localization.preview.date', { defaultValue: 'Date' })}:</strong>{' '}
            {formatDate(new Date(), previewLocale, { dateStyle: 'long' })}
          </Typography.Paragraph>
        </SectionCard>

        <Space>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('common:save', { defaultValue: 'Save' })}
          </Button>
          <Button onClick={() => data && form.setFieldsValue(data)} disabled={saving}>
            {t('common:reset', { defaultValue: 'Reset' })}
          </Button>
        </Space>
      </Form>
    </SectionCard>
  );
});

Localization.displayName = 'Localization';

export default Localization;
