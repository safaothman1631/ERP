import i18n from '../i18n';

const localeMap: Record<string, string> = {
  ku: 'ckb-IQ',
  en: 'en-US',
};

function getLocale(): string {
  return localeMap[i18n.language] || 'en-US';
}

export function formatCurrency(amount: number, currencyCode = 'IQD'): string {
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(getLocale(), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  }).format(d);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(getLocale(), options).format(value);
}
