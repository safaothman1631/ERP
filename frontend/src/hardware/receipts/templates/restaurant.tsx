/**
 * Restaurant receipt — kitchen ticket variant.
 *
 * Differences from the standard template:
 *   - Table number / server prominent at the top.
 *   - Item modifiers indented under each line.
 *   - No tax breakdown (restaurants usually include tax in price).
 *   - "Kitchen copy" watermark on the alternate side.
 */
import React from 'react';
import { ReceiptIQD } from '../ReceiptIQD';
import type { ReceiptModel } from '../../printers/types';

export interface RestaurantReceiptModel extends ReceiptModel {
  tableNumber?: string;
  serverName?: string;
  isKitchenCopy?: boolean;
}

interface Props {
  model: RestaurantReceiptModel;
  paperWidthMm?: 58 | 80;
}

export const RestaurantReceipt: React.FC<Props> = ({ model, paperWidthMm = 80 }) => {
  const augmentedFooter = [
    model.tableNumber ? `Table: ${model.tableNumber}` : null,
    model.serverName ? `Server: ${model.serverName}` : null,
    model.isKitchenCopy ? '*** KITCHEN COPY ***' : null,
    model.footer ?? null,
  ]
    .filter(Boolean)
    .join('  •  ');
  return <ReceiptIQD model={{ ...model, footer: augmentedFooter || undefined }} paperWidthMm={paperWidthMm} />;
};

export default RestaurantReceipt;
