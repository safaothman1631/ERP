import React from 'react';
import { OptimizedImage } from '../OptimizedImage';
import { formatMoney, formatDate } from '../../utils/format';
import type { CompanyInfo, DocumentLineItem } from './types';
import type { Language } from '../../utils/language';
import './PrintTemplate.css';

interface BasePrintTemplateProps {
  /** Document type label (e.g. "Invoice", "فاتورە") */
  docTypeLabel: string;
  /** Document number */
  docNumber: string;
  /** Document date (ISO string) */
  docDate: string;
  /** Optional due date (ISO string) */
  dueDate?: string;
  /** Optional valid-until date (ISO string) */
  validUntil?: string;
  /** Optional expected delivery date (ISO string) */
  expectedDeliveryDate?: string;
  /** Party A label (e.g. "From", "Bill From") */
  fromLabel: string;
  /** Party A info */
  from: CompanyInfo;
  /** Party B label (e.g. "To", "Bill To") */
  toLabel: string;
  /** Party B name */
  toName: string;
  /** Party B address */
  toAddress?: string;
  /** Party B phone */
  toPhone?: string;
  /** Party B email */
  toEmail?: string;
  /** Party B tax number */
  toTaxNumber?: string;
  /** Line items */
  lineItems: DocumentLineItem[];
  /** Subtotal amount */
  subtotal: number;
  /** Discount total */
  discountTotal?: number;
  /** Tax total */
  taxTotal?: number;
  /** Grand total */
  total: number;
  /** Paid amount (for invoices/bills) */
  paidAmount?: number;
  /** Balance due (for invoices/bills) */
  balanceDue?: number;
  /** Payment method (for receipts) */
  paymentMethod?: string;
  /** Reference number (for receipts) */
  referenceNumber?: string;
  /** Document status */
  status?: string;
  /** Notes */
  notes?: string;
  /** Terms */
  terms?: string;
  /** Currency */
  currency: 'IQD' | 'USD';
  /** RTL direction */
  isRTL: boolean;
  /** i18n labels */
  labels: {
    subtotal: string;
    discount: string;
    tax: string;
    total: string;
    paidAmount: string;
    balanceDue: string;
    notes: string;
    terms: string;
    date: string;
    dueDate: string;
    validUntil: string;
    expectedDelivery: string;
    paymentMethod: string;
    reference: string;
    itemNo: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discountPct: string;
    taxPct: string;
    amount: string;
  };
}

/**
 * BasePrintTemplate — shared layout for all ERP print templates.
 * Task 22 (Requirements 19.1–19.7)
 *
 * Renders:
 * - Company logo + info at the top (Requirement 19.6)
 * - Document type, number, dates
 * - From/To party info
 * - Line items table
 * - Totals section with IQD/USD formatting (Requirement 19.4)
 * - Notes and terms footer
 * - RTL/LTR direction (Requirement 19.3)
 */
export const BasePrintTemplate: React.FC<BasePrintTemplateProps> = ({
  docTypeLabel,
  docNumber,
  docDate,
  dueDate,
  validUntil,
  expectedDeliveryDate,
  fromLabel,
  from,
  toLabel,
  toName,
  toAddress,
  toPhone,
  toEmail,
  toTaxNumber,
  lineItems,
  subtotal,
  discountTotal,
  taxTotal,
  total,
  paidAmount,
  balanceDue,
  paymentMethod,
  referenceNumber,
  status,
  notes,
  terms,
  currency,
  isRTL,
  labels,
}) => {
  const dir = isRTL ? 'rtl' : 'ltr';
  const lang: Language = isRTL ? 'ar' : 'en';

  const fmt = (amount: number) => formatMoney(amount, currency, lang);
  const fmtDate = (d?: string) => (d ? formatDate(d, lang) : '—');

  return (
    <div className="print-template" dir={dir}>
      {/* ── Company header — Requirement 19.6 ── */}
      <div className="print-template__header">
        <div className="print-template__company">
          {/* Company logo — Requirement 19.6 */}
          {from.logo && (
            <OptimizedImage
              src={from.logo}
              fallbackSrc={from.logoFallback}
              alt={from.name}
              width={120}
              height={60}
              loading="eager"
              className="print-template__logo"
              wrapperStyle={{ marginBottom: 8 }}
            />
          )}
          <h1 className="print-template__company-name">{from.name}</h1>
          <div className="print-template__company-details">
            {from.address && <div>{from.address}</div>}
            {from.city && from.country && (
              <div>
                {from.city}, {from.country}
              </div>
            )}
            {from.phone && <div>{from.phone}</div>}
            {from.email && <div>{from.email}</div>}
            {from.website && <div>{from.website}</div>}
            {from.taxNumber && <div>{from.taxNumber}</div>}
            {from.registrationNumber && <div>{from.registrationNumber}</div>}
          </div>
        </div>

        {/* Document title block */}
        <div className="print-template__title-block">
          <h2 className="print-template__doc-type">{docTypeLabel}</h2>
          <p className="print-template__doc-number">#{docNumber}</p>
          {status && (
            <span className="print-template__status">{status}</span>
          )}
        </div>
      </div>

      {/* ── Meta info (dates) ── */}
      <div className="print-template__meta">
        <div className="print-template__meta-section">
          <div className="print-template__meta-label">{labels.date}</div>
          <div className="print-template__meta-value">{fmtDate(docDate)}</div>
        </div>

        {dueDate && (
          <div className="print-template__meta-section">
            <div className="print-template__meta-label">{labels.dueDate}</div>
            <div className="print-template__meta-value">{fmtDate(dueDate)}</div>
          </div>
        )}

        {validUntil && (
          <div className="print-template__meta-section">
            <div className="print-template__meta-label">{labels.validUntil}</div>
            <div className="print-template__meta-value">{fmtDate(validUntil)}</div>
          </div>
        )}

        {expectedDeliveryDate && (
          <div className="print-template__meta-section">
            <div className="print-template__meta-label">{labels.expectedDelivery}</div>
            <div className="print-template__meta-value">{fmtDate(expectedDeliveryDate)}</div>
          </div>
        )}

        {paymentMethod && (
          <div className="print-template__meta-section">
            <div className="print-template__meta-label">{labels.paymentMethod}</div>
            <div className="print-template__meta-value">{paymentMethod}</div>
          </div>
        )}

        {referenceNumber && (
          <div className="print-template__meta-section">
            <div className="print-template__meta-label">{labels.reference}</div>
            <div className="print-template__meta-value">{referenceNumber}</div>
          </div>
        )}
      </div>

      {/* ── Party info (From / To) ── */}
      <div className="print-template__parties">
        <div className="print-template__party">
          <div className="print-template__party-label">{fromLabel}</div>
          <div className="print-template__party-name">{from.name}</div>
          {from.address && (
            <div className="print-template__party-detail">{from.address}</div>
          )}
          {from.phone && (
            <div className="print-template__party-detail">{from.phone}</div>
          )}
          {from.email && (
            <div className="print-template__party-detail">{from.email}</div>
          )}
          {from.taxNumber && (
            <div className="print-template__party-detail">{from.taxNumber}</div>
          )}
        </div>

        <div className="print-template__party">
          <div className="print-template__party-label">{toLabel}</div>
          <div className="print-template__party-name">{toName}</div>
          {toAddress && (
            <div className="print-template__party-detail">{toAddress}</div>
          )}
          {toPhone && (
            <div className="print-template__party-detail">{toPhone}</div>
          )}
          {toEmail && (
            <div className="print-template__party-detail">{toEmail}</div>
          )}
          {toTaxNumber && (
            <div className="print-template__party-detail">{toTaxNumber}</div>
          )}
        </div>
      </div>

      {/* ── Line items table ── */}
      <table className="print-template__table">
        <thead>
          <tr>
            <th className="col-num">{labels.itemNo}</th>
            <th className="col-desc">{labels.description}</th>
            <th className="col-qty">{labels.quantity}</th>
            <th className="col-price">{labels.unitPrice}</th>
            {lineItems.some((li) => li.discount !== undefined && li.discount > 0) && (
              <th className="col-discount">{labels.discountPct}</th>
            )}
            {lineItems.some((li) => li.taxRate !== undefined && li.taxRate > 0) && (
              <th className="col-tax">{labels.taxPct}</th>
            )}
            <th className="col-total">{labels.amount}</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            <tr key={item.id}>
              <td className="col-num">{index + 1}</td>
              <td className="col-desc">{item.description}</td>
              <td className="col-qty">{item.quantity}</td>
              <td className="col-price">
                <bdi>{fmt(item.unitPrice)}</bdi>
              </td>
              {lineItems.some((li) => li.discount !== undefined && li.discount > 0) && (
                <td className="col-discount">
                  {item.discount !== undefined && item.discount > 0
                    ? `${item.discount}%`
                    : '—'}
                </td>
              )}
              {lineItems.some((li) => li.taxRate !== undefined && li.taxRate > 0) && (
                <td className="col-tax">
                  {item.taxRate !== undefined && item.taxRate > 0
                    ? `${item.taxRate}%`
                    : '—'}
                </td>
              )}
              <td className="col-total">
                <bdi>{fmt(item.total)}</bdi>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Totals ── */}
      <div className="print-template__totals">
        <table className="print-template__totals-table">
          <tbody>
            <tr>
              <td className="totals-label">{labels.subtotal}</td>
              <td className="totals-value">
                <bdi>{fmt(subtotal)}</bdi>
              </td>
            </tr>

            {discountTotal !== undefined && discountTotal > 0 && (
              <tr>
                <td className="totals-label">{labels.discount}</td>
                <td className="totals-value">
                  <bdi>-{fmt(discountTotal)}</bdi>
                </td>
              </tr>
            )}

            {taxTotal !== undefined && taxTotal > 0 && (
              <tr>
                <td className="totals-label">{labels.tax}</td>
                <td className="totals-value">
                  <bdi>{fmt(taxTotal)}</bdi>
                </td>
              </tr>
            )}

            <tr className="totals-grand">
              <td className="totals-label">{labels.total}</td>
              <td className="totals-value">
                <bdi>{fmt(total)}</bdi>
              </td>
            </tr>

            {paidAmount !== undefined && paidAmount > 0 && (
              <tr>
                <td className="totals-label">{labels.paidAmount}</td>
                <td className="totals-value">
                  <bdi>{fmt(paidAmount)}</bdi>
                </td>
              </tr>
            )}

            {balanceDue !== undefined && balanceDue > 0 && (
              <tr className="totals-balance">
                <td className="totals-label">{labels.balanceDue}</td>
                <td className="totals-value">
                  <bdi>{fmt(balanceDue)}</bdi>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Notes and terms footer ── */}
      {(notes || terms) && (
        <div className="print-template__footer">
          {notes && (
            <div className="print-template__footer-section">
              <h4>{labels.notes}</h4>
              <p>{notes}</p>
            </div>
          )}
          {terms && (
            <div className="print-template__footer-section">
              <h4>{labels.terms}</h4>
              <p>{terms}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BasePrintTemplate;
