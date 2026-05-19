/**
 * Print Template Types — Task 22 (Requirements 19.1–19.7)
 *
 * Shared interfaces for all ERP print templates:
 * Invoice, Quote, Bill, Purchase Order, Receipt
 */

/** Company information displayed at the top of every print template */
export interface CompanyInfo {
  name: string;
  logo?: string;
  logoFallback?: string;
  address?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  taxNumber?: string;
  registrationNumber?: string;
}

/** A single line item on a document */
export interface DocumentLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;   // percentage 0–100
  taxRate?: number;    // percentage 0–100
  total: number;
}

/** Base document fields shared across all document types */
export interface BaseDocument {
  id: string;
  number: string;
  date: string;          // ISO date string
  dueDate?: string;      // ISO date string
  notes?: string;
  terms?: string;
  lineItems: DocumentLineItem[];
  subtotal: number;
  discountTotal?: number;
  taxTotal?: number;
  total: number;
  currency: 'IQD' | 'USD';
  status?: string;
}

/** Invoice document */
export interface InvoiceDocument extends BaseDocument {
  type: 'invoice';
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerTaxNumber?: string;
  paymentTerms?: string;
  paidAmount?: number;
  balanceDue?: number;
}

/** Quote / Quotation document */
export interface QuoteDocument extends BaseDocument {
  type: 'quote';
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  customerEmail?: string;
  validUntil?: string;   // ISO date string
}

/** Bill (vendor invoice) document */
export interface BillDocument extends BaseDocument {
  type: 'bill';
  vendorName: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  vendorTaxNumber?: string;
  paymentTerms?: string;
  paidAmount?: number;
  balanceDue?: number;
}

/** Purchase Order document */
export interface PurchaseOrderDocument extends BaseDocument {
  type: 'purchase_order';
  vendorName: string;
  vendorAddress?: string;
  vendorPhone?: string;
  vendorEmail?: string;
  deliveryAddress?: string;
  expectedDeliveryDate?: string;  // ISO date string
}

/** Receipt document */
export interface ReceiptDocument extends BaseDocument {
  type: 'receipt';
  customerName: string;
  customerAddress?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  cashierName?: string;
}

/** Union type for all supported document types */
export type PrintDocument =
  | InvoiceDocument
  | QuoteDocument
  | BillDocument
  | PurchaseOrderDocument
  | ReceiptDocument;

/**
 * PrintTemplateProps — the interface every print template component must implement.
 * Requirements: 19.1–19.7
 */
export interface PrintTemplateProps {
  /** The ERP document to render */
  document: PrintDocument;
  /** Company information displayed at the top */
  company: CompanyInfo;
  /** Whether to render in RTL (Kurdish/Arabic) or LTR (English) */
  isRTL: boolean;
  /** Currency for formatting — 'IQD' uses ar-IQ locale, 'USD' uses en-US locale */
  currency: 'IQD' | 'USD';
}
