/**
 * Print Templates — public API
 * Task 22 (Requirements 19.1–19.7)
 *
 * Exports all ERP print template components and shared types.
 * Each template implements PrintTemplateProps:
 *   - document: the ERP document to render
 *   - company: company info displayed at the top (logo + details)
 *   - isRTL: RTL (Kurdish/Arabic) or LTR (English) direction
 *   - currency: 'IQD' (ar-IQ formatting) or 'USD' (en-US formatting)
 */

// Types
export type {
  PrintTemplateProps,
  CompanyInfo,
  DocumentLineItem,
  BaseDocument,
  InvoiceDocument,
  QuoteDocument,
  BillDocument,
  PurchaseOrderDocument,
  ReceiptDocument,
  PrintDocument,
} from './types';

// Template components
export { InvoicePrintTemplate, default as InvoicePrintTemplateDefault } from './InvoicePrintTemplate';
export { QuotePrintTemplate, default as QuotePrintTemplateDefault } from './QuotePrintTemplate';
export { BillPrintTemplate, default as BillPrintTemplateDefault } from './BillPrintTemplate';
export { PurchaseOrderPrintTemplate, default as PurchaseOrderPrintTemplateDefault } from './PurchaseOrderPrintTemplate';
export { ReceiptPrintTemplate, default as ReceiptPrintTemplateDefault } from './ReceiptPrintTemplate';

// Base template (for custom document types)
export { BasePrintTemplate } from './BasePrintTemplate';
