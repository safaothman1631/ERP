import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Typography, Divider } from 'antd';
import { LeftOutlined, DollarOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';

const { Title, Text } = Typography;

const PortalStatements: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState<any>(null);

  useEffect(() => {
    const jwt = sessionStorage.getItem('portal_jwt');
    if (!jwt) {
      message.warning(t('portal.session_expired'));
      navigate('/portal/login');
      return;
    }

    fetchStatement();
  }, []);

  const fetchStatement = async () => {
    try {
      setLoading(true);
      const jwt = sessionStorage.getItem('portal_jwt');
      const res = await api.get('/api/portal/me/statements', {
        headers: { Authorization: `Bearer ${jwt}` },
      });

      setStatement(res.data);
    } catch (_err) {
      message.error(t('portal.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/portal')}
          style={{ marginBottom: 16 }}
        >
          {t('portal.back_to_dashboard')}
        </Button>

        <Card loading={loading}>
          <Title level={2}>{t('portal.account_statement')}</Title>

          {statement && (
            <>
              <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 24 }}>
                {statement.contact_name}
              </Text>

              <Row gutter={[24, 24]}>
                <Col xs={24} md={12}>
                  <Card style={{ background: '#f0f7ff', borderColor: '#1890ff' }}>
                    <Statistic
                      title={t('portal.total_outstanding')}
                      value={statement.total_due || 0}
                      prefix={<DollarOutlined />}
                      suffix={t('currency')}
                      valueStyle={{ color: '#1890ff', fontSize: 32 }}
                    />
                  </Card>
                </Col>

                <Col xs={24} md={12}>
                  <Card style={{ background: '#fff1f0', borderColor: '#ff4d4f' }}>
                    <Statistic
                      title={t('portal.overdue_amount')}
                      value={statement.overdue || 0}
                      prefix={<FileTextOutlined />}
                      suffix={t('currency')}
                      valueStyle={{ color: '#ff4d4f', fontSize: 32 }}
                    />
                  </Card>
                </Col>
              </Row>

              <Divider />

              <Card title={t('portal.payment_summary')} style={{ marginTop: 24 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Text type="secondary">{t('portal.current_balance')}:</Text>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 18 }}>
                      {statement.total_due?.toLocaleString()} {t('currency')}
                    </Text>
                  </Col>
                </Row>

                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Text type="secondary">{t('portal.overdue')}:</Text>
                  </Col>
                  <Col span={12} style={{ textAlign: 'right' }}>
                    <Text strong style={{ fontSize: 18, color: '#ff4d4f' }}>
                      {statement.overdue?.toLocaleString()} {t('currency')}
                    </Text>
                  </Col>
                </Row>
              </Card>

              <Card
                title={t('portal.payment_options')}
                style={{ marginTop: 24 }}
              >
                <Text type="secondary">
                  {t('portal.payment_instructions')}
                </Text>
              </Card>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PortalStatements;
