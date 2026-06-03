import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, Form, message, Modal, Tag } from 'antd';
import { useTranslation } from 'react-i18next';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined, CopyOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { PageHeader, type ColumnVisibilityItem } from '../../design-system';
import KitListCard from '../../design-system/KitListCard';
import KitListToolbarActions from '../../design-system/KitListToolbarActions';
import KitRowActions from '../../design-system/KitRowActions';
import KitFiltersButton from '../../design-system/KitFiltersButton';
import KitSearchInput from '../../design-system/KitSearchInput';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { downloadCsv } from '../../utils/exportCsv';
import api from '../../api';
import { FormDialog } from '../../components/responsive/FormDialog';

interface Patient {
 id: string;
 name: string;
 phone?: string;
 dob?: string;
 gender: string;
 blood_type?: string;
 allergies?: string[];
 last_visit?: string;
 created_at?: string;
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

const PatientsList: React.FC = () => {
 const { t } = useTranslation();
 const [form] = Form.useForm();
 const [loading, setLoading] = useState(false);
 const [patients, setPatients] = useState<Patient[]>([]);
 const [searchText, setSearchText] = useState('');
 const [modalVisible, setModalVisible] = useState(false);
 const [editingId, setEditingId] = useState<string | null>(null);
 const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
 try { return JSON.parse(localStorage.getItem('patients.hiddenCols') || '[]'); } catch { return []; }
 });

 useEffect(() => {
 void fetchPatients();
 }, []);

 const fetchPatients = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/healthcare/patients', { params: { limit: 500 } });
 setPatients(res.data.items);
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 const handleCreate = () => {
 setEditingId(null);
 form.resetFields();
 setModalVisible(true);
 };

 const handleEdit = (record: Patient) => {
 setEditingId(record.id);
 form.setFieldsValue(record);
 setModalVisible(true);
 };

 // Duplicate: open the create form pre-filled with this record's values (no id).
 const handleDuplicate = (record: Patient) => {
 setEditingId(null);
 const { id: _id, ...rest } = record;
 form.setFieldsValue({ ...rest, name: `${record.name ?? ''} (${t('copy', 'copy')})` });
 setModalVisible(true);
 };

 const handleSave = async () => {
 try {
 const values = await form.validateFields();
 if (editingId) {
 await api.patch(`/api/healthcare/patients/${editingId}`, values);
 void message.success(t('saved'));
 } else {
 await api.post('/api/healthcare/patients', values);
 void message.success(t('created'));
 }
 setModalVisible(false);
 void fetchPatients();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 };

 const handleDelete = (id: string) => {
 Modal.confirm({
 title: t('confirm_delete'),
 okButtonProps: { danger: true },
 onOk: async () => {
 try {
 await api.delete(`/api/healthcare/patients/${id}`);
 void message.success(t('deleted'));
 void fetchPatients();
 } catch (error) {
 console.error(error);
 void message.error(t('error'));
 }
 },
 });
 };

 const filteredPatients = patients.filter(
 (p) =>
 p.name?.toLowerCase().includes(searchText.toLowerCase()) ||
 p.phone?.toLowerCase().includes(searchText.toLowerCase())
 );

 const allColumns: ColumnsType<Patient> = [
 {
 title: t('healthcare.name'),
 dataIndex: 'name',
 key: 'name',
 sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
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
 title: t('healthcare.phone'),
 dataIndex: 'phone',
 key: 'phone',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('healthcare.dob'),
 dataIndex: 'dob',
 key: 'dob',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('healthcare.gender'),
 dataIndex: 'gender',
 key: 'gender',
 render: (gender: string) => (
 <span style={{
 display: 'inline-block', padding: '2px 9px', borderRadius: 'var(--radius-sm, 6px)',
 background: 'var(--surface-2)', border: '1px solid var(--border)',
 fontSize: 11.5, fontWeight: 600, color: 'var(--ink-600)',
 }}>{t(`healthcare.gender_${gender}`)}</span>
 ),
 },
 {
 title: t('healthcare.blood_type'),
 dataIndex: 'blood_type',
 key: 'blood_type',
 render: (v: string) => v
 ? <span style={{ color: 'var(--ink-900)', fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 12.5 }}>{v}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('healthcare.allergies'),
 dataIndex: 'allergies',
 key: 'allergies',
 render: (allergies?: string[]) =>
 allergies && allergies.length > 0 ? allergies.map((a) => <Tag key={a}>{a}</Tag>) : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: t('healthcare.last_visit'),
 dataIndex: 'last_visit',
 key: 'last_visit',
 render: (date?: string) => date
 ? <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>{date.substring(0, 10)}</span>
 : <span style={{ color: 'var(--ink-400)' }}>—</span>,
 },
 {
 title: '',
 key: 'actions',
 width: 56,
 align: 'center' as const,
 render: (_: unknown, record: Patient) => (
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
 [hiddenCols, t]
 );
 const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
 key: String(c.key),
 label: typeof c.title === 'string' ? c.title : String(c.key),
 pinned: c.key === 'name' || c.key === 'actions',
 }));
 const persistHidden = (next: string[]) => {
 setHiddenCols(next);
 try { localStorage.setItem('patients.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
 };

 return (
 <div>
 <PageHeader
 title={t('healthcare.patients')}
 subtitle={t('healthcare.patients_subtitle')}
 extra={
 <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
 {t('healthcare.new_patient')}
 </Button>
 }
 />

 <KitListCard
 toolbar={
 <>
 <KitSearchInput
 value={searchText}
 onChange={(v) => setSearchText(v)}
 placeholder={t('search')}
 />
 <KitFiltersButton
 activeCount={searchText ? 1 : 0}
 onClear={() => setSearchText('')}
 >
 <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 220 }}>
 <span style={{ fontSize: 12, color: 'var(--ink-500)' }}>{t('search', 'Search')}</span>
 <Input
 placeholder={t('healthcare.search_patient')}
 value={searchText}
 onChange={(e) => setSearchText(e.target.value)}
 allowClear
 />
 </div>
 </KitFiltersButton>
 <div style={{ marginInlineStart: 'auto' }}>
 <KitListToolbarActions
 columns={columnsMeta.filter((c) => c.key !== 'actions')}
 hiddenCols={hiddenCols}
 onColumnsChange={persistHidden}
 onExport={() => {
 const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
 downloadCsv('patients', filteredPatients, cols);
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
 dataSource={filteredPatients}
 columns={columns}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 50, showSizeChanger: true }}
 />
 </KitListCard>

 <FormDialog
 title={editingId ? t('healthcare.edit_patient') : t('healthcare.new_patient')}
 open={modalVisible}
 onClose={() => setModalVisible(false)}
 onOk={() => void handleSave()}
 >
 <Form form={form} layout="vertical">
 <Form.Item name="name" label={t('healthcare.name')} rules={[{ required: true }]}>
 <Input />
 </Form.Item>
 <Form.Item name="phone" label={t('healthcare.phone')}>
 <Input />
 </Form.Item>
 <Form.Item name="dob" label={t('healthcare.dob')}>
 <Input type="date" />
 </Form.Item>
 <Form.Item name="gender" label={t('healthcare.gender')} initialValue="unknown">
 <Input />
 </Form.Item>
 <Form.Item name="blood_type" label={t('healthcare.blood_type')}>
 <Input placeholder="A+, B-, O+, AB+" />
 </Form.Item>
 <Form.Item name="allergies" label={t('healthcare.allergies')}>
 <Input placeholder={t('healthcare.allergies_hint')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default PatientsList;
