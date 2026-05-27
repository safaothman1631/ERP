import React from 'react';
import { Button, Empty } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const SettingsModulesEmptyState: React.FC = () => {
  const { t } = useTranslation();
  const reopen = () => window.dispatchEvent(new Event('open-onboarding'));

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={
        <>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>
            {t('settings.empty_modules_title', 'No module settings yet')}
          </div>
          <div style={{ color: 'var(--ink-500, #64748b)', maxWidth: 420, margin: '0 auto' }}>
            {t(
              'settings.empty_modules_desc',
              'Complete onboarding or request modules from your administrator to unlock module-specific settings.',
            )}
          </div>
        </>
      }
    >
      <Button type="primary" icon={<RocketOutlined />} onClick={reopen}>
        {t('start_onboarding', 'Start onboarding')}
      </Button>
      <Link to="/settings/module-requests" style={{ marginInlineStart: 8 }}>
        <Button>{t('modreq_page_title', 'Module requests')}</Button>
      </Link>
    </Empty>
  );
};

export default SettingsModulesEmptyState;
