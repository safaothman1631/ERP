import React from 'react';
import { Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import type { SettingsDenyReason } from '../hooks/useSettingsAccess';

interface Props {
  reason: SettingsDenyReason;
}

const SettingsGateBanner: React.FC<Props> = ({ reason }) => {
  const { t } = useTranslation();
  if (reason !== 'view_only') return null;
  return (
    <Alert
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
      message={t('settings.gate.view_only', 'View only')}
      description={t(
        'settings.gate.view_only_desc',
        'You can view these settings but cannot save changes. Contact your administrator for edit access.',
      )}
    />
  );
};

export default SettingsGateBanner;
