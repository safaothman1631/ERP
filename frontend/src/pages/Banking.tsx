import React, { useEffect, useState } from 'react';
import { Tabs, Button, Upload, Select, Space } from 'antd';
import { message } from '../utils/message';
import { UploadOutlined, LinkOutlined, SettingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useListQuery } from '../api/queries/useListQuery';
import { listQueryKeys } from '../api/queries/keys';
import { PageHeader, StatusTag, SectionCard } from '../design-system';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

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

  useEffect(() => {
    if (bankAccountsQuery.error) {
      message.error(t('error'));
    }
  }, [bankAccountsQuery.error, t]);

  const columns = [
    { title: t('name'), dataIndex: 'account_name', key: 'account_name' },
    { title: t('banking'), dataIndex: 'bank_name', key: 'bank_name' },
    { title: '#', dataIndex: 'account_number', key: 'account_number' },
    {
      title: t('status'), dataIndex: 'account_type', key: 'account_type',
      render: (v: string) => <StatusTag status={v === 'bank' ? 'info' : v === 'cash' ? 'success' : 'warning'} label={v} />,
    },
    { title: t('currency'), dataIndex: 'currency_code', key: 'currency_code' },
    { title: t('balance_due'), dataIndex: 'balance', key: 'balance', render: (v: number) => (v || 0).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16, gap: 8 }}>
        <Button icon={<LinkOutlined />} onClick={() => navigate('/banking/reconciliation')}>{t('reconciliation')}</Button>
        <Button icon={<SettingOutlined />} onClick={() => navigate('/banking/rules')}>{t('bankRules')}</Button>
      </div>
      <ResponsiveTableAdapter dataSource={accounts} columns={columns} rowKey="id" loading={loading} pagination={false} />
    </div>
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
