import React from 'react';
import { BasePrintTemplate } from './BasePrintTemplate';
import type { PrintTemplateProps, PurchaseOrderDocument } from './types';

/**
 * PurchaseOrderPrintTemplate — A4 print template for Purchase Orders.
 * Task 22 (Requirements 19.1–19.7)
 *
 * Implements PrintTemplateProps with:
 * - Company logo + info at the top (Requirement 19.6)
 * - RTL/LTR direction via isRTL prop (Requirement 19.3)
 * - IQD (ar-IQ) / USD (en-US) currency formatting (Requirement 19.4)
 * - A4 paper size via PrintTemplate.css @page rule (Requirement 19.2)
 * - @media print hides .sidebar, .topbar, .no-print (Requirements 19.5, 19.7)
 */
export const PurchaseOrderPrintTemplate: React.FC<PrintTemplateProps> = ({
  document,
  company,
  isRTL,
  currency,
}) => {
  const doc = document as PurchaseOrderDocument;

  // i18n labels — RTL uses Arabic/Kurdish, LTR uses English
  const labels = isRTL
    ? {
        subtotal: 'المجموع الفرعي',
        discount: 'الخصم',
        tax: 'الضريبة',
        total: 'المجموع الكلي',
        paidAmount: 'المبلغ المدفوع',
        balanceDue: 'الرصيد المستحق',
        notes: 'ملاحظات',
        terms: 'الشروط والأحكام',
        date: 'التاريخ',
        dueDate: 'تاريخ الاستحقاق',
        validUntil: 'صالح حتى',
        expectedDelivery: 'تاريخ التسليم المتوقع',
        paymentMethod: 'طريقة الدفع',
        reference: 'رقم المرجع',
        itemNo: '#',
        description: 'الوصف',
        quantity: 'الكمية',
        unitPrice: 'سعر الوحدة',
        discountPct: 'الخصم %',
        taxPct: 'الضريبة %',
        amount: 'المبلغ',
        from: 'من',
        to: 'إلى المورد',
        docType: 'أمر شراء',
      }
    : {
        subtotal: 'Subtotal',
        discount: 'Discount',
        tax: 'Tax',
        total: 'Total',
        paidAmount: 'Amount Paid',
        balanceDue: 'Balance Due',
        notes: 'Notes',
        terms: 'Terms & Conditions',
        date: 'Date',
        dueDate: 'Due Date',
        validUntil: 'Valid Until',
        expectedDelivery: 'Expected Delivery',
        paymentMethod: 'Payment Method',
        reference: 'Reference',
        itemNo: '#',
        description: 'Description',
        quantity: 'Qty',
        unitPrice: 'Unit Price',
        discountPct: 'Disc %',
        taxPct: 'Tax %',
        amount: 'Amount',
        from: 'From',
        to: 'Vendor',
        docType: 'PURCHASE ORDER',
      };

  return (
    <BasePrintTemplate
      docTypeLabel={labels.docType}
      docNumber={doc.number}
      docDate={doc.date}
      expectedDeliveryDate={doc.expectedDeliveryDate}
      fromLabel={labels.from}
      from={company}
      toLabel={labels.to}
      toName={doc.vendorName}
      toAddress={doc.vendorAddress}
      toPhone={doc.vendorPhone}
      toEmail={doc.vendorEmail}
      lineItems={doc.lineItems}
      subtotal={doc.subtotal}
      discountTotal={doc.discountTotal}
      taxTotal={doc.taxTotal}
      total={doc.total}
      status={doc.status}
      notes={doc.notes}
      terms={doc.terms}
      currency={currency}
      isRTL={isRTL}
      labels={labels}
    />
  );
};

export default PurchaseOrderPrintTemplate;
