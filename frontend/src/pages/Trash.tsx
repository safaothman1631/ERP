import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Button,
  Space,
  Tag,
  Popconfirm,
  Select,
  Typography,
  Statistic,
  Row,
  Col,
  Empty,
  message as antMessage } from 'antd';
import {
  DeleteOutlined,
  UndoOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import HelpButton from '../components/HelpButton';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const { Title, Text } = Typography;

interface TrashItem {
  id: string;
  _collection: string;
  name?: string;
  number?: string;
  contact_name?: string;
  deleted_at?: string;
  [key: string]: any;
}

interface TrashStat {
  collection: string;
  key: string;
  label: string;
  count: number;
}

const Trash: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [stats, setStats] = useState<TrashStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [collection, setCollection] = useState<string | undefined>(undefined);
  const [retentionDays, setRetentionDays] = useState(30);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page: 1, page_size: 200 };
      if (collection) params.collection = collection;
      const [listRes, statsRes] = await Promise.all([
        api.get('/api/trash', { params }),
        api.get('/api/trash/stats'),
      ]);
      setItems(listRes.data.items || []);
      setRetentionDays(listRes.data.retention_days || 30);
      setStats(statsRes.data.stats || []);
    } catch (err: any) {
      antMessage.error(err?.response?.data?.detail || t('error'));
    } finally {
      setLoading(false);
    }
  }, [collection, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRestore = async (item: TrashItem) => {
    try {
      await api.post(`/api/trash/restore/${item._collection}/${item.id}`);
      antMessage.success(t('restored_successfully'));
      void load();
    } catch (err: any) {
      antMessage.error(err?.response?.data?.detail || t('error'));
    }
  };

  const handlePermanentDelete = async (item: TrashItem) => {
    try {
      await api.delete(`/api/trash/permanent/${item._collection}/${item.id}`);
      antMessage.success(t('deleted_permanently'));
      void load();
    } catch (err: any) {
      antMessage.error(err?.response?.data?.detail || t('error'));
    }
  };

  const totalCount = stats.reduce((acc, s) => acc + s.count, 0);

  const columns = [
    {
      title: t('section'),
      dataIndex: '_collection',
      key: '_collection',
      width: 140,
      render: (col: string) => <Tag color="blue">{col}</Tag>,
    },
    {
      title: t('name'),
      key: 'name',
      render: (_: any, item: TrashItem) =>
        item.name || item.number || item.contact_name || item.id,
    },
    {
      title: t('deleted_at'),
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      width: 200,
      render: (val: any) => {
        if (!val) return '-';
        const d = typeof val === 'string' ? new Date(val) : new Date(val);
        return d.toLocaleString();
      },
    },
    {
      title: t('actions'),
      key: 'actions',
      width: 240,
      render: (_: any, item: TrashItem) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<UndoOutlined />}
            onClick={() => handleRestore(item)}
          >
            {t('restore')}
          </Button>
          <Popconfirm
            title={t('confirm_permanent_delete')}
            description={t('action_irreversible')}
            okText={t('delete_forever')}
            cancelText={t('cancel')}
            okButtonProps={{ danger: true }}
            onConfirm={() => handlePermanentDelete(item)}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>
              {t('delete_forever')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <DeleteOutlined /> {t('trash')}
        </Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load}>
            {t('refresh')}
          </Button>
          <HelpButton pageKey="trash" />
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title={t('total_in_trash')} value={totalCount} />
          </Card>
        </Col>
        <Col xs={24} sm={16}>
          <Card>
            <Text type="secondary">{t('retention_notice', { days: retentionDays })}</Text>
          </Card>
        </Col>
      </Row>

      <Card
        title={t('deleted_items')}
        extra={
          <Select
            allowClear
            placeholder={t('filter_by_section')}
            style={{ minWidth: 200 }}
            value={collection}
            onChange={(v) => setCollection(v)}
            options={stats.map((s) => ({
              label: `${s.label} (${s.count})`,
              value: s.collection,
            }))}
          />
        }
      >
        {items.length === 0 && !loading ? (
          <Empty description={t('trash_empty')} />
        ) : (
          <ResponsiveTableAdapter
            rowKey={(r) => `${r._collection}-${r.id}`}
            dataSource={items}
            columns={columns}
            loading={loading}
            pagination={{ pageSize: 20 }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>
    </div>
  );
};

export default Trash;
