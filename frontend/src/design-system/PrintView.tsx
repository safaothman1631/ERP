import React, { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

export interface PrintViewProps {
  title: string;
  subtitle?: string;
  orgName?: string;
  children: ReactNode;
}

/**
 * PrintView — Wave 8.C
 * Reusable wrapper that renders children in a print-friendly layout.
 * Hides nav/sidebar/toolbar on print via @media print styles.
 */
export const PrintView: React.FC<PrintViewProps> = ({ title, subtitle, orgName, children }) => {
  const { t } = useTranslation();
  const printDate = dayjs().format('YYYY-MM-DD HH:mm');

  return (
    <>
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
            body {
              color: #000 !important;
              background: #fff !important;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-header {
              margin-bottom: 24px;
              padding-bottom: 12px;
              border-bottom: 2px solid #000;
            }
            .print-header h1 {
              font-size: 24px;
              margin: 0 0 4px 0;
              font-weight: 700;
            }
            .print-header h2 {
              font-size: 14px;
              margin: 0;
              color: #666;
              font-weight: 400;
            }
            .print-meta {
              margin-top: 8px;
              font-size: 12px;
              color: #666;
            }
          }
        `}
      </style>
      <div className="print-container">
        <div className="print-header no-print">
          <h1>{title}</h1>
          {subtitle && <h2>{subtitle}</h2>}
          {orgName && <div className="print-meta">{orgName}</div>}
          <div className="print-meta">
            {t('print.printed_on', 'Printed on')}: {printDate}
          </div>
        </div>
        <div className="print-content">{children}</div>
      </div>
    </>
  );
};

/**
 * usePrint hook — Wave 8.C
 * Returns a print function and isPrinting state.
 */
export const usePrint = () => {
  const [isPrinting, setIsPrinting] = useState(false);

  const print = () => {
    setIsPrinting(true);
    // Allow time for React to re-render with isPrinting=true before printing
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  };

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => window.removeEventListener('afterprint', handleAfterPrint);
  }, []);

  return { print, isPrinting };
};

export default PrintView;
