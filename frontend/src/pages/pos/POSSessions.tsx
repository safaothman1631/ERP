import React, { useEffect, useMemo, useState } from 'react';
import { Button, Tag, Space, Select, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../../api';
import { message } from '../../utils/message';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../../design-system';
import { downloadCsv } from '../../utils/exportCsv';
import { useAuthStore } from '../../store';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Title } = Typography;

const statusColors: Record<string, string> = {
  opening: 'blue',
  opened: 'green',
  closing: 'orange',
  closed: 'default',
};

const POSSessions: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stateFilter, setStateFilter] = useState('');
  const [configFilter, setConfigFilter] = useState('');
  const [configs, setConfigs] = useState<any[]>([]);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('posSessions.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 25 };
      if (stateFilter) params.state = stateFilter;
      if (configFilter) params.config_id = configFilter;
      
      const res = await api.get('/api/pos/sessions', { params });
      setData(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/api/pos/configs', { params: { page_size: 100 } });
      setConfigs(res.data.items || []);
    } catch {}
  };

  useEffect(() => {
    fetchData();
  }, [page, stateFilter, configFilter]);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const columns = [
    {
      title: t('pos.config'),
      dataIndex: 'config_name',
      key: 'config_name',
    },
    {
      title: t('pos.cashier'),
      dataIndex: 'cashier_name',
      key: 'cashier_name',
    },
    {
      title: t('pos.opened_at'),
      dataIndex: 'opened_at',
      key: 'opened_at',
      render: (date: string) => formatDate(date),
    },
    {
      title: t('pos.closed_at'),
      dataIndex: 'closed_at',
      key: 'closed_at',
      render: (date: string) => date ? formatDate(date) : '-',
    },
    {
      title: t('pos.total_sales'),
      dataIndex: 'total_sales',
      key: 'total_sales',
      render: (val: number) => formatCurrency(val || 0),
    },
    {
      title: t('pos.orders'),
      dataIndex: 'total_orders',
      key: 'total_orders',
    },
    {
      title: t('status'),
      dataIndex: 'state',
      key: 'state',
      render: (state: string) => (
        <Tag color={statusColors[state]}>{t(`pos.state_${state}`)}</Tag>
      ),
    },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            size="small"
            onClick={() => navigate(`/pos/sessions/${record.id}`)}
          >
            {t('view')}
          </Button>
          {record.state === 'opened' && (
            <Button
              icon={<PlayCircleOutlined />}
              type="primary"
              size="small"
              onClick={() => navigate(`/pos/terminal/${record.id}`)}
            >
              {t('pos.resume')}
            </Button>
          )}
        </Space>
      ),
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'config_name' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('posSessions.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2}>{t('pos.sessions')}</Title>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <Select
          placeholder={t('pos.config')}
          value={configFilter || undefined}
          onChange={v => { setConfigFilter(v || ''); setPage(1); }}
          allowClear
          style={{ width: 200 }}
        >
          {configs.map(cfg => (
            <Select.Option key={cfg.id} value={cfg.id}>
              {cfg.name_ku || cfg.name}
            </Select.Option>
          ))}
        </Select>
        <Select
          placeholder={t('status')}
          value={stateFilter || undefined}
          onChange={v => { setStateFilter(v || ''); setPage(1); }}
          allowClear
          style={{ width: 150 }}
        >
          <Select.Option value="opened">{t('pos.state_opened')}</Select.Option>
          <Select.Option value="closed">{t('pos.state_closed')}</Select.Option>
        </Select>
        <ExportMenu
          formats={['csv']}
          onExport={(f: ExportFormat) => {
            if (f === 'csv') {
              const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
              downloadCsv('pos-sessions', data, cols);
            }
          }}
        />
        <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
      </div>

      <ResponsiveTableAdapter
        dataSource={data}
        columns={visibleColumns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          total,
          pageSize: 25,
          onChange: setPage,
        }}
      />
    </div>
  );
};

export default POSSessions;
