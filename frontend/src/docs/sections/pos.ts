import type { SectionDoc } from '../types';

export const posDoc: SectionDoc = {
  key: 'pos',
  title: 'خالی فرۆشتن (POS)',
  purpose: 'سیستەمی POS ی تەواو بۆ فرۆشگا و ئێستۆران: terminal، floor plan، طلباتی آشپزخانه، loyalty، gift cards، و session management. هەموو فرۆشتن خۆکار دەکەوێتە ئاکاونتینگ.',
  whoUses: ['Cashier', 'POS Manager', 'Restaurant Manager', 'Kitchen Staff'],
  subAreas: [
    {
      name: 'ترمینالی فرۆشتن',
      purpose: 'ئینترفەیسی سەرەکی کاشێر — کاڵا زیاد بکە، پارە وەرگرە.',
      dataFlow: 'POS Order → Payment → Closed Session → Journal Entry (Revenue + Cash)',
      route: '/pos/terminal',
    },
    {
      name: 'شوینگراف (Floor Plans)',
      purpose: 'دیاریکردنی نەخشەی میز و هۆل بۆ ئێستۆران.',
      route: '/pos/floors',
    },
    {
      name: 'داواکاری خواردن (Kitchen Display)',
      purpose: 'نمایشی real-time ی داواکارییەکان بۆ تیمی ئامادەکردن.',
      route: '/pos/kitchen',
    },
    {
      name: 'Loyalty و Gift Cards',
      purpose: 'پرۆگرامی خستنەرووی موشتەری و کارتی دیاری.',
      route: '/pos/loyalty',
    },
    {
      name: 'شیاوبوون و ڕاپۆرتەکان',
      purpose: 'ڕاپۆرتی session ـەکان، فرۆشتن، و بەراوردکاری.',
      route: '/pos/reports',
    },
    {
      name: 'ڕێکخستنەکان',
      purpose: 'پێکهاتنی terminal، تەکس، پارەدان، و receipt template.',
      route: '/pos/configs',
    },
  ],
  dataDestination: 'Firestore: pos_orders, pos_sessions, pos_products, pos_loyalty, pos_gift_cards, journal_entries',
  related: ['inventory', 'sales', 'accounting'],
  kpis: ['Daily sales', 'Average ticket', 'Items sold', 'Payment method breakdown'],
  tips: [
    'Session باید باز و داخستنەوە بکرێت بۆ transaction ـی تووشیوانتر.',
    'POS product categories لە POS/Categories دیاری دەکرێن — جیاوازن لە item ـی سراسری.',
  ],
  mermaidDiagram: `flowchart LR
  T[POS Terminal] -->|order| KD[Kitchen Display]
  T -->|pay| S[Session]
  S -->|close| JE[Journal Entry]
  S -->|feeds| RPT[POS Reports]`,
};
