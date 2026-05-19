import React, { useState, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

export interface PrintViewProps {
  title: string;
  subtitle?: string;
  orgName?: string;
  /** Direction for the print document — 'rtl' for Kurdish/Arabic, 'ltr' for English */
  dir?: 'rtl' | 'ltr';
  children: ReactNode;
}

/**
 * PrintView — Task 22 (Requirements 19.1–19.7)
 *
 * Reusable wrapper that renders children in a print-friendly A4 layout.
 * - Calls window.print() via the usePrint hook
 * - Hides .sidebar, .topbar, .no-print via @media print CSS
 * - Shows .print-only elements during printing
 * - Formats for A4 paper: @page { size: A4; margin: 20mm; }
 * - Supports RTL (dir="rtl") and LTR (dir="ltr") rendering
 */
export const PrintView: React.FC<PrintViewProps> = ({
  title,
  subtitle,
  orgName,
  dir = 'ltr',
  children,
}) => {
  const { t } = useTranslation();
  const printDate = dayjs().format('YYYY-MM-DD HH:mm');

  return (
    <>
      <style>
        {`
          @media print {
            /* Hide navigation and sidebar — Requirements 19.5, 19.7 */
            .sidebar,
            .topbar,
            .no-print,
            .ant-layout-sider,
            .ant-layout-header,
            [class*="SideNav"],
            [class*="TopBar"] {
              display: none !important;
            }

            /* Show print-only elements — Requirements 19.7 */
            .print-only {
              display: block !important;
            }

            /* A4 paper size — Requirements 19.2 */
            @page {
              size: A4;
              margin: 20mm;
            }

            body {
              font-size: 12pt;
              color: #000 !important;
              background: #fff !important;
              margin: 0;
              padding: 0;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            .print-container {
              width: 100%;
              max-width: 100%;
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
      <div className="print-container" dir={dir}>
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
 * usePrint hook — Task 22 (Requirements 19.5)
 * Returns a print function and isPrinting state.
 * Calls window.print() to trigger the browser print dialog.
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
