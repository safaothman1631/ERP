import type { SectionGroup } from '../registry/types';

export const SETTINGS_NAV_GROUPS: readonly SectionGroup[] = [
  'account',
  'general_app',
  'organization',
  'users',
  'localization',
  'finance',
  'commerce',
  'operations',
  'automation',
  'content',
  'system',
];

export type SettingsNavGroupLabels = Record<SectionGroup, string>;
