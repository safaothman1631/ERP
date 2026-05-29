import React from 'react';
import { Button } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { ModuleDef } from '../../onboarding/industries';
import { MODULE_PRIMARY_SECTION } from '../registry/moduleSettingsRegistry';
import { palette, radius, space, fontSize } from '../../theme/tokens';

interface Props {
  module: ModuleDef;
  enabled: boolean;
  inPool?: boolean;
}

const ModuleSettingsCard: React.FC<Props> = ({ module, enabled, inPool }) => {
  const { t } = useTranslation();
  const primary = MODULE_PRIMARY_SECTION[module.key];
  const notInPool = inPool === false;

  return (
    <div
      style={{
        padding: space.md,
        border: `1px solid ${palette.border}`,
        borderRadius: radius.md,
        background: palette.surface,
        display: 'flex',
        flexDirection: 'column',
        gap: space.sm,
        minHeight: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: space.sm }}>
        <span style={{ fontSize: 22 }}>{module.icon}</span>
        <span style={{ fontWeight: 600, color: palette.ink900, flex: 1 }}>{module.title}</span>
      </div>
      <div style={{ fontSize: fontSize.xs, color: palette.ink500, flex: 1 }}>{module.description}</div>
      {enabled && primary ? (
        <Link to={`/settings?s=${primary}`}>
          <Button type="primary" size="small" icon={<SettingOutlined />}>
            {t('settings.open_module_settings', 'Open settings')}
          </Button>
        </Link>
      ) : inPool && !enabled ? (
        <Link to="/settings/module-requests">
          <Button size="small">{t('settings.request_module_access', 'Request access')}</Button>
        </Link>
      ) : notInPool ? (
        <span style={{ fontSize: fontSize.xs, color: palette.ink400 }}>
          {t('settings.modules.not_in_license', 'Not included in your license — contact vendor.')}
        </span>
      ) : null}
    </div>
  );
};

export default ModuleSettingsCard;
