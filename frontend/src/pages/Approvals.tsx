import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Alert, Space, Button } from 'antd';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, SettingOutlined } from '@ant-design/icons';

export default function Approvals() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    // Auto-redirect to My Approvals after 2 seconds
    const timer = setTimeout(() => {
      navigate('/my-approvals');
    }, 2000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Card title={t('approvals.title')}>
      <Alert
        message={t('approvals.redirecting')}
        description={
          <div>
            <p>{t('approvals.redirect_message')}</p>
            <Space>
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={() => navigate('/my-approvals')}
              >
                {t('approvals.my_approvals')}
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => navigate('/approval-rules')}
              >
                {t('approvals.rules')}
              </Button>
            </Space>
          </div>
        }
        type="info"
        showIcon
      />
    </Card>
  );
}

