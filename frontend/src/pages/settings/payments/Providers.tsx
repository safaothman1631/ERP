/**
 * Settings → Payments → Providers (launch-readiness § R4.13).
 *
 * Lists the registered payment provider adapters with on/off toggles and a
 * configuration form per provider (merchant id, masked secret inputs, sandbox
 * mode). The list itself is fetched from ``GET /api/payments/providers`` —
 * the toggle persists to ``PUT /api/payments/providers/{slug}/config``.
 *
 * Iraqi providers (FastPay / Qi / Zain / Asia Pay) are shown with an
 * informational alert indicating credentials are pending (R7.2–R7.5); the
 * toggle is left enabled so admins can pre-stage their config.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Form,
  Input,
  Space,
  Spin,
  Switch,
  Typography,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { PageHeader, SectionCard, StatusTag } from '../../../design-system';
import api from '../../../api';

const { Text, Paragraph } = Typography;

interface ProviderConfig {
  slug: string;
  display_name: string;
  enabled: boolean;
  configured: boolean;
  sandbox: boolean;
  /** Pending R7.x — adapter is stubbed and cannot transact. */
  credentials_pending: boolean;
  config_fields: ConfigField[];
  config_values: Record<string, string>;
}

interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'url';
  required: boolean;
}

/** Local fallback registry — used when the backend is unreachable so admins
 * can still see what providers exist. The backend response always wins when
 * available. */
const FALLBACK_PROVIDERS: ProviderConfig[] = [
  {
    slug: 'cash',
    display_name: 'Cash',
    enabled: true,
    configured: true,
    sandbox: false,
    credentials_pending: false,
    config_fields: [],
    config_values: {},
  },
  {
    slug: 'cod',
    display_name: 'Cash on Delivery',
    enabled: true,
    configured: true,
    sandbox: false,
    credentials_pending: false,
    config_fields: [],
    config_values: {},
  },
  {
    slug: 'stripe',
    display_name: 'Stripe (international cards)',
    enabled: false,
    configured: false,
    sandbox: true,
    credentials_pending: false,
    config_fields: [
      { key: 'publishable_key', label: 'Publishable key', type: 'text', required: true },
      { key: 'secret_key', label: 'Secret key', type: 'secret', required: true },
      { key: 'webhook_secret', label: 'Webhook signing secret', type: 'secret', required: true },
    ],
    config_values: {},
  },
  {
    slug: 'fastpay',
    display_name: 'FastPay',
    enabled: false,
    configured: false,
    sandbox: true,
    credentials_pending: true,
    config_fields: [
      { key: 'client_id', label: 'OAuth client id', type: 'text', required: true },
      { key: 'client_secret', label: 'OAuth client secret', type: 'secret', required: true },
      { key: 'webhook_secret', label: 'Webhook signing secret', type: 'secret', required: true },
    ],
    config_values: {},
  },
  {
    slug: 'qi',
    display_name: 'Qi Card',
    enabled: false,
    configured: false,
    sandbox: true,
    credentials_pending: true,
    config_fields: [
      { key: 'merchant_id', label: 'Merchant id', type: 'text', required: true },
      { key: 'api_key', label: 'API key', type: 'secret', required: true },
    ],
    config_values: {},
  },
  {
    slug: 'zain',
    display_name: 'Zain Cash',
    enabled: false,
    configured: false,
    sandbox: true,
    credentials_pending: true,
    config_fields: [
      { key: 'merchant_id', label: 'Merchant id', type: 'text', required: true },
      { key: 'secret', label: 'Merchant secret', type: 'secret', required: true },
      { key: 'msisdn', label: 'Merchant MSISDN', type: 'text', required: true },
    ],
    config_values: {},
  },
  {
    slug: 'asia_pay',
    display_name: 'Asia Pay',
    enabled: false,
    configured: false,
    sandbox: true,
    credentials_pending: true,
    config_fields: [
      { key: 'merchant_id', label: 'Merchant id', type: 'text', required: true },
      { key: 'api_key', label: 'API key', type: 'secret', required: true },
    ],
    config_values: {},
  },
];

const PaymentProvidersPage: React.FC = () => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get<{ items: ProviderConfig[] }>('/api/payments/providers');
        setProviders(res.data.items ?? FALLBACK_PROVIDERS);
      } catch {
        setProviders(FALLBACK_PROVIDERS);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleToggle = async (slug: string, enabled: boolean) => {
    setSavingSlug(slug);
    setProviders(prev => prev.map(p => (p.slug === slug ? { ...p, enabled } : p)));
    try {
      await api.put(`/api/payments/providers/${slug}/config`, { enabled });
      message.success(t('payments.providers.savedToggle', 'Provider updated'));
    } catch {
      message.error(t('payments.providers.saveFailed', 'Failed to save provider'));
      setProviders(prev => prev.map(p => (p.slug === slug ? { ...p, enabled: !enabled } : p)));
    } finally {
      setSavingSlug(null);
    }
  };

  const handleSaveConfig = async (slug: string, values: Record<string, string>) => {
    setSavingSlug(slug);
    try {
      await api.put(`/api/payments/providers/${slug}/config`, { config: values });
      message.success(t('payments.providers.savedConfig', 'Configuration saved'));
      setProviders(prev => prev.map(p => (p.slug === slug
        ? { ...p, configured: true, config_values: values } : p)));
    } catch {
      message.error(t('payments.providers.saveFailed', 'Failed to save configuration'));
    } finally {
      setSavingSlug(null);
    }
  };

  if (loading) return <Spin />;

  return (
    <div>
      <PageHeader
        title={t('payments.providers.title', 'Payment Providers')}
        subtitle={t(
          'payments.providers.subtitle',
          'Enable, configure, and toggle each payment gateway.',
        )}
      />
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {providers.map(provider => (
          <ProviderCard
            key={provider.slug}
            provider={provider}
            saving={savingSlug === provider.slug}
            onToggle={handleToggle}
            onSaveConfig={handleSaveConfig}
          />
        ))}
      </Space>
    </div>
  );
};

interface ProviderCardProps {
  provider: ProviderConfig;
  saving: boolean;
  onToggle: (slug: string, enabled: boolean) => void;
  onSaveConfig: (slug: string, values: Record<string, string>) => void;
}

const ProviderCard: React.FC<ProviderCardProps> = ({
  provider, saving, onToggle, onSaveConfig,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  return (
    <SectionCard
      title={
        <Space>
          <Text strong>{provider.display_name}</Text>
          {provider.sandbox && <StatusTag status="warning" label="sandbox" />}
          {provider.credentials_pending && <StatusTag status="error" label="credentials pending" />}
          {provider.configured && !provider.credentials_pending && <StatusTag status="success" label="configured" />}
        </Space>
      }
      extra={
        <Switch
          checked={provider.enabled}
          onChange={v => onToggle(provider.slug, v)}
          loading={saving}
          disabled={provider.credentials_pending && !provider.configured}
        />
      }
      style={{ marginBottom: 0 }}
    >
      {provider.credentials_pending && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message={t(
            'payments.providers.pendingCreds',
            'Sandbox credentials pending — pre-stage your configuration here, but transactions will fail with provider_not_configured until R7.x closes.',
          )}
        />
      )}
      {provider.config_fields.length > 0 ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={provider.config_values}
          onFinish={values => onSaveConfig(provider.slug, values)}
        >
          {provider.config_fields.map(field => (
            <Form.Item
              key={field.key}
              label={field.label}
              name={field.key}
              rules={field.required ? [{ required: true }] : []}
            >
              {field.type === 'secret'
                ? <Input.Password autoComplete="new-password" />
                : <Input />}
            </Form.Item>
          ))}
          <Button type="primary" htmlType="submit" loading={saving}>
            {t('common.save', 'Save')}
          </Button>
        </Form>
      ) : (
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          {t('payments.providers.noConfig', 'No configuration required.')}
        </Paragraph>
      )}
    </SectionCard>
  );
};

export default PaymentProvidersPage;
