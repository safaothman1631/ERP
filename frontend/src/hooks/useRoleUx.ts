import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermission } from './usePermission';
import { resolveRoleUx } from '../personas/resolveRoleUx';

export function useRoleUx() {
  const { t } = useTranslation();
  const { role, permissions } = usePermission();

  return useMemo(
    () => resolveRoleUx(role, permissions, (key, fb) => String(t(key, fb))),
    [permissions, role, t],
  );
}
