import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Form, Input, InputNumber, Select, Space, Modal, Radio } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InboxOutlined,
  ExportOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  GoldOutlined,
  PieChartOutlined,
} from '@ant-design/icons';
import { message } from '../../utils/message';
import api from '../../api';
import { space } from '../../theme/tokens';
import {
  PageHeader,
  KpiCard,
  SectionCard,
  StatusTag,
  EmptyState,
  type ColumnVisibilityItem,
} from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Option } = Select;

/** A warehouse storage bin/location (mirrors backend `/api/wms/bins`). */
interface Bin {
  /** Firestore document id (used for /bins/{id} path ops). */
  id: string;
  /** Human bin code, e.g. "A-01-03". */
  bin_id: string;
  zone?: string;
  capacity?: number;
  load?: number;
  item_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** One allocation line returned by putaway/pick. */
interface Allocation {
  bin_id: string;
  qty: number;
}

interface PutawayResult {
  item_id?: string | null;
  qty: number;
  strategy: string;
  zone?: string | null;
  allocations: Allocation[];
  leftover: number;
}

interface PickResult {
  item_id?: string | null;
  qty: number;
  strategy: string;
  allocations: Allocation[];
  short: number;
}

type AllocKind = 'putaway' | 'pick';

const numberFmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

const WmsPage: React.FC = () => {
  const { t } = useTranslation();

  // ── Bins list state ──
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('wms.hiddenCols') || '[]'); } catch { return []; }
  });

  // ── Bin create/edit modal ──
  const [binOpen, setBinOpen] = useState(false);
  const [editing, setEditing] = useState<Bin | null>(null);
  const [binForm] = Form.useForm();

  // ── Putaway / Pick action modal ──
  const [allocKind, setAllocKind] = useState<AllocKind | null>(null);
  const [allocForm] = Form.useForm();
  const [allocLoading, setAllocLoading] = useState(false);
  const [putawayResult, setPutawayResult] = useState<PutawayResult | null>(null);
  const [pickResult, setPickResult] = useState<PickResult | null>(null);

  const loadBins = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/wms/bins');
      setBins(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error(t('error'));
    }
    setLoading(false);
  };

  useEffect(() => { loadBins(); }, []);

  // ── KPI aggregates ──
  const kpis = useMemo(() => {
    const totalBins = bins.length;
    const totalCapacity = bins.reduce((s, b) => s + (Number(b.capacity) || 0), 0);
    const totalLoad = bins.reduce((s, b) => s + (Number(b.load) || 0), 0);
    const utilization = totalCapacity > 0 ? Math.round((totalLoad / totalCapacity) * 100) : 0;
    return { totalBins, totalCapacity, totalLoad, utilization };
  }, [bins]);

  // ── Bin CRUD ──
  const openCreate = () => { setEditing(null); binForm.resetFields(); setBinOpen(true); };
  const openEdit = (record: Bin) => {
    setEditing(record);
    binForm.setFieldsValue({
      bin_id: record.bin_id,
      zone: record.zone,
      capacity: record.capacity,
      load: record.load,
      item_id: record.item_id ?? undefined,
    });
    setBinOpen(true);
  };

  const submitBin = async (values: Record<string, unknown>) => {
    try {
      if (editing) {
        await api.put(`/api/wms/bins/${editing.id}`, values);
        message.success(t('updated'));
      } else {
        await api.post('/api/wms/bins', values);
        message.success(t('created'));
      }
      setBinOpen(false);
      setEditing(null);
      binForm.resetFields();
      loadBins();
    } catch {
      // global interceptor surfaces the server error toast
    }
  };

  const confirmDelete = (record: Bin) => {
    Modal.confirm({
      title: t('confirmDelete'),
      content: record.bin_id,
      okText: t('delete'),
      okButtonProps: { danger: true },
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await api.delete(`/api/wms/bins/${record.id}`);
          message.success(t('deleted'));
          loadBins();
        } catch {
          /* interceptor handles toast */
        }
      },
    });
  };

  // ── Putaway / Pick ──
  const openAlloc = (kind: AllocKind) => {
    setAllocKind(kind);
    setPutawayResult(null);
    setPickResult(null);
    allocForm.resetFields();
    allocForm.setFieldsValue({ strategy: kind === 'putaway' ? 'consolidate' : 'fifo' });
  };

  const closeAlloc = () => {
    setAllocKind(null);
    setPutawayResult(null);
    setPickResult(null);
    allocForm.resetFields();
  };

  const runAlloc = async (values: Record<string, unknown>) => {
    if (!allocKind) return;
    setAllocLoading(true);
    try {
      if (allocKind === 'putaway') {
        const res = await api.post('/api/wms/putaway', {
          item_id: values.item_id || undefined,
          qty: Number(values.qty),
          zone: values.zone || undefined,
          strategy: values.strategy,
        });
        setPutawayResult(res.data as PutawayResult);
      } else {
        const res = await api.post('/api/wms/pick', {
          item_id: values.item_id,
          qty: Number(values.qty),
          strategy: values.strategy,
        });
        setPickResult(res.data as PickResult);
      }
      loadBins();
    } catch {
      /* interceptor handles toast */
    }
    setAllocLoading(false);
  };

  // ── Bins table columns ──
  const allColumns = [
    {
      title: t('wms.bin', 'Bin'),
      dataIndex: 'bin_id',
      key: 'bin_id',
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600 }}>{v}</span>
      ),
    },
    {
      title: t('wms.zone', 'Zone'),
      dataIndex: 'zone',
      key: 'zone',
      render: (v: string) => v
        ? (
          <span style={{
            display: 'inline-block', paddingBlock: 2, paddingInline: 9, borderRadius: 'var(--radius-sm, 6px)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
          }}>{v}</span>
        )
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('wms.capacity', 'Capacity'),
      dataIndex: 'capacity',
      key: 'capacity',
      align: 'end' as const,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)' }}>{numberFmt(Number(v) || 0)}</span>
      ),
    },
    {
      title: t('wms.load', 'Load'),
      dataIndex: 'load',
      key: 'load',
      align: 'end' as const,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)' }}>{numberFmt(Number(v) || 0)}</span>
      ),
    },
    {
      title: t('wms.utilization', 'Utilization'),
      key: 'utilization',
      width: 120,
      render: (_: unknown, r: Bin) => {
        const cap = Number(r.capacity) || 0;
        const load = Number(r.load) || 0;
        const pct = cap > 0 ? Math.round((load / cap) * 100) : 0;
        const kind = pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'success';
        return <StatusTag status={kind} label={`${pct}%`} />;
      },
    },
    {
      title: t('wms.item', 'Item'),
      dataIndex: 'item_id',
      key: 'item_id',
      ellipsis: true,
      render: (v: string) => v
        ? <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-600)', fontSize: 12.5 }}>{v}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: '',
      key: 'actions',
      width: 56,
      align: 'center' as const,
      render: (_: unknown, r: Bin) => (
        <KitRowActions
          ariaLabel={t('actions') || 'Actions'}
          actions={[
            { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => openEdit(r) },
            { type: 'divider' },
            { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => confirmDelete(r) },
          ]}
        />
      ),
    },
  ];

  const visibleColumns = useMemo(
    () => allColumns.filter((c) => !hiddenCols.includes(c.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenCols, t],
  );
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key,
    label: typeof c.title === 'string' ? c.title : c.key,
    pinned: c.key === 'bin_id' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('wms.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  const zoneOptions = useMemo(() => {
    const zones = Array.from(new Set(bins.map((b) => b.zone).filter(Boolean))) as string[];
    return zones.map((z) => ({ value: z, label: z }));
  }, [bins]);

  const filteredData = useMemo(() => {
    let rows = bins;
    if (zoneFilter) rows = rows.filter((b) => b.zone === zoneFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row: Bin) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
    }
    return rows;
  }, [bins, zoneFilter, search]);

  // ── Allocation result table (shared by putaway + pick) ──
  const allocResult = allocKind === 'putaway' ? putawayResult : allocKind === 'pick' ? pickResult : null;
  const remainder = allocKind === 'putaway'
    ? putawayResult?.leftover ?? 0
    : pickResult?.short ?? 0;

  const renderAllocResult = () => {
    if (!allocResult) return null;
    const allocations = allocResult.allocations || [];
    return (
      <div style={{ marginBlockStart: space.lg }}>
        <SectionCard title={t('wms.allocationResult', 'Allocation result')} padded={false}>
          {allocations.length === 0 ? (
            <EmptyState
              icon={<AppstoreOutlined />}
              title={t('wms.noAllocation', 'No allocation produced')}
              description={
                allocKind === 'putaway'
                  ? t('wms.noCapacity', 'No bin had free capacity for this quantity.')
                  : t('wms.noStock', 'No bin holds stock of this item.')
              }
            />
          ) : (
            <ResponsiveTableAdapter
              rowKey={(r: Allocation) => `${r.bin_id}`}
              dataSource={allocations}
              pagination={false}
              columns={[
                {
                  title: t('wms.bin', 'Bin'),
                  dataIndex: 'bin_id',
                  key: 'bin_id',
                  render: (v: string) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600 }}>{v}</span>
                  ),
                },
                {
                  title: t('wms.qty', 'Qty'),
                  dataIndex: 'qty',
                  key: 'qty',
                  align: 'end' as const,
                  render: (v: number) => (
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontWeight: 600 }}>{numberFmt(Number(v) || 0)}</span>
                  ),
                },
              ]}
            />
          )}
        </SectionCard>
        <div style={{ display: 'flex', alignItems: 'center', gap: space.sm, marginBlockStart: space.md }}>
          {remainder > 0 ? (
            <StatusTag
              status="warning"
              label={`${allocKind === 'putaway' ? t('wms.leftover', 'Leftover') : t('wms.short', 'Short')}: ${numberFmt(remainder)}`}
            />
          ) : (
            <StatusTag
              status="success"
              label={allocKind === 'putaway'
                ? t('wms.fullyStored', 'Fully stored')
                : t('wms.fullyPicked', 'Fully picked')}
            />
          )}
        </div>
      </div>
    );
  };

  const isPick = allocKind === 'pick';

  return (
    <div>
      <PageHeader
        title={t('wms.title', 'Warehouse (WMS)')}
        subtitle={t('wms.subtitle', 'Bins, putaway and picking')}
        extra={
          <Space wrap>
            <Button icon={<InboxOutlined />} onClick={() => openAlloc('putaway')}>
              {t('wms.putaway', 'Putaway')}
            </Button>
            <Button icon={<ExportOutlined />} onClick={() => openAlloc('pick')}>
              {t('wms.pick', 'Pick')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              {t('wms.newBin', 'New bin')}
            </Button>
          </Space>
        }
      />

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: space.md,
        marginBlockEnd: space.lg,
      }}>
        <KpiCard title={t('wms.totalBins', 'Total bins')} value={kpis.totalBins} icon={<DatabaseOutlined />} tone="primary" loading={loading} />
        <KpiCard title={t('wms.totalCapacity', 'Total capacity')} value={kpis.totalCapacity} icon={<AppstoreOutlined />} tone="info" loading={loading} />
        <KpiCard title={t('wms.totalLoad', 'Total load')} value={kpis.totalLoad} icon={<GoldOutlined />} tone="success" loading={loading} />
        <KpiCard
          title={t('wms.utilization', 'Utilization')}
          value={kpis.utilization}
          suffix="%"
          icon={<PieChartOutlined />}
          tone={kpis.utilization >= 100 ? 'danger' : kpis.utilization >= 80 ? 'warning' : 'primary'}
          loading={loading}
        />
      </div>

      <KitListCard
        toolbar={
          <>
            <KitSearchInput value={search} onChange={(v) => { setSearch(v); }} placeholder={t('search')} />
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <KitFiltersButton
                activeCount={zoneFilter ? 1 : 0}
                onClear={() => { setZoneFilter(''); }}
              >
                <Radio.Group
                  value={zoneFilter}
                  onChange={(e) => { setZoneFilter(e.target.value); }}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <Radio value="">{t('all', 'All')}</Radio>
                  {zoneOptions.map((z) => (
                    <Radio key={z.value} value={z.value}>{z.label}</Radio>
                  ))}
                </Radio.Group>
              </KitFiltersButton>
              <KitStatusFilter
                label={t('wms.zone', 'Zone')}
                anyLabel={t('all', 'All')}
                value={zoneFilter}
                onChange={(v) => { setZoneFilter(v || ''); }}
                options={zoneOptions}
              />
            </div>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('wms-bins', filteredData, cols);
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
        {!loading && bins.length === 0 ? (
          <EmptyState
            icon={<DatabaseOutlined />}
            title={t('wms.noBins', 'No bins yet')}
            description={t('wms.noBinsDesc', 'Create storage bins to start putaway and picking.')}
            actionLabel={t('wms.newBin', 'New bin')}
            onAction={openCreate}
          />
        ) : (
          <ResponsiveTableAdapter
            rowKey="id"
            dataSource={filteredData}
            columns={visibleColumns}
            loading={loading}
            pagination={{ pageSize: 20 }}
          />
        )}
      </KitListCard>

      {/* Create / edit bin */}
      <FormDialog
        title={editing ? t('wms.editBin', 'Edit bin') : t('wms.newBin', 'New bin')}
        open={binOpen}
        onClose={() => { setBinOpen(false); setEditing(null); binForm.resetFields(); }}
        onOk={() => binForm.submit()}
      >
        <Form form={binForm} layout="vertical" onFinish={submitBin}>
          <Form.Item
            name="bin_id"
            label={t('wms.bin', 'Bin')}
            rules={[{ required: true, message: t('wms.binRequired', 'Bin code is required') }]}
          >
            <Input placeholder="A-01-03" disabled={!!editing} />
          </Form.Item>
          <Form.Item name="zone" label={t('wms.zone', 'Zone')}>
            <Input placeholder={t('wms.zonePlaceholder', 'e.g. A')} />
          </Form.Item>
          <Form.Item name="capacity" label={t('wms.capacity', 'Capacity')} initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="load" label={t('wms.load', 'Load')} initialValue={0}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="item_id" label={t('wms.item', 'Item')}>
            <Input placeholder={t('wms.itemPlaceholder', 'Optional item id')} />
          </Form.Item>
        </Form>
      </FormDialog>

      {/* Putaway / Pick */}
      <FormDialog
        title={isPick ? t('wms.pick', 'Pick') : t('wms.putaway', 'Putaway')}
        open={allocKind !== null}
        onClose={closeAlloc}
        onOk={() => allocForm.submit()}
        okText={isPick ? t('wms.runPick', 'Run pick') : t('wms.runPutaway', 'Run putaway')}
      >
        <Form form={allocForm} layout="vertical" onFinish={runAlloc}>
          <Form.Item
            name="item_id"
            label={t('wms.item', 'Item')}
            rules={isPick ? [{ required: true, message: t('wms.itemRequired', 'Item is required') }] : undefined}
          >
            <Input placeholder={isPick ? t('wms.itemPlaceholder', 'Optional item id') : t('wms.itemPlaceholderOpt', 'Item id (optional)')} />
          </Form.Item>
          <Form.Item
            name="qty"
            label={t('wms.qty', 'Qty')}
            rules={[{ required: true, message: t('wms.qtyRequired', 'Quantity is required') }]}
          >
            <InputNumber min={0.0001} style={{ width: '100%' }} placeholder="10" />
          </Form.Item>
          {!isPick && (
            <Form.Item name="zone" label={t('wms.zone', 'Zone')}>
              <Select allowClear placeholder={t('all', 'All')}>
                {zoneOptions.map((z) => (
                  <Option key={z.value} value={z.value}>{z.label}</Option>
                ))}
              </Select>
            </Form.Item>
          )}
          <Form.Item name="strategy" label={t('wms.strategy', 'Strategy')}>
            <Select>
              {isPick ? (
                <>
                  <Option value="fifo">{t('wms.strategyFifo', 'FIFO')}</Option>
                  <Option value="nearest">{t('wms.strategyNearest', 'Nearest')}</Option>
                </>
              ) : (
                <>
                  <Option value="consolidate">{t('wms.strategyConsolidate', 'Consolidate')}</Option>
                  <Option value="spread">{t('wms.strategySpread', 'Spread')}</Option>
                </>
              )}
            </Select>
          </Form.Item>

          {allocLoading
            ? <div style={{ color: 'var(--ink-500)', marginBlockStart: space.sm }}>{t('loading', 'Loading…')}</div>
            : renderAllocResult()}
        </Form>
      </FormDialog>
    </div>
  );
};

export default WmsPage;
