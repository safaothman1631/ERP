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
  { keys: '⌘K / Ctrl+K', description: 'keyboard_shortcuts.search', group: 'keyboard_shortcuts.navigation' },
  { keys: '?', description: 'keyboard_shortcuts.show_shortcuts', group: 'keyboard_shortcuts.navigation' },
  { keys: 'g d', description: 'keyboard_shortcuts.go_dashboard', group: 'keyboard_shortcuts.navigation' },
  { keys: 'g i', description: 'keyboard_shortcuts.go_invoices', group: 'keyboard_shortcuts.navigation' },
  { keys: 'c i', description: 'keyboard_shortcuts.create_invoice', group: 'keyboard_shortcuts.create' },
  { keys: 'c b', description: 'keyboard_shortcuts.create_bill', group: 'keyboard_shortcuts.create' },
  { keys: 'c c', description: 'keyboard_shortcuts.create_contact', group: 'keyboard_shortcuts.create' },
  { keys: 'Esc', description: 'keyboard_shortcuts.close_cancel', group: 'keyboard_shortcuts.general' },
  { keys: 'Ctrl+S', description: 'keyboard_shortcuts.save_form', group: 'keyboard_shortcuts.general' },
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
      title={t('keyboard_shortcuts.title')}
      width={600}
    >
      <Table
        size="small"
        pagination={false}
        rowKey={(r) => r.keys}
        dataSource={shortcuts}
        columns={[
          { title: t('keyboard_shortcuts.shortcut'), dataIndex: 'keys', width: 160, render: (k: string) => <kbd style={{ background: '#F1F5F9', padding: '2px 8px', borderRadius: 4, fontFamily: 'monospace' }}>{k}</kbd> },
          { title: t('keyboard_shortcuts.action'), dataIndex: 'description', render: (key: string) => t(key) },
          { title: t('keyboard_shortcuts.group'), dataIndex: 'group', width: 120, render: (key: string) => t(key) },
        ]}
      />
    </Modal>
  );
};

export default ShortcutCheatsheet;
