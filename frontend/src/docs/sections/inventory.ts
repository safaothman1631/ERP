import type { SectionDoc } from '../types';

export const inventoryDoc: SectionDoc = {
  key: 'inventory',
  title: 'ئەنبار و کاڵا',
  purpose: 'بەڕێوەبردنی تەواوی stock: warehouse، batch/lot tracking، قیمەتکردنی کاڵا، و حرکت ـی inventory. بەستراوە بۆ Sales، Purchases، و Manufacturing.',
  whoUses: ['Warehouse Manager', 'Procurement', 'Operations'],
  subAreas: [
    {
      name: 'کاڵاکان (Items)',
      purpose: 'کاتالۆگی تەواوی بەرهەم، خزمەتگوزاری، و combo ـەکان.',
      dataFlow: 'Item → Referenced in Sales/Purchases/POS/Manufacturing',
      route: '/items',
    },
    {
      name: 'ئەنبارەکان (Warehouses)',
      purpose: 'دیاریکردن و بەڕێوەبردنی شوێنی فیزیکی ئەنبار.',
      route: '/warehouses',
    },
    {
      name: 'گواستنەوەکان (Inventory Movements)',
      purpose: 'تۆماری هەموو وردکردنەوە، بارکردن، و گواستنەوەی stock.',
      route: '/inventory',
    },
    {
      name: 'لیستی نرخ (Price Lists)',
      purpose: 'تایبەتی نرخ بۆ گروپی موشتەری یان سێزن.',
      route: '/price-lists',
    },
    {
      name: 'بارگیری OCR',
      purpose: 'سکانکردنی وەصڵ و فاکتور بە OCR بۆ وردکردنی خێرا.',
      route: '/ocr-receipts',
    },
  ],
  dataDestination: 'Firestore: items, warehouses, inventory_movements, lots, price_lists',
  related: ['sales', 'purchases', 'manufacturing', 'pos'],
  kpis: ['Stock on hand', 'Stock value', 'Low-stock alerts', 'Inventory turnover'],
  tips: [
    'Lot/batch tracking فعال دەبێت لە item settings.',
    'Price list ی تایبەت دەتوانێت بۆ هەر موشتەری/گروپ assign بکرێت.',
  ],
};
