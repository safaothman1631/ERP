import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Button, Space, message, Typography, Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { ClockCircleOutlined, CheckOutlined, FireOutlined } from '@ant-design/icons';
import api from '../../api';
import { PageHeader } from '../../design-system';
import { space, radius } from '../../theme/tokens';

const { Text } = Typography;

interface KDSTicket {
  id: string;
  order_id: string;
  station: string;
  items: Array<{ name: string; qty: number; notes?: string }>;
  status?: string;
  created_at?: string;
  started_at?: string;
  ready_at?: string;
}

const KitchenDisplay: React.FC = () => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<KDSTicket[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchTickets();
    const interval = setInterval(() => void fetchTickets(), 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/restaurant/kds');
      setTickets(res.data.items || []);
    } catch {
      void message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await api.post(`/api/restaurant/kds/${id}/start`);
      void message.success(t('restaurant.cooking_started'));
      void fetchTickets();
    } catch {
      void message.error(t('error'));
    }
  };

  const handleReady = async (id: string) => {
    try {
      await api.post(`/api/restaurant/kds/${id}/ready`);
      void message.success(t('restaurant.order_ready'));
      void fetchTickets();
    } catch {
      void message.error(t('error'));
    }
  };

  const calculateElapsed = (createdAt?: string) => {
    if (!createdAt) return '';
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    return `${diffMin} ${t('restaurant.minutes')}`;
  };

  const ticketColor = (status?: string) => {
    switch (status) {
      case 'preparing':
        return 'var(--warning-500)';
      case 'ready':
        return 'var(--success-500)';
      default:
        return 'var(--border-strong)';
    }
  };

  return (
    <div>
      <PageHeader
        title={t('restaurant.kitchen_display')}
        subtitle={t('restaurant.kds_subtitle')}
        extra={
          <Button onClick={() => void fetchTickets()} loading={loading}>
            {t('refresh')}
          </Button>
        }
      />

      <Row gutter={[space.md, space.md]}>
        {tickets.length === 0 && !loading && (
          <Col span={24}>
            <Card style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">{t('restaurant.no_pending_orders')}</Text>
            </Card>
          </Col>
        )}
        {tickets.map(ticket => (
          <Col key={ticket.id} xs={24} sm={12} md={8} lg={6}>
            <Badge.Ribbon
              text={t(`restaurant.station_${ticket.station}`)}
              color={ticketColor(ticket.status)}
            >
              <Card
                size="small"
                style={{
                  borderRadius: radius.md,
                  borderInlineStart: `4px solid ${ticketColor(ticket.status)}`,
                }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text strong>
                    {t('restaurant.order')} #{ticket.order_id.substring(0, 8)}
                  </Text>
                  <Text type="secondary">
                    <ClockCircleOutlined /> {calculateElapsed(ticket.created_at)}
                  </Text>

                  <div style={{ marginTop: 8 }}>
                    {ticket.items.map((item, idx) => (
                      <div key={idx} style={{ marginBottom: 4 }}>
                        <Text>
                          {item.qty}× {item.name}
                        </Text>
                        {item.notes && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {item.notes}
                            </Text>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <Space style={{ marginTop: 12 }}>
                    {!ticket.status || ticket.status === 'pending' ? (
                      <Button
                        type="primary"
                        size="small"
                        icon={<FireOutlined />}
                        onClick={() => void handleStart(ticket.id)}
                      >
                        {t('restaurant.start_cooking')}
                      </Button>
                    ) : ticket.status === 'preparing' ? (
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        style={{ backgroundColor: 'var(--success-500)', borderColor: 'var(--success-500)' }}
                        onClick={() => void handleReady(ticket.id)}
                      >
                        {t('restaurant.mark_ready')}
                      </Button>
                    ) : null}
                  </Space>
                </Space>
              </Card>
            </Badge.Ribbon>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default KitchenDisplay;
