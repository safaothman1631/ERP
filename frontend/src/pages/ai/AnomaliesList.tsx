import React, { useEffect, useState } from 'react';
import { Button, Space, Tag, Select, Input, message } from 'antd';
import type { TableProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { SearchOutlined, ReloadOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { PageHeader } from '../../design-system';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface Anomaly {
  id: string;
  entity_type: string;
  entity_id: string;
  score: number;
  reason?: string;
  detected_at?: string;
  status?: string;
  created_at?: string;
}

const AnomaliesList: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEntityType, setFilterEntityType] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [searchText, setSearchText] = useState('');

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/ai/anomalies', { params: { limit: 500 } });
      setData(res.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnomalies();
  }, []);

  const acknowledge = async (id: string) => {
    try {
      await api.patch(`/api/ai/anomalies/${id}`, { status: 'reviewed' });
      message.success(t('ai.anomaly_acknowledged'));
      await fetchAnomalies();
    } catch {
      message.error(t('error'));
    }
  };

  const dismiss = async (id: string) => {
    try {
      await api.patch(`/api/ai/anomalies/${id}`, { status: 'dismissed' });
      message.success(t('ai.anomaly_dismissed'));
      await fetchAnomalies();
    } catch {
      message.error(t('error'));
    }
  };

  const handleEntityLink = (entityType: string, _entityId: string) => {
    const routes: Record<string, string> = {
      invoice: '/invoices',
      bill: '/bills',
      payment: '/banking',
      expense: '/expenses',
    };
    const base = routes[entityType];
    if (base) navigate(base);
  };

  const filteredData = data
    .filter((item) => {
      if (filterEntityType && item.entity_type !== filterEntityType) return false;
      if (filterStatus && item.status !== filterStatus) return false;
      if (searchText) {
        const text = searchText.toLowerCase();
        return (
          item.entity_id?.toLowerCase().includes(text) ||
          item.reason?.toLowerCase().includes(text) ||
          item.entity_type?.toLowerCase().includes(text)
        );
      }
      return true;
    });

  const columns: TableProps<Anomaly>['columns'] = [
    {
      title: t('ai.entity_type'),
      dataIndex: 'entity_type',
      key: 'entity_type',
      render: (val: string) => <Tag color="blue">{val}</Tag>,
      filters: [
        { text: 'Invoice', value: 'invoice' },
        { text: 'Bill', value: 'bill' },
        { text: 'Payment', value: 'payment' },
        { text: 'Expense', value: 'expense' },
      ],
      onFilter: (value, record) => record.entity_type === value,
    },
    {
      title: t('ai.entity_id'),
      dataIndex: 'entity_id',
      key: 'entity_id',
      render: (val: string, record: Anomaly) => (
        <Button
          type="link"
          size="small"
          onClick={() => handleEntityLink(record.entity_type, val)}
        >
          {val}
        </Button>
      ),
    },
    {
      title: t('ai.anomaly_score'),
      dataIndex: 'score',
      key: 'score',
      render: (val: number) => (
        <Tag color={val > 0.8 ? 'red' : val > 0.5 ? 'orange' : 'yellow'}>
          {(val * 100).toFixed(0)}%
        </Tag>
      ),
      sorter: (a, b) => (a.score || 0) - (b.score || 0),
    },
    {
      title: t('ai.reason'),
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: t('ai.detected_at'),
      dataIndex: 'detected_at',
      key: 'detected_at',
      render: (val?: string) => val?.substring(0, 16).replace('T', ' ') || '—',
      sorter: (a, b) => (a.detected_at || '').localeCompare(b.detected_at || ''),
    },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (val?: string) => {
        const statusColors: Record<string, string> = {
          new: 'red',
          reviewed: 'green',
          dismissed: 'default',
        };
        return <Tag color={statusColors[val || 'new']}>{val || 'new'}</Tag>;
      },
      filters: [
        { text: t('ai.status_new'), value: 'new' },
        { text: t('ai.status_reviewed'), value: 'reviewed' },
        { text: t('ai.status_dismissed'), value: 'dismissed' },
      ],
      onFilter: (value, record) => (record.status || 'new') === value,
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_, record: Anomaly) => (
        <Space size="small">
          {record.status !== 'reviewed' && (
            <Button
              size="small"
              icon={<CheckOutlined />}
              onClick={() => acknowledge(record.id)}
            >
              {t('ai.acknowledge')}
            </Button>
          )}
          {record.status !== 'dismissed' && (
            <Button
              size="small"
              danger
              icon={<CloseOutlined />}
              onClick={() => dismiss(record.id)}
            >
              {t('ai.dismiss')}
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('ai.anomalies_title')}
        subtitle={t('ai.anomalies_subtitle')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={fetchAnomalies}>
            {t('refresh')}
          </Button>
        }
      />

      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }}>
        <Space>
          <Input
            placeholder={t('search')}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder={t('ai.entity_type')}
            value={filterEntityType}
            onChange={setFilterEntityType}
            style={{ width: 150 }}
            allowClear
            options={[
              { label: 'Invoice', value: 'invoice' },
              { label: 'Bill', value: 'bill' },
              { label: 'Payment', value: 'payment' },
              { label: 'Expense', value: 'expense' },
            ]}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          <Select
            placeholder={t('status')}
            value={filterStatus}
            onChange={setFilterStatus}
            style={{ width: 150 }}
            allowClear
            options={[
              { label: t('ai.status_new'), value: 'new' },
              { label: t('ai.status_reviewed'), value: 'reviewed' },
              { label: t('ai.status_dismissed'), value: 'dismissed' },
            ]}
            filterOption={(input, option) =>
              String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
        </Space>
      </Space>

      <ListWithEmptyState
        entity="anomaly"
        data={filteredData}
        loading={loading}
        searchQuery={searchText}
        onClearSearch={() => setSearchText('')}
        onRetry={() => void fetchAnomalies()}
        render={(rows) => (
          <ResponsiveTableAdapter
            columns={columns}
            dataSource={rows}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 50, showSizeChanger: true }}
          />
        )}
      />
    </div>
  );
};

export default AnomaliesList;
