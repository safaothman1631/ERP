import React, { useEffect, useState, useCallback } from 'react';
import { Card, Button, Row, Col, Tag, Space, Typography, Empty } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ShopOutlined, PlayCircleOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { InlineError } from '../../components/feedback/InlineError';
import { useLoadingState } from '../../hooks/useLoadingState';

const { Title, Text } = Typography;

const POSHub: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState<Record<string, boolean>>({});
  const { showSkeleton } = useLoadingState(loading);

  const fetchConfigs = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.get('/api/pos/configs', { params: { is_active: true, page_size: 100 } });
      setConfigs(res.data.items || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const handleOpenSession = async (configId: string) => {
    setCheckingAvailability({ ...checkingAvailability, [configId]: true });
    try {
      // Check availability first
      const availRes = await api.get(`/api/pos/configs/${configId}/available`);
      if (!availRes.data.can_open) {
        if (availRes.data.open_session) {
          // Resume existing session
          navigate(`/pos/terminal/${availRes.data.open_session.id}`);
        } else {
          message.warning(availRes.data.reason);
        }
        return;
      }

      // Open new session
      const res = await api.post('/api/pos/sessions/open', { config_id: configId, opening_cash: 0 });
      message.success(t('pos.session_opened'));
      navigate(`/pos/terminal/${res.data.id}`);
    } catch {
      message.error(t('error'));
    } finally {
      setCheckingAvailability({ ...checkingAvailability, [configId]: false });
    }
  };

  if (error) {
    return <InlineError onRetry={fetchConfigs} />;
  }

  if (showSkeleton) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <Empty
        description={t('pos.no_configs')}
        style={{ marginTop: 100 }}
      >
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/pos/configs')}>
          {t('pos.create_config')}
        </Button>
      </Empty>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          <ShopOutlined style={{ marginRight: 8 }} />
          {t('pos.select_config')}
        </Title>
        <Button icon={<SettingOutlined />} onClick={() => navigate('/pos/configs')}>
          {t('settings')}
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {configs.map((config) => (
          <Col key={config.id} xs={24} sm={12} md={8} lg={6}>
            <Card
              hoverable
              style={{ height: '100%' }}
              actions={[
                <Button
                  key="open"
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={checkingAvailability[config.id]}
                  onClick={() => handleOpenSession(config.id)}
                  block
                >
                  {t('pos.open_session')}
                </Button>,
              ]}
            >
              <Space orientation="vertical" size="small" style={{ width: '100%' }}>
                <Title level={4} style={{ margin: 0 }}>
                  {config.name_ku || config.name}
                </Title>
                <Text type="secondary">{config.name}</Text>
                <Space wrap>
                  {config.restaurant_mode && <Tag color="orange">{t('pos.restaurant')}</Tag>}
                  {config.cash_control && <Tag color="green">{t('pos.cash_control')}</Tag>}
                  <Tag color={config.iface_type === 'shop' ? 'blue' : 'purple'}>
                    {t(`pos.${config.iface_type}`)}
                  </Tag>
                </Space>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default POSHub;
