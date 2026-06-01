import React, { useState } from 'react';
import { Avatar, Dropdown, Tooltip } from 'antd';
import { DownOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store';
import { usePermission } from '../../hooks/usePermission';
import { useRoleUx } from '../../hooks/useRoleUx';
import { palette, radius, space, transitions } from '../../theme/tokens';
import RoleCapabilityPanel from './RoleCapabilityPanel';
import { readSessionClaims } from '../../platform/utils/sessionClaims';

interface Props {
  isDark: boolean;
  onLogout: () => void;
}

const RoleIdentityChip: React.FC<Props> = ({ isDark, onLogout }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userName } = useAuthStore();
  const { role, isImpersonating } = usePermission();
  const { theme, persona, roleLabel } = useRoleUx();
  const [capOpen, setCapOpen] = useState(false);
  const platformClaims = readSessionClaims();

  const searchBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const searchBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';
  const userInk = isDark ? palette.darkInk : palette.ink900;
  const accentBorder = theme.isOwnerAccent ? theme.accent : 'var(--role-accent, #7B61FF)';

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: t('profile'), onClick: () => navigate('/settings?s=profile') },
      { key: 'settings', icon: <SettingOutlined />, label: t('settings'), onClick: () => navigate('/settings') },
      { type: 'divider' as const },
      { key: 'logout', icon: <LogoutOutlined />, label: t('logout'), danger: true, onClick: onLogout },
    ],
  };

  const chip = (
    <button
      type="button"
      className="role-identity-chip"
      aria-label={t('role.chip_aria', '{{role}} — {{name}}', { role: roleLabel, name: userName ?? '' })}
      onClick={() => setCapOpen((v) => !v)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: space.sm,
        background: searchBg,
        border: `1px solid ${isImpersonating ? palette.warning500 : searchBorder}`,
        boxShadow: theme.isOwnerAccent ? theme.glassBorderGlow : undefined,
        cursor: 'pointer',
        padding: '4px 10px 4px 4px',
        borderRadius: radius.pill,
        transition: transitions.base,
      }}
    >
      <Avatar
        size={30}
        style={{
          background: `linear-gradient(135deg, ${accentBorder} 0%, ${theme.accent}99 100%)`,
          fontWeight: 700,
          fontSize: 13,
        }}
      >
        {(userName || 'U').slice(0, 1).toUpperCase()}
      </Avatar>
      <span style={{ textAlign: 'start', minWidth: 0 }}>
        <span
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: accentBorder,
            lineHeight: 1.2,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          {isImpersonating ? t('role.impersonating', 'Viewing as org') : roleLabel}
        </span>
        <span
          style={{
            display: 'block',
            fontSize: 13,
            fontWeight: 500,
            color: userInk,
            maxWidth: 100,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {userName ?? 'User'}
        </span>
      </span>
      <DownOutlined style={{ fontSize: 9, opacity: 0.6 }} />
    </button>
  );

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: space.xs }}>
      <Dropdown
        open={capOpen}
        onOpenChange={setCapOpen}
        dropdownRender={() => (
          <RoleCapabilityPanel persona={persona} roleLabel={roleLabel} />
        )}
        trigger={['click']}
        placement="bottomRight"
      >
        <Tooltip title={t('role.chip_hint', 'Your role and capabilities')}>{chip}</Tooltip>
      </Dropdown>
      {role !== 'super_admin' || platformClaims.isImpersonating ? (
        <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
          <button
            type="button"
            aria-label={t('user_menu', 'User menu')}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: userInk,
              opacity: 0.7,
            }}
          >
            •••
          </button>
        </Dropdown>
      ) : null}
    </span>
  );
};

export default RoleIdentityChip;
