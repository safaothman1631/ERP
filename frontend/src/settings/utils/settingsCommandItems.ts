import type { TFunction } from 'i18next';
import type { ModuleKey } from '../../onboarding/industries';
import type { CommandItem } from '../../layouts/CommandPalette';
import { getVisibleBindings } from '../registry/moduleSettingsRegistry';
import type { SettingsRole } from '../registry/types';

/** Build command-palette entries for visible tenant settings sections. */
export function buildSettingsCommandItems(
  t: TFunction,
  navigate: (path: string) => void,
  enabledModules: ModuleKey[] | null,
  role: SettingsRole,
  permissions: Iterable<string> | null | undefined,
): CommandItem[] {
  const visible = getVisibleBindings(enabledModules, role, permissions, true);
  return visible
    .filter((binding) => binding.key !== 'modules' && binding.key !== 'system')
    .map((binding) => ({
      id: `settings:${binding.key}`,
      label: t(binding.labelKey, binding.fallbackLabel),
      labelEn: binding.fallbackLabel,
      category: 'page' as const,
      action: () => navigate(binding.route ?? `/settings?s=${binding.key}`),
    }));
}
