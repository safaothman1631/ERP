import { useState, useEffect, useMemo } from 'react';
import { Table, Select, Tag, Card, Row, Col, Statistic, Space, DatePicker, Button, Tooltip } from 'antd';
import { ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs, { Dayjs } from 'dayjs';
import { ColumnVisibility, type ColumnVisibilityItem, ExportMenu, type ExportFormat } from '../design-system';
import { downloadCsv } from '../utils/exportCsv';
import { useAuthStore } from '../store';

const { RangePicker } = DatePicker;

export default function AuditLog() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filterEntity, setFilterEntity] = useState<string | undefined>();
  const [filterAction, setFilterAction] = useState<string | undefined>();
  const [filterMethod, setFilterMethod] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [mineOnly, setMineOnly] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('auditLog.hiddenCols') || '[]'); } catch { return []; }
  });
  const isDark = useAuthStore((s) => s.theme === 'dark');

  const fetchData = async (page = 1) => {
    setLoading(true);
    try {
      const params: any = { page, page_size: pagination.pageSize };
      if (filterEntity) params.entity_type = filterEntity;
      if (filterAction) params.action = filterAction;
      if (filterMethod) params.method = filterMethod;
      if (mineOnly) params.mine_only = true;
      if (range) {
        params.date_from = range[0].format('YYYY-MM-DD');
        params.date_to = range[1].format('YYYY-MM-DD');
      }
      const res = await api.get('/api/audit', { params });
      setData(res.data.items || []);
      setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  const fetchStats = async () => {
    try {
      const res = await api.get('/api/audit/stats');
      setStats(res.data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchData(); fetchStats(); }, [filterEntity, filterAction, filterMethod, range, mineOnly]);

  const actionColors: Record<string, string> = {
    create: 'green', update: 'blue', delete: 'red', view: 'default',
  };
  const methodColors: Record<string, string> = {
    POST: 'green', PUT: 'blue', PATCH: 'cyan', DELETE: 'red', GET: 'default',
  };

  const columns = [
    {
      title: t('timestamp'),
      key: 'created_at',
      dataIndex: 'created_at',
      render: (d: any) => {
        const v = d?._seconds ? dayjs.unix(d._seconds) : (d ? dayjs(d) : null);
        return v ? v.format('YYYY-MM-DD HH:mm:ss') : '-';
      },
      width: 170,
    },
    {
      title: t('user'),
      key: 'user',
      render: (_: any, r: any) => r.user_email || r.user_name || <span style={{ color: '#aaa' }}>{r.user_id?.slice(0, 8) || '-'}</span>,
      width: 200,
    },
    {
      title: t('action'),
      key: 'action',
      dataIndex: 'action',
      render: (a: string) => a ? <Tag color={actionColors[a] || 'default'}>{a}</Tag> : '-',
      width: 90,
    },
    {
      title: 'Method',
      key: 'method',
      dataIndex: 'method',
      render: (m: string) => m ? <Tag color={methodColors[m] || 'default'}>{m}</Tag> : '-',
      width: 80,
    },
    {
      title: t('entity_type'),
      key: 'entity_type',
      dataIndex: 'entity_type',
      width: 140,
    },
    {
      title: t('path') || 'Path',
      key: 'path',
      dataIndex: 'path',
      render: (p: string) => <code style={{ fontSize: 11 }}>{p}</code>,
      ellipsis: true,
    },
    {
      title: 'Status',
      key: 'status_code',
      dataIndex: 'status_code',
      render: (s: number) => {
        if (!s) return '-';
        const color = s < 300 ? 'green' : s < 400 ? 'blue' : 'red';
        return <Tag color={color}>{s}</Tag>;
      },
      width: 80,
    },
    {
      title: 'ms',
      key: 'duration_ms',
      dataIndex: 'duration_ms',
      render: (v: number) => v != null ? `${v}` : '-',
      width: 60,
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'created_at',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('auditLog.hiddenCols', JSON.stringify(next)); } catch {}
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>{t('audit_log')}</h2>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small"><Statistic title={t('last_30_days') || 'Last 30 days'} value={stats.total_last_30_days} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t('total_all_time') || 'Total all time'} value={stats.total_all_time} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t('unique_users') || 'Unique users'} value={stats.unique_users} prefix={<UserOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: '#888' }}>{t('top_action') || 'Top action'}</div>
              {stats.by_action?.[0] ? (
                <Tag color="blue" style={{ fontSize: 14 }}>
                  {stats.by_action[0].action} ({stats.by_action[0].count})
                </Tag>
              ) : '-'}
            </Card>
          </Col>
        </Row>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder={t('filter_entity_type')}
            allowClear
            style={{ width: 180 }}
            value={filterEntity}
            onChange={setFilterEntity}
            options={['invoices','quotes','contacts','items','expenses','bills','sales_orders','purchase_orders','rbac','l10n'].map(v => ({ label: v, value: v }))}
          />
          <Select
            placeholder={t('action')}
            allowClear
            style={{ width: 140 }}
            value={filterAction}
            onChange={setFilterAction}
            options={['create','update','delete'].map(v => ({ label: v, value: v }))}
          />
          <Select
            placeholder="Method"
            allowClear
            style={{ width: 120 }}
            value={filterMethod}
            onChange={setFilterMethod}
            options={['POST','PUT','PATCH','DELETE'].map(v => ({ label: v, value: v }))}
          />
          <RangePicker value={range as any} onChange={(v) => setRange(v as any)} />
          <Tooltip title={t('mine_only_tip') || 'Show only my actions'}>
            <Button
              type={mineOnly ? 'primary' : 'default'}
              icon={<UserOutlined />}
              onClick={() => setMineOnly(!mineOnly)}
            >
              {t('mine_only') || 'Mine only'}
            </Button>
          </Tooltip>
          <Button icon={<ReloadOutlined />} onClick={() => fetchData(1)}>{t('refresh') || 'Refresh'}</Button>
          <ExportMenu
            formats={['csv']}
            onExport={(f: ExportFormat) => {
              if (f === 'csv') {
                const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                downloadCsv('audit-log', data, cols);
              }
            }}
          />
          <ColumnVisibility columns={columnsMeta} hidden={hiddenCols} onChange={persistHidden} isDark={isDark} />
        </Space>
      </Card>

      <Table
        dataSource={data}
        columns={visibleColumns}
        rowKey="id"
        loading={loading}
        pagination={{ ...pagination, onChange: fetchData, showSizeChanger: false }}
        size="small"
        scroll={{ x: 1200 }}
      />
    </div>
  );
}
