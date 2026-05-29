/**
 * WHTBreakdown — invoice-form sidebar showing gross / withheld / net payable
 * (growth-to-100 § R4.5).
 *
 * Subscribes to the parent invoice's gross amount + service category + customer
 * type and calls `/api/tax/wht/calculate` (or computes locally via the same
 * formula). When the calculator returns `placeholder_rate: true` we show a
 * yellow badge so the user knows the rate is unverified pending R7.1.
 */
import React, { useMemo } from 'react';
import { Card, Descriptions, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import { formatCurrency } from '../../utils/formatCurrency';
import { useLanguage } from '../../hooks/useLanguage';
import { useDigitPreference } from '../../contexts/DigitPreferenceContext';

const { Text } = Typography;

export type WHTType = 'services' | 'rent' | 'materials' | 'other';
export type CustomerType = 'b2b' | 'b2c' | 'b2g';

interface WHTBreakdownProps {
  /** Gross invoice amount (subtotal + tax, pre-withholding). */
  grossAmount: number;
  /** Type of supply — drives the default rate. */
  whtType?: WHTType;
  /** Customer payer type — B2C is exempt. */
  customerType?: CustomerType;
  /** Optional tenant override of the rate. */
  rateOverridePercent?: number;
  /** IQD by default. */
  currency?: string;
  /** Optional flag from the rate-table API: the rate is unverified. */
  placeholderRate?: boolean;
}

const DEFAULT_RATES: Record<WHTType, number> = {
  services: 3,
  rent: 5,
  materials: 2,
  other: 0,
};

export const WHTBreakdown: React.FC<WHTBreakdownProps> = React.memo(({
  grossAmount,
  whtType = 'services',
  customerType = 'b2b',
  rateOverridePercent,
  currency = 'IQD',
  placeholderRate = true,  // default: every Iraqi rate is a placeholder until R7.1
}) => {
  const { t } = useTranslation(['invoices', 'common']);
  const { language } = useLanguage();
  const { useArabicIndic } = useDigitPreference();

  const breakdown = useMemo(() => {
    const safeGross = Number.isFinite(grossAmount) && grossAmount > 0 ? grossAmount : 0;
    const ratePct = rateOverridePercent ?? DEFAULT_RATES[whtType];
    const applicable = customerType !== 'b2c' && ratePct > 0;
    const withheld = applicable ? Math.round((safeGross * ratePct) / 100) : 0;
    return {
      gross: safeGross,
      rate: applicable ? ratePct : 0,
      withheld,
      net: safeGross - withheld,
      applied: applicable,
    };
  }, [grossAmount, whtType, customerType, rateOverridePercent]);

  // Use the existing formatter — we just pass the locale through.
  const fmt = (n: number) => formatCurrency(n, currency, useArabicIndic ? `${language}-u-nu-arab` : language);

  return (
    <Card
      size="small"
      title={t('invoices:wht.title', { defaultValue: 'Withholding tax (WHT)' })}
      extra={placeholderRate ? (
        <Tag color="warning">
          {t('invoices:wht.placeholder', { defaultValue: 'Placeholder rate · R7.1' })}
        </Tag>
      ) : null}
    >
      <Descriptions column={1} size="small" colon>
        <Descriptions.Item label={t('invoices:wht.gross', { defaultValue: 'Gross amount' })}>
          <Text>{fmt(breakdown.gross)}</Text>
        </Descriptions.Item>
        <Descriptions.Item
          label={t('invoices:wht.rate', { defaultValue: 'Rate' })}
        >
          {breakdown.applied ? (
            <Text>{breakdown.rate}%</Text>
          ) : (
            <Tag>
              {customerType === 'b2c'
                ? t('invoices:wht.b2c_exempt', { defaultValue: 'B2C — not applicable' })
                : t('invoices:wht.zero', { defaultValue: '0% — none' })}
            </Tag>
          )}
        </Descriptions.Item>
        <Descriptions.Item label={t('invoices:wht.withheld', { defaultValue: 'WHT withheld' })}>
          <Text type="danger">- {fmt(breakdown.withheld)}</Text>
        </Descriptions.Item>
        <Descriptions.Item label={t('invoices:wht.net_payable', { defaultValue: 'Net payable' })}>
          <Text strong>{fmt(breakdown.net)}</Text>
        </Descriptions.Item>
      </Descriptions>
    </Card>
  );
});

WHTBreakdown.displayName = 'WHTBreakdown';

export default WHTBreakdown;
