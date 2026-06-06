/**
 * POSPaymentMethodPicker — tile grid of enabled payment providers.
 * (launch-readiness § R4.15)
 *
 * Behaviour per provider:
 *   - cash:    opens numpad → confirm → POST /api/payments/initiate
 *   - cod:     confirm dialog → POST /api/payments/initiate
 *   - stripe:  shows "online required" if offline, else QR / terminal hand-off
 *   - fastpay: QR display (placeholder URL until R7.2)
 *   - qi:      hosted-page redirect (placeholder until R7.3)
 *   - zain:    OTP input (placeholder until R7.4)
 *
 * Offline handling: cash & COD work fully offline (queued via existing
 * ``posOfflineQueue``). Online providers show an inline alert until
 * connectivity returns.
 */
import React, { useMemo, useState } from 'react';
import { Alert, Card, Col, Input, InputNumber, Modal, QRCode, Row, Space, Tag, Typography } from 'antd';
import {
  DollarOutlined,
  TruckOutlined,
  CreditCardOutlined,
  QrcodeOutlined,
  MobileOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export interface PaymentProviderOption {
  slug: string;
  display_name: string;
  enabled: boolean;
  /** True when the provider has working credentials in the tenant config. */
  configured: boolean;
  /** True when the provider can only operate online. */
  online_only: boolean;
}

export interface POSPaymentMethodPickerProps {
  total: number;
  currency: string;
  isOnline: boolean;
  providers: PaymentProviderOption[];
  onSelect: (slug: string, payload: PaymentMethodPayload) => Promise<void>;
  onClose?: () => void;
}

export interface PaymentMethodPayload {
  slug: string;
  tendered?: number;
  change?: number;
  metadata?: Record<string, string>;
}

const PROVIDER_ICONS: Record<string, React.ReactNode> = {
  cash: <DollarOutlined style={{ fontSize: 36 }} />,
  cod: <TruckOutlined style={{ fontSize: 36 }} />,
  stripe: <CreditCardOutlined style={{ fontSize: 36 }} />,
  fastpay: <QrcodeOutlined style={{ fontSize: 36 }} />,
  qi: <CreditCardOutlined style={{ fontSize: 36 }} />,
  zain: <MobileOutlined style={{ fontSize: 36 }} />,
  asia_pay: <CreditCardOutlined style={{ fontSize: 36 }} />,
};

export const POSPaymentMethodPicker: React.FC<POSPaymentMethodPickerProps> = ({
  total, currency, isOnline, providers, onSelect, onClose,
}) => {
  const { t } = useTranslation();
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const enabledProviders = useMemo(
    () => providers.filter(p => p.enabled),
    [providers],
  );

  const tileDisabled = (p: PaymentProviderOption) => {
    if (!p.configured) return true;
    if (p.online_only && !isOnline) return true;
    return false;
  };

  return (
    <div>
      <Title level={4}>
        {t('pos.payment.pickerTitle', 'Choose Payment Method')}
        {' '}<Tag color="blue">{t('pos.payment.total', 'Total')}: {total} {currency}</Tag>
      </Title>
      {!isOnline && (
        <Alert
          type="warning"
          showIcon
          icon={<WifiOutlined />}
          message={t('pos.payment.offline', 'Offline — only Cash and COD are available.')}
          style={{ marginBottom: 12 }}
        />
      )}
      <Row gutter={[12, 12]}>
        {enabledProviders.map(p => {
          const disabled = tileDisabled(p);
          return (
            <Col xs={12} sm={8} md={6} key={p.slug}>
              <Card
                hoverable={!disabled}
                onClick={() => !disabled && setActiveSlug(p.slug)}
                style={{
                  textAlign: 'center',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  minHeight: 130,
                }}
              >
                {PROVIDER_ICONS[p.slug] ?? <CreditCardOutlined style={{ fontSize: 36 }} />}
                <div style={{ marginTop: 8 }}>
                  <Text strong>{p.display_name}</Text>
                </div>
                {!p.configured && (
                  <Tag color="red" style={{ marginTop: 6 }}>
                    {t('pos.payment.notConfigured', 'Not configured')}
                  </Tag>
                )}
                {p.online_only && !isOnline && (
                  <Tag color="orange" style={{ marginTop: 6 }}>
                    {t('pos.payment.onlineRequired', 'Online required')}
                  </Tag>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {activeSlug && (
        <ProviderFlowModal
          slug={activeSlug}
          total={total}
          currency={currency}
          submitting={submitting}
          onClose={() => setActiveSlug(null)}
          onConfirm={async (payload) => {
            setSubmitting(true);
            try {
              await onSelect(activeSlug, payload);
              setActiveSlug(null);
              onClose?.();
            } finally {
              setSubmitting(false);
            }
          }}
        />
      )}
    </div>
  );
};

// ── Per-provider flow modals ─────────────────────────────────────────────

interface FlowProps {
  slug: string;
  total: number;
  currency: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (payload: PaymentMethodPayload) => Promise<void>;
}

const ProviderFlowModal: React.FC<FlowProps> = ({
  slug, total, currency, submitting, onClose, onConfirm,
}) => {
  switch (slug) {
    case 'cash':
      return <CashFlow {...{ total, currency, submitting, onClose, onConfirm }} />;
    case 'cod':
      return <CODFlow {...{ total, currency, submitting, onClose, onConfirm }} />;
    case 'stripe':
      return <StripeFlow {...{ total, currency, submitting, onClose, onConfirm }} />;
    case 'fastpay':
    case 'qi':
      return <QRFlow slug={slug} {...{ total, currency, submitting, onClose, onConfirm }} />;
    case 'zain':
      return <OTPFlow {...{ total, currency, submitting, onClose, onConfirm }} />;
    default:
      return null;
  }
};

const CashFlow: React.FC<Omit<FlowProps, 'slug'>> = ({
  total, currency, submitting, onClose, onConfirm,
}) => {
  const { t } = useTranslation();
  const [tendered, setTendered] = useState<number>(total);
  const change = Math.max(0, tendered - total);
  return (
    <Modal
      open
      onCancel={onClose}
      onOk={() => onConfirm({ slug: 'cash', tendered, change })}
      okText={t('pos.payment.collect', 'Collect Cash')}
      confirmLoading={submitting}
      title={t('pos.payment.cashTitle', 'Cash Payment')}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text>{t('pos.payment.total', 'Total')}: </Text>
          <Text strong>{total} {currency}</Text>
        </div>
        <div>
          <Text>{t('pos.payment.tendered', 'Tendered')}: </Text>
          <InputNumber
            value={tendered}
            min={0}
            step={1000}
            onChange={v => setTendered(Number(v ?? 0))}
            style={{ width: 200 }}
          />
        </div>
        <div>
          <Text>{t('pos.payment.change', 'Change')}: </Text>
          <Text strong>{change} {currency}</Text>
        </div>
      </Space>
    </Modal>
  );
};

const CODFlow: React.FC<Omit<FlowProps, 'slug'>> = ({
  total, currency, submitting, onClose, onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      open
      onCancel={onClose}
      onOk={() => onConfirm({ slug: 'cod' })}
      okText={t('pos.payment.markCOD', 'Mark as COD')}
      confirmLoading={submitting}
      title={t('pos.payment.codTitle', 'Cash on Delivery')}
    >
      <Text>
        {t(
          'pos.payment.codConfirm',
          'This order will be marked Cash on Delivery and the courier will collect {{total}} {{currency}} at the door.',
          { total, currency },
        )}
      </Text>
    </Modal>
  );
};

const StripeFlow: React.FC<Omit<FlowProps, 'slug'>> = ({
  total, currency, submitting, onClose, onConfirm,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      open
      onCancel={onClose}
      onOk={() => onConfirm({ slug: 'stripe' })}
      okText={t('pos.payment.tapToCharge', 'Charge Card')}
      confirmLoading={submitting}
      title={t('pos.payment.stripeTitle', 'Card Payment (Stripe)')}
    >
      <Text>
        {t(
          'pos.payment.stripeDescription',
          'A Stripe Payment Intent will be created. Use a connected terminal or display the QR for the customer to pay {{total}} {{currency}}.',
          { total, currency },
        )}
      </Text>
    </Modal>
  );
};

const QRFlow: React.FC<FlowProps> = ({
  slug, total, currency, submitting, onClose, onConfirm,
}) => {
  const { t } = useTranslation();
  // Placeholder QR string — real value comes from POST /initiate next_action.
  const qrValue = `${slug}-pending:${total}:${currency}`;
  return (
    <Modal
      open
      onCancel={onClose}
      onOk={() => onConfirm({ slug })}
      okText={t('pos.payment.markPaid', 'Mark as Paid')}
      confirmLoading={submitting}
      title={t('pos.payment.scanQR', 'Scan to Pay — {{provider}}', { provider: slug })}
    >
      <Space direction="vertical" align="center" style={{ width: '100%' }}>
        <QRCode value={qrValue} size={200} />
        <Text>{total} {currency}</Text>
        <Alert
          type="info"
          message={t(
            'pos.payment.qrPlaceholder',
            'Placeholder QR — real provider QR will be returned by /api/payments/initiate once credentials are configured.',
          )}
        />
      </Space>
    </Modal>
  );
};

const OTPFlow: React.FC<Omit<FlowProps, 'slug'>> = ({
  total, currency, submitting, onClose, onConfirm,
}) => {
  const { t } = useTranslation();
  const [otp, setOtp] = useState('');
  return (
    <Modal
      open
      onCancel={onClose}
      onOk={() => onConfirm({ slug: 'zain', metadata: { otp } })}
      okText={t('pos.payment.confirmOTP', 'Confirm OTP')}
      confirmLoading={submitting}
      title={t('pos.payment.zainTitle', 'Zain Cash')}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <Text>{t('pos.payment.zainDescription',
          'An OTP will be sent to the customer wallet. Enter the code to confirm.')}</Text>
        <Input
          value={otp}
          onChange={e => setOtp(e.target.value)}
          placeholder="OTP"
          maxLength={8}
        />
        <Text>{total} {currency}</Text>
      </Space>
    </Modal>
  );
};

export default POSPaymentMethodPicker;
