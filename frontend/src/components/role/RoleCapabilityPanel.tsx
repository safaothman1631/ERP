import React from 'react';
import { List, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { RolePersona } from '../../personas/types';
import GlassCard from '../glass/GlassCard';
import { palette, space, fontSize } from '../../theme/tokens';

interface Props {
  persona: RolePersona;
  roleLabel: string;
}

const RoleCapabilityPanel: React.FC<Props> = ({ persona, roleLabel }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div style={{ width: 320, maxWidth: 'min(320px, 92vw)' }}>
      <GlassCard accent style={{ padding: space.lg }}>
        <Typography.Title level={5} style={{ marginTop: 0, marginBottom: space.xs }}>
          {roleLabel}
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ fontSize: fontSize.sm, marginBottom: space.md }}>
          {t(persona.descriptionKey, persona.fallbackLabel)}
        </Typography.Paragraph>

        <Typography.Text strong style={{ fontSize: fontSize.xs, color: palette.success600 }}>
          {t('persona.you_can', 'You can')}
        </Typography.Text>
        <List
          size="small"
          dataSource={[...persona.canKeys]}
          renderItem={(key) => (
            <List.Item style={{ padding: '4px 0', border: 'none' }}>
              <span style={{ fontSize: fontSize.sm }}>{t(key)}</span>
            </List.Item>
          )}
        />

        <Typography.Text strong style={{ fontSize: fontSize.xs, color: palette.ink500, display: 'block', marginTop: space.sm }}>
          {t('persona.you_cannot', 'You cannot')}
        </Typography.Text>
        <List
          size="small"
          dataSource={[...persona.cannotKeys]}
          renderItem={(key) => (
            <List.Item style={{ padding: '4px 0', border: 'none' }}>
              <span style={{ fontSize: fontSize.sm, color: palette.ink500 }}>{t(key)}</span>
            </List.Item>
          )}
        />

        <button
          type="button"
          onClick={() => navigate('/settings?s=profile')}
          style={{
            marginTop: space.md,
            background: 'none',
            border: 'none',
            color: 'var(--role-accent, #1F6FEB)',
            cursor: 'pointer',
            fontSize: fontSize.sm,
            fontWeight: 600,
            padding: 0,
          }}
        >
          {t('persona.open_profile_settings', 'Open profile settings →')}
        </button>
      </GlassCard>
    </div>
  );
};

export default RoleCapabilityPanel;
