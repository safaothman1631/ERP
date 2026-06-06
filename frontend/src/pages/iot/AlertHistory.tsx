import React, { useEffect, useMemo, useState } from 'react';
import { Button, Space, DatePicker, Radio, message } from 'antd';
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';

dayjs.extend(relativeTime);

const { RangePicker: _RangePicker } = DatePicker;

interface Alert {
  id: string;
  device_id: string;
  metric?: string;
  value?: number;
  threshold?: number;
  severity: string;
  message?: string;
  triggered_at: string;
  acknowledged: boolean;
  acknowledged_at?: string;
  acknowledged_by?: string;
}

interface Device {
  id: string;
  name: string;
}

const AlertHistory: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<any>({});
  const [search, setSearch] = useState('');
  const [autoRefresh, _setAutoRefresh] = useState(true);
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('iot.alerts.hiddenCols') || '[]'); } catch { return []; }
  });

  useEffect(() => {
    loadAlerts();
    loadDevices();
  }, [page, pageSize, filters]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        loadAlerts();
      }, 30000); // 30s
      return () => clearInterval(interval);
    }
  }, [autoRefresh, page, pageSize, filters]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize
      };
      if (filters.severity) params.severity = filters.severity;
      if (filters.device_id) params.device_id = filters.device_id;
      if (filters.acknowledged !== undefined) params.acknowledged = filters.acknowledged;

      const res = await api.get('/api/iot/alerts', { params });
      setAlerts(res.data.items);
      setTotal(res.data.total);
    } catch (_err) {
      message.error(t('common.load_failed', 'Failed to load'));
    } finally {
      setLoading(false);
    }
  };

  const loadDevices = async () => {
    try {
      const res = await api.get('/api/iot/devices', { params: { limit: 100 } });
      setDevices(res.data.items);
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const handleAck = async (id: string) => {
    try {
      await api.post(`/api/iot/alerts/${id}/ack`);
      message.success(t('iot.acknowledged', 'Acknowledged'));
      loadAlerts();
    } catch (_err) {
      message.error(t('common.operation_failed', 'Operation failed'));
    }
  };

  const severityStatus = (severity: string) => {
    const map: Record<string, string> = {
      info: 'info',
      warn: 'warning',
      critical: 'error'
    };
    return map[severity] || 'default';
  };

  // Status tab segments map to the real `acknowledged` server filter param.
  const ackTab: string = filters.acknowledged === undefined ? 'all' : filters.acknowledged ? 'acknowledged' : 'pending';
  const setAckTab = (key: string) => {
    setFilters({
      ...filters,
      acknowledged: key === 'all' ? undefined : key === 'acknowledged',
    });
    setPage(1);
  };
  const tabs: KitListTab[] = [
    { key: 'all', label: t('all', 'All') },
    { key: 'pending', label: t('iot.pending', 'Pending') },
    { key: 'acknowledged', label: t('iot.acknowledged', 'Acknowledged') },
  ];

  const allColumns = [
    {
      title: t('iot.triggered_at', 'Triggered'),
      dataIndex: 'triggered_at',
      key: 'triggered_at',
      render: (val: string) => (
        <Space direction="vertical" size={0}>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{dayjs(val).format('YYYY-MM-DD HH:mm:ss')}</span>
          <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>{dayjs(val).fromNow()}</span>
        </Space>
      )
    },
    {
      title: t('iot.device', 'Device'),
      dataIndex: 'device_id',
      key: 'device_id',
      render: (id: string) => {
        const device = devices.find(d => d.id === id);
        return <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{device?.name || id.substring(0, 8)}</span>;
      }
    },
    {
      title: t('iot.metric', 'Metric'),
      dataIndex: 'metric',
      key: 'metric',
      render: (v: string) => v
        ? (
          <span style={{
            display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
          }}>{v}</span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('iot.value', 'Value'),
      dataIndex: 'value',
      key: 'value',
      render: (_: any, record: Alert) => {
        if (record.value !== undefined && record.threshold !== undefined) {
          return (
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>
              {record.value} <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>({t('iot.threshold', 'threshold')}: {record.threshold})</span>
            </span>
          );
        }
        return <span style={{ color: 'var(--ink-700)' }}>{record.message || '—'}</span>;
      }
    },
    {
      title: t('iot.severity', 'Severity'),
      dataIndex: 'severity',
      key: 'severity',
      render: (val: string) => <StatusTag status={severityStatus(val)} label={t(`iot.${val}`, val)} />
    },
    {
      title: t('iot.status', 'Status'),
      dataIndex: 'acknowledged',
      key: 'acknowledged',
      render: (acked: boolean, record: Alert) => (
        <Space direction="vertical" size={0}>
          <StatusTag
            status={acked ? 'success' : 'warning'}
            label={acked ? t('iot.acknowledged', 'Acknowledged') : t('iot.pending', 'Pending')}
          />
          {acked && record.acknowledged_by && (
            <span style={{ fontSize: 11, color: 'var(--ink-500)' }}>
              {t('common.by', 'by')} {record.acknowledged_by}
            </span>
          )}
        </Space>
      )
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center' as const,
      render: (_: any, record: Alert) => (
        <KitRowActions
          ariaLabel={t('common.actions', 'Actions')}
          actions={[
            {
              key: 'ack',
              icon: <CheckOutlined />,
              label: record.acknowledged ? t('iot.acked', 'Acked') : t('iot.ack', 'Acknowledge'),
              disabled: record.acknowledged,
              onClick: () => handleAck(record.id),
            },
          ]}
        />
      )
    }
  ];

  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key)), [hiddenCols, devices, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'triggered_at' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('iot.alerts.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  // Active filter count for the Filters popover badge (severity + device).
  const activeFilterCount = (filters.severity ? 1 : 0) + (filters.device_id ? 1 : 0);

  // Client-side search across all alert fields (backend has no `q` param).
  const filteredData = useMemo(() => {
    if (!search) return alerts;
    const q = search.toLowerCase();
    return alerts.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
  }, [alerts, search]);

  return (
    <div style={{ padding: 'var(--space-6, 24px)' }}>
      <PageHeader
        title={t('iot.alert_history', 'Alert History')}
        extra={
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadAlerts}
            >
              {autoRefresh && `(${t('iot.auto_refresh', 'auto')})`}
            </Button>
          </Space>
        }
      />

      <KitListCard
        tabs={tabs}
        activeTab={ackTab}
        onTabChange={setAckTab}
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); setPage(1); }}
              placeholder={t('search')}
            />
            {/* Group Filters + Severity so they always wrap together on small screens. */}
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={activeFilterCount}
                onClear={() => setFilters({ ...filters, severity: undefined, device_id: undefined })}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-700)' }}>
                      {t('iot.filter_severity', 'Filter by severity')}
                    </div>
                    <Radio.Group
                      value={filters.severity ?? ''}
                      onChange={(e) => { setFilters({ ...filters, severity: e.target.value || undefined }); setPage(1); }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    >
                      <Radio value="">{t('all', 'All')}</Radio>
                      <Radio value="info">{t('iot.info', 'Info')}</Radio>
                      <Radio value="warn">{t('iot.warn', 'Warning')}</Radio>
                      <Radio value="critical">{t('iot.critical', 'Critical')}</Radio>
                    </Radio.Group>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--ink-700)' }}>
                      {t('iot.filter_device', 'Filter by device')}
                    </div>
                    <Radio.Group
                      value={filters.device_id ?? ''}
                      onChange={(e) => { setFilters({ ...filters, device_id: e.target.value || undefined }); setPage(1); }}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}
                    >
                      <Radio value="">{t('all', 'All')}</Radio>
                      {devices.map((d) => (
                        <Radio key={d.id} value={d.id}>{d.name}</Radio>
                      ))}
                    </Radio.Group>
                  </div>
                </div>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('iot.severity', 'Severity')}
                anyLabel={t('all', 'All')}
                value={filters.severity ?? ''}
                onChange={(v) => { setFilters({ ...filters, severity: v || undefined }); setPage(1); }}
                options={[
                  { value: 'info', label: t('iot.info', 'Info') },
                  { value: 'warn', label: t('iot.warn', 'Warning') },
                  { value: 'critical', label: t('iot.critical', 'Critical') },
                ]}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('iot-alerts', filteredData, cols);
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
          pagination={{
            current: page,
            pageSize,
            total: search ? filteredData.length : total,
            showSizeChanger: true,
            showTotal: (tot) => `${tot} ${t('common.total', 'total')}`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps || 20);
            }
          }}
        />
      </KitListCard>
    </div>
  );
};

export default AlertHistory;
