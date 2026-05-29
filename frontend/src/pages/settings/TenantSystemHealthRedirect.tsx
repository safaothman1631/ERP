import React, { useEffect } from 'react';
import { Alert, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';

/** Tenant users are redirected away from infra health; platform uses /platform/health. */
const TenantSystemHealthRedirect: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermission();

  useEffect(() => {
    if (isSuperAdmin) {
      navigate('/platform/health', { replace: true });
      return;
    }
    navigate('/settings?s=system', { replace: true });
  }, [isSuperAdmin, navigate]);

  return (
    <div style={{ padding: 24, maxWidth: 560, margin: '0 auto' }}>
      <Spin />
      <Alert
        style={{ marginTop: 16 }}
        type="info"
        showIcon
        message={t('settings.gate.platform_only', 'Platform feature')}
        description={t(
          'settings.gate.health_redirect',
          'Full system health monitoring is available in the vendor platform console.',
        )}
      />
    </div>
  );
};

export default TenantSystemHealthRedirect;
