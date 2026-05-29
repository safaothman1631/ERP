/**
 * POSCartPanel — cart UI only.
 *
 * Receives the cart and totals from `usePOSTerminal` and renders them.
 * No business logic — all callbacks bubble up.
 */
import React from 'react';
import {
  Card,
  Button,
  Space,
  Typography,
  Divider,
  Empty,
  InputNumber,
  Row,
  Col,
} from 'antd';
import {
  DeleteOutlined,
  MinusOutlined,
  PlusOutlined,
  DollarOutlined,
  SaveOutlined,
  FileTextOutlined,
  TruckOutlined,
  UserOutlined,
  PercentageOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import type { TerminalCartLine } from '../../hooks/usePOSTerminal';

const { Text, Title } = Typography;

export interface POSCartPanelProps {
  cart: TerminalCartLine[];
  customer: unknown | null;
  totals: { subtotal: number; tax: number; total: number };
  currentOrderId: string | null;
  onCustomerClick: () => void;
  onUpdateLine: (itemId: string, updates: Partial<TerminalCartLine>) => void;
  onRemoveLine: (itemId: string) => void;
  onClearCart: () => void;
  onSaveDraft: () => Promise<void> | void;
  onOpenPayment: () => void;
  onOpenDiscount: () => void;
  onQuotation: () => void;
  onShipLater: () => void;
}

export const POSCartPanel: React.FC<POSCartPanelProps> = ({
  cart,
  customer,
  totals,
  currentOrderId,
  onCustomerClick,
  onUpdateLine,
  onRemoveLine,
  onClearCart,
  onSaveDraft,
  onOpenPayment,
  onOpenDiscount,
  onQuotation,
  onShipLater,
}) => {
  const { t } = useTranslation();
  const cust = customer as { display_name?: string; company_name?: string } | null;

  return (
    <div style={{ padding: 16, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Customer */}
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <Space>
            <UserOutlined />
            <Text>
              {cust?.display_name || cust?.company_name || t('pos.walk_in_customer')}
            </Text>
          </Space>
          <Button onClick={onCustomerClick}>
            {customer ? t('change') : t('select')}
          </Button>
        </Space>
      </Card>

      {/* Cart Lines */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
        {cart.length === 0 ? (
          <Empty description={t('pos.cart_empty')} />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            {cart.map((line) => (
              <Card key={line.item_id} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Text strong>{line.item_name}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {line.sku}
                    </Text>
                  </div>
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    onClick={() => onRemoveLine(line.item_id)}
                  />
                </div>
                <Divider style={{ margin: '8px 0' }} />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <Space>
                    <Button
                      icon={<MinusOutlined />}
                      onClick={() =>
                        onUpdateLine(line.item_id, { qty: Math.max(1, line.qty - 1) })
                      }
                    />
                    <InputNumber
                      value={line.qty}
                      min={1}
                      style={{ width: 60 }}
                      onChange={(v) => onUpdateLine(line.item_id, { qty: v || 1 })}
                    />
                    <Button
                      icon={<PlusOutlined />}
                      onClick={() => onUpdateLine(line.item_id, { qty: line.qty + 1 })}
                    />
                  </Space>
                  <Text strong>{formatCurrency(line.total)}</Text>
                </div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <InputNumber
                    placeholder={t('pos.discount')}
                    value={line.discount_percent}
                    min={0}
                    max={100}
                    formatter={(v) => `${v}%`}
                    style={{ width: 80 }}
                    onChange={(v) =>
                      onUpdateLine(line.item_id, { discount_percent: v || 0 })
                    }
                  />
                  <Text type="secondary">@ {formatCurrency(line.unit_price)}</Text>
                </div>
              </Card>
            ))}
          </Space>
        )}
      </div>

      {/* Totals */}
      <Card style={{ marginBottom: 16 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
        >
          <Text>{t('subtotal')}</Text>
          <Text>{formatCurrency(totals.subtotal)}</Text>
        </div>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}
        >
          <Text>{t('tax')}</Text>
          <Text>{formatCurrency(totals.tax)}</Text>
        </div>
        <Divider style={{ margin: '8px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Title level={4} style={{ margin: 0 }}>
            {t('total')}
          </Title>
          <Title level={4} style={{ margin: 0 }}>
            {formatCurrency(totals.total)}
          </Title>
        </div>
      </Card>

      {/* Actions */}
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          type="primary"
          block
          icon={<DollarOutlined />}
          onClick={onOpenPayment}
          disabled={cart.length === 0}
        >
          {t('pos.payment')}
        </Button>
        <Row gutter={8}>
          <Col span={12}>
            <Button block icon={<SaveOutlined />} onClick={() => void onSaveDraft()}>
              {t('pos.save_draft')}
            </Button>
          </Col>
          <Col span={12}>
            <Button
              block
              icon={<PercentageOutlined />}
              onClick={onOpenDiscount}
              disabled={cart.length === 0}
            >
              {t('pos.discount')}
            </Button>
          </Col>
        </Row>
        <Row gutter={8}>
          <Col span={12}>
            <Button
              block
              icon={<FileTextOutlined />}
              onClick={onQuotation}
              disabled={!currentOrderId}
            >
              {t('pos.quotation')}
            </Button>
          </Col>
          <Col span={12}>
            <Button
              block
              icon={<TruckOutlined />}
              onClick={onShipLater}
              disabled={!currentOrderId}
            >
              {t('pos.ship_later')}
            </Button>
          </Col>
        </Row>
        <Button block danger onClick={onClearCart} disabled={cart.length === 0}>
          {t('pos.clear_cart')}
        </Button>
      </Space>
    </div>
  );
};

export default POSCartPanel;
