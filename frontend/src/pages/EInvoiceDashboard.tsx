import { useEffect, useMemo, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Tabs, DatePicker, Button, Space, Tag, message, Spin, Image, Modal } from 'antd';
import { ReloadOutlined, SendOutlined, RetweetOutlined, CloseCircleOutlined, QrcodeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { type Dayjs } from 'dayjs';
import api from '../api';
import ExportButton from '../components/ExportButton';

const { RangePicker } = DatePicker;

interface Submission {
  id: string;
  invoice_id: string;
  invoice_number?: string;
  fiscal_id?: string;
  seller_tax_id?: string;
  status?: string;
  submitted_at?: string;
  last_generated_at?: string;
  error_message?: string;
  preview_mode?: boolean;
}

interface MonthlyReport {
  period_from: string;
  period_to: string;
  summary: Record<string, number>;
  items: Submission[];
}

const STATUS_COLORS: Record<string, string> = {
  generated: 'default',
  signed: 'cyan',
  submitted: 'blue',
  accepted: 'green',
  rejected: 'red',
  failed: 'volcano',
  cancelled: 'orange',
};

export default function EInvoiceDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [errors, setErrors] = useState<Submission[]>([]);
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')]);
  const [qrInvoiceId, setQrInvoiceId] = useState<string | null>(null);
  const [qrImage, setQrImage] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        period_from: range[0].format('YYYY-MM-DD'),
        period_to: range[1].format('YYYY-MM-DD'),
      };
      const [m, e] = await Promise.all([
        api.get('/api/einvoice/report/monthly', { params }),
        api.get('/api/einvoice/report/errors', { params: { limit: 200 } }),
      ]);
      setReport(m.data);
      setErrors(e.data.items || []);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const summary = report?.summary || {};
  const total = useMemo(() => Object.values(summary).reduce((s, v) => s + v, 0), [summary]);
  const acceptanceRate = total > 0 ? ((summary.accepted || 0) / total * 100).toFixed(1) : '0.0';

  const submit = async (invoiceId: string) => {
    try {
      await api.post(`/api/einvoice/submit/${invoiceId}`);
      message.success(t('saved'));
      load();
    } catch { message.error(t('error')); }
  };

  const retry = async (invoiceId: string) => {
    try {
      await api.post(`/api/einvoice/retry/${invoiceId}`);
      message.success(t('saved'));
      load();
    } catch { message.error(t('error')); }
  };

  const cancel = async (invoiceId: string) => {
    try {
      await api.post(`/api/einvoice/cancel/${invoiceId}`, { reason: 'User cancelled from dashboard' });
      message.success(t('saved'));
      load();
    } catch { message.error(t('error')); }
  };

  const showQr = async (invoiceId: string) => {
    try {
      const res = await api.get(`/api/einvoice/qr/${invoiceId}`);
      setQrImage(res.data?.qr_base64 || res.data?.qr || '');
      setQrInvoiceId(invoiceId);
    } catch { message.error(t('error')); }
  };

  const columns = [
    { title: t('invoice'), dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: t('fiscal_id'), dataIndex: 'fiscal_id', key: 'fiscal_id' },
    {
      title: t('status'),
      dataIndex: 'status',
      key: 'status',
      render: (s?: string) => <Tag color={STATUS_COLORS[s || 'generated'] || 'default'}>{s || 'generated'}</Tag>,
    },
    { title: t('submitted_at'), dataIndex: 'submitted_at', key: 'submitted_at',
      render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : '—' },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: unknown, r: Submission) => (
        <Space size={4}>
          <Button size="small" icon={<QrcodeOutlined />} onClick={() => showQr(r.invoice_id)} />
          <Button size="small" icon={<SendOutlined />} disabled={['accepted', 'submitted'].includes(r.status || '')}
                  onClick={() => submit(r.invoice_id)} />
          <Button size="small" icon={<RetweetOutlined />} disabled={!['rejected', 'failed'].includes(r.status || '')}
                  onClick={() => retry(r.invoice_id)} />
          <Button size="small" danger icon={<CloseCircleOutlined />}
                  disabled={['cancelled', 'rejected'].includes(r.status || '')}
                  onClick={() => cancel(r.invoice_id)} />
        </Space>
      ),
    },
  ];

  const errorColumns = [
    { title: t('invoice'), dataIndex: 'invoice_number', key: 'invoice_number' },
    { title: t('status'), dataIndex: 'status', key: 'status',
      render: (s?: string) => <Tag color={STATUS_COLORS[s || 'failed']}>{s}</Tag> },
    { title: t('error'), dataIndex: 'error_message', key: 'error_message' },
    {
      title: t('actions'),
      key: 'actions',
      render: (_: unknown, r: Submission) => (
        <Button size="small" icon={<RetweetOutlined />} onClick={() => retry(r.invoice_id)}>{t('retry')}</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }} wrap>
        <h2 style={{ margin: 0 }}>{t('einvoice_dashboard')}</h2>
        <RangePicker
          value={range}
          onChange={(v) => { if (v && v[0] && v[1]) setRange([v[0], v[1]]); }}
        />
        <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
        <ExportButton endpoint="/api/export/invoices" filename="einvoices" />
      </Space>

      {loading && !report ? <Spin /> : (
        <>
          <Row gutter={12} style={{ marginBottom: 16 }}>
            <Col span={4}><Card><Statistic title={t('total')} value={total} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('accepted')} value={summary.accepted || 0} styles={{ content: { color: '#52c41a' } }} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('submitted')} value={summary.submitted || 0} styles={{ content: { color: '#1890ff' } }} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('rejected')} value={(summary.rejected || 0) + (summary.failed || 0)} styles={{ content: { color: '#f5222d' } }} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('cancelled')} value={summary.cancelled || 0} styles={{ content: { color: '#fa8c16' } }} /></Card></Col>
            <Col span={4}><Card><Statistic title={t('acceptance_rate')} value={acceptanceRate} suffix="%" /></Card></Col>
          </Row>

          <Tabs
            items={[
              {
                key: 'all',
                label: t('all_submissions'),
                children: (
                  <Table rowKey="id" loading={loading} dataSource={report?.items || []} columns={columns} pagination={{ pageSize: 20 }} />
                ),
              },
              {
                key: 'errors',
                label: `${t('errors')} (${errors.length})`,
                children: (
                  <Table rowKey="id" loading={loading} dataSource={errors} columns={errorColumns} pagination={{ pageSize: 20 }} />
                ),
              },
            ]}
          />
        </>
      )}

      <Modal
        title={t('qr_code')}
        open={!!qrInvoiceId}
        onCancel={() => setQrInvoiceId(null)}
        footer={null}
        destroyOnHidden
      >
        {qrImage ? (
          <div style={{ textAlign: 'center' }}>
            <Image src={qrImage.startsWith('data:') ? qrImage : `data:image/png;base64,${qrImage}`} alt="QR" />
          </div>
        ) : (
          <Spin />
        )}
      </Modal>
    </div>
  );
}
