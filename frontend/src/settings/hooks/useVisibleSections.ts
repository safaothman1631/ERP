import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { ModuleKey } from '../../onboarding/industries';
import { getVisibleBindings } from '../registry/moduleSettingsRegistry';
import type { SectionBinding, SectionKey, SettingsRole } from '../registry/types';

type TranslateFn = (key: string, fallback?: string) => unknown;

export type SectionIconMap = Partial<Record<SectionKey, ReactNode>>;

export interface VisibleSection extends SectionBinding {
  label: string;
  icon?: ReactNode;
}

export function useVisibleSections(
  t: TranslateFn,
  iconMap: SectionIconMap,
  enabledModules: ModuleKey[] | null | undefined,
  role: SettingsRole,
  permissions: Iterable<string> | null | undefined,
  tenant = true,
): VisibleSection[] {
  return useMemo(() => {
    const bindings = getVisibleBindings(enabledModules, role, permissions, tenant);
    return bindings.map((binding) => {
      const translated = t(binding.labelKey, binding.fallbackLabel);
      const label = typeof translated === 'string' ? translated : binding.fallbackLabel;
      return {
        ...binding,
        label,
        icon: iconMap[binding.key],
      };
    });
  }, [enabledModules, iconMap, permissions, role, t, tenant]);
}
