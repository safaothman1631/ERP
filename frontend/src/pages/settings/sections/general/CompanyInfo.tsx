/**
 * CompanyInfo settings — Phase P5 sample section.
 *
 * Demonstrates the conventions for newly-decomposed settings sections:
 *   - `React.memo` wrapper to elide re-renders when the shell re-renders.
 *   - `useClassedQuery` (class C — slow-changing config) for the GET.
 *   - Stable, memoized handlers (no inline functions in props).
 *   - Optimistic update on save via `queryClient.setQueryData`.
 *   - Full i18n with the `settings` namespace.
 *   - Strict TypeScript types — no `any`.
 *
 * Spec: R8.1 (one file per section), R8.2 (memo + stable callbacks).
 */

import React, { useCallback, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  DatePicker,
  Button,
  Row,
  Col,
  Space,
  Spin,
  Alert,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import dayjs, { type Dayjs } from 'dayjs';

import api from '../../../../api';
import { useClassedQuery } from '../../../../data/useClassedQuery';
import { message } from '../../../../utils/message';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CompanyInfoApi {
  name: string;
  legal_name?: string;
  registration_number?: string;
  /**
   * Iraqi commercial registration number (growth-to-100 § R4.14).
   * Format ``XX-NNNNNN`` (governorate prefix) or 6–15 bare digits.
   * Final format pending R7.1 sign-off.
   */
  commercial_registration_no?: string;
  tax_id?: string;
  fiscal_year_start?: string; // ISO yyyy-mm-dd (month-day used)
  timezone: string;
  industry?: string;
  email?: string;
  phone?: string;
}

interface CompanyInfoForm {
  name: string;
  legal_name?: string;
  registration_number?: string;
  commercial_registration_no?: string;
  tax_id?: string;
  fiscal_year_start?: Dayjs;
  timezone: string;
  industry?: string;
  email?: string;
  phone?: string;
}

const QUERY_KEY = ['settings', 'general', 'company'] as const;

const TIMEZONE_OPTIONS = [
  { value: 'Asia/Baghdad', label: 'Asia/Baghdad (UTC+3)' },
  { value: 'Asia/Dubai', label: 'Asia/Dubai (UTC+4)' },
  { value: 'Asia/Riyadh', label: 'Asia/Riyadh (UTC+3)' },
  { value: 'Asia/Beirut', label: 'Asia/Beirut (UTC+2/+3)' },
  { value: 'Europe/Istanbul', label: 'Europe/Istanbul (UTC+3)' },
  { value: 'UTC', label: 'UTC' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const CompanyInfo: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const qc = useQueryClient();
  const [form] = Form.useForm<CompanyInfoForm>();
  const [saving, setSaving] = React.useState(false);

  // Class C = slow-changing config (long staleTime, no refetch on focus).
  // See data/queryClasses.ts.
  const { data, isLoading, error } = useClassedQuery<CompanyInfoApi>(
    QUERY_KEY,
    () => api.get<CompanyInfoApi>('/api/system/organization').then((r) => r.data),
    'C',
  );

  // Populate form when the query resolves.
  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      name: data.name,
      legal_name: data.legal_name,
      registration_number: data.registration_number,
      commercial_registration_no: data.commercial_registration_no,
      tax_id: data.tax_id,
      fiscal_year_start: data.fiscal_year_start ? dayjs(data.fiscal_year_start) : undefined,
      timezone: data.timezone,
      industry: data.industry,
      email: data.email,
      phone: data.phone,
    });
  }, [data, form]);

  const handleSave = useCallback(async () => {
    let values: CompanyInfoForm;
    try {
      values = await form.validateFields();
    } catch {
      return; // validation errors already surfaced by antd
    }
    const payload: CompanyInfoApi = {
      ...values,
      fiscal_year_start: values.fiscal_year_start?.format('YYYY-MM-DD'),
    };
    const previous = qc.getQueryData<CompanyInfoApi>(QUERY_KEY);
    // Optimistic update — spec R8.2 implies snappy UX for settings.
    qc.setQueryData<CompanyInfoApi>(QUERY_KEY, (prev) => ({ ...(prev ?? {} as CompanyInfoApi), ...payload }));
    setSaving(true);
    try {
      await api.put('/api/system/organization', payload);
      message.success(t('common:saved', { defaultValue: 'Saved' }));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      // Roll back optimistic update on failure.
      if (previous) qc.setQueryData(QUERY_KEY, previous);
      message.error(t('common:save_failed', { defaultValue: 'Save failed' }));
       
      console.warn('[CompanyInfo] save failed', err);
    } finally {
      setSaving(false);
    }
  }, [form, qc, t]);

  const handleReset = useCallback(() => {
    if (data) {
      form.setFieldsValue({
        name: data.name,
        legal_name: data.legal_name,
        registration_number: data.registration_number,
        commercial_registration_no: data.commercial_registration_no,
        tax_id: data.tax_id,
        fiscal_year_start: data.fiscal_year_start ? dayjs(data.fiscal_year_start) : undefined,
        timezone: data.timezone,
        industry: data.industry,
        email: data.email,
        phone: data.phone,
      });
    } else {
      form.resetFields();
    }
  }, [data, form]);

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

  return (
    <Card>
      <Form<CompanyInfoForm> form={form} layout="vertical" requiredMark="optional">
        <Row gutter={[24, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="name"
              label={t('settings:company.name', { defaultValue: 'Company name' })}
              rules={[
                { required: true, message: t('common:required', { defaultValue: 'Required' }) },
                { max: 200 },
              ]}
            >
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="legal_name"
              label={t('settings:company.legal_name', { defaultValue: 'Legal name' })}
            >
              <Input maxLength={200} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="registration_number"
              label={t('settings:company.registration_number', { defaultValue: 'Registration number' })}
            >
              <Input maxLength={64} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="tax_id"
              label={t('settings:company.tax_id', { defaultValue: 'Tax ID' })}
            >
              <Input maxLength={64} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="commercial_registration_no"
              label={t('settings:company.commercial_registration_no', {
                defaultValue: 'Commercial registration no. (Iraq)',
              })}
              tooltip={t('settings:company.commercial_registration_no.help', {
                defaultValue:
                  'Iraqi Ministry of Trade business registration. Format XX-NNNNNN (governorate prefix) or 6–15 bare digits. Final format pending verification.',
              })}
              rules={[
                {
                  pattern: /^(?:[A-Za-z]{2}-)?\d{6,15}$/,
                  message: t('settings:company.commercial_registration_no.invalid', {
                    defaultValue: 'Format: XX-NNNNNN or 6–15 digits',
                  }),
                },
              ]}
            >
              <Input maxLength={32} placeholder="BG-123456" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="fiscal_year_start"
              label={t('settings:company.fiscal_year_start', { defaultValue: 'Fiscal year start' })}
              tooltip={t('settings:company.fiscal_year_start.help', {
                defaultValue: 'Used to compute fiscal periods. Most companies use Jan 1.',
              })}
            >
              <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="timezone"
              label={t('settings:company.timezone', { defaultValue: 'Timezone' })}
              rules={[{ required: true, message: t('common:required', { defaultValue: 'Required' }) }]}
            >
              <Select options={[...TIMEZONE_OPTIONS]} showSearch optionFilterProp="label" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="email"
              label={t('settings:company.email', { defaultValue: 'Contact email' })}
              rules={[{ type: 'email', message: t('common:invalid_email', { defaultValue: 'Invalid email' }) }]}
            >
              <Input type="email" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="phone"
              label={t('settings:company.phone', { defaultValue: 'Contact phone' })}
            >
              <Input />
            </Form.Item>
          </Col>
        </Row>

        <Space style={{ marginTop: 8 }}>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('common:save', { defaultValue: 'Save' })}
          </Button>
          <Button onClick={handleReset} disabled={saving}>
            {t('common:reset', { defaultValue: 'Reset' })}
          </Button>
        </Space>
      </Form>
    </Card>
  );
});

CompanyInfo.displayName = 'CompanyInfo';

export default CompanyInfo;
