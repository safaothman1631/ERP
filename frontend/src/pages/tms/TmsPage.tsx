import React, { useEffect, useMemo, useState } from 'react';
import {
  Tabs,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Modal,
  Row,
  Col,
  Typography,
  Divider,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CalculatorOutlined,
  NodeIndexOutlined,
  CarOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import {
  PageHeader,
  SectionCard,
  KpiCard,
  StatusTag,
  EmptyState,
  KeyValueGrid,
  type KeyValueItem,
  type StatusKind,
} from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

const { Text } = Typography;

// ─── Domain types ───────────────────────────────────────────────────────────

interface Carrier {
  id: string;
  name: string;
  code?: string;
  service_level?: string;
  contact_phone?: string;
  contact_email?: string;
  is_active?: boolean;
}

interface Shipment {
  id: string;
  reference?: string;
  carrier_id?: string;
  carrier_name?: string;
  origin?: string;
  destination?: string;
  weight_kg?: number;
  distance_km?: number;
  status?: string;
  cost?: number;
}

interface FreightBreakdown {
  base: number;
  weight_cost: number;
  distance_cost: number;
  zone_mult: number;
  service_mult: number;
  floored_to_min?: boolean;
}

interface FreightQuote {
  cost: number;
  breakdown: FreightBreakdown;
}

interface RouteResult {
  order: string[];
  total: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
// Mirror backend engine multipliers (services/tms_rating.py).

const ZONES = ['domestic', 'regional', 'remote'] as const;
const SERVICES = ['standard', 'express', 'economy'] as const;

const SHIPMENT_STATUS_KIND: Record<string, StatusKind> = {
  draft: 'draft',
  booked: 'pending',
  in_transit: 'info',
  delivered: 'success',
  cancelled: 'cancelled',
};

const numberFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const fmtMoney = (v?: number): string => (typeof v === 'number' ? numberFmt.format(v) : '—');

// ─── Carriers tab ───────────────────────────────────────────────────────────

const CarriersTab: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Carrier | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/tms/carriers');
      setData(Array.isArray(res.data) ? res.data : res.data?.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (record: Carrier) => {
    setEditing(record);
    form.setFieldsValue(record);
    setOpen(true);
  };

  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      if (editing) {
        await api.put(`/api/tms/carriers/${editing.id}`, values);
        message.success(t('updated'));
      } else {
        await api.post('/api/tms/carriers', values);
        message.success(t('created'));
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const onDelete = (record: Carrier) => {
    Modal.confirm({
      title: t('confirmDelete', 'دڵنیایت لە سڕینەوە؟'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/api/tms/carriers/${record.id}`);
          message.success(t('deleted'));
          load();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  const columns = [
    {
      title: t('name', 'ناو'),
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>,
    },
    {
      title: t('code', 'کۆد'),
      dataIndex: 'code',
      key: 'code',
      render: (v?: string) =>
        v ? (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v}</span>
        ) : (
          <span style={{ color: 'var(--ink-400)' }}>—</span>
        ),
    },
    {
      title: t('tms.serviceLevel', 'ئاستی خزمەت'),
      dataIndex: 'service_level',
      key: 'service_level',
      render: (v?: string) =>
        v ? (
          <span style={{ color: 'var(--ink-700)' }}>{t(`tms.service.${v}`, v)}</span>
        ) : (
          <span style={{ color: 'var(--ink-400)' }}>—</span>
        ),
    },
    {
      title: t('phone', 'تەلەفۆن'),
      dataIndex: 'contact_phone',
      key: 'contact_phone',
      render: (v?: string) =>
        v ? (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontSize: 12.5 }}>{v}</span>
        ) : (
          <span style={{ color: 'var(--ink-400)' }}>—</span>
        ),
    },
    {
      title: t('status', 'دۆخ'),
      dataIndex: 'is_active',
      key: 'is_active',
      width: 120,
      render: (v?: boolean) => (
        <StatusTag
          status={v === false ? 'inactive' : 'active'}
          label={v === false ? t('inactive', 'ناچالاک') : t('active', 'چالاک')}
        />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, record: Carrier) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} aria-label={t('edit', 'دەستکاری')} onClick={() => openEdit(record)} />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('delete', 'سڕینەوە')}
            onClick={() => onDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <SectionCard
      title={t('tms.carriers', 'گواستنەوەکان')}
      subtitle={t('tms.carriersSubtitle', 'بەڕێوەبردنی کۆمپانیاکانی گواستنەوە')}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          {t('tms.newCarrier', 'گواستنەوەی نوێ')}
        </Button>
      }
    >
      <ResponsiveTableAdapter
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={{ pageSize: 20 }}
        locale={{
          emptyText: <EmptyState title={t('tms.noCarriers', 'هیچ گواستنەوەیەک نییە')} actionLabel={t('tms.newCarrier', 'گواستنەوەی نوێ')} onAction={openNew} />,
        }}
      />

      <FormDialog
        title={editing ? t('tms.editCarrier', 'دەستکاری گواستنەوە') : t('tms.newCarrier', 'گواستنەوەی نوێ')}
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ is_active: true, service_level: 'standard' }}>
          <Form.Item name="name" label={t('name', 'ناو')} rules={[{ required: true, message: t('required', 'پێویستە') }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label={t('code', 'کۆد')}>
            <Input />
          </Form.Item>
          <Form.Item name="service_level" label={t('tms.serviceLevel', 'ئاستی خزمەت')}>
            <Select
              options={SERVICES.map((s) => ({ value: s, label: t(`tms.service.${s}`, s) }))}
            />
          </Form.Item>
          <Form.Item name="contact_phone" label={t('phone', 'تەلەفۆن')}>
            <Input />
          </Form.Item>
          <Form.Item name="contact_email" label={t('email', 'ئیمەیڵ')}>
            <Input type="email" />
          </Form.Item>
        </Form>
      </FormDialog>
    </SectionCard>
  );
};

// ─── Shipments tab ──────────────────────────────────────────────────────────

const ShipmentsTab: React.FC = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<Shipment[]>([]);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Shipment | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    try {
      const [shipRes, carrierRes] = await Promise.all([
        api.get('/api/tms/shipments'),
        api.get('/api/tms/carriers'),
      ]);
      setData(Array.isArray(shipRes.data) ? shipRes.data : shipRes.data?.items || []);
      setCarriers(Array.isArray(carrierRes.data) ? carrierRes.data : carrierRes.data?.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const carrierName = (id?: string): string => carriers.find((c) => c.id === id)?.name || '—';

  const openNew = () => {
    setEditing(null);
    form.resetFields();
    setOpen(true);
  };

  const openEdit = (record: Shipment) => {
    setEditing(record);
    form.setFieldsValue(record);
    setOpen(true);
  };

  const onSubmit = async (values: Record<string, unknown>) => {
    try {
      if (editing) {
        await api.put(`/api/tms/shipments/${editing.id}`, values);
        message.success(t('updated'));
      } else {
        await api.post('/api/tms/shipments', values);
        message.success(t('created'));
      }
      setOpen(false);
      setEditing(null);
      form.resetFields();
      load();
    } catch {
      message.error(t('error'));
    }
  };

  const onDelete = (record: Shipment) => {
    Modal.confirm({
      title: t('confirmDelete', 'دڵنیایت لە سڕینەوە؟'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await api.delete(`/api/tms/shipments/${record.id}`);
          message.success(t('deleted'));
          load();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  // KPI summary
  const totals = useMemo(() => {
    const count = data.length;
    const inTransit = data.filter((s) => s.status === 'in_transit').length;
    const delivered = data.filter((s) => s.status === 'delivered').length;
    const cost = data.reduce((sum, s) => sum + (typeof s.cost === 'number' ? s.cost : 0), 0);
    return { count, inTransit, delivered, cost };
  }, [data]);

  const columns = [
    {
      title: t('tms.reference', 'ژمارەی ناردن'),
      dataIndex: 'reference',
      key: 'reference',
      render: (v?: string) =>
        v ? (
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{v}</span>
        ) : (
          <span style={{ color: 'var(--ink-400)' }}>—</span>
        ),
    },
    {
      title: t('tms.carrier', 'گواستنەوە'),
      dataIndex: 'carrier_id',
      key: 'carrier_id',
      render: (_: unknown, r: Shipment) => (
        <span style={{ color: 'var(--ink-700)' }}>{r.carrier_name || carrierName(r.carrier_id)}</span>
      ),
    },
    {
      title: t('tms.origin', 'سەرچاوە'),
      dataIndex: 'origin',
      key: 'origin',
      render: (v?: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('tms.destination', 'مەنزڵ'),
      dataIndex: 'destination',
      key: 'destination',
      render: (v?: string) => <span style={{ color: 'var(--ink-700)' }}>{v || '—'}</span>,
    },
    {
      title: t('tms.weightKg', 'کێش (kg)'),
      dataIndex: 'weight_kg',
      key: 'weight_kg',
      align: 'right' as const,
      render: (v?: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-700)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtMoney(v)}
        </span>
      ),
    },
    {
      title: t('tms.cost', 'تێچوو'),
      dataIndex: 'cost',
      key: 'cost',
      align: 'right' as const,
      render: (v?: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {fmtMoney(v)}
        </span>
      ),
    },
    {
      title: t('status', 'دۆخ'),
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (v?: string) => (
        <StatusTag status={(v && SHIPMENT_STATUS_KIND[v]) || 'draft'} label={t(`tms.shipmentStatus.${v || 'draft'}`, v || 'draft')} />
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, record: Shipment) => (
        <Space size={4}>
          <Button type="text" size="small" icon={<EditOutlined />} aria-label={t('edit', 'دەستکاری')} onClick={() => openEdit(record)} />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            aria-label={t('delete', 'سڕینەوە')}
            onClick={() => onDelete(record)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 'var(--space-lg)' }}>
        <Col xs={12} md={6}>
          <KpiCard title={t('tms.totalShipments', 'کۆی ناردنەکان')} value={totals.count} icon={<CarOutlined />} tone="primary" />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard title={t('tms.inTransit', 'لە ڕێگەدا')} value={totals.inTransit} icon={<NodeIndexOutlined />} tone="info" />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard title={t('tms.delivered', 'گەیشتوو')} value={totals.delivered} tone="success" />
        </Col>
        <Col xs={12} md={6}>
          <KpiCard title={t('tms.totalCost', 'کۆی تێچوو')} value={fmtMoney(totals.cost)} currency="IQD" tone="warning" />
        </Col>
      </Row>

      <SectionCard
        title={t('tms.shipments', 'ناردنەکان')}
        subtitle={t('tms.shipmentsSubtitle', 'بەدواداچوونی ناردنی کاڵا')}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
            {t('tms.newShipment', 'ناردنی نوێ')}
          </Button>
        }
      >
        <ResponsiveTableAdapter
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: <EmptyState title={t('tms.noShipments', 'هیچ ناردنێک نییە')} actionLabel={t('tms.newShipment', 'ناردنی نوێ')} onAction={openNew} />,
          }}
        />
      </SectionCard>

      <FormDialog
        title={editing ? t('tms.editShipment', 'دەستکاری ناردن') : t('tms.newShipment', 'ناردنی نوێ')}
        open={open}
        onClose={() => {
          setOpen(false);
          setEditing(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onSubmit} initialValues={{ status: 'draft' }}>
          <Form.Item name="reference" label={t('tms.reference', 'ژمارەی ناردن')}>
            <Input />
          </Form.Item>
          <Form.Item name="carrier_id" label={t('tms.carrier', 'گواستنەوە')}>
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              options={carriers.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={t('tms.selectCarrier', 'گواستنەوە هەڵبژێرە')}
            />
          </Form.Item>
          <Form.Item name="origin" label={t('tms.origin', 'سەرچاوە')}>
            <Input />
          </Form.Item>
          <Form.Item name="destination" label={t('tms.destination', 'مەنزڵ')}>
            <Input />
          </Form.Item>
          <Form.Item name="weight_kg" label={t('tms.weightKg', 'کێش (kg)')}>
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="distance_km" label={t('tms.distanceKm', 'دووری (km)')}>
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cost" label={t('tms.cost', 'تێچوو')}>
            <InputNumber min={0} step={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label={t('status', 'دۆخ')}>
            <Select
              options={Object.keys(SHIPMENT_STATUS_KIND).map((s) => ({
                value: s,
                label: t(`tms.shipmentStatus.${s}`, s),
              }))}
            />
          </Form.Item>
        </Form>
      </FormDialog>
    </div>
  );
};

// ─── Freight quote tab ──────────────────────────────────────────────────────

const FreightQuoteTab: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FreightQuote | null>(null);

  const onCalculate = async (values: Record<string, unknown>) => {
    setLoading(true);
    try {
      const res = await api.post('/api/tms/freight-quote', {
        weight_kg: Number(values.weight_kg) || 0,
        distance_km: Number(values.distance_km) || 0,
        zone: values.zone || 'domestic',
        service: values.service || 'standard',
      });
      setResult(res.data as FreightQuote);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const breakdownItems: KeyValueItem[] = useMemo(() => {
    if (!result) return [];
    const b = result.breakdown;
    return [
      { label: t('tms.qBase', 'بنەڕەت'), value: fmtMoney(b.base) },
      { label: t('tms.qWeightCost', 'تێچووی کێش'), value: fmtMoney(b.weight_cost) },
      { label: t('tms.qDistanceCost', 'تێچووی دووری'), value: fmtMoney(b.distance_cost) },
      { label: t('tms.qZoneMult', 'هاوکێشی ناوچە'), value: `× ${numberFmt.format(b.zone_mult)}` },
      { label: t('tms.qServiceMult', 'هاوکێشی خزمەت'), value: `× ${numberFmt.format(b.service_mult)}` },
    ];
  }, [result, t]);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <SectionCard title={t('tms.freightQuote', 'خەملاندنی کرێی گواستنەوە')} subtitle={t('tms.freightQuoteSubtitle', 'خەملاندنی تێچوو لەسەر کێش و دووری')}>
          <Form
            form={form}
            layout="vertical"
            onFinish={onCalculate}
            initialValues={{ zone: 'domestic', service: 'standard', weight_kg: 10, distance_km: 50 }}
          >
            <Form.Item name="weight_kg" label={t('tms.weightKg', 'کێش (kg)')} rules={[{ required: true, message: t('required', 'پێویستە') }]}>
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="distance_km" label={t('tms.distanceKm', 'دووری (km)')} rules={[{ required: true, message: t('required', 'پێویستە') }]}>
              <InputNumber min={0} step={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="zone" label={t('tms.zone', 'ناوچە')}>
              <Select options={ZONES.map((z) => ({ value: z, label: t(`tms.zoneOpt.${z}`, z) }))} />
            </Form.Item>
            <Form.Item name="service" label={t('tms.serviceLevel', 'ئاستی خزمەت')}>
              <Select options={SERVICES.map((s) => ({ value: s, label: t(`tms.service.${s}`, s) }))} />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" icon={<CalculatorOutlined />} loading={loading} block>
                {t('tms.calculate', 'خەملاندن')}
              </Button>
            </Form.Item>
          </Form>
        </SectionCard>
      </Col>

      <Col xs={24} lg={12}>
        <SectionCard title={t('tms.result', 'ئەنجام')}>
          {result ? (
            <div>
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <Text style={{ color: 'var(--ink-500)', fontSize: 12.5 }}>{t('tms.estimatedCost', 'تێچووی خەملێنراو')}</Text>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--ink-900)',
                    lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmtMoney(result.cost)}{' '}
                  <span style={{ fontSize: 16, color: 'var(--ink-500)', fontWeight: 500 }}>IQD</span>
                </div>
                {result.breakdown.floored_to_min && (
                  <div style={{ marginTop: 6 }}>
                    <StatusTag status="info" label={t('tms.flooredToMin', 'گەیشتە کەمترین کرێ')} />
                  </div>
                )}
              </div>
              <Divider style={{ margin: 'var(--space-md) 0' }} />
              <KeyValueGrid items={breakdownItems} columns={1} />
            </div>
          ) : (
            <EmptyState title={t('tms.noQuoteYet', 'خەملاندنێک ئەنجام نەدراوە')} description={t('tms.noQuoteHint', 'فۆرمەکە پڕبکەرەوە و خەملاندن بکە')} />
          )}
        </SectionCard>
      </Col>
    </Row>
  );
};

// ─── Optimize route tab ─────────────────────────────────────────────────────

const OptimizeRouteTab: React.FC = () => {
  const { t } = useTranslation();
  const [start, setStart] = useState('');
  const [stopsText, setStopsText] = useState('');
  const [distText, setDistText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RouteResult | null>(null);

  const onOptimize = async () => {
    const stops = stopsText
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!start.trim() || stops.length === 0) {
      message.error(t('tms.routeInputRequired', 'سەرەتا و وێستگەکان پێویستن'));
      return;
    }
    // Parse distances: each non-empty line "a|b=km".
    const distances: Record<string, number> = {};
    distText
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean)
      .forEach((line) => {
        const [pair, km] = line.split('=');
        if (pair && km && !Number.isNaN(Number(km))) {
          distances[pair.trim()] = Number(km);
        }
      });

    setLoading(true);
    try {
      const res = await api.post('/api/tms/optimize-route', {
        start: start.trim(),
        stops,
        distances,
      });
      setResult(res.data as RouteResult);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <SectionCard
          title={t('tms.optimizeRoute', 'باشترکردنی ڕێگا')}
          subtitle={t('tms.optimizeRouteSubtitle', 'ڕیزکردنی وێستگەکان بەپێی نزیکترین دووری')}
        >
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div>
              <Text style={{ color: 'var(--ink-700)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                {t('tms.startPoint', 'خاڵی سەرەتا')}
              </Text>
              <Input value={start} onChange={(e) => setStart(e.target.value)} placeholder={t('tms.startPlaceholder', 'بۆ نموونە: A')} />
            </div>
            <div>
              <Text style={{ color: 'var(--ink-700)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                {t('tms.stops', 'وێستگەکان')}
              </Text>
              <Input.TextArea
                value={stopsText}
                onChange={(e) => setStopsText(e.target.value)}
                rows={3}
                placeholder={t('tms.stopsPlaceholder', 'هەر وێستگەیەک لە دێڕێک یان بە کۆما')}
              />
            </div>
            <div>
              <Text style={{ color: 'var(--ink-700)', fontSize: 13, display: 'block', marginBottom: 6 }}>
                {t('tms.distances', 'دوورییەکان')}
              </Text>
              <Input.TextArea
                value={distText}
                onChange={(e) => setDistText(e.target.value)}
                rows={4}
                placeholder={'A|B=12\nB|C=8'}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5 }}
              />
              <Text style={{ color: 'var(--ink-400)', fontSize: 11.5, display: 'block', marginTop: 4 }}>
                {t('tms.distancesHint', 'فۆرمات: a|b=کیلۆمەتر، هەر دێڕێک')}
              </Text>
            </div>
            <Button type="primary" icon={<NodeIndexOutlined />} loading={loading} onClick={onOptimize} block>
              {t('tms.optimize', 'باشترکردن')}
            </Button>
          </Space>
        </SectionCard>
      </Col>

      <Col xs={24} lg={12}>
        <SectionCard title={t('tms.result', 'ئەنجام')}>
          {result ? (
            <div>
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <Text style={{ color: 'var(--ink-500)', fontSize: 12.5 }}>{t('tms.totalDistance', 'کۆی دووری')}</Text>
                <div
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 30,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: 'var(--ink-900)',
                    lineHeight: 1.2,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {numberFmt.format(result.total)} <span style={{ fontSize: 16, color: 'var(--ink-500)', fontWeight: 500 }}>km</span>
                </div>
              </div>
              <Text style={{ color: 'var(--ink-700)', fontSize: 13, display: 'block', marginBottom: 8 }}>
                {t('tms.optimizedOrder', 'ڕیزی باشترکراو')}
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                {[start, ...result.order].map((stop, i) => (
                  <React.Fragment key={`${stop}-${i}`}>
                    {i > 0 && <span style={{ color: 'var(--ink-400)' }} aria-hidden>→</span>}
                    <StatusTag status={i === 0 ? 'info' : 'default'} label={stop} />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title={t('tms.noRouteYet', 'ڕێگایەک باشتر نەکراوە')}
              description={t('tms.noRouteHint', 'خاڵی سەرەتا و وێستگەکان بنووسە')}
            />
          )}
        </SectionCard>
      </Col>
    </Row>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const TmsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div>
      <PageHeader
        title={t('tms.title', 'بەڕێوەبردنی گواستنەوە (TMS)')}
        subtitle={t('tms.subtitle', 'گواستنەوەکان، ناردنەکان، کرێ و باشترکردنی ڕێگا')}
      />
      <Tabs
        defaultActiveKey="carriers"
        items={[
          { key: 'carriers', label: t('tms.carriers', 'گواستنەوەکان'), children: <CarriersTab /> },
          { key: 'shipments', label: t('tms.shipments', 'ناردنەکان'), children: <ShipmentsTab /> },
          { key: 'quote', label: t('tms.freightQuote', 'خەملاندنی کرێ'), children: <FreightQuoteTab /> },
          { key: 'route', label: t('tms.optimizeRoute', 'باشترکردنی ڕێگا'), children: <OptimizeRouteTab /> },
        ]}
      />
    </div>
  );
};

export default TmsPage;
