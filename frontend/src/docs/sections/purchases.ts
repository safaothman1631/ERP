import type { SectionDoc } from '../types';

export const purchasesDoc: SectionDoc = {
  key: 'purchases',
  title: 'مۆدیوولی کڕین',
  purpose: 'سایکڵی کاملی کڕین لە داواکاری، وەرگرتنی فاکتور، تۆخمکردن، تا کردیت ـی فرۆشکار. هەموو transaction ئاخر دەگاتە ئاکاونتینگ بە شێوەی journal entry.',
  whoUses: ['Procurement', 'Accountant', 'Warehouse Manager'],
  subAreas: [
    {
      name: 'فاکتورەکان (Bills)',
      purpose: 'فاکتوری فرۆشکار — وەرگرتن، بررسی، پارەدان.',
      dataFlow: 'Bill → Payment → Journal Entry (Debit Expense, Credit AP) → GL',
      route: '/bills',
    },
    {
      name: 'داواکاری کڕین (Purchase Orders)',
      purpose: 'فرمانی رەسمی بۆ فرۆشکار پێش وەرگرتنی کاڵا.',
      dataFlow: 'PO → [Receive Goods] → Bill (3-way match)',
      route: '/purchase-orders',
    },
    {
      name: 'کردیتی فرۆشکار (Vendor Credits)',
      purpose: 'وەرگرتنی کردیت لە فرۆشکار بۆ گەرانەوەی کاڵا یان هەڵەی فاکتور.',
      dataFlow: 'Vendor Credit → Applied to Bill → Reduces AP balance',
      route: '/vendor-credits',
    },
    {
      name: 'گەرانەوەی کڕین (Purchase Returns)',
      purpose: 'گەرانەوەی کاڵای نادروست بۆ فرۆشکار.',
      dataFlow: 'Return → Inventory reduction → Vendor Credit',
      route: '/purchase-returns',
    },
    {
      name: 'چاڵانی گێڕانەوە (Delivery Challans)',
      purpose: 'دۆکومێنتی گواستنەوەی کاڵا — بۆ تۆخم و ئاشتکاری inventory.',
      route: '/delivery-challans',
    },
  ],
  dataDestination: 'Firestore: bills, purchase_orders, vendor_credits, purchase_returns, journal_entries, inventory_movements',
  related: ['sales', 'inventory', 'accounting'],
  kpis: ['Accounts Payable', 'DPO', 'Top vendors by spend', 'PO fill rate'],
  tips: [
    'PO → Bill matching ی ٣ لاری (3-way): order, receipt, invoice.',
    'Vendor Credit دەتوانرێت لە invoice ی داهاتوویش apply بکرێت.',
  ],
  mermaidDiagram: `flowchart LR
  PO[Purchase Order] -->|Receive| RCP[Receipt]
  RCP -->|Bill| BL[Bill]
  BL -->|Pay| PMT[Payment]
  PMT -->|Post| JE[Journal Entry]
  BL -->|Return| VC[Vendor Credit]`,
};
