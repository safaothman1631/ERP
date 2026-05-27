import React from 'react';
import type { RoleThemeId } from '../../../personas/types';
import Dashboard from '../../Dashboard';
import RoleHomeHero from '../../../components/role/RoleHomeHero';
import { getDashboardLayout } from '../dashboardLayouts';

export function createRoleHome(themeId: RoleThemeId) {
  const layout = getDashboardLayout(themeId);
  const RoleHome: React.FC = () => (
    <>
      <RoleHomeHero />
      <Dashboard
        embedded
        hideHero
        layoutId={themeId}
        hideExecutiveInvoiceCta={!layout.showQuickActions}
      />
    </>
  );
  RoleHome.displayName = `RoleHome(${themeId})`;
  return RoleHome;
}
