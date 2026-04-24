import type { SectionDoc } from '../types';

export const iraqIntDoc: SectionDoc = {
  key: 'iraq-int',
  title: 'عێراقی و ھەرێمی کوردستان',
  purpose: 'تایبەتمەندییەکانی localization ی عێراق: VAT ی ١٥٪، withholding tax، currency ـی IQD، و ئینتیگریشنی ئێ-فاکتوری هیئت عامة للضرائب. سیستەمەکە IAS-compliant ی دیاریکردراوە.',
  whoUses: ['Tax Officer', 'Accountant', 'CFO'],
  subAreas: [
    {
      name: 'تەکس ـی عێراقی',
      purpose: 'پابەندبوون بە قانوونی تەکسی عێراق: VAT، withholding، و tax return.',
      dataFlow: 'Taxable transactions → Tax ledger → Periodic tax return filing',
      route: '/tax-returns',
    },
    {
      name: 'IQD و فرۆشنامەکان',
      purpose: 'پشتیوانی کامل لە دینارە عێراقییەکان و فرۆشنامەی کوردی/عەرەبی.',
      route: '/iraq-localization',
    },
    {
      name: 'ئێ-فاکتور',
      purpose: 'ناردنی ئیلەکترۆنی ی فاکتور بۆ portal ی فیدرال.',
      route: '/e-invoice',
    },
  ],
  dataDestination: 'Firestore: tax_returns, e_invoices, invoices (tax fields)',
  related: ['accounting', 'sales'],
  kpis: ['VAT payable', 'Withholding collected', 'E-invoices submitted'],
  tips: [
    'Tax category لە هەموو invoice و bill ـدا پرکردنی پێویستە.',
    'E-Invoice submission ی ZATCA-style پێویستی credentials لە Settings ـدا.',
  ],
};
