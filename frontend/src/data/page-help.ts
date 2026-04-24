import type { PageHelpContent, PageHelpSection } from '../components/PageHelp';

type Localized = { en: PageHelpContent; ku: PageHelpContent };

export const PAGE_HELP_REGISTRY: Record<string, Localized> = {};

export function registerPageHelp(key: string, entry: Localized): void {
  PAGE_HELP_REGISTRY[key] = entry;
}

export function getPageHelp(key: string, lang: string): PageHelpContent {
  const entry = PAGE_HELP_REGISTRY[key];
  const isKu = lang === 'ku';
  if (entry) return isKu ? entry.ku : entry.en;
  return isKu
    ? {
        title: key,
        purpose:
          'هێشتا یارمەتی تایبەت بۆ ئەم پەیجە دانەنراوە. لە فەیزەکانی داهاتوودا زیاد دەکرێت.',
      }
    : {
        title: key,
        purpose:
          'No specific help is available for this page yet. It will be added in a future phase.',
      };
}

export function listPageHelpKeys(): string[] {
  return Object.keys(PAGE_HELP_REGISTRY);
}

/** Group registered pages by section — used by DocsHub. */
export function groupPageHelpBySection(
  lang: string,
): Record<PageHelpSection | 'other', { key: string; content: PageHelpContent }[]> {
  const out: Record<string, { key: string; content: PageHelpContent }[]> = {};
  for (const key of listPageHelpKeys()) {
    const content = getPageHelp(key, lang);
    const section = (content.section || 'other') as PageHelpSection | 'other';
    (out[section] ||= []).push({ key, content });
  }
  for (const k of Object.keys(out)) {
    out[k].sort((a, b) => a.content.title.localeCompare(b.content.title));
  }
  return out as Record<PageHelpSection | 'other', { key: string; content: PageHelpContent }[]>;
}

// ─────────────────────────────────────────────────────────────────────────
// Getting Started
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('dashboard', {
  en: {
    title: 'Dashboard',
    section: 'getting-started',
    purpose:
      'Your at-a-glance home. Live KPIs, recent activity, top customers, cash trend, and quick actions.',
    workflow: [
      'Open the app — Dashboard is the default landing page',
      'Click any KPI tile (Revenue, Receivables, …) to drill into the detail view',
      'Use Quick Actions in the header to create invoices/contacts/expenses without navigating',
    ],
    tips: [
      'Numbers refresh in real time as your team enters data.',
      'Use the date range selector to compare periods (today, week, month, quarter).',
      'Customise widgets from Settings → Dashboard layout.',
    ],
    related: ['reports', 'invoices', 'banking'],
    shortcuts: [
      { keys: 'Ctrl+K', description: 'Global command palette' },
      { keys: 'G then D', description: 'Jump to Dashboard from anywhere' },
    ],
  },
  ku: {
    title: 'داشبۆرد',
    section: 'getting-started',
    purpose:
      'سەرەتای پڕۆژەکەت. KPI زیندوو، چالاکیی نوێ، باشترین کڕیار، تڕێندی پارە، و کردارە خێراکان.',
    workflow: [
      'سیستەمەکە بکەرەوە — داشبۆرد لاپەڕەی سەرەکیە',
      'کلیک لەسەر هەر KPI (داهات، وەرگرتنیەکان، …) بکە بۆ بینینی تێکڕای',
      'لە Quick Actions ـی سەرەوە فاکتور/کڕیار/خەرجی نوێ دروست بکە بێ ناڤیگەیشن',
    ],
    tips: [
      'ژمارەکان بە ڕیئاڵتایم نوێ دەبنەوە کاتێک تیمەکەت داتا داخڵ دەکات.',
      'مۆدوولی بەروار بەکاربهێنە بۆ بەراوردکردن (ئەمڕۆ، هەفتە، مانگ، چارەک).',
      'ویجێتەکان لە Settings → Dashboard layout دەستکاری بکە.',
    ],
    related: ['reports', 'invoices', 'banking'],
    shortcuts: [
      { keys: 'Ctrl+K', description: 'پاڵێتی فەرمانی گشتی' },
      { keys: 'G ئینجا D', description: 'بچۆ بۆ داشبۆرد لە هەر شوێنێک' },
    ],
  },
});

registerPageHelp('docs', {
  en: {
    title: 'Help Center',
    section: 'getting-started',
    purpose:
      'Browse all in-app guides, search any page or workflow, and learn how each module fits together.',
    tips: [
      'Use the search box (top of page) to find anything instantly.',
      'Each detail page lists Fields, Workflow, Tips, Warnings, and Related pages.',
      "Press the ? icon on any page header to jump to that page's help.",
    ],
  },
  ku: {
    title: 'سەنتەری یارمەتی',
    section: 'getting-started',
    purpose:
      'گەڕان بە هەموو ڕێبەرەکانی ناو سیستەم، گەڕان بەدوای هەر پەیجێک یان وۆرک‌فلۆیەک، و فێربوونی پەیوەندی نێوان مۆدوولەکان.',
    tips: [
      'بۆکسی گەڕان (سەرەوەی پەیج) بەکار بهێنە بۆ دۆزینەوەی هەر شتێک خێرا.',
      'هەر دۆکیومێنتێک ئەم بەشانە لە خۆ دەگرێت: فیلدەکان، وۆرک‌فلۆ، شارەزایی، ئاگاداری، و پەیجی پەیوەست.',
      'سەر هەر پەیجێک ئایکۆنی ? کلیک بکە بۆ یارمەتیی تایبەتی ئەو پەیجە.',
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Sales
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('contacts', {
  en: {
    title: 'Contacts',
    section: 'sales',
    purpose:
      'Customers and vendors you do business with. One contact can be both a customer and a vendor.',
    fields: [
      { name: 'Name', required: true, description: 'Display name shown on invoices, bills, and reports.' },
      { name: 'Type', required: true, description: 'Customer, Vendor, or Both.' },
      { name: 'Email', description: 'Used for sending invoices, statements, and reminders.' },
      { name: 'Phone', description: 'Optional. Shown on documents.' },
      { name: 'Tax ID', description: 'VAT / business registration number for tax forms.' },
      { name: 'Currency', description: 'Default currency for transactions with this contact.' },
      { name: 'Payment terms', description: 'How many days the customer has to pay (e.g. Net 30).' },
    ],
    workflow: [
      'Click "+ New Contact"',
      'Fill required fields (Name, Type)',
      'Save — the contact is immediately available in invoices, bills, and quotes',
    ],
    related: ['invoices', 'bills', 'crm-leads'],
  },
  ku: {
    title: 'کڕیار و فرۆشیار',
    section: 'sales',
    purpose:
      'کڕیار و فرۆشیارەکان کە کاری بازرگانی لەگەڵیان دەکەیت. یەک پەیوەندی دەتوانێت هەردووک بێت.',
    fields: [
      { name: 'ناو', required: true, description: 'ئەو ناوەی لە فاکتور و ڕاپۆرتەکان نیشان دەدرێت.' },
      { name: 'جۆر', required: true, description: 'کڕیار، فرۆشیار، یان هەردووک.' },
      { name: 'ئیمەیڵ', description: 'بۆ ناردنی فاکتور، گوزارش، و بیرخستنەوە.' },
      { name: 'تەلەفۆن', description: 'ئاڵگۆڕی. لە بەڵگەکان نیشان دەدرێت.' },
      { name: 'ژمارەی بازرگانی', description: 'ژمارەی VAT یان تۆماری بازرگانی بۆ فۆڕمە باجییەکان.' },
      { name: 'دراو', description: 'دراوی ئاسایی کاتێک کۆگا خۆکار دەبێتەوە.' },
      { name: 'مەرجی پارەدان', description: 'چەند ڕۆژ کاتی هەیە بۆ پارەدان (نموونە: Net 30).' },
    ],
    workflow: [
      'کلیک لە «+ پەیوەندیی نوێ» بکە',
      'خانە پێویستەکان پڕ بکەرەوە (ناو، جۆر)',
      'پاشەکەوت بکە — یەکسەر لە فاکتور و گوزارشەکاندا بەردەستە',
    ],
    related: ['invoices', 'bills', 'crm-leads'],
  },
});

registerPageHelp('invoices', {
  en: {
    title: 'Invoices',
    section: 'sales',
    purpose:
      'Bills you send to customers requesting payment. Tracks status from Draft → Sent → Paid → Overdue.',
    fields: [
      { name: 'Customer', required: true, description: 'Who you are billing.' },
      { name: 'Invoice #', required: true, description: 'Auto-generated unique number.' },
      { name: 'Date', required: true, description: 'Issue date.' },
      { name: 'Due date', required: true, description: 'When payment is expected.' },
      { name: 'Line items', required: true, description: 'Products/services with quantity, price, and tax.' },
      { name: 'Discount', description: 'Per-line or total discount (% or fixed amount).' },
      { name: 'Notes', description: 'Visible to the customer (terms, thank-you).' },
    ],
    workflow: [
      'Create invoice with customer + line items',
      'Save as Draft to review later, or "Save & Send" to email immediately',
      'Approve (if approval workflow is enabled) → status becomes Sent',
      'Record payment when customer pays → status becomes Paid (or Partially Paid)',
      'For mistakes: issue a Credit Note instead of editing posted invoices',
    ],
    tips: [
      'Use Recurring Invoices for monthly subscriptions.',
      'Send via WhatsApp directly from the invoice toolbar.',
      'PDF preview supports right-to-left for Arabic / Kurdish customers.',
    ],
    warnings: [
      'Once an invoice is paid or has journal entries posted, you cannot delete it — issue a Credit Note instead.',
    ],
    related: ['quotes', 'sales-orders', 'banking', 'reports'],
  },
  ku: {
    title: 'فاکتورەکان',
    section: 'sales',
    purpose:
      'فاکتوری ناردراو بۆ کڕیار بۆ داواکردنی پارە. دۆخ تراک دەکات: ڕەشنووس → نێردراو → پارەدراو → دواکەوتوو.',
    fields: [
      { name: 'کڕیار', required: true, description: 'کێ فاکتوری بۆ دەنێریت.' },
      { name: 'ژمارەی فاکتور', required: true, description: 'ژمارەی یەکتای خۆکار.' },
      { name: 'بەروار', required: true, description: 'بەرواری دەرکردن.' },
      { name: 'بەرواری کۆتایی', required: true, description: 'کەی پارەدان چاوەڕێ دەکرێت.' },
      { name: 'هێڵەکان', required: true, description: 'کاڵا/خزمەتگوزاری لەگەڵ بڕ، نرخ، و باج.' },
      { name: 'داشکاندن', description: 'لە هەر هێڵ یان لە کۆ (% یان بڕی دیاریکراو).' },
      { name: 'تێبینی', description: 'بۆ کڕیار دەردەکەوێت (مەرج، سپاس).' },
    ],
    workflow: [
      'فاکتور دروست بکە بە کڕیار + هێڵەکان',
      '«ڕەشنووس» پاشەکەوت بکە بۆ یان «پاشەکەوت و ناردن» بۆ ناردن یەکسەر',
      'پاش پۆست (ئەگەر ڕێگەی پەسەندکردن چالاکە) → دۆخ دەبێتە نێردراو',
      'پارە تۆمار بکە کاتێک کڕیار پارەی دەدات → دۆخ دەبێتە پارەدراو (یان پارەدراوی بەشەکی)',
      'بۆ هەڵە: کرێدت نۆت دەرکە لە جیاتی دەستکاری فاکتوری پۆستکراو',
    ],
    tips: [
      'بۆ مودای مانگانە «فاکتوری دووبارە» بەکار بهێنە.',
      'لە سەروەری فاکتورەکە ڕاستەوخۆ بە WhatsApp بنێرە.',
      'پێشبینینی PDF ڕاست-بۆ-چەپ پشتیوانی دەکات بۆ کڕیاری عەرەبی/کوردی.',
    ],
    warnings: [
      'کاتێک فاکتورێک پارەدراو بوو یان تۆماری ژمێرکاری هەیە، ناتوانیت بیسڕیتەوە — لە جیاتی ئەوە کرێدت نۆت دەرکە.',
    ],
    related: ['quotes', 'sales-orders', 'banking', 'reports'],
  },
});

registerPageHelp('quotes', {
  en: {
    title: 'Quotes / Estimates',
    section: 'sales',
    purpose:
      'Price offers you send to customers before they buy. Once accepted, convert to an Invoice or Sales Order with one click.',
    workflow: [
      'Create quote with line items + valid-until date',
      'Send to customer for approval (email or WhatsApp)',
      'Once accepted: Convert → Invoice or Sales Order',
      'Rejected/expired quotes can be archived without affecting accounts',
    ],
    tips: ['Quotes do NOT post to the general ledger. Only invoices/orders do.'],
    related: ['invoices', 'sales-orders', 'contacts'],
  },
  ku: {
    title: 'نرخاندنەکان',
    section: 'sales',
    purpose:
      'پێشنیاری نرخ کە بۆ کڕیار دەنێریت پێش کڕین. کاتێک قبووڵ کرا، بە یەک کلیک دەیگۆڕیت بۆ فاکتور یان داواکاریی فرۆش.',
    workflow: [
      'نرخاندن دروست بکە بە هێڵەکان + بەرواری کۆتایی',
      'بۆ کڕیار بنێرە بۆ ڕەزامەندی (ئیمەیڵ یان WhatsApp)',
      'پاش قبووڵ: گۆڕین → فاکتور یان داواکاریی فرۆش',
      'نرخاندنی ڕەفزکراو/بەسەرچوو دەکرێت ئەرشیف بکرێت بێ کاریگەری لەسەر حیسابات',
    ],
    tips: ['نرخاندن لە لێجەری گشتی پۆست ناکرێت — تەنها فاکتور و داواکاریی پۆست دەکرێت.'],
    related: ['invoices', 'sales-orders', 'contacts'],
  },
});

registerPageHelp('sales-orders', {
  en: {
    title: 'Sales Orders',
    section: 'sales',
    purpose: 'Confirmed customer orders waiting to be fulfilled (delivered + invoiced).',
    workflow: [
      'Create from accepted quote or directly',
      'Pick & ship → creates Shipment + reduces inventory',
      'Invoice when ready (partial or full)',
      'Closed when fully invoiced and shipped',
    ],
    related: ['quotes', 'invoices', 'inventory'],
  },
  ku: {
    title: 'داواکاریی فرۆش',
    section: 'sales',
    purpose: 'داواکاریی پشتڕاستکراوی کڕیار کە چاوەڕێی جێبەجێکردنە (گەیاندن + فاکتور).',
    workflow: [
      'لە نرخاندنی قبووڵکراو دروست بکە یان ڕاستەوخۆ',
      'هەڵبژێرە و بنێرە → گەیاندن دروست دەکات + کۆگا کەم دەکات',
      'فاکتور دروست بکە کاتێک ئامادەیە (بەشەکی یان تەواو)',
      'داخراو دەبێت کاتێک تەواو فاکتور و گەیاندن کرا',
    ],
    related: ['quotes', 'invoices', 'inventory'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Purchases
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('bills', {
  en: {
    title: 'Bills',
    section: 'purchases',
    purpose: 'Invoices vendors send you. Track what you owe and when payments are due.',
    fields: [
      { name: 'Vendor', required: true, description: 'Who sent the bill.' },
      { name: 'Bill #', required: true, description: 'Vendor reference number.' },
      { name: 'Date', required: true, description: 'Bill date.' },
      { name: 'Due date', required: true, description: 'Payment due date.' },
      { name: 'Line items', required: true, description: 'What was purchased.' },
      { name: 'Withholding tax', description: 'Iraq WHT (5%) deducted from vendor payment.' },
    ],
    workflow: [
      'Enter bill from vendor',
      'Approve → status becomes Posted (creates AP journal entry)',
      'Pay (full or partial) — supports withholding tax for Iraq compliance',
      'Reconcile against bank statement',
    ],
    related: ['expenses', 'banking'],
  },
  ku: {
    title: 'بیلەکان',
    section: 'purchases',
    purpose: 'فاکتورەکانی فرۆشیار بۆ تۆ. تراکی دەکات کە چەند قەرزداری و کەی پارەدان واجبە.',
    fields: [
      { name: 'فرۆشیار', required: true, description: 'کێ بیلی ناردووە.' },
      { name: 'ژمارەی بیل', required: true, description: 'ژمارەی فرۆشیار.' },
      { name: 'بەروار', required: true, description: 'بەرواری بیل.' },
      { name: 'بەرواری کۆتایی', required: true, description: 'بەرواری کۆتایی پارەدان.' },
      { name: 'هێڵەکان', required: true, description: 'چی کڕدراوە.' },
      { name: 'باجی ڕاگرتن', description: 'باجی ڕاگرتنی عێراق (٥٪) لە پارەی فرۆشیار کەم دەکرێت.' },
    ],
    workflow: [
      'بیلی فرۆشیار داخڵ بکە',
      'پەسەند بکە → دۆخ دەبێتە پۆستکراو (تۆماری AP دروست دەکات)',
      'پارە بدە (تەواو یان بەشەکی) — پشتیوانیی باجی ڕاگرتن دەکات',
      'لەگەڵ گوزارشی بانک ڕێک بخە',
    ],
    related: ['expenses', 'banking'],
  },
});

registerPageHelp('expenses', {
  en: {
    title: 'Expenses',
    section: 'purchases',
    purpose:
      'Money your business spends. Attach receipts, categorize by account, and track project costs.',
    tips: [
      'Use OCR (Receipts) to auto-extract data from photos.',
      'Mark "Billable" to invoice the cost back to a customer.',
      'Tag expenses to a Project to compute project profitability.',
    ],
    related: ['bills', 'projects'],
  },
  ku: {
    title: 'خەرجییەکان',
    section: 'purchases',
    purpose: 'پارەی خەرج بزنسەکەت. وەسڵ هاوپێچ بکە، بە هەژمار پۆلێن بکە، و تێچووی پڕۆژە تراک بکە.',
    tips: [
      'OCR (وەسڵەکان) بەکار بهێنە بۆ دەرهێنانی خۆکاری زانیاری لە وێنە.',
      '«بیلابڵ» دیاری بکە بۆ گەڕاندنەوەی تێچوو لە کڕیار.',
      'خەرجییەکان بە پڕۆژە تاگ بکە بۆ ژماردنی قازانجی پڕۆژە.',
    ],
    related: ['bills', 'projects'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Banking
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('banking', {
  en: {
    title: 'Banking',
    section: 'banking',
    purpose:
      'Bank and cash accounts. Import statements, match transactions to invoices/bills, reconcile balances.',
    workflow: [
      'Add bank account (Settings → Banking)',
      'Import CSV statement (or enter manually)',
      'Match each transaction to an invoice, bill, or expense',
      'Run reconciliation when bank balance equals book balance',
    ],
    tips: [
      'Bank Rules can auto-match recurring transactions (rent, salaries, internet).',
      'Multi-currency accounts auto-revalue at month-end.',
    ],
    related: ['journals'],
  },
  ku: {
    title: 'بانکداری',
    section: 'banking',
    purpose:
      'هەژماری بانک و کاش. گوزارش هاوبەش بکە، مامەڵەکان لەگەڵ فاکتور/بیل لێک بدەنەوە، و باڵانس ڕێک بخە.',
    workflow: [
      'هەژماری بانک زیاد بکە (Settings → Banking)',
      'گوزارشی CSV هاوبەش بکە (یان دەستی)',
      'هەر مامەڵەیەک لەگەڵ فاکتور، بیل، یان خەرجی لێک بدەرەوە',
      'ڕێک‌خستن بکە کاتێک باڵانسی بانک = باڵانسی دەفتەر',
    ],
    tips: [
      'یاسای بانک دەتوانێت مامەڵەی دووبارە خۆکار لێک بداتەوە (کرێ، مووچە، ئینتەرنێت).',
      'هەژماری چەند دراو خۆکار لە کۆتایی مانگ پێداچوونەوە دەکرێت.',
    ],
    related: ['journals'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Inventory
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('items', {
  en: {
    title: 'Items',
    section: 'inventory',
    purpose:
      'Products and services you sell or buy. Each item has price, tax, and optional inventory tracking.',
    fields: [
      { name: 'Name', required: true, description: 'Item name shown on invoices.' },
      { name: 'SKU', description: 'Internal product code for inventory tracking.' },
      { name: 'Type', required: true, description: 'Goods (physical, tracked) or Service (no inventory).' },
      { name: 'Sale price', description: 'Default price when added to an invoice.' },
      { name: 'Purchase price', description: 'Default cost when added to a bill.' },
      { name: 'Tax', description: 'Default sales tax rate (e.g. 5% VAT Iraq).' },
      { name: 'Track inventory', description: 'When ON, stock levels update automatically on every sale and purchase.' },
      { name: 'Reorder level', description: 'When stock falls below this, an alert appears in the dashboard.' },
    ],
    related: ['serial_numbers'],
  },
  ku: {
    title: 'کاڵا و خزمەتگوزاری',
    section: 'inventory',
    purpose:
      'بەرهەم و خزمەتگوزاری کە دەفرۆشیت یان دەکڕیت. هەر یەک نرخ، باج، و چاودێریی کۆگای ئاڵگۆڕی هەیە.',
    fields: [
      { name: 'ناو', required: true, description: 'ناوی کاڵا کە لە فاکتوردا نیشان دەدرێت.' },
      { name: 'SKU', description: 'کۆدی ناوخۆیی بۆ چاودێریی کۆگا.' },
      { name: 'جۆر', required: true, description: 'کاڵا (مادی، تراکراو) یان خزمەتگوزاری (بێ کۆگا).' },
      { name: 'نرخی فرۆش', description: 'نرخی ئاسایی کاتێک بۆ فاکتور زیاد دەکرێت.' },
      { name: 'نرخی کڕین', description: 'تێچووی ئاسایی کاتێک بۆ بیل زیاد دەکرێت.' },
      { name: 'باج', description: 'ڕێژەی باجی فرۆش (نموونە: ٥٪ VAT عێراق).' },
      { name: 'چاودێریی کۆگا', description: 'کاتێک چالاکە، ئاستی کۆگا خۆکار نوێ دەبێتەوە.' },
      { name: 'ئاستی داواکاری دووبارە', description: 'کاتێک کۆگا کەمتر بێت لەمە، ئاگاداری لە داشبۆرد دەردەکەوێت.' },
    ],
    related: ['serial_numbers'],
  },
});

registerPageHelp('serial_numbers', {
  en: {
    title: 'Serial Numbers',
    section: 'inventory',
    purpose: 'Track each individual unit (electronics, vehicles, …) by unique serial / IMEI / VIN.',
    workflow: [
      'Enable serial tracking on the Item',
      'When receiving stock, scan/enter each serial',
      'When selling, pick the specific serial from the dropdown',
      'View full history for any serial: receipts, sales, repairs, returns',
    ],
    related: ['items'],
  },
  ku: {
    title: 'ژمارەی سیریاڵ',
    section: 'inventory',
    purpose: 'تراکی هەر یەکەیەک بکە (ئەلیکترۆنیات، ئۆتۆمبێل، …) بە ژمارەی سیریاڵ/IMEI/VIN ـی یەکتا.',
    workflow: [
      'چاودێریی سیریاڵ لە کاڵا چالاک بکە',
      'کاتێک کۆگا وەردەگریت، هەر سیریاڵێک سکان/داخڵ بکە',
      'کاتێک دەفرۆشیت، سیریاڵی تایبەت لە لیستەکە هەڵبژێرە',
      'مێژووی تەواو ببینە بۆ هەر سیریاڵێک: وەرگرتن، فرۆش، چاککردنەوە، گەڕاندنەوە',
    ],
    related: ['items'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Accounting
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('accounts', {
  en: {
    title: 'Chart of Accounts',
    section: 'accounting',
    purpose:
      'The list of all accounts used to record transactions: assets, liabilities, equity, revenue, expenses.',
    tips: [
      'Iraq Localization preset includes a fully-translated COA matching IFRS + Iraqi tax rules.',
      'Sub-accounts (e.g. "Bank → Bank A → IQD") give multi-level reports.',
    ],
    warnings: ['Once an account has transactions, you cannot delete it — only deactivate.'],
    related: ['journals', 'reports'],
  },
  ku: {
    title: 'پلانی هەژمارەکان',
    section: 'accounting',
    purpose:
      'لیستی هەموو هەژمارەکان بۆ تۆمارکردنی مامەڵەکان: سامان، قەرز، خاوەنیێتی، داهات، خەرجی.',
    tips: [
      'یارمەتیی عێراق پلانێکی هەژماری بە تەواوی وەرگێڕاو لە خۆ دەگرێت کە لەگەڵ IFRS + باجی عێراق دەگونجێت.',
      'هەژماری لاوەکی (نموونە: «بانک → بانکی A → IQD») ڕاپۆرتی چەند ئاستی دەدات.',
    ],
    warnings: ['کاتێک هەژمارێک مامەڵەی هەیە، ناتوانیت بیسڕیتەوە — تەنها بە ناچالاک دەکرێت.'],
    related: ['journals', 'reports'],
  },
});

registerPageHelp('journals', {
  en: {
    title: 'Journal Entries',
    section: 'accounting',
    purpose:
      'Manual double-entry transactions. Most journals are auto-created by invoices/bills/payments — only enter manual ones for adjustments.',
    fields: [
      { name: 'Date', required: true, description: 'Posting date.' },
      { name: 'Reference', description: 'Description shown in reports.' },
      { name: 'Lines', required: true, description: 'At least one Debit + one Credit. Total Debit must equal total Credit.' },
    ],
    workflow: [
      'New Journal → enter date + reference',
      'Add lines: Account, Debit OR Credit (not both per line)',
      'System validates Debit total == Credit total',
      'Post → entry becomes immutable (use a reversing journal to undo)',
    ],
    warnings: [
      'Posted journals cannot be edited — use Reverse to create a counter-entry.',
      'Journals in a closed period are locked.',
    ],
    related: ['accounts', 'reports'],
  },
  ku: {
    title: 'تۆمارە ژمارییەکان',
    section: 'accounting',
    purpose:
      'مامەڵەی دەستی double-entry. زۆربەی ژۆرنالەکان خۆکار لە فاکتور/بیل/پارەدان دروست دەکرێن — تەنها بۆ ڕاستکردنەوە دەستی داخڵ بکە.',
    fields: [
      { name: 'بەروار', required: true, description: 'بەرواری پۆست.' },
      { name: 'سەرچاوە', description: 'وەسف کە لە ڕاپۆرتدا نیشان دەدرێت.' },
      { name: 'هێڵەکان', required: true, description: 'لانیکەم یەک Debit + یەک Credit. کۆی Debit پێویستە یەکسان بێت لەگەڵ کۆی Credit.' },
    ],
    workflow: [
      'تۆماری نوێ → بەروار + سەرچاوە داخڵ بکە',
      'هێڵ زیاد بکە: هەژمار، Debit یان Credit (نا هەردووک لە یەک هێڵ)',
      'سیستەم پشتڕاست دەکاتەوە کۆی Debit == کۆی Credit',
      'پۆست → تۆمارەکە ناگۆڕە (ژۆرنالی پێچەوانە بەکار بهێنە بۆ هەڵوەشاندن)',
    ],
    warnings: [
      'تۆماری پۆستکراو ناگۆڕێت — Reverse بەکار بهێنە بۆ دروستکردنی تۆماری پێچەوانە.',
      'تۆمارەکانی ماوەی داخراو قفڵکراون.',
    ],
    related: ['accounts', 'reports'],
  },
});

registerPageHelp('reports', {
  en: {
    title: 'Reports',
    section: 'reports',
    purpose:
      'Financial and operational reports: P&L, Balance Sheet, Cash Flow, Sales by Customer, AR/AP Aging, Tax Returns, and more.',
    workflow: [
      'Pick a report from the categorized list',
      'Select date range + filters (branch, customer, currency)',
      'View on-screen, export PDF/Excel/CSV, or schedule by email',
    ],
    tips: [
      'Compare two periods side-by-side using Compare mode.',
      'Save your filters as a "Saved Report" for one-click access.',
      'Multi-branch reports include consolidation.',
    ],
    related: ['journals', 'accounts'],
  },
  ku: {
    title: 'ڕاپۆرتەکان',
    section: 'reports',
    purpose:
      'ڕاپۆرتی دارایی و کاروباری: P&L، باڵانس شیت، جوڵەی پارە، فرۆش بە کڕیار، تەمەنی AR/AP، باجی گەڕاوە، و زیاتر.',
    workflow: [
      'ڕاپۆرتێک لە لیستی پۆلێنکراو هەڵبژێرە',
      'ماوەی بەروار + فلتەرەکان دیاری بکە (لقی، کڕیار، دراو)',
      'لە سکرین ببینە، PDF/Excel/CSV ئیکسپۆرت بکە، یان بە ئیمەیڵ بنێرە',
    ],
    tips: [
      'دوو ماوە لەگەڵ یەکتر بەراورد بکە لە مۆدی Compare.',
      'فلتەرەکانت پاشەکەوت بکە بە «ڕاپۆرتی پاشەکەوتکراو» بۆ یەک کلیک.',
      'ڕاپۆرتی چەند لقی پشتیوانیی consolidation دەکات.',
    ],
    related: ['journals', 'accounts'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// POS
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('pos-terminal', {
  en: {
    title: 'POS Terminal',
    section: 'pos',
    purpose:
      'The cashier interface. Scan/select products, accept payment (cash, card, multi-payment), and print receipt — all from one screen.',
    workflow: [
      'Open a session (counts opening cash drawer)',
      'Add items via barcode scan or product grid',
      'Apply discount/loyalty/coupon if needed',
      'Press "Pay" → choose payment method(s) → confirm',
      'Receipt prints + invoice + journal entry are auto-created',
      'Close session at end of shift (cash count + reconciliation)',
    ],
    tips: [
      'F2 quick-search by barcode, F4 customer lookup, F8 close ticket.',
      'Offline mode keeps working without internet — syncs when reconnected.',
      'Multi-payment supported: e.g. partial cash + partial card.',
    ],
    related: ['pos-sessions'],
    shortcuts: [
      { keys: 'F2', description: 'Search by barcode' },
      { keys: 'F4', description: 'Customer lookup' },
      { keys: 'F8', description: 'Close ticket' },
      { keys: 'Enter', description: 'Pay' },
    ],
  },
  ku: {
    title: 'تێرمیناڵی POS',
    section: 'pos',
    purpose:
      'ڕووکاری سندوقدار. کاڵاکان سکان/هەڵبژێرە، پارە وەربگرە (کاش، کارت، چەند پارەدان)، و وەسڵ چاپ بکە — هەمووی لە یەک شاشە.',
    workflow: [
      'سێشن بکەرەوە (سندوقی کاش بژمێرە)',
      'کاڵاکان زیاد بکە بە سکانی بارکۆد یان لە گریدی بەرهەم',
      'داشکاندن/خواست‌گرتن/کۆپۆن جێبەجێ بکە ئەگەر پێویستە',
      '«پارەدان» کلیک بکە → شێوازی پارە دیاری بکە → پشتڕاست بکە',
      'وەسڵ چاپ دەکرێت + فاکتور + ژۆرنال خۆکار دروست دەکرێن',
      'لە کۆتایی شیفت سێشن دابخە (ژمارەی کاش + ڕێک‌خستنەوە)',
    ],
    tips: [
      'F2 گەڕانی خێرا بە بارکۆد، F4 دۆزینەوەی کڕیار، F8 داخستنی تیکت.',
      'مۆدی ئۆفلاین بێ ئینتەرنێت کار دەکات — خۆکار syncـ دەبێت پاش پەیوەندی.',
      'چەند پارەدان پشتیوانییە: نموونە بەشێک کاش + بەشێک کارت.',
    ],
    related: ['pos-sessions'],
    shortcuts: [
      { keys: 'F2', description: 'گەڕان بە بارکۆد' },
      { keys: 'F4', description: 'دۆزینەوەی کڕیار' },
      { keys: 'F8', description: 'داخستنی تیکت' },
      { keys: 'Enter', description: 'پارەدان' },
    ],
  },
});

registerPageHelp('pos-sessions', {
  en: {
    title: 'POS Sessions',
    section: 'pos',
    purpose:
      'Each cashier shift is a Session. Tracks opening cash, sales, payments by method, and closing cash count.',
    workflow: [
      'Open session — enter opening cash drawer amount',
      'Sell through the Terminal (each sale = POS Order linked to the session)',
      'Close session — enter actual cash count → system shows variance vs expected',
      'Approve/correct variance → session locked, journal posted',
    ],
    related: ['pos-terminal'],
  },
  ku: {
    title: 'سێشنەکانی POS',
    section: 'pos',
    purpose:
      'هەر شیفتی سندوقدار سێشنە. کاشی کردنەوە، فرۆش، پارەدان بە جۆر، و ژمارەی کاشی داخستن تراک دەکات.',
    workflow: [
      'سێشن بکەرەوە — بڕی کاشی سندوقی کردنەوە داخڵ بکە',
      'بفرۆشە لە تێرمیناڵ (هەر فرۆش = داواکاریی POS بەستراو بە سێشن)',
      'سێشن دابخە — ژمارەی کاشی ڕاستەقینە داخڵ بکە → سیستەم جیاوازی نیشان دەدات',
      'پەسەند بکە/ڕاست بکەرەوە → سێشن قفڵ دەبێت، ژۆرنال پۆست دەکرێت',
    ],
    related: ['pos-terminal'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// CRM
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('crm-leads', {
  en: {
    title: 'CRM Leads',
    section: 'crm',
    purpose:
      'Potential customers tracked through stages: New → Contacted → Qualified → Won / Lost.',
    workflow: [
      'Capture lead (web form, manual entry, or import)',
      'Assign owner + first activity (call, email, meeting)',
      'Move through pipeline stages as relationship develops',
      'On Win → convert to Contact + Quote/Invoice',
      'On Loss → mark with reason for analytics',
    ],
    tips: [
      'Use Pipeline view (Kanban) for at-a-glance status of all leads.',
      'Lead Score uses configurable rules to prioritize hot leads.',
    ],
    related: ['contacts', 'quotes'],
  },
  ku: {
    title: 'لیدەکانی CRM',
    section: 'crm',
    purpose:
      'کڕیاری ئەگەری کە بە قۆناغەکان تراک دەکرێن: نوێ → پەیوەندیکراو → باوەڕپێکراو → براوە / دۆڕاو.',
    workflow: [
      'لید بگرە (فۆڕمی وێب، داخڵکردنی دەستی، یان هاوبەشکردن)',
      'خاوەن دیاری بکە + یەکەم چالاکی (پەیوەندی، ئیمەیڵ، کۆبوونەوە)',
      'لە ناو پایپلاینەکە جوڵە بکە بە گەشەی پەیوەندی',
      'لە کاتی Win → بیگۆڕە بۆ پەیوەندی + نرخاندن/فاکتور',
      'لە کاتی Loss → بە هۆکار دیاری بکە بۆ شیکاری',
    ],
    tips: [
      'Pipeline view (Kanban) بەکار بهێنە بۆ بینینی دۆخی هەموو لیدەکان.',
      'Lead Score یاسای دیاریکراو بەکار دەهێنێت بۆ پێش‌خستنی لیدی گەرم.',
    ],
    related: ['contacts', 'quotes'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// HR
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('hr-employees', {
  en: {
    title: 'Employees',
    section: 'hr',
    purpose:
      'Master record for each staff member: contract, salary, attendance, time-off, payroll, and documents.',
    fields: [
      { name: 'Full name', required: true, description: 'Legal name as it should appear on payslips.' },
      { name: 'Employee ID', required: true, description: 'Unique internal code.' },
      { name: 'Department', description: 'For org chart + reports.' },
      { name: 'Manager', description: 'For approval workflows (timesheet, time-off).' },
      { name: 'Hire date', required: true, description: 'Used for tenure + leave accruals.' },
      { name: 'Contract type', description: 'Permanent, contract, intern, etc.' },
    ],
  },
  ku: {
    title: 'کارمەندەکان',
    section: 'hr',
    purpose:
      'تۆماری سەرەکی هەر کارمەندێک: گرێبەست، مووچە، ئامادەبوون، پشوو، مووچە، و بەڵگەنامەکان.',
    fields: [
      { name: 'ناوی تەواو', required: true, description: 'ناوی یاسایی وەک لە بڕگەی مووچەدا دەردەکەوێت.' },
      { name: 'ID ـی کارمەند', required: true, description: 'کۆدی ناوخۆیی یەکتا.' },
      { name: 'بەش', description: 'بۆ نەخشەی ڕێکخراوەیی + ڕاپۆرت.' },
      { name: 'بەرپرس', description: 'بۆ ڕێگەی پەسەندکردن (تایمشیت، پشوو).' },
      { name: 'بەرواری دامەزراندن', required: true, description: 'بۆ خزمەتی پاشەکەوت + پشوو.' },
      { name: 'جۆری گرێبەست', description: 'هەمیشەیی، گرێبەست، خۆبەخش، …' },
    ],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Projects
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('projects', {
  en: {
    title: 'Projects',
    section: 'projects',
    purpose:
      'Track work for clients: tasks, timesheets, expenses, and billable amounts. Compute project profitability.',
    workflow: [
      'Create Project (link to a Customer if billable)',
      'Add tasks + assign to employees',
      'Team logs hours via Timesheet',
      'Tag expenses to the project',
      'Generate invoice from billable hours/expenses',
      'View profitability: Revenue − Cost = Margin',
    ],
    related: ['contacts', 'invoices', 'expenses'],
  },
  ku: {
    title: 'پڕۆژەکان',
    section: 'projects',
    purpose:
      'کاری کڕیار تراک بکە: تاسک، تایمشیت، خەرجی، و بڕی بیلابڵ. قازانجی پڕۆژە بژمێرە.',
    workflow: [
      'پڕۆژە دروست بکە (بە کڕیار بەستە ئەگەر بیلابڵە)',
      'تاسک زیاد بکە + بە کارمەندان دیاری بکە',
      'تیم کاتژمێرەکان لۆگ دەکات لە تایمشیت',
      'خەرجی بە پڕۆژە تاگ بکە',
      'فاکتور لە کاتژمێر/خەرجی بیلابڵ دروست بکە',
      'قازانج ببینە: داهات − تێچوو = مارجن',
    ],
    related: ['contacts', 'invoices', 'expenses'],
  },
});

// ─────────────────────────────────────────────────────────────────────────
// Setup / System
// ─────────────────────────────────────────────────────────────────────────

registerPageHelp('settings', {
  en: {
    title: 'Settings',
    section: 'setup',
    purpose:
      'Global configuration: company info, currencies, fiscal year, taxes, branding, integrations, branches.',
    tips: [
      'Changes here affect every user in your organization.',
      'Iraq Localization preset configures VAT, WHT, COA, and IQD currency in one click.',
    ],
  },
  ku: {
    title: 'ڕێکخستنەکان',
    section: 'setup',
    purpose:
      'دەسبژاردنی گشتی: زانیاریی کۆمپانیا، دراوەکان، ساڵی دارایی، باج، براندینگ، یەکگرتنەکان، لقەکان.',
    tips: [
      'گۆڕانکاری لێرە کاریگەری لەسەر هەموو بەکارهێنەری ڕێکخراوەکەت دەبێت.',
      'پێشئامادەی عێراق VAT، WHT، COA، و دراوی IQD بە یەک کلیک ڕێک دەخات.',
    ],
  },
});

registerPageHelp('trash', {
  en: {
    title: 'Trash',
    section: 'system',
    purpose:
      'Anything you delete is moved here for 30 days. You can restore items, or permanently remove them. After 30 days they are auto-purged.',
    workflow: [
      'Pick a section (contacts, invoices, …) from the filter',
      'Click "Restore" to send the item back to its original list',
      'Click "Delete forever" to remove permanently',
    ],
    warnings: ['Permanent delete cannot be undone — be careful.'],
  },
  ku: {
    title: 'تەنەکەی پاشماوە',
    section: 'system',
    purpose:
      'هەر شتێک کە دەیسڕیتەوە بۆ ٣٠ ڕۆژ لێرە دەمێنێتەوە. دەتوانیت بیگەڕێنیتەوە یان بە هەمیشەیی بیسڕیتەوە. پاش ٣٠ ڕۆژ خۆکار دەسڕێتەوە.',
    workflow: [
      'گرووپێک هەڵبژێرە (contacts, invoices, …) لە پاڵاوتن',
      'کلیک لەسەر «گەڕاندنەوە» بکە بۆ ناردنی بۆ لیستی ئەسڵی',
      'کلیک لەسەر «سڕینەوەی هەمیشەیی» بکە بۆ سڕینەوەی بێ گەڕانەوە',
    ],
    warnings: ['سڕینەوەی هەمیشەیی بێ گەڕانەوەیە — وردبە.'],
  },
});
