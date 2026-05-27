/**
 * POSDiscountModal — line-level discount entry.
 *
 * Supports both percentage and fixed-amount discounts. When the user enters
 * a fixed amount we convert to a percentage on commit so the cart row stays
 * single-field (the legacy CartLine has only `discount_percent`).
 */
import React, { useEffect, useState } from 'react';
import {
  Modal,
  Select,
  Radio,
  InputNumber,
  Button,
  Space,
  Typography,
  Divider,
} from 'antd';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/formatters';
import type { TerminalCartLine } from '../../hooks/usePOSTerminal';

const { Text } = Typography;

export interface POSDiscountModalProps {
  open: boolean;
  onClose: () => void;
  cart: TerminalCartLine[];
  onApply: (itemId: string, discountPercent: number) => void;
}

type DiscountKind = 'percent' | 'fixed';

export const POSDiscountModal: React.FC<POSDiscountModalProps> = ({
  open,
  onClose,
  cart,
  onApply,
}) => {
  const { t } = useTranslation();
  const [lineId, setLineId] = useState<string | null>(null);
  const [kind, setKind] = useState<DiscountKind>('percent');
  const [value, setValue] = useState<number>(0);

  useEffect(() => {
    if (open) {
      setLineId(cart[0]?.item_id ?? null);
      setKind('percent');
      setValue(0);
    }
  }, [open, cart]);

  const selected = cart.find((l) => l.item_id === lineId);

  const previewPercent = (() => {
    if (kind === 'percent') return value;
    if (!selected) return 0;
    const base = selected.qty * selected.unit_price;
    if (base <= 0) return 0;
    return Math.min(100, (value / base) * 100);
  })();

  const handleApply = () => {
    if (!selected) return;
    onApply(selected.item_id, Math.max(0, Math.min(100, previewPercent)));
    onClose();
  };

  return (
    <Modal
      title={t('pos.discount')}
      open={open}
      onCancel={onClose}
      onOk={handleApply}
      okText={t('apply')}
      destroyOnHidden
      width={480}
    >
      <Space direction="vertical" style={{ width: '100%' }}>
        <div>
          <Text>{t('pos.line') /* fallback 'Line' */}</Text>
          <Select
            style={{ width: '100%', marginTop: 4 }}
            value={lineId ?? undefined}
            onChange={setLineId}
            placeholder={t('pos.select') /* fallback 'Select' */}
            options={cart.map((l) => ({
              value: l.item_id,
              label: `${l.item_name} (${l.qty} × ${formatCurrency(l.unit_price)})`,
            }))}
          />
        </div>

        <div>
          <Radio.Group value={kind} onChange={(e) => setKind(e.target.value)}>
            <Radio.Button value="percent">%</Radio.Button>
            <Radio.Button value="fixed">{t('amount') /* fallback 'Amount' */}</Radio.Button>
          </Radio.Group>
        </div>

        <InputNumber
          style={{ width: '100%' }}
          value={value}
          min={0}
          max={kind === 'percent' ? 100 : undefined}
          onChange={(v) => setValue(Number(v ?? 0))}
        />

        {selected && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <Text type="secondary">
              {t('pos.applied_percent') /* fallback 'Applied' */}:{' '}
              {previewPercent.toFixed(2)}%
            </Text>
          </>
        )}
      </Space>
    </Modal>
  );
};

export default POSDiscountModal;
