/**
 * Branding settings — Phase P5 sample section.
 *
 * Logo upload (URL or file), primary / accent color, dark-mode preference.
 * Same conventions as the rest of `general/*`.
 *
 * Spec: R8.1, R8.2.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Upload,
  Space,
  Spin,
  Alert,
  Segmented,
  Row,
  Col,
  Typography,
  type UploadFile,
} from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';

import api from '../../../../api';
import { useClassedQuery } from '../../../../data/useClassedQuery';
import { message } from '../../../../utils/message';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ThemeMode = 'light' | 'dark' | 'system';

interface BrandingConfig {
  logo_url: string;
  logo_dark_url?: string;
  favicon_url?: string;
  primary_color: string;
  accent_color: string;
  theme_mode: ThemeMode;
}

const QUERY_KEY = ['settings', 'general', 'branding'] as const;

const DEFAULTS: BrandingConfig = {
  logo_url: '',
  logo_dark_url: '',
  favicon_url: '',
  primary_color: '#1F6FEB',
  accent_color: '#22C55E',
  theme_mode: 'system',
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

const Branding: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const qc = useQueryClient();
  const [form] = Form.useForm<BrandingConfig>();
  const [saving, setSaving] = useState(false);

  const { data, isLoading, error } = useClassedQuery<BrandingConfig>(
    QUERY_KEY,
    () =>
      api
        .get<BrandingConfig>('/api/system/settings/branding')
        .then((r) => ({ ...DEFAULTS, ...r.data })),
    'C',
  );

  useEffect(() => {
    form.setFieldsValue(data ?? DEFAULTS);
  }, [data, form]);

  const handleSave = useCallback(async () => {
    let values: BrandingConfig;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const previous = qc.getQueryData<BrandingConfig>(QUERY_KEY);
    qc.setQueryData<BrandingConfig>(QUERY_KEY, values);
    setSaving(true);
    try {
      await api.put('/api/system/settings/branding', values);
      message.success(t('common:saved', { defaultValue: 'Saved' }));
      void qc.invalidateQueries({ queryKey: QUERY_KEY });
    } catch (err) {
      if (previous) qc.setQueryData(QUERY_KEY, previous);
      message.error(t('common:save_failed', { defaultValue: 'Save failed' }));
      // eslint-disable-next-line no-console
      console.warn('[Branding] save failed', err);
    } finally {
      setSaving(false);
    }
  }, [form, qc, t]);

  const handleLogoUpload = useCallback(
    async (file: UploadFile['originFileObj'] | undefined) => {
      if (!file) return false;
      const fd = new FormData();
      fd.append('file', file as Blob);
      try {
        const res = await api.post<{ url: string }>('/api/files/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        form.setFieldValue('logo_url', res.data.url);
        message.success(t('common:uploaded', { defaultValue: 'Uploaded' }));
      } catch {
        message.error(t('common:upload_failed', { defaultValue: 'Upload failed' }));
      }
      return false; // prevent antd's default upload
    },
    [form, t],
  );

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
      <Form<BrandingConfig> form={form} layout="vertical" initialValues={DEFAULTS}>
        <Row gutter={[24, 0]}>
          <Col xs={24} md={12}>
            <Form.Item
              name="logo_url"
              label={t('settings:branding.logo_url', { defaultValue: 'Logo URL' })}
            >
              <Input placeholder="https://…" />
            </Form.Item>
            <Upload
              accept="image/*"
              maxCount={1}
              beforeUpload={(f) => handleLogoUpload(f as unknown as File)}
              showUploadList={false}
            >
              <Button icon={<UploadOutlined />}>
                {t('settings:branding.upload_logo', { defaultValue: 'Upload logo' })}
              </Button>
            </Upload>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item
              name="logo_dark_url"
              label={t('settings:branding.logo_dark_url', { defaultValue: 'Logo (dark mode)' })}
            >
              <Input placeholder="https://…" />
            </Form.Item>
            <Form.Item
              name="favicon_url"
              label={t('settings:branding.favicon_url', { defaultValue: 'Favicon URL' })}
            >
              <Input placeholder="https://…" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="primary_color"
              label={t('settings:branding.primary_color', { defaultValue: 'Primary color' })}
              rules={[{ required: true }]}
            >
              <Input type="color" style={{ width: 80, height: 36, padding: 2 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="accent_color"
              label={t('settings:branding.accent_color', { defaultValue: 'Accent color' })}
              rules={[{ required: true }]}
            >
              <Input type="color" style={{ width: 80, height: 36, padding: 2 }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item
              name="theme_mode"
              label={t('settings:branding.theme_mode', { defaultValue: 'Default theme' })}
            >
              <Segmented
                options={[
                  { value: 'light', label: t('settings:branding.light', { defaultValue: 'Light' }) },
                  { value: 'dark', label: t('settings:branding.dark', { defaultValue: 'Dark' }) },
                  { value: 'system', label: t('settings:branding.system', { defaultValue: 'System' }) },
                ]}
              />
            </Form.Item>
          </Col>
        </Row>

        <Typography.Paragraph type="secondary" style={{ marginBlockEnd: 12 }}>
          {t('settings:branding.help', {
            defaultValue:
              'Logos appear on invoices, the login page, and the top navigation. Use SVG or 2x PNG for crispness.',
          })}
        </Typography.Paragraph>

        <Space>
          <Button type="primary" onClick={handleSave} loading={saving}>
            {t('common:save', { defaultValue: 'Save' })}
          </Button>
          <Button onClick={() => form.setFieldsValue(data ?? DEFAULTS)} disabled={saving}>
            {t('common:reset', { defaultValue: 'Reset' })}
          </Button>
        </Space>
      </Form>
    </Card>
  );
});

Branding.displayName = 'Branding';

export default Branding;
