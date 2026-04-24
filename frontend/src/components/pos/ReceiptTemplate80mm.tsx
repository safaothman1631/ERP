import React from 'react';
import { Typography } from 'antd';
import { formatCurrency, formatDate } from '../../utils/formatters';

const { Text, Title } = Typography;

interface ReceiptTemplateProps {
  order: any;
  config?: any;
  session?: any;
}

const ReceiptTemplate80mm: React.FC<ReceiptTemplateProps> = ({ order, config, session }) => {
  return (
    <div
      style={{
        width: '80mm',
        fontFamily: 'monospace',
        fontSize: '12px',
        padding: '10mm',
        background: '#fff',
        color: '#000',
      }}
      className="receipt-80mm"
    >
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
          }
          .receipt-80mm {
            width: 80mm !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 16, borderBottom: '2px dashed #000', paddingBottom: 8 }}>
        <Title level={4} style={{ margin: 0 }}>
          {config?.name_ku || config?.name || 'POS Receipt'}
        </Title>
        {config?.receipt_header && (
          <Text>{config.receipt_header.ku || config.receipt_header.en || config.receipt_header}</Text>
        )}
      </div>

      {/* Order Info */}
      <div style={{ marginBottom: 12, fontSize: 11 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text>Order: {order?.order_number}</Text>
          <Text>{formatDate(order?.date || new Date().toISOString())}</Text>
        </div>
        <div>
          <Text>Cashier: {session?.cashier_name || order?.cashier_name}</Text>
        </div>
        {order?.partner_name && (
          <div>
            <Text>Customer: {order.partner_name}</Text>
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', paddingTop: 8, paddingBottom: 8, marginBottom: 8 }}>
        {/* Items */}
        {order?.lines?.map((line: any, idx: number) => (
          <div key={idx} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong>{line.item_name}</Text>
              <Text>{formatCurrency(line.total)}</Text>
            </div>
            <div style={{ fontSize: 10, color: '#666', paddingLeft: 8 }}>
              <Text>
                {line.qty} x {formatCurrency(line.unit_price)}
                {line.discount_percent > 0 && ` (-${line.discount_percent}%)`}
              </Text>
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Subtotal:</Text>
          <Text>{formatCurrency(order?.subtotal || 0)}</Text>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text>Tax:</Text>
          <Text>{formatCurrency(order?.tax_total || 0)}</Text>
        </div>
        {order?.discount_total > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text>Discount:</Text>
            <Text>-{formatCurrency(order.discount_total)}</Text>
          </div>
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 16,
            fontWeight: 'bold',
            borderTop: '2px solid #000',
            paddingTop: 4,
            marginTop: 4,
          }}
        >
          <Text strong>TOTAL:</Text>
          <Text strong>{formatCurrency(order?.total || 0)}</Text>
        </div>
      </div>

      {/* Payments */}
      {order?.payments && order.payments.length > 0 && (
        <div style={{ marginBottom: 12, fontSize: 11 }}>
          <Text strong>Payments:</Text>
          {order.payments.map((payment: any, idx: number) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 8 }}>
              <Text>{payment.payment_method_name}</Text>
              <Text>{formatCurrency(payment.amount)}</Text>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: 11, marginTop: 16, borderTop: '2px dashed #000', paddingTop: 8 }}>
        {config?.receipt_footer ? (
          <Text>{config.receipt_footer.ku || config.receipt_footer.en || config.receipt_footer}</Text>
        ) : (
          <Text>Thank you! سپاس!</Text>
        )}
      </div>
    </div>
  );
};

export default ReceiptTemplate80mm;
