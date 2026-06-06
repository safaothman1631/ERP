import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Space, Typography, message } from 'antd';
import { EyeOutlined, CopyOutlined, DashboardOutlined, InboxOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { PageHeader, SectionCard, StatusTag, EmptyState } from '../../design-system';

const { Title, Text } = Typography;

const SharedDashboards: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSharedDashboards();
  }, []);

  const fetchSharedDashboards = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/dashboards');
      const allDashboards = res.data.data || [];
      const shared = allDashboards.filter((d: any) => !d.is_owner);
      setDashboards(shared);
    } catch (_err) {
      message.error(t('load_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleClone = async (id: string) => {
    try {
      const res = await api.post(`/api/dashboards/${id}/clone`);
      message.success(t('dashboard_cloned'));
      const clonedId = res.data.data.id;
      navigate(`/dashboards/${clonedId}/edit`);
    } catch (_err) {
      message.error(t('clone_error'));
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div>
      <PageHeader
        title={t('shared_with_me')}
        subtitle={t('dashboards_shared_subtitle')}
      />

      <Row gutter={[16, 16]}>
        {dashboards.length === 0 && !loading ? (
          <Col span={24}>
            <SectionCard>
              <EmptyState icon={<InboxOutlined />} title={t('no_shared_dashboards')} />
            </SectionCard>
          </Col>
        ) : (
          dashboards.map((dash) => (
            <Col xs={24} sm={12} lg={8} key={dash.id}>
              <Card
                hoverable
                onClick={() => navigate(`/dashboards/${dash.id}`)}
                actions={[
                  <EyeOutlined key="view" onClick={(e) => { e.stopPropagation(); navigate(`/dashboards/${dash.id}`); }} />,
                  <CopyOutlined key="copy" onClick={(e) => { e.stopPropagation(); handleClone(dash.id); }} />
                ]}
              >
                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Title level={5} style={{ margin: 0 }}>
                      <DashboardOutlined style={{ marginInlineEnd: 8 }} />
                      {dash.name}
                    </Title>
                    <StatusTag status="success" label={t('shared')} />
                  </div>
                  <Text type="secondary">
                    {t('widgets')}: {dash.widgets?.length || 0}
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {t('last_modified')}: {formatDate(dash.updated_at)}
                  </Text>
                </Space>
              </Card>
            </Col>
          ))
        )}
      </Row>
    </div>
  );
};

export default SharedDashboards;
