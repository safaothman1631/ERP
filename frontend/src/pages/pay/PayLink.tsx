/**
 * Public hosted payment page (launch-readiness § R4.16).
 *
 * Route: ``/pay/:token``. The token is a signed JWT issued by
 * ``POST /api/invoices/{id}/pay-link`` carrying ``{tid, iid, amt, cur, exp}``.
 * The browser POSTs the token to the public verify endpoint, which returns
 * invoice details + the tenant's enabled providers. The customer then picks
 * a provider and proceeds to its checkout (QR scan, Stripe redirect, etc.).
 *
 * No auth: this page is intentionally tenant-anonymous; only the JWT proves
 * intent.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Spin, Typography, Result } from 'antd';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import POSPaymentMethodPicker, {
  type PaymentProviderOption,
  type PaymentMethodPayload,
} from '../../components/pos/POSPaymentMethodPicker';

const { Title, Text } = Typography;

interface PayLinkInvoice {
  invoice_number: string;
  vendor_name: string;
  amount_due: number;
  currency: string;
  description?: string;
  providers: PaymentProviderOption[];
  expired: boolean;
}

const PayLinkPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<PayLinkInvoice | null>(null);
  const [completed, setCompleted] = useState(false);

  // Online state — same heuristic as POS.
  const isOnline = useMemo(() => typeof navigator !== 'undefined' ? navigator.onLine : true, []);

  useEffect(() => {
    if (!token) {
      setError(t('pay.invalidToken', 'Invalid payment link'));
      setLoading(false);
      return;
    }
    const verify = async () => {
      try {
        const res = await api.post<PayLinkInvoice>('/api/payment-links/verify', { token });
        setInvoice(res.data);
        if (res.data.expired) {
          setError(t('pay.expired', 'This payment link has expired'));
        }
      } catch (e) {
        setError(t('pay.notFound', 'Payment link not found or expired'));
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, [token, t]);

  const handleProviderSelected = async (slug: string, payload: PaymentMethodPayload) => {
    if (!invoice || !token) return;
    try {
      const res = await api.post('/api/payments/initiate', {
        amount: invoice.amount_due,
        currency: invoice.currency,
        provider_slug: slug,
        order: {
          invoice_id: undefined,    // resolved server-side from token
          customer_email: undefined,
          metadata: { pay_link_token: token, ...payload.metadata },
        },
      });
      // For client_secret / redirect next_action_kind, hand off to provider here.
      // For now we treat any 201 as success — the page completes with a thank you.
      if (res.status === 200 || res.status === 201) {
        setCompleted(true);
      }
    } catch (e) {
      setError(t('pay.initiateFailed', 'Could not initiate payment. Please try again.'));
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '6rem auto' }} />;

  if (error) {
    return (
      <Result
        status="error"
        title={t('pay.errorTitle', 'Unable to load payment')}
        subTitle={error}
      />
    );
  }

  if (completed) {
    return (
      <Result
        status="success"
        title={t('pay.thanks', 'Thank you for your payment!')}
        subTitle={t('pay.receiptSoon', 'A receipt has been sent to your email.')}
      />
    );
  }

  if (!invoice) return null;

  return (
    <div style={{ maxWidth: 720, margin: '2rem auto', padding: '0 1rem' }}>
      <Card>
        <Title level={3}>{invoice.vendor_name}</Title>
        <Text type="secondary">{t('pay.invoiceNumber', 'Invoice')} #{invoice.invoice_number}</Text>
        {invoice.description && (
          <div style={{ marginTop: 8 }}>
            <Text>{invoice.description}</Text>
          </div>
        )}
        <div style={{ marginTop: 16 }}>
          <Title level={4}>
            {invoice.amount_due} {invoice.currency}
          </Title>
        </div>
      </Card>
      <Card style={{ marginTop: 12 }}>
        <POSPaymentMethodPicker
          total={invoice.amount_due}
          currency={invoice.currency}
          isOnline={isOnline}
          providers={invoice.providers}
          onSelect={handleProviderSelected}
        />
      </Card>
    </div>
  );
};

export default PayLinkPage;
