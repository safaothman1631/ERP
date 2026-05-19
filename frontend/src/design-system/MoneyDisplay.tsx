/**
 * MoneyDisplay — formatted money with <bdi> wrapper for mixed-direction strings.
 *
 * Wraps the formatted amount in a <bdi> (Bidirectional Isolation) element to
 * prevent numbers + Kurdish/Arabic text from causing direction confusion in
 * mixed-direction contexts (e.g. "١٢٣,٤٥٦ د.ع" inside an RTL paragraph).
 *
 * Uses formatMoney() from utils/format.ts for locale-aware formatting:
 *   - IQD with Kurdish/Arabic: ar-IQ locale
 *   - USD with English: en-US locale
 *
 * Requirements: 10.4, 10.6, 15.8
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { formatMoney } from '../utils/format';
import { resolveLanguage } from '../utils/language';

export interface MoneyDisplayProps {
  /** The numeric amount to display */
  amount: number;
  /** ISO 4217 currency code — defaults to 'IQD' */
  currency?: 'IQD' | 'USD' | string;
  /** Override the language for formatting (defaults to current i18n language) */
  lang?: 'ku' | 'en' | 'ar';
  /** Additional CSS class for the outer <bdi> element */
  className?: string;
  /** Inline style for the outer <bdi> element */
  style?: React.CSSProperties;
}

/**
 * MoneyDisplay renders a formatted monetary value wrapped in a <bdi> element.
 *
 * The <bdi> tag isolates the text direction of the money string from the
 * surrounding content, which is critical when displaying numbers alongside
 * Kurdish or Arabic text (Requirement 10.6).
 *
 * React.memo applied per Requirements 18.4.
 *
 * @example
 *   <MoneyDisplay amount={1234567.89} currency="IQD" />
 *   // Renders: <bdi>١٬٢٣٤٬٥٦٧٫٨٩ د.ع.‏</bdi>  (in ku/ar mode)
 *   // Renders: <bdi>IQD 1,234,567.89</bdi>       (in en mode)
 */
const MoneyDisplayInner: React.FC<MoneyDisplayProps> = ({
  amount,
  currency = 'IQD',
  lang,
  className,
  style,
}) => {
  const { i18n } = useTranslation();
  const resolvedLang = resolveLanguage(lang ?? i18n.language ?? 'ku');
  const formatted = formatMoney(amount, currency, resolvedLang);

  return (
    // <bdi> isolates the bidirectional text algorithm for the money string,
    // preventing direction bleed from surrounding RTL/LTR content.
    // Requirements: 10.6
    <bdi className={className} style={style}>
      {formatted}
    </bdi>
  );
};

export const MoneyDisplay = React.memo(MoneyDisplayInner);

export default MoneyDisplay;
