import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useRoleUx } from '../../hooks/useRoleUx';
import { useAuthStore } from '../../store';
import { useIsDark } from '../../hooks/useIsDark';
import { useGlassMotion } from '../../hooks/useGlassMotion';
import { space } from '../../theme/tokens';
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
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme, roleLabel, persona } = useRoleUx();
  const userName = useAuthStore((s) => s.userName);
  const isDark = useIsDark();
  const { page } = useGlassMotion();
  const copy = HERO_COPY[theme.id];

  // Kit dashboard hero: a saturated two-stop accent wash (accent-700 → accent-500
  // in the kit). Derive both stops from the live role accent so the banner reads
  // as distinctly "theirs", and deepen the dark stop a touch more in dark mode.
  const accent = theme.accent;
  const deepStop = `color-mix(in srgb, ${accent} ${isDark ? 62 : 70}%, #000)`;
  const heroGradient = `linear-gradient(135deg, ${deepStop} 0%, ${accent} 100%)`;

  // White ink reads correctly on the saturated accent in BOTH themes — this is
  // why the kit hero uses fixed white tones rather than theme tokens here.
  const onAccent = '#FFFFFF';
  const onAccentSoft = 'rgba(255,255,255,0.88)';
  const onAccentMuted = 'rgba(255,255,255,0.72)';

  const today = new Date().toLocaleDateString(i18n.language === 'ku' ? 'ar-IQ' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const primaryActionId = theme.quickActions[0]?.id;

  return (
    <motion.div variants={page} initial="initial" animate="animate" style={{ marginBottom: space.lg }}>
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 'var(--radius-xl)',
          padding: space.xl,
          color: onAccent,
          background: heroGradient,
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {/* Soft luminous orb — kit signature, RTL-safe via logical inset */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: -60,
            insetInlineEnd: -30,
            width: 220,
            height: 220,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%)',
            filter: 'blur(30px)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative' }}>
          {/* Role chip + date row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: space.sm,
              fontSize: 'var(--fs-xs)',
              color: onAccentSoft,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '2px 10px',
                borderRadius: 'var(--radius-pill)',
                background: 'rgba(255,255,255,0.18)',
                color: onAccent,
                fontWeight: 600,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
              }}
            >
              {roleLabel}
            </span>
            <span>{today}</span>
          </div>

          {/* Greeting — kit display heading */}
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-4xl)',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: onAccent,
              margin: `${space.sm}px 0 0`,
            }}
          >
            {t('role.home.welcome', 'Welcome back, {{name}}', { name: userName ?? t('user', 'User') })}
          </h2>

          {/* Role context line */}
          <div
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-lg)',
              fontWeight: 600,
              color: onAccent,
              marginTop: space.xs,
            }}
          >
            {t(copy.titleKey, copy.titleFb)}
          </div>

          <p
            style={{
              fontSize: 'var(--fs-base)',
              color: onAccentSoft,
              margin: `${space.xs}px 0 0`,
              maxWidth: 560,
            }}
          >
            {t(copy.subKey, copy.subFb)}
          </p>

          {theme.quickActions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg }}>
              {theme.quickActions.map((action) => {
                const isPrimary = action.id === primaryActionId;
                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => navigate(action.route)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 'var(--radius-pill)',
                      border: '1px solid rgba(255,255,255,0.28)',
                      background: isPrimary ? '#FFFFFF' : 'rgba(255,255,255,0.14)',
                      color: isPrimary ? accent : onAccent,
                      fontWeight: 600,
                      fontSize: 'var(--fs-sm)',
                      cursor: 'pointer',
                      transition: 'background var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)',
                    }}
                  >
                    {t(action.labelKey, action.fallbackLabel)}
                  </button>
                );
              })}
            </div>
          )}

          {theme.id === 'readonly' && (
            <div
              style={{
                marginTop: space.sm,
                fontSize: 'var(--fs-sm)',
                color: onAccentMuted,
              }}
            >
              {t(persona.cannotKeys[0], 'Cannot create or edit records')}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default RoleHomeHero;
