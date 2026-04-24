import type { SectionDoc } from '../types';

export const manufacturingDoc: SectionDoc = {
  key: 'manufacturing',
  title: 'بەرهەمهێنان (Manufacturing)',
  purpose: 'پلانکردن و جێبەجێکردنی فەرمانی بەرهەمهێنان لەگەڵ Bill of Materials و Work Centers. کاڵاکانی تەواوبوو خۆکار دەچنە ئەنبار.',
  whoUses: ['Production Manager', 'Operations', 'Warehouse'],
  subAreas: [
    {
      name: 'فەرمانی بەرهەمهێنان (MFG Orders)',
      purpose: 'دروستکردن و بەڕێوەبردنی فەرمانی بەرهەمهێنان.',
      dataFlow: 'MFG Order → Consume Materials (inventory -) → Produce FG (inventory +)',
      route: '/manufacturing/orders',
    },
    {
      name: 'لیستی پێکهاتن (BOMs)',
      purpose: 'دیاریکردنی Recipe ـی بەرهەم — چ ئامراز و کاڵایەکی پێویستە.',
      route: '/manufacturing/boms',
    },
    {
      name: 'شوێنی کار (Work Centers)',
      purpose: 'مەکینە یان ئیستگایەکان کە کار لەسەر جێبەجێ دەکرێت.',
      route: '/manufacturing/work-centers',
    },
  ],
  dataDestination: 'Firestore: mfg_orders, boms, work_centers, inventory_movements',
  related: ['inventory', 'sales', 'purchases'],
  kpis: ['WIP value', 'Production efficiency', 'Scrap rate', 'On-time completion'],
  tips: [
    'BOM ی دووجهی (multi-level) پشتیوانی دەکرێت — sub-component ـی nested.',
    'MFG Order دروستکردن stock ی component ئاوتۆماتیکی check دەکات.',
  ],
};
