import React, { useEffect, useMemo, useState } from 'react';
import { Tabs, Button, Upload, Select, Space, Radio } from 'antd';
import { message } from '../utils/message';
import { UploadOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import { PageHeader, StatusTag, SectionCard, type ColumnVisibilityItem } from '../design-system';
import KitListCard, { type KitListTab } from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitStatusFilter from '../design-system/KitStatusFilter';
import KitSearchInput from '../design-system/KitSearchInput';
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

const Banking: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader title={t('banking')} subtitle={t('banking_subtitle', 'Manage bank accounts and payments')} helpKey="banking" sectionId="banking" />
      <Tabs defaultActiveKey="accounts" items={[
        { key: 'accounts', label: t('accounts'), children: <BankAccounts /> },
        { key: 'import', label: t('importCSV'), children: <ImportCSV /> },
      ]} />
    </div>
  );
};

const BankAccounts: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('banking.hiddenCols') || '[]'); } catch { return []; }
  });
  const bankAccountsQuery = useListQuery<any, any>({
    queryKey: listQueryKeys.banking({ scope: 'accounts' }),
    queryFn: () => api.get('/api/banking/accounts'),
    selectList: (raw) => {
      if (Array.isArray(raw)) return { items: raw, total: raw.length };
      const list = Array.isArray(raw?.items) ? raw.items : [];
      return { items: list, total: typeof raw?.total === 'number' ? raw.total : list.length };
    },
  });
  const accounts = bankAccountsQuery.data?.items ?? [];
  const loading = bankAccountsQuery.isLoading || bankAccountsQuery.isFetching;

  // Presentation-only client filter on account_type (endpoint takes no params).
  const data = useMemo(
    () => (typeFilter === 'all' ? accounts : accounts.filter((a: any) => a.account_type === typeFilter)),
    [accounts, typeFilter],
  );
  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  useEffect(() => {
    if (bankAccountsQuery.error) {
      message.error(t('error'));
    }
  }, [bankAccountsQuery.error, t]);

  // Kit list tabs — by account type (client-side segment).
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'bank', label: t('bank_account', 'Bank') },
    { key: 'cash', label: t('cash', 'Cash') },
    { key: 'credit_card', label: t('credit_card', 'Credit card') },
  ];
  const typeOptions = [
    { value: 'bank', label: t('bank_account', 'Bank') },
    { value: 'cash', label: t('cash', 'Cash') },
    { value: 'credit_card', label: t('credit_card', 'Credit card') },
  ];

  const allColumns = [
    {
      title: t('name'), dataIndex: 'account_name', key: 'account_name',
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
      title: t('banking'), dataIndex: 'bank_name', key: 'bank_name',
      render: (v: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: '#', dataIndex: 'account_number', key: 'account_number',
      render: (v: string) => v
        ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500 }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('status'), dataIndex: 'account_type', key: 'account_type',
      render: (v: string) => <StatusTag status={v === 'bank' ? 'info' : v === 'cash' ? 'success' : 'warning'} label={v} />,
    },
    {
      title: t('currency'), dataIndex: 'currency_code', key: 'currency_code',
      render: (v: string) => v
        ? <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
          }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('balance_due'), dataIndex: 'balance', key: 'balance',
      render: (v: number) => (
        <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{(v || 0).toLocaleString()}</span>
      ),
    },
  ];
  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'account_name',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('banking.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <KitListCard
      tabs={tabs}
      activeTab={typeFilter}
      onTabChange={(k) => setTypeFilter(k)}
      toolbar={
        <>
          <KitSearchInput
            value={search}
            onChange={(v) => setSearch(v)}
            placeholder={t('search')}
          />
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <KitFiltersButton
              activeCount={typeFilter !== 'all' ? 1 : 0}
              onClear={() => setTypeFilter('all')}
            >
              <Radio.Group
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
              >
                <Radio value="all">{t('all', 'All')}</Radio>
                {typeOptions.map((o) => (
                  <Radio key={o.value} value={o.value}>{o.label}</Radio>
                ))}
              </Radio.Group>
            </KitFiltersButton>
            <KitStatusFilter
              label={t('type', 'Type')}
              anyLabel={t('all', 'All')}
              value={typeFilter === 'all' ? '' : typeFilter}
              onChange={(v) => setTypeFilter(v || 'all')}
              options={typeOptions}
            />
          </div>
          <div style={{ marginInlineStart: 'auto' }}>
            <Space size={8}>
              <Button icon={<LinkOutlined />} onClick={() => navigate('/banking/reconciliation')}>{t('reconciliation')}</Button>
              <Button icon={<SettingOutlined />} onClick={() => navigate('/banking/rules')}>{t('bankRules')}</Button>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                  downloadCsv('banking-accounts', filteredData, cols);
                }}
                onPrint={() => window.print()}
                onImport={() => message.info(t('coming_soon', 'Coming soon'))}
                onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
                onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
              />
            </Space>
          </div>
        </>
      }
    >
      <ResponsiveTableAdapter dataSource={filteredData} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </KitListCard>
  );
};

const ImportCSV: React.FC = () => {
  const { t } = useTranslation();
  const bankAccountsQuery = useListQuery<any, any>({
    queryKey: listQueryKeys.banking({ scope: 'accounts-import' }),
    queryFn: () => api.get('/api/banking/accounts'),
    selectList: (raw) => {
      if (Array.isArray(raw)) return { items: raw, total: raw.length };
      const list = Array.isArray(raw?.items) ? raw.items : [];
      return { items: list, total: typeof raw?.total === 'number' ? raw.total : list.length };
    },
  });
  const accounts = bankAccountsQuery.data?.items ?? [];
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [fileData, setFileData] = useState<any[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [_uploading, _setUploading] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (bankAccountsQuery.error) {
      message.error(t('error'));
    }
  }, [bankAccountsQuery.error, t]);

  const systemFields = ['date', 'description', 'amount', 'reference'];

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const rows = text.split('\n').filter(r => r.trim());
      if (rows.length < 2) return;
      const headers = rows[0].split(',').map(h => h.trim().replace(/"/g, ''));
      setCsvColumns(headers);
      const parsedData = rows.slice(1, Math.min(rows.length, 20)).map((row, idx) => {
        const values = row.split(',').map(v => v.trim().replace(/"/g, ''));
        const obj: Record<string, string> = { key: String(idx) };
        headers.forEach((h, i) => { obj[h] = values[i] || ''; });
        return obj;
      });
      setFileData(parsedData);
      // auto-map matching columns
      const autoMap: Record<string, string> = {};
      headers.forEach(h => {
        const lower = h.toLowerCase();
        if (lower.includes('date')) autoMap['date'] = h;
        else if (lower.includes('desc') || lower.includes('memo')) autoMap['description'] = h;
        else if (lower.includes('amount') || lower.includes('sum')) autoMap['amount'] = h;
        else if (lower.includes('ref')) autoMap['reference'] = h;
      });
      setColumnMap(autoMap);
    };
    reader.readAsText(file);
    return false; // prevent auto upload
  };

  const handleImport = async () => {
    if (!selectedAccount) { message.warning(t('select') + ' ' + t('account')); return; }
    setImporting(true);
    try {
      await api.post(`/api/banking/accounts/${selectedAccount}/import`, {
        column_map: columnMap,
        data: fileData.map(row => {
          const mapped: Record<string, string> = {};
          Object.entries(columnMap).forEach(([sysField, csvCol]) => { mapped[sysField] = row[csvCol] || ''; });
          return mapped;
        }),
      });
      message.success(t('success'));
      setFileData([]);
      setCsvColumns([]);
    } catch {
      message.error(t('error'));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <Space size="large" wrap style={{ marginBottom: 16 }}>
        <Select
          placeholder={t('account')}
          value={selectedAccount || undefined}
          onChange={setSelectedAccount}
          style={{ width: 250 }}
          options={accounts.map((a: any) => ({ label: a.account_name, value: a.id }))}
        />
        <Upload beforeUpload={handleFileUpload} accept=".csv" showUploadList={false}>
          <Button icon={<UploadOutlined />}>{t('importCSV')}</Button>
        </Upload>
      </Space>

      {csvColumns.length > 0 && (
        <SectionCard title={t('column_mapping')} style={{ marginBottom: 16 }}>
          <Space wrap>
            {systemFields.map(sf => (
              <div key={sf} style={{ marginBottom: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink-700)' }}>{t(sf)}</div>
                <Select
                  style={{ width: 180 }}
                  value={columnMap[sf]}
                  onChange={v => setColumnMap(prev => ({ ...prev, [sf]: v }))}
                  options={csvColumns.map(c => ({ label: c, value: c }))}
                  allowClear
                />
              </div>
            ))}
          </Space>
        </SectionCard>
      )}

      {fileData.length > 0 && (
        <>
          <ResponsiveTableAdapter
            dataSource={fileData}
            columns={csvColumns.map(c => ({ title: c, dataIndex: c, key: c }))}
            rowKey="key"
            pagination={false}
            size="small"
            scroll={{ x: 'max-content' }}
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" onClick={handleImport} loading={importing}>{t('confirm')}</Button>
        </>
      )}
    </div>
  );
};

export default Banking;
