/**
 * Arabic / Kurdish RTL receipt template — same content, RTL container
 * + Arabic-Indic digits on by default.
 *
 * Used by shops in Sulaymaniyah / Erbil that prefer the Arabic-script
 * presentation. Item labels are rendered in whatever script the operator
 * entered; the layout flips to right-to-left.
 */
import React from 'react';
import { ReceiptIQD } from '../ReceiptIQD';
import type { ReceiptModel } from '../../printers/types';

interface Props {
  model: ReceiptModel;
  paperWidthMm?: 58 | 80;
  useArabicIndicDigits?: boolean;
}

export const ArabicReceipt: React.FC<Props> = ({
  model,
  paperWidthMm = 80,
  useArabicIndicDigits = true,
}) => (
  <div dir="rtl" lang="ar" style={{ direction: 'rtl' }}>
    <ReceiptIQD
      model={model}
      paperWidthMm={paperWidthMm}
      useArabicIndicDigits={useArabicIndicDigits}
      showHijri
    />
  </div>
);

export default ArabicReceipt;
