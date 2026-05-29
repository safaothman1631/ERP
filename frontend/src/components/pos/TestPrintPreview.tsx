/**
 * TestPrintPreview — renders an inline preview of what the pairing
 * wizard's test print will look like, plus a debug trace of the ESC/POS
 * commands that will be sent.
 */
import React, { useMemo } from 'react';
import { ReceiptIQD } from '../../hardware/receipts/ReceiptIQD';
import { debugTrace, printReceipt } from '../../hardware/printers/commands';
import { getDialectById } from '../../hardware/printers/dialects';
import type { DialectId, ReceiptModel } from '../../hardware/printers/types';
import { SAMPLE_STANDARD } from '../../hardware/receipts/templates/standard';

interface Props {
  dialectId: DialectId;
  model?: ReceiptModel;
  showTrace?: boolean;
}

export const TestPrintPreview: React.FC<Props> = ({ dialectId, model, showTrace }) => {
  const dialect = getDialectById(dialectId);
  const receipt = model ?? SAMPLE_STANDARD;
  const trace = useMemo(() => debugTrace(printReceipt(receipt, dialect)), [receipt, dialect]);
  const totalBytes = useMemo(() => {
    const cmds = printReceipt(receipt, dialect);
    return cmds.reduce((n, c) => n + c.bytes.length, 0);
  }, [receipt, dialect]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: '#fafafa',
          padding: 12,
          borderRadius: 8,
          border: '1px solid #eee',
        }}
      >
        <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
          Dialect: <strong>{dialect.displayName}</strong> • Paper: {dialect.width}mm •
          Codepages: {dialect.codePages.join(', ')} • Bytes: {totalBytes}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', background: '#fff', padding: 12 }}>
          <ReceiptIQD model={receipt} paperWidthMm={dialect.width} />
        </div>
      </div>
      {showTrace && (
        <details style={{ background: '#fafafa', padding: 12, borderRadius: 8 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, color: '#555' }}>
            Show ESC/POS command trace ({trace.split('\n').length} commands)
          </summary>
          <pre
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              background: '#1a1a1a',
              color: '#cfc',
              padding: 12,
              borderRadius: 6,
              overflow: 'auto',
              maxHeight: 240,
              marginTop: 8,
            }}
          >
            {trace}
          </pre>
        </details>
      )}
    </div>
  );
};

export default TestPrintPreview;
