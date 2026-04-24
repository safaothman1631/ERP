import type { SectionDoc } from '../types';

export const accountingDoc: SectionDoc = {
  key: 'accounting',
  title: 'ئاکاونتینگ و دارایی',
  purpose: 'موتۆری دارایی سیستەمەکە. Chart of Accounts، fiscal year، بودجە، تەکسی عێراقی، و ئینتیگریشنی ئێ-فاکتورەکانی FBR. هەموو module ـی تر ئاخر دانەی خۆی لێرە دیاری دەکات.',
  whoUses: ['CFO', 'Accountant', 'Tax Officer'],
  subAreas: [
    {
      name: 'خەشتی هەژمارەکان (COA)',
      purpose: 'ستراکچەری هەموو heirarchical ی ئاکاونتینگ — Asset, Liability, Equity, Income, Expense.',
      dataFlow: 'Chart of Accounts → Referenced by all journal entries',
      route: '/accounts',
    },
    {
      name: 'کەرتی مالی (Fiscal Year)',
      purpose: 'دیاریکردن و داخستنی سالی مالی.',
      route: '/settings?tab=fiscal',
    },
    {
      name: 'بودجە (Budgets)',
      purpose: 'دیاریکردنی مەبەستی داهات و خەرج بۆ هەر ئاکاونتێک بەپێی سالی مالی.',
      dataFlow: 'Budget → Compared against actuals in reports',
      route: '/settings?tab=budgets',
    },
    {
      name: 'تەکسی ارزش‌افزوده (VAT)',
      purpose: 'مەنەجکردنی تەکس ـی ١٥٪ی VAT و withholding بەپێی قانوونی عێراق.',
      route: '/tax-returns',
    },
    {
      name: 'ئێ-فاکتور (E-Invoice)',
      purpose: 'پێوەندییەوەبردنی invoice بۆ portal ی الهیئة العامة للضرائب.',
      route: '/e-invoice',
    },
    {
      name: 'مەوادی داهاتووی ئاکاونتینگ (Assets)',
      purpose: 'تۆماری دارایی و depreciation schedule بۆ هەموو fixed assets.',
      route: '/assets',
    },
  ],
  dataDestination: 'Firestore: accounts, journal_entries, fiscal_years, budgets, tax_returns, assets',
  related: ['banking', 'sales', 'purchases', 'iraq-int'],
  kpis: ['Trial Balance', 'P&L net income', 'Balance Sheet totals', 'Tax payable'],
  tips: [
    'COA ی ستاندارد ئێراقی IAS-compliant دروستکراوە — account زیاد مەکە بەبێ پێویست.',
    'بودجە apply دەبێت بۆ هەر account ـێک — نەک تەنها P&L.',
    'قبل از بستن fiscal year، trial balance و بانک reconciliation تەواو دەبێت.',
  ],
  mermaidDiagram: `flowchart TB
  S[Sales/Purchases/Banking] -->|auto-post| JE[Journal Entry]
  JE -->|hits| COA[Chart of Accounts]
  COA -->|feeds| TB[Trial Balance]
  TB -->|drives| PL[P&L Report]
  TB -->|drives| BS[Balance Sheet]`,
};
