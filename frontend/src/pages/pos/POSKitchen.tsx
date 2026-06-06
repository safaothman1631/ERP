import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Button, Space, Typography, Row, Col } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReloadOutlined, FullscreenOutlined, CheckOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { StatusTag } from '../../design-system';

const { Text, Title } = Typography;

interface PreparationOrderCardProps {
  order: any;
  stages: any[];
  onStageChange: (orderId: string, stage: string) => void;
  onComplete: (orderId: string) => void;
}

const PreparationOrderCard: React.FC<PreparationOrderCardProps> = ({ order, stages, onStageChange, onComplete }) => {
  const { t } = useTranslation();
  
  const getElapsedTime = () => {
    if (!order.sent_at) return '';
    const sent = new Date(order.sent_at);
    const now = new Date();
    const diffMs = now.getTime() - sent.getTime();
    const minutes = Math.floor(diffMs / 60000);
    return `${minutes} min`;
  };

  const currentStageIndex = stages.findIndex((s) => s.key === order.stage);
  const nextStage = stages[currentStageIndex + 1];

  return (
    <Card
      size="small"
      style={{
        marginBottom: 12,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--surface)',
      }}
    >
      <Space orientation="vertical" style={{ width: '100%' }} size="small">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Text strong style={{ fontSize: 16 }}>
            {order.table_name || t('pos.order')} #{order.sequence || order.id?.slice(-4)}
          </Text>
          <StatusTag status="warning" label={getElapsedTime()} />
        </div>

        {order.lines?.map((line: any, idx: number) => (
          <div key={idx} style={{ padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
            <Text strong>{line.qty}x</Text> {line.item_name}
            {line.note && (
              <div style={{ fontSize: 12, color: 'var(--ink-500)', marginTop: 2 }}>
                📝 {line.note}
              </div>
            )}
            {line.course && (
              <div style={{ marginTop: 4 }}>
                <StatusTag status="info" label={line.course} />
              </div>
            )}
          </div>
        ))}

        <div style={{ marginTop: 8 }}>
          {nextStage ? (
            <Button
              type="primary"
              size="small"
              block
              onClick={() => onStageChange(order.id, nextStage.key)}
            >
              → {nextStage.name}
            </Button>
          ) : (
            <Button
              type="primary"
              size="small"
              block
              icon={<CheckOutlined />}
              onClick={() => onComplete(order.id)}
              style={{ backgroundColor: 'var(--success-500)', borderColor: 'var(--success-500)' }}
            >
              {t('pos.complete')}
            </Button>
          )}
        </div>
      </Space>
    </Card>
  );
};

const POSKitchen: React.FC = () => {
  const { displayId } = useParams<{ displayId: string }>();
  const { t } = useTranslation();
  const [display, setDisplay] = useState<any | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [_loading, _setLoading] = useState(false);
  const [lastOrderCount, setLastOrderCount] = useState(0);

  const defaultStages = [
    { key: 'received', name: 'Received', color: 'var(--danger-500)' },
    { key: 'preparing', name: 'Preparing', color: 'var(--warning-500)' },
    { key: 'ready', name: 'Ready', color: 'var(--success-500)' },
    { key: 'served', name: 'Served', color: 'var(--ink-400)' },
  ];

  const fetchDisplay = async () => {
    try {
      const res = await api.get('/api/pos/preparation/displays');
      const displays = res.data.items || [];
      const found = displays.find((d: any) => d.id === displayId);
      if (found) {
        setDisplay(found);
      }
    } catch {
      message.error(t('error'));
    }
  };

  const fetchOrders = async () => {
    if (!displayId) return;
    
    try {
      const res = await api.get(`/api/pos/preparation/displays/${displayId}/orders`);
      const newOrders = res.data.items || [];
      
      // Play sound if new orders arrived
      if (newOrders.length > lastOrderCount) {
        playNotificationSound();
      }
      
      setOrders(newOrders);
      setLastOrderCount(newOrders.length);
    } catch {
      // Silent fail for auto-refresh
    }
  };

  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch {
      // Silent fail if audio not supported
    }
  };

  useEffect(() => {
    fetchDisplay();
    fetchOrders();
  }, [displayId]);

  useEffect(() => {
    // Auto-refresh every 5 seconds
    const interval = setInterval(() => {
      fetchOrders();
    }, 5000);

    return () => clearInterval(interval);
  }, [displayId, lastOrderCount]);

  const handleStageChange = async (orderId: string, stage: string) => {
    try {
      await api.post(`/api/pos/preparation/orders/${orderId}/stage`, { stage });
      fetchOrders();
    } catch {
      message.error(t('error'));
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      await api.post(`/api/pos/preparation/orders/${orderId}/complete`);
      message.success(t('pos.order_completed'));
      fetchOrders();
    } catch {
      message.error(t('error'));
    }
  };

  const stages = display?.stages || defaultStages;
  const groupedOrders: Record<string, any[]> = {};
  
  stages.forEach((stage: any) => {
    groupedOrders[stage.key] = orders.filter((o) => o.stage === stage.key);
  });

  return (
    <div style={{ padding: 16, backgroundColor: '#000', minHeight: '100vh' }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          {display?.name || t('pos.kitchen_display')} - {new Date().toLocaleTimeString()}
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>
            {t('refresh')}
          </Button>
          <Button icon={<FullscreenOutlined />} onClick={() => document.documentElement.requestFullscreen()}>
            {t('pos.fullscreen')}
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        {stages.map((stage: any) => (
          <Col key={stage.key} span={6}>
            <div
              style={{
                backgroundColor: stage.color,
                padding: '8px 16px',
                borderRadius: 4,
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              <Text strong style={{ color: '#fff', fontSize: 16 }}>
                {stage.name} ({groupedOrders[stage.key]?.length || 0})
              </Text>
            </div>
            <div style={{ maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
              {groupedOrders[stage.key]?.map((order) => (
                <PreparationOrderCard
                  key={order.id}
                  order={order}
                  stages={stages}
                  onStageChange={handleStageChange}
                  onComplete={handleComplete}
                />
              ))}
            </div>
          </Col>
        ))}
      </Row>
    </div>
  );
};

export default POSKitchen;
