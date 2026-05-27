import { useEffect } from 'react';
import type { TFunction } from 'i18next';
import type { ModuleKey } from '../../onboarding/industries';
import { message } from '../../utils/message';
import { getBinding, getVisibleBindings } from '../registry/moduleSettingsRegistry';
import { isPlatformOnlySectionKey } from '../registry/platformOnlySections';
import type { SectionKey, SettingsRole } from '../registry/types';

interface Options {
  isAuthenticated: boolean;
  requested: SectionKey;
  enabledModules: ModuleKey[] | null;
  role: SettingsRole;
  permissions: Iterable<string> | null | undefined;
  setActive: (key: SectionKey) => void;
  setParams: (next: { s: SectionKey }, opts: { replace: boolean }) => void;
  t: TFunction;
}

/** Redirects invalid ?s= deep links to the first allowed section. */
export function useSettingsRouteGuard({
  isAuthenticated,
  requested,
  enabledModules,
  role,
  permissions,
  setActive,
  setParams,
  t,
}: Options): void {
  useEffect(() => {
    if (!isAuthenticated) return;
    if (isPlatformOnlySectionKey(requested)) {
      message.warning(t('settings.gate.platform_only', 'This setting is managed in the platform console.'));
      setParams({ s: 'profile' }, { replace: true });
      setActive('profile');
      return;
    }
    const visible = getVisibleBindings(enabledModules, role, permissions, true);
    const allowed = visible.some((s) => s.key === requested);
    if (!allowed && visible.length > 0) {
      const binding = getBinding(requested);
      if (binding?.moduleGate?.length) {
        message.info(t('settings.gate.module_disabled', 'This section requires a module that is not enabled.'));
        if (visible.some((s) => s.key === 'modules')) {
          setParams({ s: 'modules' }, { replace: true });
          setActive('modules');
          return;
        }
      }
      const fallback = visible[0].key;
      setParams({ s: fallback }, { replace: true });
      setActive(fallback);
    }
  }, [enabledModules, isAuthenticated, permissions, requested, role, setActive, setParams, t]);
}
