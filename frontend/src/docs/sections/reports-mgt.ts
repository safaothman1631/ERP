import type { SectionDoc } from '../types';

export const reportsMgtDoc: SectionDoc = {
  key: 'reports-mgt',
  title: 'ڕاپۆرت و شیکاری',
  purpose: 'گوندی ڕاپۆرتی مالی و ئیدارەکاری — P&L، Balance Sheet، Trial Balance، AR/AP Aging، و ڕاپۆرتی بەراوردکاری. هەر ڕاپۆرتێک live data ـی Firestore بەکار دەهێنێت.',
  whoUses: ['CFO', 'Accountant', 'CEO', 'Auditor'],
  subAreas: [
    {
      name: 'ڕاپۆرتی مالی',
      purpose: 'Profit & Loss، Balance Sheet، Cash Flow، Trial Balance.',
      dataFlow: 'journal_entries → aggregation → report figures',
      route: '/reports',
    },
    {
      name: 'ڕاپۆرتی پێشرەفتوو',
      purpose: 'AR/AP Aging، Account Summary، Branch Comparison.',
      route: '/advanced-reports',
    },
    {
      name: 'ڕاپۆرتی کۆمپانی (Consolidated)',
      purpose: 'بەراوردی ژیرانەی هەموو branch ـەکان لە یەک view.',
      route: '/consolidated-reports',
    },
  ],
  dataDestination: 'Firestore: journal_entries, accounts, invoices, bills (read-only aggregation)',
  related: ['accounting', 'banking', 'sales', 'purchases', 'hr'],
  kpis: ['Net income', 'Total assets', 'Cash position', 'AR aging buckets'],
  tips: [
    'ڕاپۆرتی مالی بۆ Excel و PDF ـیش export دەبێت.',
    'Date range ی default ـی سال ـی مالی ئێستایە — دەتوانرێت بگۆڕێت.',
  ],
};
