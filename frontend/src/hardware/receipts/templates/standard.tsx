/**
 * Standard receipt template — the canonical layout used by 80 % of
 * shopkeepers. Header + meta + lines + totals + footer.
 *
 * This file is a thin re-export of ReceiptIQD with a built-in sample
 * model, used by the pairing wizard's "preview" stage and Storybook.
 */
import React from 'react';
import { ReceiptIQD } from '../ReceiptIQD';
import type { ReceiptModel } from '../../printers/types';

interface Props {
  model: ReceiptModel;
  paperWidthMm?: 58 | 80;
}

export const StandardReceipt: React.FC<Props> = ({ model, paperWidthMm = 80 }) => (
  <ReceiptIQD model={model} paperWidthMm={paperWidthMm} />
);

export const SAMPLE_STANDARD: ReceiptModel = {
  shopName: 'Bazaar Grocery / فرۆشگای بازار',
  shopAddress: 'Erbil, 60-Meter Rd.',
  shopPhone: '+964 750 123 4567',
  shopVAT: '12345678',
  receiptNumber: 'INV-2026-00012',
  cashier: 'Rebin',
  terminalId: 'T-001',
  issuedAt: new Date().toISOString(),
  currency: 'IQD',
  lines: [
    { label: 'Sangak Bread', qty: 2, unitPriceMinor: 1000 },
    { label: 'Yoghurt 1L', qty: 1, unitPriceMinor: 3500 },
    { label: 'Tea (250g)', qty: 1, unitPriceMinor: 4750, discountMinor: 250 },
  ],
  subtotalMinor: 9250,
  taxes: [],
  totalMinor: 9250,
  tenderedMinor: 10000,
  changeMinor: 750,
};

export default StandardReceipt;
