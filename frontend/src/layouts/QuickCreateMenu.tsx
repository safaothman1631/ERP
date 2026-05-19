import React from 'react';
import { Input } from 'antd';
import {
 FileTextOutlined, FileDoneOutlined, UserAddOutlined,
 ShopOutlined, InboxOutlined, ProfileOutlined, BookOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../stores/uiStore';
import { palette, space, radius } from '../theme/tokens';
import { FormDialog } from '../components/responsive/FormDialog';

interface QuickItem {
 key: string;
 icon: React.ReactNode;
 i18nKey: string;
 fallback: string;
 shortcut: string; // single char after `c `
 to: string;
}

const QUICK_ITEMS: QuickItem[] = [
 { key: 'invoice', icon: <FileTextOutlined />, i18nKey: 'quick_create.invoice', fallback: 'پسووڵە', shortcut: 'I', to: '/invoices/new' },
 { key: 'bill', icon: <FileDoneOutlined />, i18nKey: 'quick_create.bill', fallback: 'خەرجی فرۆشیار', shortcut: 'B', to: '/bills' },
 { key: 'customer', icon: <UserAddOutlined />, i18nKey: 'quick_create.customer', fallback: 'کڕیار', shortcut: 'C', to: '/contacts' },
 { key: 'vendor', icon: <ShopOutlined />, i18nKey: 'quick_create.vendor', fallback: 'فرۆشیار', shortcut: 'V', to: '/contacts' },
 { key: 'item', icon: <InboxOutlined />, i18nKey: 'quick_create.item', fallback: 'کاڵا', shortcut: 'P', to: '/items' },
 { key: 'quote', icon: <ProfileOutlined />, i18nKey: 'quick_create.quote', fallback: 'نرخ', shortcut: 'Q', to: '/quotes' },
 { key: 'journal', icon: <BookOutlined />, i18nKey: 'quick_create.manual_journal', fallback: 'تۆمارکردنی دەستکار', shortcut: 'J', to: '/journals' },
];

interface QuickCreateMenuProps {
 isDark: boolean;
}

export const QuickCreateMenu: React.FC<QuickCreateMenuProps> = ({ isDark }) => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const open = useUiStore((s) => s.quickCreateOpen);
 const setOpen = useUiStore((s) => s.setQuickCreateOpen);
 const [query, setQuery] = React.useState('');

 React.useEffect(() => { if (!open) setQuery(''); }, [open]);

 const filtered = React.useMemo(() => {
 const q = query.trim().toLowerCase();
 if (!q) return QUICK_ITEMS;
 return QUICK_ITEMS.filter((it) => {
 const label = t(it.i18nKey, it.fallback).toString().toLowerCase();
 return label.includes(q) || it.key.includes(q) || it.shortcut.toLowerCase() === q;
 });
 }, [query, t]);

 const handleSelect = (it: QuickItem) => {
 setOpen(false);
 navigate(it.to);
 };

 return (
 <FormDialog
 open={open}
 onClose={() => setOpen(false)} hideFooter
 centered
 styles={{
 body: { padding: 0 },
 }}
 >
 <div style={{ background: isDark ? palette.darkSurface : palette.surface, padding: space.md, borderBottom: `1px solid ${isDark ? palette.darkBorder : palette.border}` }}>
 <Input
 autoFocus
 placeholder={t('quick_create.title', 'Quick create')}
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 variant="borderless"
 style={{ fontSize: 16 }}
 />
 </div>
 <div style={{ background: isDark ? palette.darkSurface : palette.surface, padding: space.sm, maxHeight: 480, overflowY: 'auto' }}>
 {filtered.length === 0 ? (
 <div style={{ padding: space.xl, textAlign: 'center', color: palette.ink500 }}>—</div>
 ) : (
 <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
 {filtered.map((it) => (
 <li key={it.key}>
 <button
 type="button"
 onClick={() => handleSelect(it)}
 style={{
 width: '100%',
 display: 'flex', alignItems: 'center', gap: space.md,
 padding: `${space.sm}px ${space.md}px`,
 background: 'transparent', border: 'none',
 borderRadius: radius.md,
 color: isDark ? palette.darkInk : palette.ink900,
 cursor: 'pointer',
 transition: 'background 120ms',
 textAlign: 'inherit',
 }}
 onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? palette.darkElevated : palette.bg; }}
 onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
 >
 <span style={{
 width: 32, height: 32, borderRadius: radius.sm,
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 background: isDark ? palette.darkElevated : palette.bg,
 color: palette.primary500, fontSize: 16,
 }}>
 {it.icon}
 </span>
 <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{t(it.i18nKey, it.fallback)}</span>
 <kbd style={{
 background: isDark ? palette.darkBg : palette.surface,
 border: `1px solid ${isDark ? palette.darkBorder : palette.border}`,
 borderRadius: 4, padding: '1px 6px',
 fontSize: 11, color: palette.ink500, fontFamily: 'inherit',
 }}>c {it.shortcut}</kbd>
 </button>
 </li>
 ))}
 </ul>
 )}
 </div>
 </FormDialog>
 );
};

export default QuickCreateMenu;

/**
 * Hook to register global `c i`, `c b`, `c c`, etc. sequences.
 * Press `c` then within 800ms press the second key to navigate.
 */
export function useQuickCreateKeyboard() {
 const navigate = useNavigate();
 React.useEffect(() => {
 let waitingForSecond = false;
 let timer: ReturnType<typeof setTimeout> | null = null;
 const reset = () => { waitingForSecond = false; if (timer) { clearTimeout(timer); timer = null; } };
 const handler = (e: KeyboardEvent) => {
 // Ignore when typing in inputs
 const tag = (e.target as HTMLElement)?.tagName;
 if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
 if (e.metaKey || e.ctrlKey || e.altKey) return;

 if (!waitingForSecond) {
 if (e.key.toLowerCase() === 'c') {
 waitingForSecond = true;
 timer = setTimeout(reset, 800);
 }
 return;
 }
 // Second key
 const k = e.key.toUpperCase();
 const it = QUICK_ITEMS.find((x) => x.shortcut === k);
 if (it) {
 e.preventDefault();
 navigate(it.to);
 }
 reset();
 };
 window.addEventListener('keydown', handler);
 return () => { window.removeEventListener('keydown', handler); reset(); };
 }, [navigate]);
}
