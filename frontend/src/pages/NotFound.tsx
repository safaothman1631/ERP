import React from 'react';
import { Result, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Result
        data-testid="page-not-found"
        status="404"
        title="404"
        subTitle={t('page_not_found')}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            {t('go_home')}
          </Button>
        }
      />
    </div>
  );
};

export default NotFound;
