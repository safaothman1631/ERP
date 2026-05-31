import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { space } from '../../theme/tokens';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';

const Subscriptions: React.FC = () => {
  const { t: _t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => { navigate('/subscriptions', { replace: true }); }, [navigate]);
  return (<Card style={{ padding: space.lg, textAlign: 'center' }}><LoadingSkeleton variant="row" rows={2} /></Card>);
};

export default Subscriptions;
