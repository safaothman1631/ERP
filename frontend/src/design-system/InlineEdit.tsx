import React, { useState, useEffect } from 'react';
import { Input, Button, Space } from 'antd';
import { CheckOutlined, CloseOutlined, EditOutlined } from '@ant-design/icons';

export interface InlineEditProps {
  value: string;
  onSave: (next: string) => void | Promise<void>;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * InlineEdit — Sprint 10 — click-to-edit text field.
 */
export const InlineEdit: React.FC<InlineEditProps> = ({ value, onSave, placeholder, disabled }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = async () => {
    if (draft === value) { setEditing(false); return; }
    setBusy(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  if (!editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span>{value || <span style={{ color: '#94A3B8' }}>{placeholder ?? '—'}</span>}</span>
        {!disabled && (
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditing(true)} aria-label="Edit" />
        )}
      </span>
    );
  }

  return (
    <Space.Compact>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onPressEnter={commit}
        autoFocus
        disabled={busy}
        size="small"
        style={{ minWidth: 160 }}
      />
      <Button size="small" icon={<CheckOutlined />} type="primary" onClick={commit} loading={busy} />
      <Button size="small" icon={<CloseOutlined />} onClick={() => { setDraft(value); setEditing(false); }} disabled={busy} />
    </Space.Compact>
  );
};

export default InlineEdit;
