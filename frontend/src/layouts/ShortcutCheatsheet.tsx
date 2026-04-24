import React from 'react';
import { Modal, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../stores/uiStore';
import { palette, space, radius } from '../theme/tokens';
import KbdHint from '../design-system/KbdHint';

interface Group {
  title: string;
  rows: { keys: string[]; label: string }[];
}

/**
 * ShortcutCheatsheet — Sprint 10 — global `?` opens this modal.
 */
export const ShortcutCheatsheet: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const { t } = useTranslation();
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);

  // Global `?` listener
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setOpen]);

  const groups: Group[] = [
    {
      title: t('shortcuts.title', 'Keyboard shortcuts'),
      rows: [
        { keys: ['Ctrl', 'K'], label: t('search_or_jump', 'Search or jump to…') },
        { keys: ['?'],         label: t('shortcuts.title', 'Keyboard shortcuts') },
        { keys: ['Esc'],       label: t('shortcuts.close', 'Close') },
      ],
    },
    {
      title: t('topbar.quick_create', 'Quick create'),
      rows: [
        { keys: ['c', 'i'], label: t('quick_create.invoice', 'پسووڵە') },
        { keys: ['c', 'b'], label: t('quick_create.bill', 'خەرجی فرۆشیار') },
        { keys: ['c', 'c'], label: t('quick_create.customer', 'کڕیار') },
        { keys: ['c', 'v'], label: t('quick_create.vendor', 'فرۆشیار') },
        { keys: ['c', 'p'], label: t('quick_create.item', 'کاڵا') },
        { keys: ['c', 'q'], label: t('quick_create.quote', 'نرخ') },
        { keys: ['c', 'j'], label: t('quick_create.manual_journal', 'تۆمارکردنی دەستکار') },
      ],
    },
    {
      title: 'Workspace tabs',
      rows: [
        { keys: ['Ctrl', '1..9'], label: 'Jump to tab N' },
        { keys: ['Ctrl', 'W'],    label: 'Close current tab' },
      ],
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      title={t('shortcuts.title', 'Keyboard shortcuts')}
      width={560}
      styles={{ body: { padding: space.lg } }}
    >
      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: space.lg }}>
          <Typography.Title level={5} style={{ marginTop: 0, marginBottom: space.sm, color: isDark ? palette.darkInk : palette.ink900 }}>
            {g.title}
          </Typography.Title>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', rowGap: space.xs, columnGap: space.lg }}>
            {g.rows.map((r, i) => (
              <React.Fragment key={i}>
                <span style={{ color: isDark ? palette.darkInkMuted : palette.ink700, fontSize: 13 }}>{r.label}</span>
                <KbdHint keys={r.keys} size="sm" />
              </React.Fragment>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
};

export default ShortcutCheatsheet;
