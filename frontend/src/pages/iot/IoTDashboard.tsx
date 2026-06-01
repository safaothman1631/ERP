import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Button, Space } from 'antd';
import { HddOutlined, CheckCircleOutlined, CloseCircleOutlined, BellOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { PageHeader, StatusTag } from '../../design-system';
import { space } from '../../theme/tokens';

dayjs.extend(relativeTime);

interface Device {
  id: string;
  name: string;
  device_type: string;
  location?: string;
  status: string;
  last_seen_at?: string;
}

interface Alert {
  id: string;
  device_id: string;
  severity: string;
  message?: string;
  triggered_at: string;
  acknowledged: boolean;
}

const IoTDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    offline: 0,
    error: 0,
    activeAlerts: 0
  });
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [devicesRes, alertsRes] = await Promise.all([
        api.get('/api/iot/devices?limit=100'),
        api.get('/api/iot/alerts?acknowledged=false&limit=10')
      ]);

      const devices = devicesRes.data.items;
      const online = devices.filter((d: Device) => d.status === 'active').length;
      const offline = devices.filter((d: Device) => d.status === 'inactive').length;
      const error = devices.filter((d: Device) => d.status === 'error').length;

      setStats({
        total: devices.length,
        online,
        offline,
        error,
        activeAlerts: alertsRes.data.total
      });

      setRecentDevices(devices.slice(0, 6));
      setRecentAlerts(alertsRes.data.items);
    } catch (err) {
      console.error('Failed to load IoT dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAckAlert = async (alertId: string) => {
    try {
      await api.post(`/api/iot/alerts/${alertId}/ack`);
      loadData();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const severityStatus = (severity: string) => {
    const map: Record<string, string> = {
      info: 'info',
      warn: 'warning',
      critical: 'error'
    };
    return map[severity] || 'default';
  };

  const statusKind = (status: string) => {
    const map: Record<string, string> = {
      active: 'success',
      inactive: 'default',
      error: 'error'
    };
    return map[status] || 'default';
  };

  const alertColumns = [
    {
      title: t('iot.triggered_at', 'Triggered'),
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      render: (val: string) => dayjs(val).fromNow()
    },
    {
      title: t('iot.device', 'Device'),
      dataIndex: 'device_id',
      key: 'device_id',
      render: (id: string) => {
        const device = recentDevices.find(d => d.id === id);
        return device?.name || id.substring(0, 8);
      }
    },
    {
      title: t('iot.severity', 'Severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (val: string) => <StatusTag status={severityStatus(val)} label={t(`iot.${val}`, val)} />
    },
    {
      title: t('iot.action', 'Action'),
      key: 'action',
      render: (_: any, record: Alert) => (
        <Button size="small" onClick={() => handleAckAlert(record.id)}>
          {t('iot.ack', 'Acknowledge')}
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: space.lg }}>
      <PageHeader title={t('iot.dashboard', 'IoT Dashboard')} />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('iot.total_devices', 'Total Devices')}
              value={stats.total}
              prefix={<HddOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('iot.online', 'Online')}
              value={stats.online}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('iot.offline', 'Offline')}
              value={stats.offline}
              prefix={<CloseCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title={t('iot.active_alerts', 'Active Alerts')}
              value={stats.activeAlerts}
              prefix={<BellOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <Card 
            title={t('iot.recent_alerts', 'Recent Alerts')} 
            style={{ marginBottom: 16 }}
            extra={<Button onClick={() => navigate('/iot/alerts')}>{t('common.view_all', 'View All')}</Button>}
          >
            <ResponsiveTableAdapter
              dataSource={recentAlerts}
              columns={alertColumns}
              rowKey="id"
              pagination={false}
              loading={loading}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card 
            title={t('iot.recent_devices', 'Recent Devices')}
            extra={<Button onClick={() => navigate('/iot/devices')}>{t('common.view_all', 'View All')}</Button>}
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {recentDevices.map(device => (
                <Card 
                  key={device.id}
                  size="small"
                  hoverable
                  onClick={() => navigate(`/iot/devices/${device.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <Space direction="vertical" size={0} style={{ width: '100%' }}>
                    <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                      <strong>{device.name}</strong>
                      <StatusTag
                        status={statusKind(device.status)}
                        label={t(`iot.status_${device.status}`, device.status)}
                      />
                    </Space>
                    <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>
                      {t(`iot.device_type_${device.device_type}`, device.device_type)}
                      {device.location && ` · ${device.location}`}
                    </div>
                    {device.last_seen_at && (
                      <div style={{ fontSize: 11, color: 'var(--ink-400)' }}>
                        {t('iot.last_seen', 'Last seen')}: {dayjs(device.last_seen_at).fromNow()}
                      </div>
                    )}
                  </Space>
                </Card>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <div style={{ marginTop: 24, textAlign: 'center' }}>
        <Space>
          <Button type="primary" onClick={() => navigate('/iot/devices')}>
            {t('iot.manage_devices', 'Manage Devices')}
          </Button>
          <Button onClick={() => navigate('/iot/alert-rules')}>
            {t('iot.alert_rules', 'Alert Rules')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default IoTDashboard;
