import React from 'react';
import { Button, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import GlassCard from '../glass/GlassCard';
import { useRoleUx } from '../../hooks/useRoleUx';
import { useAuthStore } from '../../store';
import { useGlassMotion } from '../../hooks/useGlassMotion';
import { fontSize, space } from '../../theme/tokens';
import type { RoleThemeId } from '../../personas/types';

const HERO_COPY: Record<RoleThemeId, { titleKey: string; titleFb: string; subKey: string; subFb: string }> = {
  executive: {
    titleKey: 'role.home.executive_title',
    titleFb: 'Organization overview',
    subKey: 'role.home.executive_sub',
    subFb: 'Monitor health, modules, and team access.',
  },
  administrator: {
    titleKey: 'role.home.admin_title',
    titleFb: 'Administration hub',
    subKey: 'role.home.admin_sub',
    subFb: 'Users, modules, and system configuration.',
  },
  manager: {
    titleKey: 'role.home.manager_title',
    titleFb: 'Operations dashboard',
    subKey: 'role.home.manager_sub',
    subFb: 'Approvals, KPIs, and team performance.',
  },
  finance: {
    titleKey: 'role.home.finance_title',
    titleFb: 'Finance command center',
    subKey: 'role.home.finance_sub',
    subFb: 'Cash flow, receivables, and compliance.',
  },
  sales: {
    titleKey: 'role.home.sales_title',
    titleFb: 'Sales pipeline',
    subKey: 'role.home.sales_sub',
    subFb: 'Quotes, CRM, and revenue at a glance.',
  },
  purchase: {
    titleKey: 'role.home.purchase_title',
    titleFb: 'Purchasing workspace',
    subKey: 'role.home.purchase_sub',
    subFb: 'Vendors, POs, and payables.',
  },
  inventory: {
    titleKey: 'role.home.inventory_title',
    titleFb: 'Inventory control',
    subKey: 'role.home.inventory_sub',
    subFb: 'Stock levels, warehouses, and moves.',
  },
  pos: {
    titleKey: 'role.home.pos_title',
    titleFb: 'Point of sale',
    subKey: 'role.home.pos_sub',
    subFb: 'Open terminal and manage today\'s shifts.',
  },
  hr: {
    titleKey: 'role.home.hr_title',
    titleFb: 'People & HR',
    subKey: 'role.home.hr_sub',
    subFb: 'Employees, leave, and payroll status.',
  },
  projects: {
    titleKey: 'role.home.projects_title',
    titleFb: 'Projects hub',
    subKey: 'role.home.projects_sub',
    subFb: 'Tasks, timesheets, and delivery.',
  },
  personal: {
    titleKey: 'role.home.personal_title',
    titleFb: 'Your workspace',
    subKey: 'role.home.personal_sub',
    subFb: 'Personal tasks and profile shortcuts.',
  },
  readonly: {
    titleKey: 'role.home.viewer_title',
    titleFb: 'Read-only overview',
    subKey: 'role.home.viewer_sub',
    subFb: 'View reports — changes require an administrator.',
  },
};

const RoleHomeHero: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, roleLabel, persona } = useRoleUx();
  const userName = useAuthStore((s) => s.userName);
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const { page } = useGlassMotion();
  const copy = HERO_COPY[theme.id];

  return (
    <motion.div variants={page} initial="initial" animate="animate" style={{ marginBottom: space.lg }}>
      <GlassCard
        accent
        style={{
          padding: space.xl,
          background: isDark ? theme.heroGradientDark : theme.heroGradientLight,
        }}
      >
        <Typography.Text
          style={{
            fontSize: fontSize.xs,
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: theme.accent,
          }}
        >
          {roleLabel}
        </Typography.Text>
        <Typography.Title level={3} style={{ marginTop: space.xs, marginBottom: space.xs }}>
          {t('role.home.welcome', 'Welcome back, {{name}}', { name: userName ?? t('user', 'User') })}
        </Typography.Title>
        <Typography.Title level={5} style={{ marginTop: 0, fontWeight: 600 }}>
          {t(copy.titleKey, copy.titleFb)}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginBottom: theme.quickActions.length ? space.md : 0 }}>
          {t(copy.subKey, copy.subFb)}
        </Typography.Paragraph>
        {theme.quickActions.length > 0 && (
          <Space wrap>
            {theme.quickActions.map((action) => (
              <Button
                key={action.id}
                type={action.id === theme.quickActions[0]?.id ? 'primary' : 'default'}
                onClick={() => navigate(action.route)}
                style={
                  action.id === theme.quickActions[0]?.id
                    ? { background: theme.accent, borderColor: theme.accent }
                    : undefined
                }
              >
                {t(action.labelKey, action.fallbackLabel)}
              </Button>
            ))}
          </Space>
        )}
        {theme.id === 'readonly' && (
          <Typography.Text type="secondary" style={{ display: 'block', marginTop: space.sm, fontSize: fontSize.sm }}>
            {t(persona.cannotKeys[0], 'Cannot create or edit records')}
          </Typography.Text>
        )}
      </GlassCard>
    </motion.div>
  );
};

export default RoleHomeHero;
