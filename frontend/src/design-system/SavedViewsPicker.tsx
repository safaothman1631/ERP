import React, { useEffect, useState } from 'react';
import { Select, Button, Modal, Form, Input, Space, Popconfirm } from 'antd';
import { SaveOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

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
          placeholder={t('saved_views', 'دیدە پاشەکەوتکراوەکان')}
          value={active}
          onChange={handleApply}
          allowClear
          style={{ minWidth: 180 }}
          options={views.map((v) => ({ label: v.name, value: v.id }))}
        />
        <Button icon={<SaveOutlined />} onClick={() => setModal(true)} title={t('save_view', 'پاشەکەوتکردنی دیدە')} />
        {active && (
          <Popconfirm title={t('confirm_delete', 'دڵنیایت؟')} onConfirm={() => handleDelete(active)}>
            <Button icon={<DeleteOutlined />} danger />
          </Popconfirm>
        )}
      </Space.Compact>
      <Modal title={t('save_view', 'پاشەکەوتکردنی دیدە')} open={modal} onCancel={() => setModal(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="name" label={t('name', 'ناو')} rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
};

export default SavedViewsPicker;
