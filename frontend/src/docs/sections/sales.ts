import type { SectionDoc } from '../types';

export const salesDoc: SectionDoc = {
  key: 'sales',
  title: 'مۆدیوولی فرۆشتن',
  purpose: 'هەموو سایکڵی فرۆشتن لە پێشکەشکردنی نرخ بۆ کۆکردنەوەی پارە بەڕێوەدەبرێت. invoice، quote، sales order، credit note، و shipment ـی تێدایە. هەموو transaction لە ژێر ئەم بەشەوە بۆ journal entry ـی ئاکاونتینگ دەچێت.',
  whoUses: ['Sales Manager', 'Accountant', 'Cashier'],
  subAreas: [
    {
      name: 'وەصڵەکان (Invoices)',
      purpose: 'دروستکردن، ناردن، کۆکردنەوە، و reconcile ی وەصڵەکان.',
      dataFlow: 'Invoice → Payment → Journal Entry (Debit AR, Credit Revenue) → GL',
      route: '/invoices',
    },
    {
      name: 'پێشکەش (Quotes)',
      purpose: 'پێشکەشی نرخ بۆ موشتەری — دەتوانرێت بگوازرێتەوە بۆ Sales Order یان Invoice.',
      dataFlow: 'Quote → [accept] → Sales Order OR Invoice',
      route: '/quotes',
    },
    {
      name: 'فرمانی فرۆشتن (Sales Orders)',
      purpose: 'فرمانی پشکنراوی موشتەری کە داواکاری stock reservation و delivery plan دەکات.',
      dataFlow: 'Sales Order → Shipment → Invoice',
      route: '/sales-orders',
    },
    {
      name: 'کردیت نوت (Credit Notes)',
      purpose: 'کردیت ی موشتەری دووبارە بۆ invoice ی پێشوو کە هەڵەیەکی تێدا بووبێت یان گەرانەوەیەک.',
      dataFlow: 'Credit Note → Applied to Invoice → Reduces AR balance',
      route: '/credit-notes',
    },
    {
      name: 'بارکردن (Shipments)',
      purpose: 'جێبەجێکردنی delivery و ئاستی stock.',
      dataFlow: 'Sales Order → Shipment → Inventory reduction',
      route: '/shipments',
    },
    {
      name: 'گەرانەوەی فرۆشتن (Sales Returns)',
      purpose: 'وەرگرتنەوەی کاڵا لە موشتەری و گەرانەوەی پارە یان credit.',
      dataFlow: 'Return → Inventory +1 → Credit Note OR Refund',
      route: '/sales-returns',
    },
    {
      name: 'لینکی پارەدان (Payment Links)',
      purpose: 'لینکی کۆکردنەوەی خێرا بۆ موشتەری بەبێ invoice ی تەواو.',
      route: '/payment-links',
    },
    {
      name: 'وەصڵی دووبارەی (Recurring Invoices)',
      purpose: 'وەصڵی subscription-like کە خۆکار بەپێی شێوازی دیاریکراو دروست دەبن.',
      dataFlow: 'Schedule → Auto-create Invoice → Customer email',
      route: '/recurring-invoices',
    },
  ],
  dataDestination: 'Firestore: invoices, sales_orders, quotes, credit_notes, shipments, sales_returns, payment_links, journal_entries',
  related: ['purchases', 'banking', 'accounting', 'inventory'],
  kpis: ['Revenue MTD/YTD', 'Accounts Receivable', 'DSO', 'Top customers by revenue'],
  tips: [
    'Invoice ی approved بکە پێش نارد بۆ موشتەری.',
    'Credit Note دەتوانێت بۆ invoice ی نوێیش apply بکرێت — نەک تەنها گەرانەوەی پارە.',
  ],
  mermaidDiagram: `flowchart LR
  Q[Quote] -->|Accept| SO[Sales Order]
  SO -->|Fulfill| SH[Shipment]
  SH -->|Bill| INV[Invoice]
  INV -->|Pay| PMT[Payment]
  PMT -->|Post| JE[Journal Entry]
  INV -->|Return| CN[Credit Note]`,
};
