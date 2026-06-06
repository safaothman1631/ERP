import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Typography, Space, Empty } from 'antd';
import { message } from '../../utils/message';
import { ArrowLeftOutlined, InboxOutlined, CloudUploadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitSearchInput from '../../design-system/KitSearchInput';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { downloadCsv } from '../../utils/exportCsv';

const { Text } = Typography;

interface ImportRecord {
  id: string;
  date: string;
  format: string;
  imported_count: number;
  skipped_count: number;
  created_by: string;
}

const BankImportHistory: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();

  const [data, setData] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('bankImportHistory.hiddenCols') || '[]'); } catch { return []; }
  });

  const filteredData = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
  }, [data, search]);

  useEffect(() => {
    fetchHistory();
  }, [accountId]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Note: This endpoint doesn't exist yet in backend, but we can display
      // a placeholder or fetch transactions filtered by created_at
      // For now, show empty state
      setData([]);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  // Kit cells (tokens only) — mono date/author, kept StatusTag for format, semantic counts.
  const allColumns = [
    {
      title: t('date'),
      dataIndex: 'date',
      key: 'date',
      render: (d: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{d?.substring(0, 10)}</span>
      ),
    },
    {
      title: t('format'),
      dataIndex: 'format',
      key: 'format',
      render: (f: string) => <StatusTag status="info" label={f.toUpperCase()} />,
    },
    {
      title: t('imported'),
      dataIndex: 'imported_count',
      key: 'imported',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--success-fg)' }}>{v}</span>
      ),
    },
    {
      title: t('skipped'),
      dataIndex: 'skipped_count',
      key: 'skipped',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-500)' }}>{v}</span>
      ),
    },
    {
      title: t('created_by'),
      dataIndex: 'created_by',
      key: 'created_by',
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v || '—'}</span>
      ),
    },
  ];
  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'date',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('bankImportHistory.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  return (
    <div>
      <PageHeader
        title={t('import_history')}
        subtitle={t('import_history_subtitle', 'View past imports')}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/banking/${accountId}/reconciliation`)}>
              {t('back')}
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => navigate(`/banking/${accountId}/import`)}>
              {t('import_new')}
            </Button>
          </Space>
        }
      />

      <KitListCard
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); }}
              placeholder={t('search')}
            />
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key));
                  downloadCsv('bank-import-history', filteredData, cols);
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
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: (
              <Empty
                image={<InboxOutlined style={{ fontSize: 48, color: 'var(--ink-300)' }} />}
                description={
                  <Space direction="vertical" size={4}>
                    <Text strong>{t('no_import_history')}</Text>
                    <Text type="secondary">{t('no_import_history_hint')}</Text>
                  </Space>
                }
              >
                <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => navigate(`/banking/${accountId}/import`)}>
                  {t('import_first_statement')}
                </Button>
              </Empty>
            )
          }}
        />
      </KitListCard>
    </div>
  );
};

export default BankImportHistory;
