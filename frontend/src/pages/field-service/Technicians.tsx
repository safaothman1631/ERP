import React, { useEffect, useMemo, useState } from 'react';
import { Form, Input, Switch, Modal, Button } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, StatusTag, type ColumnVisibilityItem } from '../../design-system';
import KitListCard, { type KitListTab } from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitStatusFilter from '../../design-system/KitStatusFilter';
import KitSearchInput from '../../design-system/KitSearchInput';
import { downloadCsv } from '../../utils/exportCsv';
import { message } from '../../utils/message';
import type { ColumnsType } from 'antd/es/table';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Technician {
 id: string;
 name: string;
 phone?: string;
 email?: string;
 skills: string[];
 is_active: boolean;
 current_load?: number;
}

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
 String(name || '?')
 .trim()
 .split(/\s+/)
 .map((w) => w[0])
 .join('')
 .slice(0, 2)
 .toUpperCase();

const Technicians: React.FC = () => {
 const { t } = useTranslation();
 const [loading, setLoading] = useState(false);
 const [technicians, setTechnicians] = useState<Technician[]>([]);
 const [showModal, setShowModal] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [form] = Form.useForm();
 // Status segment (kit tabs + Status filter) — purely client-side over the
 // already-loaded list; the fetch endpoint takes no status param.
 const [statusTab, setStatusTab] = useState<'all' | 'active' | 'inactive'>('all');
 const [search, setSearch] = useState('');
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('technicians.hiddenCols') || '[]'); } catch { return []; }
 });

 const fetchTechnicians = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/field-service/workers', { params: { limit: 500 } });
 setTechnicians(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchTechnicians();
 }, []);

 const handleCreate = () => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({ is_active: true, skills: [] });
 setShowModal(true);
 };

 const handleEdit = (tech: Technician) => {
 setEditingId(tech.id);
 form.setFieldsValue({
 name: tech.name,
 phone: tech.phone,
 email: tech.email,
 skills: tech.skills.join(', '),
 is_active: tech.is_active,
 });
 setShowModal(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (tech: Technician) => {
 setEditingId(null);
 form.resetFields();
 form.setFieldsValue({
 name: `${tech.name ?? ''} (${t('copy', 'copy')})`,
 phone: tech.phone,
 email: tech.email,
 skills: tech.skills.join(', '),
 is_active: tech.is_active,
 });
 setShowModal(true);
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 content: t('delete_warning'),
 onOk: async () => {
 try {
 await api.delete(`/api/field-service/workers/${id}`);
 message.success(t('field_service.technician_deleted'));
 void fetchTechnicians();
 } catch {
 message.error(t('error'));
 }
 },
 });
 };

 const handleSubmit = async (values: Record<string, unknown>) => {
 const payload = {
 ...values,
 skills: typeof values.skills === 'string'
 ? (values.skills as string).split(',').map((s) => s.trim()).filter(Boolean)
 : [],
 };

 try {
 if (editingId) {
 await api.patch(`/api/field-service/workers/${editingId}`, payload);
 message.success(t('field_service.technician_updated'));
 } else {
 await api.post('/api/field-service/workers', payload);
 message.success(t('field_service.technician_created'));
 }
 setShowModal(false);
 form.resetFields();
 void fetchTechnicians();
 } catch {
 message.error(t('error'));
 }
 };

 // Client-side status filter for the kit tabs / Status dropdown.
 const data = useMemo(() => {
 let list = technicians;
 if (statusTab === 'active') list = list.filter((tech) => tech.is_active);
 else if (statusTab === 'inactive') list = list.filter((tech) => !tech.is_active);
 if (search) {
 const q = search.toLowerCase();
 list = list.filter((row: any) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(q)));
 }
 return list;
 }, [technicians, statusTab, search]);

 // Kit list tabs (All / Active / Inactive) with live counts.
 const activeCount = useMemo(() => technicians.filter((tech) => tech.is_active).length, [technicians]);
 const tabs: KitListTab[] = [
 { key: 'all', label: t('all', 'All'), count: technicians.length },
 { key: 'active', label: t('field_service.active'), count: activeCount },
 { key: 'inactive', label: t('inactive'), count: technicians.length - activeCount },
 ];

 const allColumns: ColumnsType<Technician> = [
 {
 title: t('field_service.technician_name'),
 dataIndex: 'name',
 key: 'name',
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
 title: t('field_service.technician_phone'),
 dataIndex: 'phone',
 key: 'phone',
 render: (phone: string) => phone
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{phone}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('email'),
 dataIndex: 'email',
 key: 'email',
 render: (email: string) => email
 ? <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{email}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('field_service.technician_skills'),
 dataIndex: 'skills',
 key: 'skills',
 render: (skills: string[]) => (
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
 {skills.map((skill, idx) => (
 <span key={idx} style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{skill}</span>
 ))}
 </div>
 ),
 },
 {
 title: t('field_service.current_load'),
 dataIndex: 'current_load',
 key: 'current_load',
 render: (load: number) => (
 <span style={{ color: 'var(--ink-900)', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{load || 0}</span>
 ),
 },
 {
 title: t('status'),
 dataIndex: 'is_active',
 key: 'is_active',
 render: (active: boolean) => (
 <StatusTag status={active ? 'success' : 'error'} label={active ? t('field_service.active') : t('inactive')} />
 ),
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: unknown, record: Technician) => (
 <KitRowActions
 ariaLabel={t('actions')}
 actions={[
 { key: 'view', icon: <EyeOutlined />, label: t('view', 'View'), onClick: () => handleEdit(record) },
 { key: 'edit', icon: <EditOutlined />, label: t('edit'), onClick: () => handleEdit(record) },
 { key: 'duplicate', icon: <CopyOutlined />, label: t('duplicate', 'Duplicate'), onClick: () => handleDuplicate(record) },
 { type: 'divider' },
 { key: 'delete', icon: <DeleteOutlined />, label: t('delete'), danger: true, onClick: () => handleDelete(record.id) },
 ]}
 />
 ),
 },
 ];

 const columns = useMemo(
 () => allColumns.filter((c) => !hiddenCols.includes(String(c.key))),
 // eslint-disable-next-line react-hooks/exhaustive-deps
 [hiddenCols, t],
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: String(c.key),
 label: typeof c.title === 'string' ? c.title : String(c.key),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('technicians.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <>
 <PageHeader
 title={t('field_service.technicians')}
 subtitle={t('field_service.title')}
 breadcrumb={[
 { label: t('dashboard'), to: '/' },
 { label: t('field_service.title') },
 { label: t('field_service.technicians') },
 ]}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('field_service.new_technician')}
 </Button>
 }
 />

 <KitListCard
 tabs={tabs}
 activeTab={statusTab}
 onTabChange={(k) => setStatusTab(k as typeof statusTab)}
 toolbar={
 <>
 <KitSearchInput value={search} onChange={(v) => setSearch(v)} placeholder={t('search')} />
 <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
 <KitFiltersButton
 activeCount={statusTab !== 'all' ? 1 : 0}
 onClear={() => setStatusTab('all')}
 >
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={statusTab === 'all' ? '' : statusTab}
 onChange={(v) => setStatusTab((v || 'all') as typeof statusTab)}
 options={[
 { value: 'active', label: t('field_service.active') },
 { value: 'inactive', label: t('inactive') },
 ]}
 />
 </KitFiltersButton>
 <KitStatusFilter
 label={t('status')}
 anyLabel={t('all', 'All')}
 value={statusTab === 'all' ? '' : statusTab}
 onChange={(v) => setStatusTab((v || 'all') as typeof statusTab)}
 options={[
 { value: 'active', label: t('field_service.active') },
 { value: 'inactive', label: t('inactive') },
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
 downloadCsv('technicians', data, cols);
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
 dataSource={data}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 20, showSizeChanger: true }}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('field_service.edit_technician') : t('field_service.new_technician')}
 open={showModal}
 onClose={() => {
 setShowModal(false);
 form.resetFields();
 }}
 onOk={() => form.submit()}
 >
 <Form form={form} layout="vertical" onFinish={handleSubmit}>
 <Form.Item
 name="name"
 label={t('field_service.technician_name')}
 rules={[{ required: true, message: t('required_field') }]}
 >
 <Input />
 </Form.Item>
 <Form.Item name="phone" label={t('field_service.technician_phone')}>
 <Input />
 </Form.Item>
 <Form.Item name="email" label={t('email')} rules={[{ type: 'email' }]}>
 <Input />
 </Form.Item>
 <Form.Item
 name="skills"
 label={t('field_service.technician_skills')}
 extra={t('comma_separated')}
 >
 <Input placeholder="HVAC, Plumbing, Electrical" />
 </Form.Item>
 <Form.Item name="is_active" label={t('field_service.active')} valuePropName="checked">
 <Switch />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default Technicians;
