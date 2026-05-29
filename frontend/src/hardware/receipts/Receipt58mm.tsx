/**
 * Receipt58mm — React component rendering a 58mm-width receipt preview.
 *
 * Spec: growth-to-100/requirements.md R3.10 (58mm template), §3.6.
 *
 * Used by:
 *   - The pairing wizard's `TestPrintPreview` to show what will be printed.
 *   - The browser-print fallback (`PrinterService.browserPrintFallback`).
 *   - The receipt preview drawer in POS terminal.
 *
 * Width: 58mm at 8 dots/mm → ~46 dots usable → 32 chars at 12-dot font.
 */
import React from 'react';
import { breakdownIQD, formatIQD, toArabicIndic } from '../printers/commands';
import type { ReceiptModel } from '../printers/types';

const COL_WIDTH = 32;
const CELL = '6px';

interface Props {
  model: ReceiptModel;
  /** Render with @media print rules for the OS print dialog. */
  forPrint?: boolean;
}

function format(s: string, useArabicIndic?: boolean) {
  return useArabicIndic ? toArabicIndic(s) : s;
}

export const Receipt58mm: React.FC<Props> = ({ model, forPrint }) => {
  const useArabicIndic = !!model.useArabicIndicDigits;
  const denoms = model.changeDenominations ?? (model.changeMinor ? breakdownIQD(model.changeMinor) : []);

  return (
    <div
      className="receipt-58mm"
      style={{
        width: '58mm',
        fontFamily: 'monospace',
        fontSize: '11px',
        lineHeight: 1.25,
        padding: '4mm',
        background: '#fff',
        color: '#000',
      }}
    >
      {forPrint && (
        <style>{`
          @media print {
            @page { size: 58mm auto; margin: 0; }
            body { margin: 0; }
            .receipt-58mm { width: 58mm !important; margin: 0 !important; }
          }
        `}</style>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '13px' }}>{model.shopName}</div>
      {model.shopAddress && <div style={{ textAlign: 'center' }}>{model.shopAddress}</div>}
      {model.shopPhone && <div style={{ textAlign: 'center' }}>{model.shopPhone}</div>}
      {model.shopVAT && <div style={{ textAlign: 'center' }}>VAT: {model.shopVAT}</div>}
      <div>{'-'.repeat(COL_WIDTH)}</div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Receipt:</span>
        <span>{model.receiptNumber}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Date:</span>
        <span>{new Date(model.issuedAt).toISOString().slice(0, 19).replace('T', ' ')}</span>
      </div>
      {model.issuedAtHijri && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Hijri:</span>
          <span>{model.issuedAtHijri}</span>
        </div>
      )}
      {model.cashier && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cashier:</span>
          <span>{model.cashier}</span>
        </div>
      )}
      <div>{'-'.repeat(COL_WIDTH)}</div>

      {/* Lines */}
      {model.lines.map((l, i) => {
        const total = l.qty * l.unitPriceMinor - (l.discountMinor ?? 0);
        return (
          <div key={i} style={{ marginBottom: CELL }}>
            <div>{l.label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px' }}>
              <span>{format(`${l.qty} × ${formatIQD(l.unitPriceMinor)}`, useArabicIndic)}</span>
              <span>{format(formatIQD(total), useArabicIndic)}</span>
            </div>
            {!!l.discountMinor && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px' }}>
                <span>Discount</span>
                <span>-{format(formatIQD(l.discountMinor), useArabicIndic)}</span>
              </div>
            )}
          </div>
        );
      })}
      <div>{'-'.repeat(COL_WIDTH)}</div>

      {/* Totals */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Subtotal</span>
        <span>{format(formatIQD(model.subtotalMinor), useArabicIndic)}</span>
      </div>
      {model.taxes.map((t, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>{t.rateLabel}</span>
          <span>{format(formatIQD(t.amountMinor), useArabicIndic)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
        <span>TOTAL</span>
        <span>{format(formatIQD(model.totalMinor), useArabicIndic)}</span>
      </div>

      {/* Tendered / change */}
      {typeof model.tenderedMinor === 'number' && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tendered</span>
          <span>{format(formatIQD(model.tenderedMinor), useArabicIndic)}</span>
        </div>
      )}
      {typeof model.changeMinor === 'number' && model.changeMinor > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Change</span>
            <span>{format(formatIQD(model.changeMinor), useArabicIndic)}</span>
          </div>
          {denoms.map((d, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px' }}>
              <span>{format(`${d.count} × ${formatIQD(d.noteValue)}`, useArabicIndic)}</span>
              <span />
            </div>
          ))}
        </>
      )}
      <div>{'-'.repeat(COL_WIDTH)}</div>

      {/* QR */}
      {model.qrPayload && (
        <div style={{ textAlign: 'center', margin: '4mm 0' }}>
          <div style={{ marginBottom: '2mm' }}>Scan for e-Fakhata:</div>
          <div
            style={{
              width: '32mm',
              height: '32mm',
              background: '#000',
              margin: '0 auto',
              position: 'relative',
            }}
            aria-label="QR placeholder"
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                color: '#fff',
                fontSize: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '2mm',
                wordBreak: 'break-all',
              }}
            >
              QR: {model.qrPayload.slice(0, 24)}…
            </span>
          </div>
        </div>
      )}

      {/* Footer */}
      {model.footer && <div style={{ textAlign: 'center' }}>{model.footer}</div>}
      <div style={{ textAlign: 'center', marginTop: '2mm' }}>سوپاس / Thank you / شكراً</div>
    </div>
  );
};

export default Receipt58mm;
