import React, { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { message } from 'antd';
import { useTranslation } from 'react-i18next';
import { isModuleEnabled, useOnboardingStore } from '../onboarding/store';
import { getModuleKeyForPath } from '../layouts/moduleMap';

interface ModuleGuardProps {
  children: React.ReactNode;
}

/**
 * Route-level gate. If the current path maps to a module the org has disabled,
 * redirect to dashboard with a toast. Unknown paths (system/setup) pass through.
 * Pre-onboarding users (enabledModules == null) also pass through.
 */
export const ModuleGuard: React.FC<ModuleGuardProps> = ({ children }) => {
  const location = useLocation();
  const { t } = useTranslation();
  const enabledModules = useOnboardingStore(s => s.enabledModules);
  const loaded = useOnboardingStore(s => s.loaded);
  const toasted = useRef(false);

  const moduleKey = getModuleKeyForPath(location.pathname);
  const allowed = !loaded || !enabledModules || isModuleEnabled(moduleKey ?? undefined, enabledModules);

  useEffect(() => {
    if (!allowed && !toasted.current) {
      toasted.current = true;
      message.warning(t('onb_module_disabled'));
    }
  }, [allowed, t]);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
};
