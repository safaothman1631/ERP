import type { SectionDoc } from '../types';

export const crmDoc: SectionDoc = {
  key: 'crm',
  title: 'بەڕێوەبردنی پەیوەندی موشتەری (CRM)',
  purpose: 'ئیدارەکردنی لید، pipeline ی فرۆشتن، و چالاکییەکان بۆ شوێنپێکردنی هەموو پەیوەندی بازرگانی. ئاخر Lead دەکەوێتە Quote یان Sales Order.',
  whoUses: ['Sales Rep', 'Sales Manager', 'CRM Admin'],
  subAreas: [
    {
      name: 'لیدەکان (Leads)',
      purpose: 'Kanban-style pipeline ی شوێنپێکردنی مشتری بالقوه.',
      dataFlow: 'Lead → [Win] → Contact + Quote/Sale',
      route: '/crm/leads',
    },
    {
      name: 'چالاکییەکان (Activities)',
      purpose: 'تۆماری call، meeting، email، و task بۆ هەر lead و موشتەرییەک.',
      route: '/crm/activities',
    },
    {
      name: 'پوختەکان (Insights)',
      purpose: 'ئانالیزی pipeline، win rate، و فعالیت ـی تیم.',
      route: '/crm/insights',
    },
  ],
  dataDestination: 'Firestore: crm_leads, crm_stages, crm_activities',
  related: ['sales', 'contacts'],
  kpis: ['Pipeline value', 'Win rate', 'Average deal size', 'Activities due today'],
  tips: [
    'Lead stage ـەکان لە Settings/CRM دەتوانرێن دەستکاری بکرێن.',
    'Lead بۆ موشتەری بگوازرێتەوە تاکو بتوانێت Sales Order دروست بکرێت.',
  ],
};
