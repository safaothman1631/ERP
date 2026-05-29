/**
 * Receipt80mm — React component rendering an 80mm-width receipt preview.
 *
 * Spec: growth-to-100/requirements.md R3.10. The legacy
 * `frontend/src/components/pos/ReceiptTemplate80mm.tsx` predates the
 * hardware layer and uses a different data model; this new component
 * accepts the canonical `ReceiptModel` and is used by the pairing wizard.
 *
 * Width: 80mm at 8 dots/mm → ~64 dots usable → 48 chars at 12-dot font.
 */
import React from 'react';
import { breakdownIQD, formatIQD, toArabicIndic } from '../printers/commands';
import type { ReceiptModel } from '../printers/types';

const COL_WIDTH = 48;

interface Props {
  model: ReceiptModel;
  forPrint?: boolean;
}

function format(s: string, useArabicIndic?: boolean) {
  return useArabicIndic ? toArabicIndic(s) : s;
}

export const Receipt80mm: React.FC<Props> = ({ model, forPrint }) => {
  const useArabicIndic = !!model.useArabicIndicDigits;
  const denoms = model.changeDenominations ?? (model.changeMinor ? breakdownIQD(model.changeMinor) : []);

  return (
    <div
      className="receipt-80mm-v2"
      style={{
        width: '80mm',
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: 1.3,
        padding: '6mm',
        background: '#fff',
        color: '#000',
      }}
    >
      {forPrint && (
        <style>{`
          @media print {
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; }
            .receipt-80mm-v2 { width: 80mm !important; margin: 0 !important; }
          }
        `}</style>
      )}

      {model.logoPngDataUrl && (
        <div style={{ textAlign: 'center', marginBottom: '4mm' }}>
          <img src={model.logoPngDataUrl} alt="" style={{ maxWidth: '40mm', maxHeight: '20mm' }} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px' }}>{model.shopName}</div>
      {model.shopAddress && <div style={{ textAlign: 'center' }}>{model.shopAddress}</div>}
      {model.shopPhone && <div style={{ textAlign: 'center' }}>{model.shopPhone}</div>}
      {model.shopVAT && <div style={{ textAlign: 'center' }}>VAT: {model.shopVAT}</div>}
      <div>{'-'.repeat(COL_WIDTH)}</div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Receipt #</span>
        <span>{model.receiptNumber}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span>Date</span>
        <span>{new Date(model.issuedAt).toISOString().slice(0, 19).replace('T', ' ')}</span>
      </div>
      {model.issuedAtHijri && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Hijri</span>
          <span>{model.issuedAtHijri}</span>
        </div>
      )}
      {model.cashier && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Cashier</span>
          <span>{model.cashier}</span>
        </div>
      )}
      {model.terminalId && (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Terminal</span>
          <span>{model.terminalId}</span>
        </div>
      )}
      <div>{'-'.repeat(COL_WIDTH)}</div>

      {/* Lines header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
        <span style={{ flex: 1 }}>Item</span>
        <span style={{ width: '12mm', textAlign: 'right' }}>Qty</span>
        <span style={{ width: '20mm', textAlign: 'right' }}>Price</span>
        <span style={{ width: '22mm', textAlign: 'right' }}>Total</span>
      </div>
      <div>{'-'.repeat(COL_WIDTH)}</div>

      {model.lines.map((l, i) => {
        const total = l.qty * l.unitPriceMinor - (l.discountMinor ?? 0);
        return (
          <div key={i} style={{ marginBottom: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ flex: 1, wordBreak: 'break-word' }}>{l.label}</span>
              <span style={{ width: '12mm', textAlign: 'right' }}>{format(String(l.qty), useArabicIndic)}</span>
              <span style={{ width: '20mm', textAlign: 'right' }}>{format(formatIQD(l.unitPriceMinor), useArabicIndic)}</span>
              <span style={{ width: '22mm', textAlign: 'right' }}>{format(formatIQD(total), useArabicIndic)}</span>
            </div>
            {!!l.discountMinor && (
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '4px', fontStyle: 'italic' }}>
                <span>Discount</span>
                <span>-{format(formatIQD(l.discountMinor), useArabicIndic)}</span>
              </div>
            )}
          </div>
        );
      })}
      <div>{'-'.repeat(COL_WIDTH)}</div>

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
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '15px' }}>
        <span>TOTAL</span>
        <span>{format(formatIQD(model.totalMinor), useArabicIndic)}</span>
      </div>

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

      {model.qrPayload && (
        <div style={{ textAlign: 'center', margin: '4mm 0' }}>
          <div>Scan for e-Fakhata:</div>
          <div
            style={{
              width: '40mm',
              height: '40mm',
              background: '#000',
              margin: '2mm auto',
              position: 'relative',
            }}
            aria-label="QR placeholder"
          >
            <span
              style={{
                position: 'absolute',
                inset: 0,
                color: '#fff',
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                padding: '2mm',
                wordBreak: 'break-all',
              }}
            >
              QR: {model.qrPayload.slice(0, 32)}…
            </span>
          </div>
        </div>
      )}

      {model.footer && <div style={{ textAlign: 'center' }}>{model.footer}</div>}
      <div style={{ textAlign: 'center', marginTop: '2mm' }}>سوپاس / Thank you / شكراً</div>
    </div>
  );
};

export default Receipt80mm;
