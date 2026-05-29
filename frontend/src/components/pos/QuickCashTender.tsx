/**
 * QuickCashTender — one-tap "exact"/"round up" buttons for IQD cash payment
 * (growth-to-100 § R4.10).
 *
 * Suggests round notes the customer is likely to hand over (5K, 10K, 25K,
 * 50K-rounded). Tapping a button calls `onTender(amount)`; the parent
 * computes change.
 */
import React, { useMemo } from 'react';
import { Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  format as formatIqd,
  quickCashTenders,
} from '../../utils/iqd-denominations';
import { useLanguage } from '../../hooks/useLanguage';
import { useDigitPreference } from '../../contexts/DigitPreferenceContext';

const { Text } = Typography;

interface QuickCashTenderProps {
  /** The amount due — buttons round up from this value. */
  amountDue: number;
  /** Called when the cashier taps a button. */
  onTender: (amount: number) => void;
  /** Optional count of suggestions to render (default 4). */
  count?: number;
}

export const QuickCashTender: React.FC<QuickCashTenderProps> = React.memo(({
  amountDue,
  onTender,
  count = 4,
}) => {
  const { t } = useTranslation(['pos', 'common']);
  const { language } = useLanguage();
  const { useArabicIndic } = useDigitPreference();
  const locale: 'ku' | 'ar' | 'en' = language === 'en' ? 'en' : language === 'ar' ? 'ar' : 'ku';

  const suggestions = useMemo(
    () => quickCashTenders(amountDue, count),
    [amountDue, count],
  );

  if (suggestions.length === 0) return null;

  return (
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      <Text type="secondary">
        {t('pos:tender.title', { defaultValue: 'Quick cash' })}
      </Text>
      <Space wrap>
        {suggestions.map((amount) => (
          <Button
            key={amount}
            type={amount === amountDue ? 'primary' : 'default'}
            onClick={() => onTender(amount)}
          >
            {formatIqd(amount, locale, useArabicIndic)}
          </Button>
        ))}
      </Space>
    </Space>
  );
});

QuickCashTender.displayName = 'QuickCashTender';

export default QuickCashTender;
