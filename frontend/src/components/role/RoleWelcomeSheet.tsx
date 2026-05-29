import React, { useEffect, useState } from 'react';
import { Button, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import GlassDrawer from '../glass/GlassDrawer';
import GlassCard from '../glass/GlassCard';
import { useRoleUx } from '../../hooks/useRoleUx';
import { usePermission } from '../../hooks/usePermission';
import { space, fontSize } from '../../theme/tokens';

const welcomeKey = (role: string | null) => `role_welcome_seen_${role ?? 'user'}`;

const RoleWelcomeSheet: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { role } = usePermission();
  const { theme, persona, roleLabel } = useRoleUx();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!role || role === 'super_admin') return;
    const seen = localStorage.getItem(welcomeKey(role));
    if (!seen) setOpen(true);
  }, [role]);

  const dismiss = () => {
    if (role) localStorage.setItem(welcomeKey(role), '1');
    setOpen(false);
  };

  if (!role || role === 'super_admin') return null;

  return (
    <GlassDrawer
      open={open}
      onClose={dismiss}
      title={t('role.welcome.title', 'Welcome — {{role}}', { role: roleLabel })}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: space.sm }}>
          <Button onClick={dismiss}>{t('role.welcome.skip', 'Got it')}</Button>
          {theme.quickActions[0] && (
            <Button
              type="primary"
              style={{ background: theme.accent, borderColor: theme.accent }}
              onClick={() => {
                dismiss();
                navigate(theme.quickActions[0].route);
              }}
            >
              {t(theme.quickActions[0].labelKey, theme.quickActions[0].fallbackLabel)}
            </Button>
          )}
        </div>
      }
    >
      <GlassCard accent style={{ padding: space.lg, marginBottom: space.md }}>
        <Typography.Paragraph style={{ marginBottom: space.sm }}>
          {t(persona.descriptionKey, persona.fallbackLabel)}
        </Typography.Paragraph>
        <Typography.Text strong style={{ fontSize: fontSize.xs, display: 'block', marginBottom: space.xs }}>
          {t('persona.you_can', 'You can')}
        </Typography.Text>
        <ul style={{ margin: 0, paddingInlineStart: space.lg }}>
          {persona.canKeys.map((key) => (
            <li key={key} style={{ marginBottom: 4 }}>{t(key)}</li>
          ))}
        </ul>
      </GlassCard>
      <Typography.Text type="secondary" style={{ fontSize: fontSize.sm }}>
        {t('role.welcome.hint', 'Use the role chip in the top bar anytime to review your capabilities.')}
      </Typography.Text>
    </GlassDrawer>
  );
};

export default RoleWelcomeSheet;
