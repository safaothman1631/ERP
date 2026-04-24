/**
 * Central registry for all section documentation.
 * Runtime registry only. Import types from ./types directly.
 */
import type { SectionDocMap } from './types';
import { overviewDoc } from './sections/overview';
import { salesDoc } from './sections/sales';
import { purchasesDoc } from './sections/purchases';
import { bankingDoc } from './sections/banking';
import { accountingDoc } from './sections/accounting';
import { inventoryDoc } from './sections/inventory';
import { manufacturingDoc } from './sections/manufacturing';
import { posDoc } from './sections/pos';
import { crmDoc } from './sections/crm';
import { hrDoc } from './sections/hr';
import { projectsDoc } from './sections/projects';
import { reportsMgtDoc } from './sections/reports-mgt';
import { iraqIntDoc } from './sections/iraq-int';
import { setupDoc } from './sections/setup';

export const SECTION_DOCS: SectionDocMap = {
  overview: overviewDoc,
  sales: salesDoc,
  purchases: purchasesDoc,
  banking: bankingDoc,
  accounting: accountingDoc,
  inventory: inventoryDoc,
  manufacturing: manufacturingDoc,
  pos: posDoc,
  crm: crmDoc,
  hr: hrDoc,
  projects: projectsDoc,
  'reports-mgt': reportsMgtDoc,
  'iraq-int': iraqIntDoc,
  setup: setupDoc,
};
