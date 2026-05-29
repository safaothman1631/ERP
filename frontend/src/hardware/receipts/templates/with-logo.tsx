/**
 * With-logo receipt — same as standard but rasterises a monochrome logo
 * on top. Logos are pre-rendered to a PNG dataURL by the shop owner
 * during onboarding; we pass it through to the `Receipt80mm` component
 * which knows to render it centred.
 *
 * On the thermal printer side, logo bytes are sent via ESC * (bitmap
 * select) — not yet implemented in the dialect layer (planned in a
 * future iteration when the lab has a known-good logo fixture).
 */
import React from 'react';
import { ReceiptIQD } from '../ReceiptIQD';
import type { ReceiptModel } from '../../printers/types';

interface Props {
  model: ReceiptModel;
  logoPngDataUrl: string;
  paperWidthMm?: 58 | 80;
}

export const WithLogoReceipt: React.FC<Props> = ({ model, logoPngDataUrl, paperWidthMm = 80 }) => (
  <ReceiptIQD model={{ ...model, logoPngDataUrl }} paperWidthMm={paperWidthMm} />
);

export default WithLogoReceipt;
