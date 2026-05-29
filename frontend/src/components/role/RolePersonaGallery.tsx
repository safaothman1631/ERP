import React from 'react';
import { Card, Col, Row, Tag, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ROLE_THEMES } from '../../theme/roleThemes';
import { resolveRolePersona } from '../../personas/rolePersonaRegistry';
import type { RoleThemeId } from '../../personas/types';

const ROLE_CODES: Record<RoleThemeId, string> = {
  executive: 'owner',
  administrator: 'admin',
  manager: 'manager',
  finance: 'accountant',
  sales: 'sales',
  purchase: 'purchaser',
  inventory: 'inventory',
  pos: 'cashier',
  hr: 'hr',
  projects: 'project_manager',
  personal: 'user',
  readonly: 'viewer',
};

const RolePersonaGallery: React.FC = () => {
  const { t } = useTranslation();
  const ids = Object.keys(ROLE_THEMES) as RoleThemeId[];

  return (
    <div style={{ marginTop: 48 }}>
      <Typography.Title level={3}>Role-adaptive personas</Typography.Title>
      <Typography.Paragraph type="secondary">
        Live theme accents and capability copy per job role (B8 gallery).
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {ids.map((id) => {
          const theme = ROLE_THEMES[id];
          const persona = resolveRolePersona(ROLE_CODES[id]);
          const label = t(persona.labelKey, persona.fallbackLabel);
          return (
            <Col xs={24} sm={12} lg={8} key={id}>
              <Card
                style={{
                  borderTop: `3px solid ${theme.accent}`,
                  boxShadow: theme.glassBorderGlow,
                }}
              >
                <Tag color={theme.accent} style={{ marginBottom: 8 }}>{label}</Tag>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {t(persona.descriptionKey, persona.fallbackLabel)}
                </Typography.Text>
                <Typography.Text style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
                  → {theme.defaultRoute}
                </Typography.Text>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

export default RolePersonaGallery;
