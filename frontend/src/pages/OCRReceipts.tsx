import { useEffect, useState } from 'react';
import {
  Card, Upload, Button, Form, Input, InputNumber, Table, Space, Tag, message, Row, Col, Image, Alert, Popconfirm,
} from 'antd';
import { InboxOutlined, ReloadOutlined, CheckOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';

const { Dragger } = Upload;

interface ParsedItem { description: string; amount: number; }
interface Parsed {
  vendor?: string; date?: string; total?: number; tax?: number; subtotal?: number;
  currency?: string; items?: ParsedItem[];
}
interface ScanResult {
  id?: string; status?: string; raw_text?: string; parsed?: Parsed; image_base64?: string; message?: string;
}
interface ScanListItem {
  id: string; filename?: string; status?: string; scanned_at?: string;
  parsed?: Parsed; linked_bill_id?: string;
}

export default function OCRReceipts() {
  const { t } = useTranslation();
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  const loadHistory = async () => {
    try {
      const res = await api.get('/api/ocr/scans');
      setHistory(res.data.items || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadHistory(); }, []);

  const customRequest = async ({ file, onSuccess, onError }: any) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file as Blob);
      const res = await api.post('/api/ocr/scan', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setScan(res.data);
      form.setFieldsValue(res.data.parsed || {});
      onSuccess?.(res.data);
      loadHistory();
    } catch (err) {
      message.error(t('error'));
      onError?.(err);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    if (!scan?.id) return;
    const v = await form.validateFields();
    try {
      await api.post('/api/ocr/confirm', { scan_id: scan.id, parsed: v });
      message.success(t('saved'));
      setScan(null);
      form.resetFields();
      loadHistory();
    } catch { message.error(t('error')); }
  };

  const removeScan = async (id: string) => {
    try { await api.delete(`/api/ocr/scans/${id}`); loadHistory(); }
    catch { message.error(t('error')); }
  };

  const showScan = async (id: string) => {
    try {
      const res = await api.get(`/api/ocr/scans/${id}`);
      setScan(res.data);
      form.setFieldsValue(res.data.parsed || {});
    } catch { message.error(t('error')); }
  };

  const histCols = [
    { title: t('filename'), dataIndex: 'filename' },
    { title: t('vendor'), key: 'vendor', render: (_: unknown, r: ScanListItem) => r.parsed?.vendor || '—' },
    { title: t('amount'), key: 'total', align: 'right' as const,
      render: (_: unknown, r: ScanListItem) => (r.parsed?.total || 0).toLocaleString() },
    { title: t('status'), dataIndex: 'status',
      render: (s?: string) => <Tag color={s === 'confirmed' ? 'green' : s === 'unconfigured' ? 'orange' : 'blue'}>{s}</Tag> },
    { title: t('scanned_at'), dataIndex: 'scanned_at',
      render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : '—' },
    {
      title: t('actions'),
      render: (_: unknown, r: ScanListItem) => (
        <Space>
          <Button size="small" onClick={() => showScan(r.id)}>{t('view')}</Button>
          <Popconfirm title={t('confirm_archive')} onConfirm={() => removeScan(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 16 }}>
      <Space style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('ocr_receipts')}</h2>
        <Button icon={<ReloadOutlined />} onClick={loadHistory}>{t('refresh')}</Button>
      </Space>

      {scan?.status === 'unconfigured' && (
        <Alert
          type="warning"
          message={t('ocr_engine_not_configured')}
          description={scan.message}
          style={{ marginBottom: 12 }}
        />
      )}

      <Row gutter={12}>
        <Col span={10}>
          <Card title={t('upload_receipt')}>
            <Dragger
              accept="image/*"
              showUploadList={false}
              customRequest={customRequest}
              disabled={loading}
            >
              <p className="ant-upload-drag-icon"><InboxOutlined /></p>
              <p className="ant-upload-text">{t('drag_drop_receipt')}</p>
              <p className="ant-upload-hint">JPG, PNG, max 10MB</p>
            </Dragger>

            {scan?.image_base64 && (
              <div style={{ marginTop: 12, textAlign: 'center' }}>
                <Image
                  src={`data:image/jpeg;base64,${scan.image_base64}`}
                  alt="receipt"
                  style={{ maxHeight: 320 }}
                />
              </div>
            )}
          </Card>
        </Col>

        <Col span={14}>
          <Card title={t('extracted_data')}
            extra={scan?.id ? (
              <Button type="primary" icon={<CheckOutlined />} onClick={confirm}>{t('confirm_create_bill')}</Button>
            ) : null}>
            <Form form={form} layout="vertical">
              <Row gutter={12}>
                <Col span={12}><Form.Item name="vendor" label={t('vendor')}><Input /></Form.Item></Col>
                <Col span={12}><Form.Item name="date" label={t('date')}><Input placeholder="YYYY-MM-DD" /></Form.Item></Col>
                <Col span={8}><Form.Item name="subtotal" label={t('subtotal')}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="tax" label={t('tax')}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={8}><Form.Item name="total" label={t('total')}><InputNumber style={{ width: '100%' }} /></Form.Item></Col>
                <Col span={24}><Form.Item name="currency" label={t('currency')}><Input /></Form.Item></Col>
              </Row>
            </Form>

            {scan?.parsed?.items && scan.parsed.items.length > 0 && (
              <>
                <h4>{t('line_items')}</h4>
                <Table
                  rowKey={(r, i) => `${i}`}
                  size="small"
                  pagination={false}
                  dataSource={scan.parsed.items}
                  columns={[
                    { title: t('description'), dataIndex: 'description' },
                    { title: t('amount'), dataIndex: 'amount', align: 'right' as const,
                      render: (n: number) => n.toLocaleString() },
                  ]}
                />
              </>
            )}

            {scan?.raw_text && (
              <details style={{ marginTop: 12 }}>
                <summary>{t('raw_text')}</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, background: '#fafafa', padding: 8 }}>
                  {scan.raw_text}
                </pre>
              </details>
            )}
          </Card>
        </Col>
      </Row>

      <Card title={t('scan_history')} style={{ marginTop: 16 }}>
        <Table rowKey="id" dataSource={history} columns={histCols} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
}
