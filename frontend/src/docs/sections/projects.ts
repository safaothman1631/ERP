import type { SectionDoc } from '../types';

export const projectsDoc: SectionDoc = {
  key: 'projects',
  title: 'پرۆژەکان',
  purpose: 'بەڕێوەبردنی پرۆژەکانی کلایەنت یان ناوخۆیی: task ـەکان، milestone ـەکان، و شوێنپێکردنی پێشکەوتن. دەتوانرێت invoice ی project-based دروست بکرێت.',
  whoUses: ['Project Manager', 'Team Lead', 'Accountant'],
  subAreas: [
    {
      name: 'لیستی پرۆژەکان',
      purpose: 'نمایشی کارت-based یان tablular ی هەموو پرۆژەکان.',
      dataFlow: 'Project → Tasks → Time Logs → [billable] → Invoice',
      route: '/projects',
    },
  ],
  dataDestination: 'Firestore: projects, project_tasks, project_time_logs',
  related: ['sales', 'hr', 'accounting'],
  kpis: ['Projects active', 'Tasks overdue', 'Hours logged', 'Billable amount'],
  tips: ['Task ی billable کردن invoice ی project ـەکە دروست دەکات.'],
};
