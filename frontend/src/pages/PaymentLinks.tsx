import { useState, useEffect, useMemo } from 'react';
import { Form, Input, InputNumber, Space, Modal, Button } from 'antd';
import { message } from '../utils/message';
import { PlusOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { PageHeader, StatusTag, type StatusKind, type ColumnVisibilityItem } from '../design-system';
import KitListCard from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../components/responsive/FormDialog';

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function PaymentLinks() {
 const { t } = useTranslation();
 const [data, setData] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [modalVisible, setModalVisible] = useState(false);
 const [form] = Form.useForm();
 const [search, setSearch] = useState('');
 const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('paymentLinks.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchData = async (page = 1) => {
 setLoading(true);
 try {
 const res = await api.get('/api/payment-links', { params: { page, page_size: pagination.pageSize } });
 setData(res.data.items || []);
 setPagination(p => ({ ...p, total: res.data.total || 0, current: page }));
 } catch {
 message.error(t('error'));
 }
 setLoading(false);
 };

 useEffect(() => {
 fetchData();
 }, []);

 const handleSubmit = async (values: any) => {
 try {
 await api.post('/api/payment-links', values);
 message.success(t('created'));
 setModalVisible(false);
 form.resetFields();
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 };

 const handleDelete = async (id: string) => {
 Modal.confirm({
 title: t('confirmDelete'),
 onOk: async () => {
 try {
 await api.delete(`/api/payment-links/${id}`);
 message.success(t('deleted'));
 fetchData(pagination.current);
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleCopyLink = (link: string) => {
 navigator.clipboard.writeText(link);
 message.success(t('copied'));
 };

 const statusKinds: Record<string, StatusKind> = {
 active: 'active',
 expired: 'error',
 used: 'info',
 };

 const columns = [
 {
 title: t('description'),
 dataIndex: 'description',
 key: 'description',
 render: (v: string) => (
 <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
 <span style={{
 width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
 background: 'var(--accent-soft)', color: 'var(--accent-500)',
 display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
 fontSize: 11, fontWeight: 700,
 }}>{initialsOf(v)}</span>
 <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{v || '—'}</span>
 </div>
 ),
 },
 {
 title: t('amount'),
 dataIndex: 'amount',
 key: 'amount',
 render: (v: number) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
 {v?.toLocaleString() || '0'}
 </span>
 ),
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (status: string) => (
 <StatusTag status={statusKinds[status] || 'default'} label={t(status)} />
 ),
 },
 {
 title: t('created'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (d: string) => <span style={{ color: 'var(--ink-500)' }}>{d?.substring(0, 10) || '—'}</span>,
 },
 {
 title: t('expires'),
 dataIndex: 'expires_at',
 key: 'expires_at',
 render: (d: string) => <span style={{ color: 'var(--ink-500)' }}>{d?.substring(0, 10) || '—'}</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: any, record: any) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 {
 key: 'copy',
 icon: <CopyOutlined />,
 label: t('copy_link'),
 onClick: () => handleCopyLink(record.link_url || `${window.location.origin}/pay/${record.id}`),
 },
 { type: 'divider' },
 {
 key: 'delete',
 icon: <DeleteOutlined />,
 label: t('delete'),
 danger: true,
 onClick: () => handleDelete(record.id),
 },
 ]}
 />
 ),
 },
 ];
 const filteredData = useMemo(() => {
 if (!search) return data;
 const q = search.toLowerCase();
 return data.filter((row: any) => Object.values(row).some(v => String(v ?? '').toLowerCase().includes(q)));
 }, [data, search]);
 const visibleColumns = useMemo(() => columns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, columns]);
 const columnsMeta: ColumnVisibilityItem[] = columns.map((c) => ({
 key: c.key as string,
 label: typeof c.title === 'string' ? c.title : (c.key as string),
 pinned: c.key === 'description' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('paymentLinks.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('payment_links')}
 subtitle={t('payment_links_subtitle', 'Payment links')}
 extra={
 <Space>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => {
 form.resetFields();
 setModalVisible(true);
 }}
 >
 {t('add')}
 </Button>
 </Space>
 }
 />
 <KitListCard
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('payment-links', data, cols);
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
 columns={visibleColumns}
 rowKey="id"
 loading={loading}
 pagination={{ ...pagination, onChange: fetchData }}
 />
 </KitListCard>
 <FormDialog
 title={t('create_payment_link')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item label={t('description')} name="description" rules={[{ required: true }]}>
 <Input placeholder={t('description')} />
 </Form.Item>
 <Form.Item label={t('amount')} name="amount" rules={[{ required: true }]}>
 <InputNumber min={0} style={{ width: '100%' }} placeholder={t('amount')} />
 </Form.Item>
 <Form.Item label={t('expiry_days')} name="expiry_days" initialValue={7}>
 <InputNumber min={1} max={365} style={{ width: '100%' }} />
 </Form.Item>
 <Form.Item label={t('notes')} name="notes">
 <Input.TextArea rows={2} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
}
