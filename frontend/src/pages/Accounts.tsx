import React, { useEffect, useMemo, useState } from 'react';
import { Radio } from 'antd';
import { message } from '../utils/message';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitSearchInput from '../design-system/KitSearchInput';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const Accounts: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  // `type` is wired to the backend's real `account_type` query param ('' = all).
  const [type, setType] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('accounts.hiddenCols') || '[]'); } catch { return []; }
  });

  // Same fetch as before; just forwards the kit's status/tab selection to the
  // server's existing `account_type` filter (re-runs when the type changes).
  useEffect(() => {
    setLoading(true);
    api
      .get('/api/accounts', { params: type ? { account_type: type } : {} })
      .then(r => setData(Array.isArray(r.data) ? r.data : (r.data.items || [] || [])))
      .catch(() => message.error(t('error')))
      .finally(() => setLoading(false));
  }, [type]);

  // Map accounting account types → kit StatusTag semantic kinds (token-driven, auto-flip).
  const typeStatus: Record<string, StatusKind> = {
    asset: 'info', fixed_asset: 'info', other_asset: 'info',
    liability: 'error', other_liability: 'error',
    equity: 'open', income: 'success',
    expense: 'warning', cost_of_goods_sold: 'warning',
  };

  // Real account_type values supported by the backend filter.
  const typeOptions = [
    { value: 'asset', label: t('asset', 'Asset') },
    { value: 'liability', label: t('liability', 'Liability') },
    { value: 'equity', label: t('equity', 'Equity') },
    { value: 'income', label: t('income', 'Income') },
    { value: 'expense', label: t('expense', 'Expense') },
  ];

  // Kit list tabs (All + each account_type) — wired to the server filter.
  const tabs: KitListTab[] = [
    { key: '', label: t('all', 'All') },
    ...typeOptions.map((o) => ({ key: o.value, label: o.label })),
  ];

  // Client-side search over the loaded rows (backend exposes no search param).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((a) =>
      String(a.code ?? '').toLowerCase().includes(q) ||
      String(a.name ?? '').toLowerCase().includes(q)
    );
  }, [data, search]);

  const allColumns = [
    {
      title: t('account'), dataIndex: 'code', key: 'code',
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
      ),
    },
    {
      title: t('name'), dataIndex: 'name', key: 'name',
      render: (v: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-soft)', color: 'var(--accent-500)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700,
          }}>{initialsOf(v)}</span>
          <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
        </div>
      ),
    },
    {
      title: t('type', 'Type'), dataIndex: 'account_type', key: 'account_type',
      render: (v: string) => <StatusTag status={typeStatus[v] || 'default'} label={t(v, v)} />,
    },
    {
      title: t('balance_due'), dataIndex: 'balance', key: 'balance',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
          {(v || 0).toLocaleString()} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span>
        </span>
      ),
    },
  ];
  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'code' || c.key === 'name',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('accounts.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div>
      <PageHeader title={t('chart_of_accounts', t('accounts'))} subtitle={t('coa_subtitle', 'Chart of accounts')} helpKey="reports" sectionId="accounting.accounts" />
      <KitListCard
        tabs={tabs}
        activeTab={type}
        onTabChange={(k) => setType(k)}
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => setSearch(v)}
              placeholder={t('search')}
            />
            {/* Group Filters + Type in a single flex unit so they ALWAYS wrap
                together to the same line — never one stranded on a row by itself. */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={type ? 1 : 0}
                onClear={() => setType('')}
              >
                <Radio.Group
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <Radio value="">{t('all', 'All')}</Radio>
                  {typeOptions.map((o) => (
                    <Radio key={o.value} value={o.value}>{o.label}</Radio>
                  ))}
                </Radio.Group>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('type', 'Type')}
                anyLabel={t('all', 'All')}
                value={type}
                onChange={(v) => setType(v)}
                options={typeOptions}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                  downloadCsv('accounts', filtered, cols);
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
        <ResponsiveTableAdapter dataSource={filtered} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </KitListCard>
    </div>
  );
};

export default Accounts;
