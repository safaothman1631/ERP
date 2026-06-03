import { useState, useEffect, useMemo } from 'react';
import { Select, Card, Row, Col, Statistic, Space, DatePicker, Button, Tooltip } from 'antd';
import { ReloadOutlined, UserOutlined } from '@ant-design/icons';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import dayjs, { Dayjs } from 'dayjs';
import { type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

const { RangePicker } = DatePicker;

export default function AuditLog() {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [search, setSearch] = useState('');
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

  // Kit status chip styling per action (semantic tokens, no antd <Tag color>).
  const actionChip = (a: string) => {
    if (!a) return <span style={{ color: 'var(--ink-400)' }}>—</span>;
    const palette: Record<string, { bg: string; fg: string; border: string }> = {
      create: { bg: 'var(--success-bg, var(--surface-2))', fg: 'var(--success-fg, var(--ink-700))', border: 'var(--border)' },
      update: { bg: 'var(--accent-soft)', fg: 'var(--accent-500)', border: 'var(--border)' },
      delete: { bg: 'var(--danger-bg, var(--surface-2))', fg: 'var(--danger-fg, var(--ink-700))', border: 'var(--border)' },
      view: { bg: 'var(--surface-2)', fg: 'var(--ink-600)', border: 'var(--border)' },
    };
    const c = palette[a] || palette.view;
    return (
      <span style={{
        display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
        background: c.bg, color: c.fg, border: `1px solid ${c.border}`,
        fontSize: 11.5, fontWeight: 600,
      }}>{a}</span>
    );
  };

  const methodChip = (m: string) => {
    if (!m) return <span style={{ color: 'var(--ink-400)' }}>—</span>;
    return (
      <span style={{
        display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
        fontFamily: 'var(--font-mono)',
      }}>{m}</span>
    );
  };

  const statusChip = (s: number) => {
    if (!s) return <span style={{ color: 'var(--ink-400)' }}>—</span>;
    const isOk = s < 300;
    const isRedir = s >= 300 && s < 400;
    const palette = isOk
      ? { bg: 'var(--success-bg, var(--surface-2))', fg: 'var(--success-fg, var(--ink-700))' }
      : isRedir
        ? { bg: 'var(--accent-soft)', fg: 'var(--accent-500)' }
        : { bg: 'var(--danger-bg, var(--surface-2))', fg: 'var(--danger-fg, var(--ink-700))' };
    return (
      <span style={{
        display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
        background: palette.bg, color: palette.fg, border: '1px solid var(--border)',
        fontSize: 11.5, fontWeight: 600, fontFamily: 'var(--font-mono)',
      }}>{s}</span>
    );
  };

  const columns = [
    {
      title: t('timestamp'),
      key: 'created_at',
      dataIndex: 'created_at',
      render: (d: any) => {
        const v = d?._seconds ? dayjs.unix(d._seconds) : (d ? dayjs(d) : null);
        return v
          ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v.format('YYYY-MM-DD HH:mm:ss')}</span>
          : <span style={{ color: 'var(--ink-400)' }}>—</span>;
      },
      width: 170,
    },
    {
      title: t('user'),
      key: 'user',
      render: (_: any, r: any) => {
        const label = r.user_email || r.user_name || r.user_id?.slice(0, 8) || '';
        return label
          ? (
            <span style={{ color: 'var(--ink-900)', fontWeight: 500, fontSize: 12.5 }}>{label}</span>
          )
          : <span style={{ color: 'var(--ink-400)' }}>—</span>;
      },
      width: 200,
    },
    {
      title: t('action'),
      key: 'action',
      dataIndex: 'action',
      render: (a: string) => actionChip(a),
      width: 100,
    },
    {
      title: t('method', 'Method'),
      key: 'method',
      dataIndex: 'method',
      render: (m: string) => methodChip(m),
      width: 90,
    },
    {
      title: t('entity_type'),
      key: 'entity_type',
      dataIndex: 'entity_type',
      render: (v: string) => v
        ? (
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
          }}>{v}</span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
      width: 140,
    },
    {
      title: t('path', 'Path'),
      key: 'path',
      dataIndex: 'path',
      render: (p: string) => p
        ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
      ellipsis: true,
    },
    {
      title: t('status', 'Status'),
      key: 'status_code',
      dataIndex: 'status_code',
      render: (s: number) => statusChip(s),
      width: 90,
    },
    {
      title: t('ms', 'ms'),
      key: 'duration_ms',
      dataIndex: 'duration_ms',
      render: (v: number) => v != null
        ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 600 }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
      width: 70,
    },
  ];
  const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);
  const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'created_at',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('auditLog.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  // Kit list tabs (All / Create / Update / Delete) — server-side filtered via action param.
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'create', label: t('create', 'Create') },
    { key: 'update', label: t('update', 'Update') },
    { key: 'delete', label: t('delete', 'Delete') },
  ];
  const activeTab = filterAction || 'all';

  // Active filter count for FiltersButton (entity + method + range + mineOnly; action is shown as StatusFilter).
  const activeFilterCount =
    (filterEntity ? 1 : 0) +
    (filterMethod ? 1 : 0) +
    (range ? 1 : 0) +
    (mineOnly ? 1 : 0);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ marginBottom: 16 }}>{t('audit_log')}</h2>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Card size="small"><Statistic title={t('last_30_days', 'Last 30 days')} value={stats.total_last_30_days} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t('total_all_time', 'Total all time')} value={stats.total_all_time} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small"><Statistic title={t('unique_users', 'Unique users')} value={stats.unique_users} prefix={<UserOutlined />} /></Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{t('top_action', 'Top action')}</div>
              {stats.by_action?.[0] ? (
                <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {actionChip(stats.by_action[0].action)}
                  <span style={{ color: 'var(--ink-600)', fontSize: 12.5 }}>({stats.by_action[0].count})</span>
                </div>
              ) : <span style={{ color: 'var(--ink-400)' }}>—</span>}
            </Card>
          </Col>
        </Row>
      )}

      <KitListCard
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(k) => {
          setFilterAction(k === 'all' ? undefined : k);
          setPagination(p => ({ ...p, current: 1 }));
        }}
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPagination(p => ({ ...p, current: 1 })); }}
              placeholder={t('search')}
            />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={activeFilterCount}
                onClear={() => {
                  setFilterEntity(undefined);
                  setFilterMethod(undefined);
                  setRange(null);
                  setMineOnly(false);
                  setPagination(p => ({ ...p, current: 1 }));
                }}
              >
                <Space direction="vertical" size={10} style={{ width: 260 }}>
                  <Select
                    placeholder={t('filter_entity_type')}
                    allowClear
                    style={{ width: '100%' }}
                    value={filterEntity}
                    onChange={(v) => { setFilterEntity(v); setPagination(p => ({ ...p, current: 1 })); }}
                    options={['invoices','quotes','contacts','items','expenses','bills','sales_orders','purchase_orders','rbac','l10n'].map(v => ({ label: v, value: v }))}
                  />
                  <Select
                    placeholder={t('method', 'Method')}
                    allowClear
                    style={{ width: '100%' }}
                    value={filterMethod}
                    onChange={(v) => { setFilterMethod(v); setPagination(p => ({ ...p, current: 1 })); }}
                    options={['POST','PUT','PATCH','DELETE'].map(v => ({ label: v, value: v }))}
                  />
                  <RangePicker
                    value={range as any}
                    onChange={(v) => { setRange(v as any); setPagination(p => ({ ...p, current: 1 })); }}
                    style={{ width: '100%' }}
                  />
                  <Tooltip title={t('mine_only_tip', 'Show only my actions')}>
                    <Button
                      type={mineOnly ? 'primary' : 'default'}
                      icon={<UserOutlined />}
                      onClick={() => { setMineOnly(!mineOnly); setPagination(p => ({ ...p, current: 1 })); }}
                      style={{ width: '100%' }}
                    >
                      {t('mine_only', 'Mine only')}
                    </Button>
                  </Tooltip>
                </Space>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('action', 'Action')}
                anyLabel={t('all', 'All')}
                value={filterAction || ''}
                onChange={(v) => {
                  setFilterAction(v || undefined);
                  setPagination(p => ({ ...p, current: 1 }));
                }}
                options={[
                  { value: 'create', label: t('create', 'Create') },
                  { value: 'update', label: t('update', 'Update') },
                  { value: 'delete', label: t('delete', 'Delete') },
                ]}
              />
            </div>
            <Button icon={<ReloadOutlined />} onClick={() => fetchData(1)}>{t('refresh', 'Refresh')}</Button>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                  downloadCsv('audit-log', filteredData, cols);
                }}
                onPrint={() => window.print()}
                onImport={() => message.info(t('coming_soon', 'Coming soon'))}
                onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
                onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
              />
            </div>
          </>
        }
      >
        <ResponsiveTableAdapter
          dataSource={filteredData}
          columns={visibleColumns}
          rowKey="id"
          loading={loading}
          pagination={{ ...pagination, onChange: fetchData, showSizeChanger: false }}
          size="small"
          scroll={{ x: 1200 }}
        />
      </KitListCard>
    </div>
  );
}
