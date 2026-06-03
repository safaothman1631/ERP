/**
 * KitPreview — a PUBLIC (no-login) visual harness for the Vertex kit list
 * composition. It renders the EXACT five shared components every converted list
 * page uses (KitListCard, KitFiltersButton, KitStatusFilter, KitListToolbarActions,
 * KitRowActions) + a sample table with the kit cell styles, in light AND dark.
 *
 * Because every list page is built from these same shared components, verifying
 * THIS page once verifies the look of all of them — no authentication required.
 * Route: /kit-preview (registered as a public sibling of /vertex).
 */
import React, { useMemo, useState } from 'react';
import { Table, Input, Radio } from 'antd';
import { SearchOutlined, EyeOutlined, EditOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useAuthStore } from '../store';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';

const initialsOf = (name: string): string =>
  String(name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

interface Row {
  id: string; display_name: string; contact_type: string;
  email: string; phone: string; amount: number; status: string;
}

const ALL_ROWS: Row[] = [
  { id: '1', display_name: 'Al-Rafidain Trading', contact_type: 'customer', email: 'info@rafidain.iq', phone: '+9647701234567', amount: 9840000, status: 'active' },
  { id: '2', display_name: 'Zagros Foods LLC', contact_type: 'vendor', email: 'sales@zagros.iq', phone: '+9647505551212', amount: 6420000, status: 'active' },
  { id: '3', display_name: 'Tigris Electronics', contact_type: 'customer', email: 'hello@tigris.iq', phone: '+9647712223344', amount: 3110000, status: 'overdue' },
  { id: '4', display_name: 'Babylon Hardware', contact_type: 'lead', email: '', phone: '+9647809998877', amount: 1280000, status: 'pending' },
  { id: '5', display_name: 'Erbil Motors', contact_type: 'customer', email: 'contact@erbilmotors.iq', phone: '+9647501119900', amount: 7560000, status: 'active' },
  { id: '6', display_name: 'Mosul Textiles', contact_type: 'vendor', email: 'orders@mosultex.iq', phone: '+9647704445566', amount: 2090000, status: 'draft' },
];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: 'color-mix(in srgb, var(--success-500) 14%, transparent)', fg: 'var(--success-600, var(--success-500))' },
  overdue: { bg: 'color-mix(in srgb, var(--danger-500) 14%, transparent)', fg: 'var(--danger-500)' },
  pending: { bg: 'color-mix(in srgb, var(--warning-500) 16%, transparent)', fg: 'var(--warning-600, var(--warning-500))' },
  draft: { bg: 'var(--surface-2)', fg: 'var(--ink-500)' },
};

const StatusChip: React.FC<{ status: string }> = ({ status }) => {
  const c = STATUS_COLORS[status] ?? STATUS_COLORS.draft;
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, background: c.bg, color: c.fg, fontSize: 11.5, fontWeight: 600, textTransform: 'capitalize' }}>
      {status}
    </span>
  );
};

const KitPreview: React.FC = () => {
  // Drive the REAL app theme store so AntD's algorithm AND the data-theme token
  // attribute stay in sync (exactly like the authenticated app). Toggling only
  // data-theme would desync AntD and mis-render form controls (e.g. checkboxes).
  const { theme, toggleTheme } = useAuthStore();
  const dark = theme === 'dark';
  const [tab, setTab] = useState<'all' | 'customer' | 'vendor' | 'lead'>('all');
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>([]);

  const data = useMemo(() => ALL_ROWS.filter((r) => {
    if (tab !== 'all' && r.contact_type !== tab) return false;
    if (search && !`${r.display_name} ${r.email}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tab, search]);

  const tabs: KitListTab[] = [
    { key: 'all', label: 'All' },
    { key: 'customer', label: 'Customers' },
    { key: 'vendor', label: 'Vendors' },
    { key: 'lead', label: 'Leads' },
  ];

  const allColumns = [
    {
      title: 'Name', dataIndex: 'display_name', key: 'display_name',
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: 'var(--accent-soft)', color: 'var(--accent-500)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>{initialsOf(v)}</span>
          <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'contact_type', key: 'contact_type',
      render: (v: string) => (
        <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)', background: 'var(--surface-2)', border: '1px solid var(--border)', fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)', textTransform: 'capitalize' }}>{v}</span>
      ),
    },
    {
      title: 'Email', dataIndex: 'email', key: 'email',
      render: (v: string) => v
        ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: 'Phone', dataIndex: 'phone', key: 'phone',
      render: (v: string) => <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>,
    },
    {
      title: 'Balance', dataIndex: 'amount', key: 'amount', align: 'end' as const,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {v.toLocaleString('en-US')} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
        </span>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (v: string) => <StatusChip status={v} />,
    },
    {
      title: '', key: 'actions', width: 56, align: 'center' as const,
      render: (_: unknown, record: Row) => (
        <KitRowActions
          ariaLabel="Actions"
          actions={[
            { key: 'view', icon: <EyeOutlined />, label: 'View', onClick: () => {} },
            { key: 'edit', icon: <EditOutlined />, label: 'Edit', onClick: () => {} },
            { key: 'duplicate', icon: <CopyOutlined />, label: 'Duplicate', onClick: () => {} },
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: 'Delete', danger: true, onClick: () => { void record; } },
          ]}
        />
      ),
    },
  ];
  const columns = allColumns.filter((c) => !hiddenCols.includes(c.key));
  const columnsMeta = allColumns
    .filter((c) => c.key !== 'actions')
    .map((c) => ({ key: c.key, label: typeof c.title === 'string' && c.title ? c.title : c.key, pinned: c.key === 'display_name' }));

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: 24 }}>
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--ink-900)', letterSpacing: '-0.02em' }}>Kit list preview</div>
            <div style={{ fontSize: 13, color: 'var(--ink-500)', marginTop: 2 }}>The exact shared components every list page uses · no login required</div>
          </div>
          <button
            onClick={() => toggleTheme()}
            style={{ height: 36, padding: '0 16px', borderRadius: 'var(--radius-md, 8px)', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--ink-900)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            {dark ? '☀ Light' : '🌙 Dark'}
          </button>
        </div>

        <KitListCard
          tabs={tabs}
          activeTab={tab}
          onTabChange={(k) => setTab(k as typeof tab)}
          toolbar={(
            <>
              <Input prefix={<SearchOutlined />} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: 260 }} allowClear />
              <KitFiltersButton activeCount={tab !== 'all' ? 1 : 0} onClear={() => setTab('all')}>
                <Radio.Group value={tab} onChange={(e) => setTab(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Radio value="all">All</Radio>
                  <Radio value="customer">Customers</Radio>
                  <Radio value="vendor">Vendors</Radio>
                  <Radio value="lead">Leads</Radio>
                </Radio.Group>
              </KitFiltersButton>
              <KitStatusFilter
                label="Type"
                anyLabel="All"
                value={tab === 'all' ? '' : tab}
                onChange={(v) => setTab((v || 'all') as typeof tab)}
                options={[{ value: 'customer', label: 'Customers' }, { value: 'vendor', label: 'Vendors' }, { value: 'lead', label: 'Leads' }]}
              />
              <div style={{ marginInlineStart: 'auto' }}>
                <KitListToolbarActions
                  columns={columnsMeta}
                  hiddenCols={hiddenCols}
                  onColumnsChange={setHiddenCols}
                  onExport={() => {}}
                  onPrint={() => {}}
                  onImport={() => {}}
                  onSavedViews={() => {}}
                  onArchive={() => {}}
                />
              </div>
            </>
          )}
        >
          <Table
            dataSource={data}
            columns={columns}
            rowKey="id"
            pagination={{ current: 1, total: data.length, pageSize: 20 }}
            rowSelection={{ selectedRowKeys: [], onChange: () => {} }}
          />
        </KitListCard>
      </div>
    </div>
  );
};

export default KitPreview;
