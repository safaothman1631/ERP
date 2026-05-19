/**
 * MoneyInput — IQD/USD multi-currency input.
 *
 * Features:
 *   - Currency selector (IQD / USD) with locale-aware formatting
 *   - IQD uses ar-IQ locale (Arabic-Iraq numerals) for Kurdish/Arabic users
 *   - USD uses en-US locale for English users
 *   - RTL-aware layout
 *   - Accessible: aria-label, role
 *
 * Requirements: 15.7, 10.4
 * React.memo applied per Requirements 18.4.
 */
import React, { useCallback } from 'react';
import { InputNumber, Select, Space } from 'antd';
import type { InputNumberProps } from 'antd';
import { useTranslation } from 'react-i18next';

export type SupportedCurrency = 'IQD' | 'USD';

export interface MoneyInputProps
  extends Omit<
    InputNumberProps<number>,
    'prefix' | 'addonAfter' | 'formatter' | 'parser' | 'onChange'
  > {
  /** Current amount value */
  value?: number;
  /** Called when amount changes */
  onChange?: (amount: number | null) => void;
  /** Current currency */
  currency?: SupportedCurrency;
  /** Called when currency changes */
  onCurrencyChange?: (currency: SupportedCurrency) => void;
  /** Whether to show the currency selector (defaults to true) */
  showCurrencySelector?: boolean;
  /** Whether to show the currency code as suffix when selector is hidden */
  showCurrencyLabel?: boolean;
  /** Accessible label */
  ariaLabel?: string;
}

const CURRENCY_OPTIONS: { value: SupportedCurrency; label: string }[] = [
  { value: 'IQD', label: 'IQD' },
  { value: 'USD', label: 'USD' },
];

/**
 * Returns the Intl locale string for number formatting based on currency and language.
 * - IQD with Kurdish/Arabic → ar-IQ
 * - USD with any language → en-US
 * - IQD with English → en-US (plain number, currency label shown separately)
 */
function getLocale(currency: SupportedCurrency, lang: string): string {
  if (currency === 'IQD' && (lang === 'ku' || lang === 'ar')) {
    return 'ar-IQ';
  }
  return 'en-US';
}

const MoneyInputInner: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  currency = 'IQD',
  onCurrencyChange,
  showCurrencySelector = true,
  showCurrencyLabel = true,
  ariaLabel,
  min = 0,
  step = 1,
  precision = 2,
  controls = false,
  style,
  disabled,
  ...rest
}) => {
  const { i18n, t } = useTranslation();
  const locale = getLocale(currency, i18n.language);

  const formatter = useCallback(
    (val: number | string | undefined): string => {
      if (val === undefined || val === null || val === '') return '';
      const n = typeof val === 'number' ? val : Number(String(val).replace(/[^\d.-]/g, ''));
      if (Number.isNaN(n)) return String(val);
      try {
        return new Intl.NumberFormat(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: precision,
        }).format(n);
      } catch {
        return n.toLocaleString('en-US', {
          minimumFractionDigits: 0,
          maximumFractionDigits: precision,
        });
      }
    },
    [locale, precision]
  );

  const parser = useCallback(
    (displayValue: string | undefined): number => {
      if (!displayValue) return 0;
      // Strip all non-numeric characters except decimal separator
      const cleaned = displayValue.replace(/[^\d.]/g, '');
      const parsed = Number(cleaned);
      return Number.isNaN(parsed) ? 0 : parsed;
    },
    []
  );

  const currencySelector = showCurrencySelector && onCurrencyChange ? (
    <Select
      value={currency}
      onChange={onCurrencyChange}
      options={CURRENCY_OPTIONS}
      style={{ width: 70 }}
      disabled={disabled}
      aria-label={t('money_input.currency_label', 'Currency')}
      size="small"
    />
  ) : showCurrencyLabel ? (
    <span style={{ padding: '0 8px', userSelect: 'none' }}>{currency}</span>
  ) : undefined;

  return (
    <Space.Compact style={{ width: '100%', ...style }}>
      <InputNumber<number>
        {...rest}
        value={value}
        onChange={onChange}
        min={min}
        step={step}
        precision={precision}
        controls={controls}
        disabled={disabled}
        formatter={formatter}
        parser={parser as InputNumberProps<number>['parser']}
        style={{ flex: 1 }}
        aria-label={ariaLabel ?? t('money_input.amount_label', 'Amount')}
      />
      {currencySelector}
    </Space.Compact>
  );
};

export const MoneyInput = React.memo(MoneyInputInner);

export default MoneyInput;
