import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Spin } from 'antd';
import { useTranslation } from 'react-i18next';
import { space } from '../../theme/tokens';

const Subscriptions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => { navigate('/subscriptions', { replace: true }); }, [navigate]);
  return (<Card style={{ padding: space.lg, textAlign: 'center' }}><Spin tip={t('subscription.redirecting')} /></Card>);
};

export default Subscriptions;
