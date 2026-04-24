import React from 'react';
import { Result, Button, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ServerError: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        status="500"
        title="500"
        subTitle={t('server_error')}
        extra={
          <Space>
            <Button type="primary" onClick={() => navigate('/')}>
              {t('go_home')}
            </Button>
            <Button onClick={() => window.location.reload()}>
              {t('try_again')}
            </Button>
          </Space>
        }
      />
    </div>
  );
};

export default ServerError;
