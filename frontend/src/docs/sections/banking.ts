import type { SectionDoc } from '../types';

export const bankingDoc: SectionDoc = {
  key: 'banking',
  title: 'بانکینگ و هەژمارەکان',
  purpose: 'بەڕێوەبردنی هەژمارە بانکییەکان، ئاشتکاری bank statement، و کردنی manual journal entry. ئەم بەشە bridge ـە نێوان transaction ـی خاوەن تۆماری ئاکاونتینگ و بانکی ڕاستەوخۆ.',
  whoUses: ['Accountant', 'CFO', 'Finance Manager'],
  subAreas: [
    {
      name: 'هەژمارە بانکییەکان',
      purpose: 'زیادکردن و بەڕێوەبردنی هەژمارە بانکییەکان بە هەر جۆر دراوێک.',
      route: '/banking',
    },
    {
      name: 'ئاشتکاری (Reconciliation)',
      purpose: 'بەراوردکردنی transaction ـی بانک بە GL — دابەشکردنی unmatched ـەکان.',
      dataFlow: 'Bank Statement import → Match to payments/receipts → Post residuals → Reconciled',
      route: '/banking/reconciliation',
    },
    {
      name: 'ڕێساکانی بانک (Bank Rules)',
      purpose: 'Auto-categorization ی transaction ـی بانک بەپێی pattern.',
      route: '/banking/rules',
    },
    {
      name: 'Journal ـەکان',
      purpose: 'Manual journal entry بۆ هەموو مەبەستی ئاکاونتینگ.',
      dataFlow: 'Debit + Credit → Posted → Updates Account Balances in GL',
      route: '/journals',
    },
  ],
  dataDestination: 'Firestore: bank_accounts, journal_entries, bank_transactions, bank_rules',
  related: ['accounting', 'sales', 'purchases'],
  kpis: ['Cash position', 'Unreconciled items count', 'Bank vs Book variance'],
  tips: [
    'Statement import کردن (CSV/OFX) transaction ـی بانک بۆ سیستەم دەهێنێتەوە.',
    'Bank Rules دروستبکە بۆ auto-match ی merchant ـی دووبارەوار.',
  ],
};
