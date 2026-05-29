/**
 * POSPaymentModal — payment selection (cash, card, split) with change calc.
 */
import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Card,
  Space,
  Typography,
  InputNumber,
  Row,
  Col,
  Divider,
  Tag,
} from 'antd';
import {
  DollarOutlined,
  CreditCardOutlined,
  DeleteOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import type { PosPaymentPayload } from '../../pos/posOfflineQueue';

const { Title, Text } = Typography;

export interface PaymentMethod {
  id: string;
  name: string;
  name_ku?: string;
  type?: string;
}

interface SelectedPayment {
  method_id: string;
  method_name: string;
  amount: number;
  tendered: number;
}

export interface POSPaymentModalProps {
  open: boolean;
  onClose: () => void;
  total: number;
  paymentMethods: PaymentMethod[];
  onConfirm: (payments: PosPaymentPayload[]) => Promise<{ ok: boolean; offline: boolean }>;
}

export const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  open,
  onClose,
  total,
  paymentMethods,
  onConfirm,
}) => {
  const { t } = useTranslation();
  const [selectedPayments, setSelectedPayments] = useState<SelectedPayment[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Reset on open
  useEffect(() => {
    if (open) setSelectedPayments([]);
  }, [open]);

  const paid = useMemo(
    () => selectedPayments.reduce((sum, p) => sum + (p.amount || 0), 0),
    [selectedPayments],
  );

  const change = useMemo(() => Math.max(0, paid - total), [paid, total]);
  const remaining = useMemo(() => Math.max(0, total - paid), [total, paid]);

  const addPaymentMethod = (methodId: string) => {
    const method = paymentMethods.find((m) => m.id === methodId);
    if (!method) return;
    const rest = total - paid;
    setSelectedPayments((prev) => [
      ...prev,
      {
        method_id: methodId,
        method_name: method.name_ku || method.name,
        amount: rest > 0 ? rest : 0,
        tendered: rest > 0 ? rest : 0,
      },
    ]);
  };

  const removePayment = (idx: number) => {
    setSelectedPayments((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateAmount = (idx: number, value: number) => {
    setSelectedPayments((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, amount: value, tendered: value } : p)),
    );
  };

  const handleConfirm = async () => {
    if (paid < total) return;
    setSubmitting(true);
    try {
      const payments: PosPaymentPayload[] = selectedPayments.map((p) => ({
        payment_method_id: p.method_id,
        amount: p.amount,
        tendered: p.tendered,
      }));
      await onConfirm(payments);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={t('pos.payment')}
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
      width={640}
    >
      <div style={{ marginBottom: 16, padding: 16, background: '#f5f5f5', borderRadius: 8 }}>
        <Title level={3} style={{ margin: 0 }}>{formatCurrency(total)}</Title>
        <Text type="secondary">{t('pos.amount_to_pay')}</Text>
        {paid > 0 && (
          <div style={{ marginTop: 8 }}>
            <Tag color="processing">{t('pos.paid') /* fallback to 'Paid' */}: {formatCurrency(paid)}</Tag>
            {remaining > 0 && <Tag color="warning">{t('pos.remaining')}: {formatCurrency(remaining)}</Tag>}
            {change > 0 && <Tag color="success">{t('pos.change')}: {formatCurrency(change)}</Tag>}
          </div>
        )}
      </div>

      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text strong>{t('pos.select_payment_method')}</Text>
          <Row gutter={[8, 8]} style={{ marginTop: 8 }}>
            {paymentMethods.map((method) => (
              <Col key={method.id} span={12}>
                <Button
                  block
                  icon={method.type === 'cash' ? <DollarOutlined /> : <CreditCardOutlined />}
                  onClick={() => addPaymentMethod(method.id)}
                >
                  {method.name_ku || method.name}
                </Button>
              </Col>
            ))}
          </Row>
        </div>

        {selectedPayments.length > 0 && (
          <div>
            <Divider style={{ margin: '8px 0' }} />
            <Text strong>{t('pos.payments')}</Text>
            <Space direction="vertical" style={{ width: '100%', marginTop: 8 }}>
              {selectedPayments.map((payment, idx) => (
                <Card key={idx} bodyStyle={{ padding: 12 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Text>{payment.method_name}</Text>
                    <Space>
                      <InputNumber
                        value={payment.amount}
                        min={0}
                        style={{ width: 150 }}
                        onChange={(v) => updateAmount(idx, Number(v ?? 0))}
                      />
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removePayment(idx)}
                      />
                    </Space>
                  </div>
                </Card>
              ))}
            </Space>
          </div>
        )}

        <Button
          type="primary"
          block
          icon={<CheckOutlined />}
          loading={submitting}
          onClick={() => void handleConfirm()}
          disabled={paid < total}
        >
          {t('pos.validate_payment')}
        </Button>
      </Space>
    </Modal>
  );
};

export default POSPaymentModal;
