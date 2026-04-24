import React from 'react';
import { InputNumber, type InputNumberProps } from 'antd';
import { useTranslation } from 'react-i18next';

export interface MoneyInputProps extends Omit<InputNumberProps<number>, 'prefix' | 'addonAfter' | 'formatter' | 'parser'> {
  currency?: string; // ISO code: IQD, USD, EUR ...
  showCurrency?: boolean;
}

/**
 * MoneyInput — InputNumber + formatting + currency suffix.
 * RTL-aware. Default currency = IQD.
 */
export const MoneyInput: React.FC<MoneyInputProps> = ({
  currency = 'IQD',
  showCurrency = true,
  min = 0,
  step = 0.01,
  precision = 2,
  controls = false,
  style,
  ...rest
}) => {
  const { i18n } = useTranslation();
  const locale = i18n.language === 'ku' || i18n.language === 'ar' ? 'en-US' : 'en-US';

  return (
    <InputNumber<number>
      {...rest}
      min={min}
      step={step}
      precision={precision}
      controls={controls}
      addonAfter={showCurrency ? currency : undefined}
      formatter={(value) => {
        if (value === undefined || value === null) return '';
        const n = typeof value === 'number' ? value : Number(value);
        if (Number.isNaN(n)) return String(value);
        return n.toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: precision });
      }}
      parser={(displayValue) => {
        if (!displayValue) return 0;
        return Number(String(displayValue).replace(/[^\d.-]/g, '')) as never;
      }}
      style={{ width: '100%', ...style }}
    />
  );
};

export default MoneyInput;
