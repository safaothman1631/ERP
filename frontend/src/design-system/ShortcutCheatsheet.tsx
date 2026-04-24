import React, { useEffect, useState } from 'react';
import { Modal, Table } from 'antd';
import { useTranslation } from 'react-i18next';

export interface Shortcut {
  keys: string;
  description: string;
  group?: string;
}

export interface ShortcutCheatsheetProps {
  shortcuts?: Shortcut[];
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { keys: '⌘K / Ctrl+K', description: 'گەڕان', group: 'Navigation' },
  { keys: '?', description: 'پیشاندانی شۆرتکەتەکان', group: 'Navigation' },
  { keys: 'g d', description: 'بڕۆ بۆ Dashboard', group: 'Navigation' },
  { keys: 'g i', description: 'بڕۆ بۆ Invoices', group: 'Navigation' },
  { keys: 'c i', description: 'دروستکردنی Invoice نوێ', group: 'Create' },
  { keys: 'c b', description: 'دروستکردنی Bill نوێ', group: 'Create' },
  { keys: 'c c', description: 'دروستکردنی Contact نوێ', group: 'Create' },
  { keys: 'Esc', description: 'داخستن / Cancel', group: 'General' },
  { keys: 'Ctrl+S', description: 'پاشەکەوتکردن لە فۆرم', group: 'General' },
];

/**
 * ShortcutCheatsheet — Sprint 10 — opens with `?` key.
 */
export const ShortcutCheatsheet: React.FC<ShortcutCheatsheetProps> = ({ shortcuts = DEFAULT_SHORTCUTS }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      title={t('keyboard_shortcuts', 'کورتکراوەی کیبۆرد')}
      width={600}
    >
      <Table
        size="small"
        pagination={false}
        rowKey={(r) => r.keys}
        dataSource={shortcuts}
        columns={[
          { title: t('shortcut', 'کلیل'), dataIndex: 'keys', width: 160, render: (k: string) => <kbd style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{k}</kbd> },
          { title: t('action', 'کردار'), dataIndex: 'description' },
          { title: t('group', 'گرووپ'), dataIndex: 'group', width: 120 },
        ]}
      />
    </Modal>
  );
};

export default ShortcutCheatsheet;
