import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Select, DatePicker, message } from 'antd';
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs, { Dayjs } from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

dayjs.extend(relativeTime);

const { RangePicker } = DatePicker;

interface Alert {
  id: string;
  device_id: string;
  metric?: string;
  value?: number;
  threshold?: number;
  severity: string;
  message?: string;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

interface Device {
  id: string;
  name: string;
}

const AlertHistory: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<any>({});
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadAlerts();
    loadDevices();
  }, [page, pageSize, filters]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadAlerts();
      }, 30000); // 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh, page, pageSize, filters]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize
      };
      if (filters.severity) params.severity = filters.severity;
      if (filters.device_id) params.device_id = filters.device_id;
      if (filters.acknowledged !== undefined) params.acknowledged = filters.acknowledged;

      const res = await api.get('/api/iot/alerts', { params });
      setAlerts(res.data.items);
      setTotal(res.data.total);
    } catch (err) {
      message.error(t('common.load_failed', 'Failed to load'));
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.get('/api/iot/devices', { params: { limit: 100 } });
      setDevices(res.data.items);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const handleAck = async (id: string) => {
    try {
      await api.post(`/api/iot/alerts/${id}/ack`);
      message.success(t('iot.acknowledged', 'Acknowledged'));
      loadAlerts();
    } catch (err) {
      message.error(t('common.operation_failed', 'Operation failed'));
    }
  };

  const severityColor = (severity: string) => {
    const map: Record<string, string> = {
      info: 'blue',
      warn: 'orange',
      critical: 'red'
    };
    return map[severity] || 'default';
  };

  const columns = [
    {
      title: t('iot.triggered_at', 'Triggered'),
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      render: (val: string) => (
        <Space direction="vertical" size={0}>
          <span>{dayjs(val).format('YYYY-MM-DD HH:mm:ss')}</span>
          <span style={{ fontSize: 11, color: '#8c8c8c' }}>{dayjs(val).fromNow()}</span>
        </Space>
      )
    },
    {
      title: t('iot.device', 'Device'),
      dataIndex: 'device_id',
      key: 'device_id',
      render: (id: string) => {
        const device = devices.find(d => d.id === id);
        return device?.name || id.substring(0, 8);
      }
    },
    {
      title: t('iot.metric', 'Metric'),
      dataIndex: 'metric',
      key: 'metric'
    },
    {
      title: t('iot.value', 'Value'),
      key: 'value',
      render: (_: any, record: Alert) => {
        if (record.value !== undefined && record.threshold !== undefined) {
          return `${record.value} (${t('iot.threshold', 'threshold')}: ${record.threshold})`;
        }
        return record.message || '-';
      }
    },
    {
      title: t('iot.severity', 'Severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (val: string) => <Tag color={severityColor(val)}>{t(`iot.${val}`, val)}</Tag>
    },
    {
      title: t('iot.status', 'Status'),
      dataIndex: 'acknowledged',
      key: 'acknowledged',
      render: (acked: boolean, record: Alert) => (
        <Space direction="vertical" size={0}>
          <Tag color={acked ? 'success' : 'warning'}>
            {acked ? t('iot.acknowledged', 'Acknowledged') : t('iot.pending', 'Pending')}
          </Tag>
          {acked && record.acknowledged_by && (
            <span style={{ fontSize: 11, color: '#8c8c8c' }}>
              {t('common.by', 'by')} {record.acknowledged_by}
            </span>
          )}
        </Space>
      )
    },
    {
      title: t('common.actions', 'Actions'),
      key: 'actions',
      render: (_: any, record: Alert) => (
        record.acknowledged ? (
          <span style={{ color: '#52c41a' }}>
            <CheckOutlined /> {t('iot.acked', 'Acked')}
          </span>
        ) : (
          <Button size="small" type="primary" onClick={() => handleAck(record.id)}>
            {t('iot.ack', 'Acknowledge')}
          </Button>
        )
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>{t('iot.alert_history', 'Alert History')}</h1>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={loadAlerts}
          >
            {autoRefresh && `(${t('iot.auto_refresh', 'auto')})`}
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder={t('iot.filter_severity', 'Filter by severity')}
          style={{ width: 150 }}
          allowClear
          onChange={val => setFilters({ ...filters, severity: val })}
        >
          <Select.Option value="info">{t('iot.info', 'Info')}</Select.Option>
          <Select.Option value="warn">{t('iot.warn', 'Warning')}</Select.Option>
          <Select.Option value="critical">{t('iot.critical', 'Critical')}</Select.Option>
        </Select>
        <Select
          placeholder={t('iot.filter_device', 'Filter by device')}
          style={{ width: 200 }}
          allowClear
          showSearch
          filterOption={(input, option) => 
            String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
          }
          onChange={val => setFilters({ ...filters, device_id: val })}
        >
          {devices.map(d => (
            <Select.Option key={d.id} value={d.id}>{d.name}</Select.Option>
          ))}
        </Select>
        <Select
          placeholder={t('iot.filter_status', 'Filter by status')}
          style={{ width: 150 }}
          allowClear
          onChange={val => setFilters({ ...filters, acknowledged: val })}
        >
          <Select.Option value={false}>{t('iot.pending', 'Pending')}</Select.Option>
          <Select.Option value={true}>{t('iot.acknowledged', 'Acknowledged')}</Select.Option>
        </Select>
      </Space>

      <ResponsiveTableAdapter
        dataSource={alerts}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (tot) => `${tot} ${t('common.total', 'total')}`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps || 20);
          }
        }}
      />
    </div>
  );
};

export default AlertHistory;
