/**
 * In-app help widget article registry (G2 / R2.2, R2.6).
 *
 * 40 articles total, each trilingual (ku / en / ar). The registry stores
 * metadata; the article bodies are markdown files in the per-language
 * subdirectories — they're loaded on demand by `HelpArticle.tsx` via
 * `import.meta.glob` so the bundle is split per language.
 *
 * Categories mirror the spec: Getting Started, POS, Invoicing, Inventory,
 * Taxes, Payroll, Reports, Admin.
 */

export type HelpLocale = 'ku' | 'en' | 'ar';
export type HelpCategory =
  | 'getting-started'
  | 'pos'
  | 'invoicing'
  | 'inventory'
  | 'taxes'
  | 'payroll'
  | 'reports'
  | 'admin';

export interface HelpArticleMeta {
  slug: string;
  category: HelpCategory;
  title: Record<HelpLocale, string>;
  summary: Record<HelpLocale, string>;
  /** Slugs of related articles, displayed in the article footer. */
  related: string[];
  /** Optional route hints — show this article first when the user is on
   * a matching route. */
  contextRoutes?: string[];
  /** Whether to feature on the help widget home screen. */
  featured?: boolean;
}

// ── 40 articles ──────────────────────────────────────────────────────────

export const HELP_ARTICLES: HelpArticleMeta[] = [
  // ── Getting Started (5) ───────────────────────────────────────────────
  {
    slug: 'create-account',
    category: 'getting-started',
    title: {
      ku: 'دروستکردنی هەژمار',
      en: 'Create your account',
      ar: 'إنشاء حسابك',
    },
    summary: {
      ku: 'چۆن یەکەم جار خۆت تۆمار دەکەیت لە Zoho Kurdish.',
      en: 'How to sign up for the first time.',
      ar: 'كيفية إنشاء حساب لأول مرة.',
    },
    related: ['first-login', 'onboarding-wizard'],
    featured: true,
  },
  {
    slug: 'first-login',
    category: 'getting-started',
    title: {
      ku: 'یەکەم چونەژوور',
      en: 'Your first login',
      ar: 'تسجيل الدخول لأول مرة',
    },
    summary: {
      ku: 'شیکردنەوەی پەڕەی سەرەکی پاش چوونەژوورەوە.',
      en: 'A tour of the home screen after first login.',
      ar: 'جولة في الصفحة الرئيسية بعد تسجيل الدخول.',
    },
    related: ['create-account', 'tour'],
  },
  {
    slug: 'onboarding-wizard',
    category: 'getting-started',
    title: {
      ku: 'ڕاهێنانی یەکەم چرکە',
      en: 'The 60-second onboarding wizard',
      ar: 'معالج البدء السريع',
    },
    summary: {
      ku: 'لە "بنکەی بەتاڵ" بۆ "یەکەم فرۆشتن" لە کەمتر لە یەک خولەک.',
      en: 'From empty database to first sale in under a minute.',
      ar: 'من قاعدة بيانات فارغة إلى أول عملية بيع في أقل من دقيقة.',
    },
    related: ['create-account', 'invite-team'],
    featured: true,
  },
  {
    slug: 'invite-team',
    category: 'getting-started',
    title: {
      ku: 'بانگکردنی تیم',
      en: 'Invite your team',
      ar: 'دعوة فريقك',
    },
    summary: {
      ku: 'بانگکردنی کارمەند و دیاریکردنی ڕۆڵ.',
      en: 'Invite teammates and assign roles.',
      ar: 'دعوة أعضاء الفريق وتعيين الأدوار.',
    },
    related: ['user-roles', 'onboarding-wizard'],
  },
  {
    slug: 'tour',
    category: 'getting-started',
    title: {
      ku: 'گەشتێک بە سیستەمەکەدا',
      en: 'A tour of the system',
      ar: 'جولة في النظام',
    },
    summary: {
      ku: 'پێشانی گرنگترین بەشەکانی Zoho Kurdish.',
      en: 'A quick tour of the most-used screens.',
      ar: 'جولة سريعة في أهم الشاشات.',
    },
    related: ['first-login'],
  },

  // ── POS (10) ──────────────────────────────────────────────────────────
  {
    slug: 'pair-printer',
    category: 'pos',
    title: {
      ku: 'بەستنی چاپکەری ڕیسیت',
      en: 'Pair a receipt printer',
      ar: 'إقران طابعة الإيصالات',
    },
    summary: {
      ku: 'بەستنی چاپکەری ESC/POS-ی ٥٨/٨٠ ملم بە POS.',
      en: 'Connect a 58/80mm ESC/POS printer to your POS.',
      ar: 'توصيل طابعة ESC/POS 58/80 مم بنقطة البيع.',
    },
    related: ['cash-management', 'kitchen-display'],
    contextRoutes: ['/pos', '/settings/hardware'],
    featured: true,
  },
  {
    slug: 'void-sale',
    category: 'pos',
    title: { ku: 'هەڵوەشاندنەوەی فرۆشتن', en: 'Void a sale', ar: 'إلغاء عملية بيع' },
    summary: {
      ku: 'چۆن فرۆشتنێکی هەڵە هەڵدەوەشێنرێتەوە و چۆن لۆگ دەکرێت.',
      en: 'How to void a wrong sale and how it is logged.',
      ar: 'كيفية إلغاء عملية بيع خاطئة وكيفية تسجيلها.',
    },
    related: ['refund', 'end-of-day'],
    contextRoutes: ['/pos'],
  },
  {
    slug: 'cash-management',
    category: 'pos',
    title: {
      ku: 'بەڕێوەبردنی پارە',
      en: 'Cash drawer management',
      ar: 'إدارة درج النقود',
    },
    summary: {
      ku: 'کردنەوەی پارەدان و دڵنیابوون لە پارە کۆکراوەکان.',
      en: 'Open the drawer and reconcile cash at end of shift.',
      ar: 'فتح الدرج وتسوية النقد في نهاية الوردية.',
    },
    related: ['end-of-day', 'pair-printer'],
    contextRoutes: ['/pos'],
  },
  {
    slug: 'customer-display',
    category: 'pos',
    title: {
      ku: 'پشتاپشتی پیشاندانی کڕیار',
      en: 'Customer-facing display',
      ar: 'شاشة العميل',
    },
    summary: {
      ku: 'دانانی پیشاندەرێکی دووەم بۆ کڕیار.',
      en: 'Configure the second screen shown to the customer.',
      ar: 'تكوين الشاشة الثانية للعميل.',
    },
    related: ['pair-printer'],
    contextRoutes: ['/pos'],
  },
  {
    slug: 'kitchen-display',
    category: 'pos',
    title: {
      ku: 'پیشاندەری چێشتخانە',
      en: 'Kitchen display system',
      ar: 'شاشة المطبخ',
    },
    summary: {
      ku: 'نیشاندانی داواکاری بۆ چێشتخانە.',
      en: 'Show incoming orders on the kitchen screen.',
      ar: 'عرض الطلبات على شاشة المطبخ.',
    },
    related: ['pair-printer'],
    contextRoutes: ['/pos/kitchen'],
  },
  {
    slug: 'gift-cards',
    category: 'pos',
    title: { ku: 'کارتی دیاری', en: 'Gift cards', ar: 'بطاقات الهدايا' },
    summary: {
      ku: 'فرۆشتن و خەرجکردنی کارتی دیاری.',
      en: 'Sell and redeem gift cards.',
      ar: 'بيع واستخدام بطاقات الهدايا.',
    },
    related: ['loyalty'],
    contextRoutes: ['/pos'],
  },
  {
    slug: 'loyalty',
    category: 'pos',
    title: {
      ku: 'پلانی دڵسۆزی',
      en: 'Loyalty program',
      ar: 'برنامج الولاء',
    },
    summary: {
      ku: 'دروستکردنی خاڵ و خەڵاتی کڕیار.',
      en: 'Award and redeem loyalty points.',
      ar: 'منح واستخدام نقاط الولاء.',
    },
    related: ['gift-cards'],
    contextRoutes: ['/pos'],
  },
  {
    slug: 'refund',
    category: 'pos',
    title: { ku: 'گەڕاندنەوەی پارە', en: 'Refunds', ar: 'استرداد الأموال' },
    summary: {
      ku: 'پرۆسەی گەڕاندنەوەی پارە لە POS.',
      en: 'Issue a refund through the POS.',
      ar: 'إجراء استرداد عبر نقطة البيع.',
    },
    related: ['void-sale', 'mark-paid'],
    contextRoutes: ['/pos'],
  },
  {
    slug: 'offline-mode',
    category: 'pos',
    title: { ku: 'دۆخی ئۆفلاین', en: 'POS offline mode', ar: 'وضع عدم الاتصال' },
    summary: {
      ku: 'فرۆشتن دەکرێت بێ ئینتەرنێت — هاوبەشی پاش گەڕانەوە.',
      en: 'Keep selling without internet; sync on reconnect.',
      ar: 'استمر في البيع دون إنترنت — تتم المزامنة عند الاتصال.',
    },
    related: ['end-of-day'],
    contextRoutes: ['/pos'],
    featured: true,
  },
  {
    slug: 'end-of-day',
    category: 'pos',
    title: { ku: 'کۆتایی ڕۆژ', en: 'End-of-day close', ar: 'إغلاق نهاية اليوم' },
    summary: {
      ku: 'پێشانی Z-report و گرتنەوەی سێشن.',
      en: 'Run the Z-report and close the till.',
      ar: 'تشغيل تقرير Z وإغلاق الصندوق.',
    },
    related: ['cash-management', 'offline-mode'],
    contextRoutes: ['/pos'],
  },

  // ── Invoicing (5) ─────────────────────────────────────────────────────
  {
    slug: 'create-invoice',
    category: 'invoicing',
    title: {
      ku: 'دروستکردنی فاکتور',
      en: 'Create an invoice',
      ar: 'إنشاء فاتورة',
    },
    summary: {
      ku: 'دروستکردنی فاکتوری نوێ بۆ کڕیار.',
      en: 'Issue a new invoice to a customer.',
      ar: 'إنشاء فاتورة جديدة للعميل.',
    },
    related: ['recurring', 'payment-link'],
    contextRoutes: ['/invoices'],
    featured: true,
  },
  {
    slug: 'recurring',
    category: 'invoicing',
    title: {
      ku: 'فاکتوری دووبارەبووەوە',
      en: 'Recurring invoices',
      ar: 'الفواتير المتكررة',
    },
    summary: {
      ku: 'پلانکردنی فاکتوری مانگانە.',
      en: 'Schedule monthly recurring invoices.',
      ar: 'جدولة الفواتير الشهرية.',
    },
    related: ['create-invoice'],
    contextRoutes: ['/invoices'],
  },
  {
    slug: 'payment-link',
    category: 'invoicing',
    title: {
      ku: 'بەستەری پارەدان',
      en: 'Share a payment link',
      ar: 'مشاركة رابط الدفع',
    },
    summary: {
      ku: 'بەستەری hosted ـی پارەدان بۆ کڕیار بنێرە.',
      en: 'Send a hosted pay-link to the customer.',
      ar: 'أرسل رابط دفع مستضاف للعميل.',
    },
    related: ['send-via-whatsapp', 'mark-paid'],
    contextRoutes: ['/invoices'],
  },
  {
    slug: 'send-via-whatsapp',
    category: 'invoicing',
    title: {
      ku: 'ناردنی فاکتور بە واتساپ',
      en: 'Send invoice via WhatsApp',
      ar: 'إرسال فاتورة عبر واتساب',
    },
    summary: {
      ku: 'ناردنی فاکتور و بەستەری پارەدان بە WhatsApp.',
      en: 'Push the invoice + pay-link via WhatsApp Business.',
      ar: 'إرسال الفاتورة + رابط الدفع عبر WhatsApp Business.',
    },
    related: ['payment-link'],
    contextRoutes: ['/invoices'],
  },
  {
    slug: 'mark-paid',
    category: 'invoicing',
    title: {
      ku: 'وەسڵی پارەدان',
      en: 'Mark an invoice as paid',
      ar: 'وضع علامة "مدفوع"',
    },
    summary: {
      ku: 'تۆمارکردنی پارەدانی نەختی یان بانک.',
      en: 'Record cash or bank payment against an invoice.',
      ar: 'تسجيل الدفع النقدي أو البنكي.',
    },
    related: ['create-invoice', 'p&l'],
    contextRoutes: ['/invoices'],
  },

  // ── Inventory (5) ─────────────────────────────────────────────────────
  {
    slug: 'add-item',
    category: 'inventory',
    title: { ku: 'زیادکردنی بەرهەم', en: 'Add an item', ar: 'إضافة منتج' },
    summary: {
      ku: 'دروستکردنی بەرهەم/خزمەتگوزاری نوێ.',
      en: 'Create a new sellable product or service.',
      ar: 'إنشاء منتج أو خدمة جديدة.',
    },
    related: ['categories', 'stock-count'],
    contextRoutes: ['/inventory'],
    featured: true,
  },
  {
    slug: 'stock-count',
    category: 'inventory',
    title: {
      ku: 'ژماردنی ئەنبار',
      en: 'Stock count',
      ar: 'جرد المخزون',
    },
    summary: {
      ku: 'بەراوردکردنی ژمارەی ڕاستەقینە لەگەڵ سیستەم.',
      en: 'Reconcile physical counts against system stock.',
      ar: 'مقارنة الجرد الفعلي بالمخزون.',
    },
    related: ['low-stock-alerts'],
    contextRoutes: ['/inventory'],
  },
  {
    slug: 'low-stock-alerts',
    category: 'inventory',
    title: {
      ku: 'ئاگاداری ئەنباری کەم',
      en: 'Low-stock alerts',
      ar: 'تنبيهات انخفاض المخزون',
    },
    summary: {
      ku: 'دانانی سنووری کەم بۆ ئاگاداری.',
      en: 'Set a reorder threshold for items.',
      ar: 'تعيين عتبة إعادة الطلب.',
    },
    related: ['stock-count', 'add-item'],
    contextRoutes: ['/inventory'],
  },
  {
    slug: 'batches',
    category: 'inventory',
    title: {
      ku: 'بەچ و کاتی بەسەرچوون',
      en: 'Batches and expiry',
      ar: 'الدفعات والصلاحية',
    },
    summary: {
      ku: 'بەڕێوەبردنی بەچ بۆ بەرهەمی خۆراکی و دەرمان.',
      en: 'Track batches and expiry dates for food/pharma.',
      ar: 'تتبع الدفعات وتواريخ الانتهاء.',
    },
    related: ['add-item', 'low-stock-alerts'],
    contextRoutes: ['/inventory'],
  },
  {
    slug: 'categories',
    category: 'inventory',
    title: {
      ku: 'پۆلێنکردن',
      en: 'Item categories',
      ar: 'فئات المنتج',
    },
    summary: {
      ku: 'دروستکردنی پۆلێن بۆ ڕێکخستنی بەرهەمەکان.',
      en: 'Organise items into categories.',
      ar: 'تنظيم المنتجات في فئات.',
    },
    related: ['add-item'],
    contextRoutes: ['/inventory'],
  },

  // ── Taxes (5) ─────────────────────────────────────────────────────────
  {
    slug: 'vat-setup',
    category: 'taxes',
    title: { ku: 'دامەزراندنی VAT', en: 'VAT setup', ar: 'إعداد ضريبة القيمة المضافة' },
    summary: {
      ku: 'دانانی ڕێژەی VAT بۆ پارێزگاکانی عێراق.',
      en: 'Set VAT rates for Iraqi governorates.',
      ar: 'تعيين معدلات ضريبة القيمة المضافة للمحافظات.',
    },
    related: ['withholding-tax', 'tax-rates-per-region'],
    contextRoutes: ['/settings/taxes', '/l10n-iq'],
  },
  {
    slug: 'withholding-tax',
    category: 'taxes',
    title: {
      ku: 'پاش بەرگرتنی باج',
      en: 'Withholding tax',
      ar: 'الضريبة المقتطعة',
    },
    summary: {
      ku: 'دانان و حیسابی پاش بەرگرتنی باج لە کارمەند و کرێچی.',
      en: 'Compute withholding tax on payroll and contractors.',
      ar: 'حساب الضرائب المقتطعة من الرواتب والمقاولين.',
    },
    related: ['vat-setup'],
  },
  {
    slug: 'tax-rates-per-region',
    category: 'taxes',
    title: {
      ku: 'ڕێژەی باج بۆ هەر ناوچەیەک',
      en: 'Tax rates per region',
      ar: 'معدلات الضرائب لكل منطقة',
    },
    summary: {
      ku: 'ڕێژەی جیاواز بۆ کوردستان و عێراقی فێدراڵ.',
      en: 'Different rates for Kurdistan vs federal Iraq.',
      ar: 'معدلات مختلفة لكردستان والعراق الاتحادي.',
    },
    related: ['vat-setup'],
  },
  {
    slug: 'exemptions',
    category: 'taxes',
    title: { ku: 'بێبەشییەکان', en: 'Exemptions', ar: 'الإعفاءات' },
    summary: {
      ku: 'بەرهەمی بێبەش لە باج چۆن دیاری دەکرێن.',
      en: 'Mark items as tax-exempt.',
      ar: 'تحديد المنتجات المعفاة من الضرائب.',
    },
    related: ['vat-setup'],
  },
  {
    slug: 'year-end',
    category: 'taxes',
    title: {
      ku: 'بەستنی کۆتایی ساڵ',
      en: 'Year-end tax closing',
      ar: 'إقفال الضريبة في نهاية السنة',
    },
    summary: {
      ku: 'گرنگترین هەنگاوەکان بۆ کۆتایی ساڵی باج.',
      en: 'Critical steps for closing the tax year.',
      ar: 'الخطوات الحرجة لإقفال السنة الضريبية.',
    },
    related: ['vat-setup', 'p&l'],
  },

  // ── Payroll (3) ───────────────────────────────────────────────────────
  {
    slug: 'add-employee',
    category: 'payroll',
    title: { ku: 'زیادکردنی کارمەند', en: 'Add an employee', ar: 'إضافة موظف' },
    summary: {
      ku: 'تۆمارکردنی کارمەند بۆ مووچە.',
      en: 'Onboard a new employee for payroll.',
      ar: 'إضافة موظف جديد للرواتب.',
    },
    related: ['run-payroll'],
    contextRoutes: ['/hr', '/payroll'],
  },
  {
    slug: 'run-payroll',
    category: 'payroll',
    title: {
      ku: 'جێبەجێکردنی مووچە',
      en: 'Run payroll',
      ar: 'تشغيل الرواتب',
    },
    summary: {
      ku: 'حیسابی مووچەی مانگانە.',
      en: 'Calculate the monthly payroll run.',
      ar: 'حساب الرواتب الشهرية.',
    },
    related: ['add-employee', 'payslips'],
    contextRoutes: ['/payroll'],
  },
  {
    slug: 'payslips',
    category: 'payroll',
    title: { ku: 'پێسلیپ', en: 'Payslips', ar: 'قسائم الدفع' },
    summary: {
      ku: 'دروستکردن و ناردنی پێسلیپ بۆ کارمەند.',
      en: 'Generate and email payslips.',
      ar: 'إنشاء وإرسال قسائم الدفع.',
    },
    related: ['run-payroll'],
    contextRoutes: ['/payroll'],
  },

  // ── Reports (3) ───────────────────────────────────────────────────────
  {
    slug: 'p&l',
    category: 'reports',
    title: {
      ku: 'ڕاپۆرتی قازانج و زیان',
      en: 'Profit & loss report',
      ar: 'تقرير الأرباح والخسائر',
    },
    summary: {
      ku: 'پێشانی P&L بۆ هەر کاتێک.',
      en: 'View P&L for any period.',
      ar: 'عرض الأرباح والخسائر لأي فترة.',
    },
    related: ['balance-sheet', 'sales-by-product'],
    contextRoutes: ['/reports'],
  },
  {
    slug: 'balance-sheet',
    category: 'reports',
    title: {
      ku: 'باڵانس شیت',
      en: 'Balance sheet',
      ar: 'الميزانية العمومية',
    },
    summary: {
      ku: 'باڵانسی هەژمارەکان لە کاتێکی دیاریکراودا.',
      en: 'Snapshot of account balances at a point in time.',
      ar: 'لقطة لأرصدة الحسابات في وقت معين.',
    },
    related: ['p&l'],
    contextRoutes: ['/reports'],
  },
  {
    slug: 'sales-by-product',
    category: 'reports',
    title: {
      ku: 'فرۆشتن بەپێی بەرهەم',
      en: 'Sales by product',
      ar: 'المبيعات حسب المنتج',
    },
    summary: {
      ku: 'بەرهەمی هەرە فرۆشراو لە ماوەیەکدا.',
      en: 'Top-selling items in a period.',
      ar: 'أكثر المنتجات مبيعًا في فترة.',
    },
    related: ['p&l'],
    contextRoutes: ['/reports'],
  },

  // ── Admin (4) ─────────────────────────────────────────────────────────
  {
    slug: 'user-roles',
    category: 'admin',
    title: {
      ku: 'ڕۆڵی بەکارهێنەر',
      en: 'User roles & permissions',
      ar: 'أدوار المستخدمين والصلاحيات',
    },
    summary: {
      ku: 'دانان و دیاریکردنی ڕۆڵ بۆ تیم.',
      en: 'Assign and customise roles for your team.',
      ar: 'تعيين وتخصيص الأدوار لفريقك.',
    },
    related: ['invite-team', 'audit-log'],
    contextRoutes: ['/admin'],
  },
  {
    slug: 'audit-log',
    category: 'admin',
    title: { ku: 'لۆگی چاودێری', en: 'Audit log', ar: 'سجل التدقيق' },
    summary: {
      ku: 'لیستی هەموو کارەکانی بەکارهێنەران.',
      en: 'A trail of every meaningful user action.',
      ar: 'سجل بكل إجراءات المستخدمين.',
    },
    related: ['user-roles', 'backup-restore'],
    contextRoutes: ['/admin'],
  },
  {
    slug: 'backup-restore',
    category: 'admin',
    title: {
      ku: 'پاشەکەوتکردن و گەڕاندنەوە',
      en: 'Backup and restore',
      ar: 'النسخ الاحتياطي والاستعادة',
    },
    summary: {
      ku: 'ئەكسپۆرت و گەڕاندنەوەی هەموو داتای کۆمپانیا.',
      en: 'Export and restore all company data.',
      ar: 'تصدير واستعادة كل بيانات الشركة.',
    },
    related: ['audit-log'],
    contextRoutes: ['/admin'],
  },
  {
    slug: 'change-plan',
    category: 'admin',
    title: {
      ku: 'گۆڕینی پلان',
      en: 'Change billing plan',
      ar: 'تغيير خطة الفوترة',
    },
    summary: {
      ku: 'بەرزکردنەوە یان نزمکردنەوەی پلانی Zoho Kurdish.',
      en: 'Upgrade or downgrade your Zoho Kurdish plan.',
      ar: 'ترقية أو تخفيض خطة Zoho Kurdish.',
    },
    related: ['backup-restore'],
    contextRoutes: ['/admin', '/admin/billing'],
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

export function listByCategory(): Record<HelpCategory, HelpArticleMeta[]> {
  return HELP_ARTICLES.reduce(
    (acc, art) => {
      (acc[art.category] ||= []).push(art);
      return acc;
    },
    {} as Record<HelpCategory, HelpArticleMeta[]>,
  );
}

export function findBySlug(slug: string): HelpArticleMeta | undefined {
  return HELP_ARTICLES.find((a) => a.slug === slug);
}

export function search(query: string, locale: HelpLocale): HelpArticleMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return HELP_ARTICLES.filter((a) => a.featured);
  return HELP_ARTICLES.filter((a) => {
    return (
      a.slug.includes(q) ||
      a.title[locale].toLowerCase().includes(q) ||
      a.summary[locale].toLowerCase().includes(q)
    );
  });
}

export function contextual(route: string): HelpArticleMeta[] {
  return HELP_ARTICLES.filter((a) =>
    a.contextRoutes?.some((r) => route.startsWith(r)),
  );
}

export const HELP_CATEGORIES: HelpCategory[] = [
  'getting-started',
  'pos',
  'invoicing',
  'inventory',
  'taxes',
  'payroll',
  'reports',
  'admin',
];

export const CATEGORY_LABELS: Record<HelpCategory, Record<HelpLocale, string>> = {
  'getting-started': { ku: 'دەستپێکردن', en: 'Getting started', ar: 'البدء' },
  pos: { ku: 'فرۆشگا', en: 'POS', ar: 'نقاط البيع' },
  invoicing: { ku: 'فاکتور', en: 'Invoicing', ar: 'الفوترة' },
  inventory: { ku: 'ئەنبار', en: 'Inventory', ar: 'المخزون' },
  taxes: { ku: 'باج', en: 'Taxes', ar: 'الضرائب' },
  payroll: { ku: 'مووچە', en: 'Payroll', ar: 'الرواتب' },
  reports: { ku: 'ڕاپۆرت', en: 'Reports', ar: 'التقارير' },
  admin: { ku: 'بەڕێوەبردن', en: 'Admin', ar: 'الإدارة' },
};
