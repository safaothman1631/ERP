import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGlassMotion } from '../../hooks/useGlassMotion';
import { useRoleUx } from '../../hooks/useRoleUx';
import type { RoleThemeId } from '../../personas/types';
import OwnerExecutiveHome from './homes/OwnerExecutiveHome';
import AdminOpsHome from './homes/AdminOpsHome';
import ManagerHome from './homes/ManagerHome';
import SalesHome from './homes/SalesHome';
import FinanceHome from './homes/FinanceHome';
import PurchaseHome from './homes/PurchaseHome';
import InventoryHome from './homes/InventoryHome';
import PosStaffHome from './homes/PosStaffHome';
import HrHome from './homes/HrHome';
import ProjectsHome from './homes/ProjectsHome';
import PersonalEmployeeHome from './homes/PersonalEmployeeHome';
import ViewerHome from './homes/ViewerHome';

const HOME_BY_THEME: Record<RoleThemeId, React.ComponentType> = {
  executive: OwnerExecutiveHome,
  administrator: AdminOpsHome,
  manager: ManagerHome,
  finance: FinanceHome,
  sales: SalesHome,
  purchase: PurchaseHome,
  inventory: InventoryHome,
  pos: PosStaffHome,
  hr: HrHome,
  projects: ProjectsHome,
  personal: PersonalEmployeeHome,
  readonly: ViewerHome,
};

const DashboardRouter: React.FC = () => {
  const { page } = useGlassMotion();
  const { theme } = useRoleUx();
  const Home = useMemo(() => HOME_BY_THEME[theme.id] ?? OwnerExecutiveHome, [theme.id]);

  return (
    <AnimatePresence mode="wait">
      <motion.div key={theme.id} variants={page} initial="initial" animate="animate" exit="exit">
        <Home />
      </motion.div>
    </AnimatePresence>
  );
};

export default DashboardRouter;
