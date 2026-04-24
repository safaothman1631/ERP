import type { SectionDoc } from '../types';

export const setupDoc: SectionDoc = {
  key: 'setup',
  title: 'ڕێکخستنەکان (Settings)',
  purpose: 'گوندی پێکهێنانی سیستەم: کۆمپانی، بەش، بەکارهێنەران، RBAC، custom fields، تەکس، فیسکال، و ئینتیگریشن. ئەمانە داتای بنەڕەت ـی سیستەمەکەن.',
  whoUses: ['Admin', 'Super Admin', 'IT'],
  subAreas: [
    {
      name: 'کۆمپانی و بەش',
      purpose: 'زانیاری سازمان، لۆگۆ، دراو، و structure ی شاخەکان.',
      route: '/settings?tab=company',
    },
    {
      name: 'بەکارهێنەران و RBAC',
      purpose: 'مەنەجکردنی بەکارهێنەر، رۆڵ، و destrees ی gatekeeper ی هەر module.',
      dataFlow: 'Role → Permissions → User → Token claims → API guard',
      route: '/settings?tab=users',
    },
    {
      name: 'Custom Fields',
      purpose: 'زیادکردنی فیلدی تایبەت بۆ کاڵا، invoice، موشتەری، و هتد.',
      route: '/custom-fields',
    },
    {
      name: 'تەکس و فیسکال',
      purpose: 'دیاریکردنی rate ی تەکس، fiscal year، و budgets.',
      route: '/settings?tab=tax',
    },
    {
      name: 'Approvals',
      purpose: 'دیاریکردنی workflow ی قبولکردن بۆ هەر جۆر transaction.',
      route: '/approvals',
    },
    {
      name: 'Audit Log',
      purpose: 'تۆماری کامل ی هەموو گۆڕانکاری و چالاکی لە سیستەم.',
      route: '/audit-log',
    },
  ],
  dataDestination: 'Firestore: organizations, branches, users, roles, permissions, custom_fields, tax_settings, fiscal_years, approval_workflows, audit_logs',
  related: ['accounting', 'hr', 'iraq-int'],
  kpis: ['Active users', 'Pending approvals', 'Audit log entries today'],
  tips: [
    'RBAC پێش دروستکردنی بەکارهێنەری نوێ بەستە.',
    'Custom fields بۆ هەموو module ـی سیستەم support دەکرێن.',
    'Audit log نەسرووستراوەتەوە — تەنها read-only.',
  ],
};
