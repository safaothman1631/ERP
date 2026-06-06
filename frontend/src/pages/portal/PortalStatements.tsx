import React, { useEffect, useState } from 'react';
import { Row, Col, Button, Typography, Divider, Spin } from 'antd';
import { LeftOutlined, DollarOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { PageHeader, SectionCard, KpiCard } from '../../design-system';
import { space } from '../../theme/tokens';

const { Text } = Typography;

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
    <div style={{ padding: '24px', background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/portal')}
          style={{ marginBottom: 16 }}
        >
          {t('portal.back_to_dashboard')}
        </Button>

        <PageHeader
          title={t('portal.account_statement')}
          subtitle={statement?.contact_name || undefined}
        />

        {loading && !statement && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin size="large" />
          </div>
        )}

        {statement && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: space.md, marginBottom: space.lg }}>
              <KpiCard
                title={t('portal.total_outstanding')}
                value={`${(statement.total_due || 0).toLocaleString()} ${t('currency')}`}
                icon={<DollarOutlined />}
                tone="info"
              />
              <KpiCard
                title={t('portal.overdue_amount')}
                value={`${(statement.overdue || 0).toLocaleString()} ${t('currency')}`}
                icon={<FileTextOutlined />}
                tone="danger"
              />
            </div>

            <SectionCard title={t('portal.payment_summary')}>
              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">{t('portal.current_balance')}:</Text>
                </Col>
                <Col span={12} style={{ textAlign: 'end' }}>
                  <Text strong style={{ fontSize: 18 }}>
                    {statement.total_due?.toLocaleString()} {t('currency')}
                  </Text>
                </Col>
              </Row>

              <Divider />

              <Row gutter={16}>
                <Col span={12}>
                  <Text type="secondary">{t('portal.overdue')}:</Text>
                </Col>
                <Col span={12} style={{ textAlign: 'end' }}>
                  <Text strong style={{ fontSize: 18, color: 'var(--danger-500)' }}>
                    {statement.overdue?.toLocaleString()} {t('currency')}
                  </Text>
                </Col>
              </Row>
            </SectionCard>

            <SectionCard title={t('portal.payment_options')}>
              <Text type="secondary">
                {t('portal.payment_instructions')}
              </Text>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalStatements;
