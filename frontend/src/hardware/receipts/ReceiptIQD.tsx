/**
 * ReceiptIQD — Iraqi-Dinar-specific receipt rendering helpers + component.
 *
 * Spec: growth-to-100/requirements.md R3.10 (IQD denomination breakdown,
 * optional Arabic-Indic digits, optional Hijri date).
 *
 * This is a thin wrapper that decides between Receipt58mm and Receipt80mm
 * based on paper width, and ensures IQD-specific fields are populated:
 *   - currency forced to 'IQD'
 *   - change breakdown computed if not supplied
 *   - Arabic-Indic toggle threaded through
 */
import React from 'react';
import { breakdownIQD } from '../printers/commands';
import type { ReceiptModel } from '../printers/types';
import { Receipt58mm } from './Receipt58mm';
import { Receipt80mm } from './Receipt80mm';

interface Props {
  model: Omit<ReceiptModel, 'currency'> & { currency?: 'IQD' };
  paperWidthMm?: 58 | 80;
  useArabicIndicDigits?: boolean;
  showHijri?: boolean;
  forPrint?: boolean;
}

/** Convert Gregorian → Hijri (UmAlQura). Best-effort using Intl. */
function toHijri(iso: string): string | undefined {
  try {
    const d = new Date(iso);
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(d);
  } catch {
    return undefined;
  }
}

export const ReceiptIQD: React.FC<Props> = ({
  model,
  paperWidthMm = 80,
  useArabicIndicDigits = false,
  showHijri = false,
  forPrint,
}) => {
  const fullModel: ReceiptModel = {
    ...model,
    currency: 'IQD',
    useArabicIndicDigits,
    issuedAtHijri: showHijri ? toHijri(model.issuedAt) : undefined,
    changeDenominations:
      model.changeDenominations ??
      (typeof model.changeMinor === 'number' && model.changeMinor > 0
        ? breakdownIQD(model.changeMinor)
        : undefined),
  };

  return paperWidthMm === 58 ? (
    <Receipt58mm model={fullModel} forPrint={forPrint} />
  ) : (
    <Receipt80mm model={fullModel} forPrint={forPrint} />
  );
};

export default ReceiptIQD;
