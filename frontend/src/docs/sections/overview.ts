import type { SectionDoc } from '../types';

export const overviewDoc: SectionDoc = {
  key: 'overview',
  title: 'داشبۆرد و گشتی',
  purpose: 'ئەم بەشە کۆگای سەرەکی سیستەمەکەیە. هەموو KPI یەکی گرنگ، ئاگاداریەکان، و لینک ـە خێراکانی پرۆژە لێرە بەردەستن. بەکارهێنەر دەتوانێ بە yek نیگا ئاستی تندرووستی بازرگانییەکەی بزانێت.',
  whoUses: ['Manager', 'CEO', 'Accountant', 'Sales'],
  subAreas: [
    {
      name: 'داشبۆرد',
      purpose: 'پانێلی بنەڕەتی لەگەڵ KPI ی داهات، هەژمار، و بۆرد ـی چالاکی.',
      dataFlow: 'Firestore (invoices + bills + journal_entries) → /api/dashboard → Dashboard.tsx',
      route: '/',
    },
    {
      name: 'بەرپرسان',
      purpose: 'لیستی موشتەری، فرۆشکار، و هەر بەرپرسێک کە ئەکاونت ـی سیستەم تێدایە.',
      dataFlow: 'contacts → /api/contacts → Contacts.tsx',
      route: '/contacts',
    },
    {
      name: 'کاڵا و خزمەتگوزاریەکان',
      purpose: 'کاتالۆگی تەواوی بەرهەم و خزمەتگوزاری بۆ فرۆشتن و کڕین.',
      dataFlow: 'items → /api/items → Items.tsx',
      route: '/items',
    },
  ],
  dataDestination: 'Firestore: contacts, items, invoices, bills, journal_entries',
  related: ['sales', 'purchases', 'accounting'],
  kpis: ['Receivables outstanding', 'Payables due', 'Cash position', 'Revenue MTD'],
  tips: ['داشبۆرد ـەکە auto-refresh نییە — پەی لەسەر بکە بۆ نوێکردنەوە.'],
};
