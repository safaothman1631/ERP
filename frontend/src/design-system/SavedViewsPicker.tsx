import React, { useEffect, useState } from 'react';
import { Select, Button, Form, Input, Space, Popconfirm } from 'antd';
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FormDialog } from '../components/responsive/FormDialog';

export interface SavedView {
 id: string;
 name: string;
 state: unknown;
}

export interface SavedViewsPickerProps {
 storageKey: string;
 currentState: unknown;
 onApply: (state: unknown) => void;
}

/**
 * SavedViewsPicker — Sprint 5 — localStorage-backed saved filter/column views.
 */
export const SavedViewsPicker: React.FC<SavedViewsPickerProps> = ({ storageKey, currentState, onApply }) => {
 const { t } = useTranslation();
 const [views, setViews] = useState<SavedView[]>([]);
 const [active, setActive] = useState<string | undefined>();
 const [modal, setModal] = useState(false);
 const [form] = Form.useForm<{ name: string }>();

 useEffect(() => {
 try {
 const raw = localStorage.getItem(`views.${storageKey}`);
 if (raw) setViews(JSON.parse(raw));
 } catch { /* noop */ }
 }, [storageKey]);

 const persist = (next: SavedView[]) => {
 setViews(next);
 try { localStorage.setItem(`views.${storageKey}`, JSON.stringify(next)); } catch { /* noop */ }
 };

 const handleSave = (values: { name: string }) => {
 const v: SavedView = { id: crypto.randomUUID(), name: values.name, state: currentState };
 persist([...views, v]);
 setActive(v.id);
 setModal(false);
 form.resetFields();
 };

 const handleApply = (id: string) => {
 setActive(id);
 const v = views.find((x) => x.id === id);
 if (v) onApply(v.state);
 };

 const handleDelete = (id: string) => {
 persist(views.filter((v) => v.id !== id));
 if (active === id) setActive(undefined);
 };

 return (
 <>
 <Space.Compact>
 <Select
 placeholder={t('saved_views', 'Saved views')}
 value={active}
 onChange={handleApply}
 allowClear
 style={{ minWidth: 180 }}
 options={views.map((v) => ({ label: v.name, value: v.id }))}
 />
 <Button icon={<SaveOutlined />} onClick={() => setModal(true)} title={t('save_view', 'Save view')} />
 {active && (
 <Popconfirm title={t('confirm_delete', 'Delete?')} onConfirm={() => handleDelete(active)}>
 <Button icon={<DeleteOutlined />} danger />
 </Popconfirm>
 )}
 </Space.Compact>
 <FormDialog title={t('save_view', 'Save view')} open={modal} onClose={() => setModal(false)} onOk={() => form.submit()}>
 <Form form={form} layout="vertical" onFinish={handleSave}>
 <Form.Item name="name" label={t('name', 'Name')} rules={[{ required: true }]}>
 <Input autoFocus />
 </Form.Item>
 </Form>
 </FormDialog>
 </>
 );
};

export default SavedViewsPicker;
