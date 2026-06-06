/* ============================================================================
   VertexProof — a self-contained, full-fidelity Vertex "Slate & Signal" proof.
   Route: /vertex.  Uses the REAL kit components (vx.tsx + vx-kit.css), the kit
   shell (SideNav + TopBar + Footer per shell.jsx) and kit screens (Dashboard,
   Invoices list, Invoice record per screens.jsx), with role switch + light/dark
   + RTL. Representative ERP data. Scoped under .vx-root so it can't touch the
   live app — this shows exactly what a full kit rebuild of the real app looks like.
   ============================================================================ */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import './vx-kit.css';
import { Icon, Logo, Button, IconBtn, Tag, Avatar, Input, Kpi, PageHead } from './vx';

/* ─────────────── data ─────────────── */
type Role = { id: string; en: string; ku: string; icon: string; accent: string; person: [string, string]; greet: [string, string]; home: string };
const ROLES: Role[] = [
  { id: 'owner', en: 'Owner', ku: 'خاوەن', icon: 'building', accent: '#7B61FF', person: ['Safa Othman', 'سەفا عوسمان'], greet: ['Run the whole business', 'هەموو بزنسەکە بەڕێوەببە'], home: '/dash' },
  { id: 'accountant', en: 'Accountant', ku: 'ژمێریار', icon: 'calculator', accent: '#1FAE63', person: ['Lana Hama', 'لانا حەمە'], greet: ['Keep the books balanced', 'هەژمارەکان هاوسەنگ ڕابگرە'], home: '/journals' },
  { id: 'sales', en: 'Sales Rep', ku: 'نوێنەری فرۆشتن', icon: 'cart', accent: '#2E8FE0', person: ['Karwan Aziz', 'کاروان عەزیز'], greet: ['Close more deals', 'مامەڵەی زیاتر تەواو بکە'], home: '/invoices' },
  { id: 'inventory', en: 'Inventory', ku: 'بەڕێوەبەری کۆگا', icon: 'box', accent: '#06B6D4', person: ['Dilan Rashid', 'دیلان ڕەشید'], greet: ['Keep stock flowing', 'کۆگا بەردەوام ڕابگرە'], home: '/items' },
  { id: 'cashier', en: 'Cashier', ku: 'فرۆشیار', icon: 'dollar', accent: '#F59E0B', person: ['Avan Jalal', 'ئاڤان جەلال'], greet: ['Ready to sell', 'ئامادەی فرۆشتن'], home: '/dash' },
  { id: 'hr', en: 'HR Manager', ku: 'بەڕێوەبەری HR', icon: 'briefcase', accent: '#C026D3', person: ['Shilan Omar', 'شیلان عومەر'], greet: ['Take care of the team', 'ئاگاداری تیمەکە بە'], home: '/employees' },
];
const roleById = (id: string) => ROLES.find(r => r.id === id) || ROLES[0];

type Link = [string, string, string]; // route, en, ku
type Section = { key: string; en: string; ku: string; icon: string; links: Link[] };
const ZONES: { zone: string; ku: string; sections: Section[] }[] = [
  { zone: 'Workspace', ku: 'شوێنی کار', sections: [
    { key: 'overview', en: 'Overview', ku: 'گشتی', icon: 'dotsGrid', links: [['/dash', 'Dashboard', 'داشبۆرد']] },
    { key: 'sales', en: 'Sales', ku: 'فرۆشتن', icon: 'cart', links: [['/invoices', 'Invoices', 'پسووڵەکان'], ['/quotes', 'Quotes', 'نرخنامەکان'], ['/customers', 'Customers', 'کڕیارەکان']] },
    { key: 'purchases', en: 'Purchases', ku: 'کڕین', icon: 'shoppingBag', links: [['/bills', 'Bills', 'پسوولەکان'], ['/po', 'Purchase Orders', 'داواکاری کڕین']] },
    { key: 'inventory', en: 'Inventory', ku: 'کۆگا', icon: 'box', links: [['/items', 'Items', 'کاڵاکان'], ['/stock', 'Stock', 'ستۆک']] },
  ] },
  { zone: 'Finance & Team', ku: 'دارایی و تیم', sections: [
    { key: 'accounting', en: 'Accounting', ku: 'ژمێریاری', icon: 'calculator', links: [['/journals', 'Journals', 'تۆمارەکان'], ['/coa', 'Chart of Accounts', 'پێرستی هەژمار'], ['/banking', 'Banking', 'بانکداری']] },
    { key: 'hr', en: 'People', ku: 'کارمەند', icon: 'briefcase', links: [['/employees', 'Employees', 'کارمەندان'], ['/payroll', 'Payroll', 'مووچە']] },
    { key: 'reports', en: 'Reports', ku: 'ڕاپۆرت', icon: 'barChart', links: [['/reports', 'Reports', 'ڕاپۆرتەکان']] },
    { key: 'settings', en: 'Settings', ku: 'ڕێکخستن', icon: 'settings', links: [['/settings', 'Settings', 'ڕێکخستنەکان']] },
  ] },
];
const ALL_LINKS = ZONES.flatMap(z => z.sections.flatMap(s => s.links.map(l => ({ route: l[0], en: l[1], ku: l[2], section: s.en, sectionKu: s.ku }))));

const NAMES = ['Al-Rafidain Trading', 'Zagros Foods LLC', 'Tigris Electronics', 'Babylon Hardware', 'Erbil Motors', 'Mosul Textiles', 'Basra Logistics', 'Najaf Pharma', 'Kirkuk Steel', 'Duhok Markets'];
const STAT = ['paid', 'pending', 'overdue', 'draft', 'sent', 'posted', 'partial', 'active'];
const fmt = (n: number) => n.toLocaleString('en-US');
const T = (lang: string, en: string, ku: string) => (lang === 'ku' ? ku : en);
function sampleRows(n = 9) {
  return Array.from({ length: n }, (_, i) => ({ id: `INV-${1042 - i}`, name: NAMES[i % NAMES.length], date: `May ${28 - i}`, status: STAT[i % STAT.length], amt: Math.round((9.6 - i * 0.9) * 1_000_000 + 240_000) }));
}

/* ─────────────── role accent (recolors the proof live) ─────────────── */
function applyRoleAccent(el: HTMLElement | null, hex: string) {
  if (!el) return;
  const set = (k: string, v: string) => el.style.setProperty(k, v);
  set('--accent-500', hex);
  set('--accent-400', `color-mix(in srgb, ${hex} 80%, #fff)`);
  set('--accent-300', `color-mix(in srgb, ${hex} 58%, #fff)`);
  set('--accent-600', `color-mix(in srgb, ${hex} 82%, #000)`);
  set('--accent-700', `color-mix(in srgb, ${hex} 62%, #000)`);
  set('--accent-soft', `color-mix(in srgb, ${hex} 16%, transparent)`);
  set('--accent-glow', `0 6px 24px color-mix(in srgb, ${hex} 40%, transparent)`);
}

/* ─────────────── Shell: SideNav ─────────────── */
const SideNav: React.FC<{ route: string; onNav: (r: string) => void; lang: string; drawerOpen: boolean; onPalette: () => void }> = ({ route, onNav, lang, drawerOpen, onPalette }) => {
  const activeSection = ALL_LINKS.find(l => l.route === route)?.section;
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const o: Record<string, boolean> = {}; ZONES.forEach(z => z.sections.forEach(s => { o[s.key] = s.en === activeSection || s.key === 'overview' || s.key === 'sales'; })); return o;
  });
  return (
    <aside className={`vx-scroll vx-side${drawerOpen ? ' open' : ''}`} style={{ width: 'var(--sidebar-w)', flexShrink: 0, height: '100vh', position: 'sticky', top: 0, alignSelf: 'flex-start', background: 'var(--surface)', borderInlineEnd: '1px solid var(--border)', display: 'flex', flexDirection: 'column', zIndex: 20, overflowY: 'auto' }}>
      <div style={{ height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', padding: '0 16px', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 2, flexShrink: 0 }}><Logo size={26} /></div>
      <div style={{ padding: '0 12px 10px' }}>
        <button onClick={onPalette} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 11px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--ink-500)', fontSize: 13 }}>
          <Icon name="search" size={15} /><span style={{ flex: 1, textAlign: 'start' }}>{T(lang, 'Search…', 'گەڕان…')}</span>
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 5px' }}>⌘K</kbd>
        </button>
      </div>
      <nav style={{ flex: 1, padding: '0 10px 14px' }}>
        {ZONES.map(z => (
          <div key={z.zone} style={{ marginBottom: 10 }}>
            <div className="vx-nav-sec">{T(lang, z.zone, z.ku)}</div>
            {z.sections.map(s => {
              const isOpen = open[s.key];
              const hasActive = s.links.some(l => l[0] === route);
              return (
                <div key={s.key}>
                  <button onClick={() => setOpen(o => ({ ...o, [s.key]: !o[s.key] }))} className="vx-nav" style={{ fontWeight: 600, color: hasActive ? 'var(--ink-900)' : 'var(--ink-700)' }}>
                    <Icon name={s.icon} size={17} style={{ color: hasActive ? 'var(--accent-500)' : 'var(--ink-500)' }} />
                    <span style={{ flex: 1, textAlign: 'start' }}>{T(lang, s.en, s.ku)}</span>
                    <Icon name="chevronDown" size={14} style={{ color: 'var(--ink-400)', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
                  </button>
                  {isOpen && (
                    <div style={{ marginInlineStart: 14, paddingInlineStart: 12, borderInlineStart: '1px solid var(--border)', marginBottom: 4 }}>
                      {s.links.map(l => (
                        <button key={l[0]} onClick={() => onNav(l[0])} className={`vx-nav${route === l[0] ? ' on' : ''}`} style={{ height: 32, fontSize: 13 }}>
                          <span style={{ textAlign: 'start' }}>{T(lang, l[1], l[2])}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
};

/* ─────────────── Shell: TopBar ─────────────── */
const TopBar: React.FC<{ route: string; lang: string; dark: boolean; role: string; onLang: () => void; onTheme: () => void; onMenu: () => void; onPalette: () => void; onRole: (id: string) => void }> = ({ route, lang, dark, role, onLang, onTheme, onMenu, onPalette, onRole }) => {
  const r = roleById(role);
  const link = ALL_LINKS.find(l => l.route === route) || { en: 'Dashboard', ku: 'داشبۆرد', section: 'Workspace', sectionKu: 'شوێنی کار' };
  const [menu, setMenu] = useState(false);
  const initials = (lang === 'ku' ? r.person[1] : r.person[0]).split(' ').map(w => w[0]).join('').slice(0, 2);
  return (
    <header style={{ height: 'var(--topbar-h)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 18px', background: 'var(--glass-bg)', WebkitBackdropFilter: 'var(--glass-blur)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 30 }}>
      <button className="vx-icon vx-hamburger" onClick={onMenu} aria-label="Menu" style={{ marginInlineStart: -6 }}><Icon name="menu" size={20} /></button>
      <div className="vx-crumb-zone" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5, minWidth: 0 }}>
        <span style={{ color: 'var(--ink-500)' }}>{T(lang, link.section, link.sectionKu)}</span>
        <Icon name="chevronRight" size={12} style={{ color: 'var(--ink-300)', transform: lang === 'ku' ? 'scaleX(-1)' : 'none' }} />
        <span style={{ color: 'var(--ink-900)', fontWeight: 600, whiteSpace: 'nowrap' }}>{T(lang, link.en, link.ku)}</span>
      </div>
      <button onClick={onPalette} className="vx-topsearch" style={{ marginInline: 'auto', display: 'flex', alignItems: 'center', gap: 8, width: 300, maxWidth: '26vw', height: 36, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 999, padding: '0 13px', color: 'var(--ink-500)', fontSize: 13 }}>
        <Icon name="search" size={14} /><span style={{ flex: 1, textAlign: 'start' }}>{T(lang, 'Search or jump to…', 'گەڕان…')}</span><kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5 }}>⌘K</kbd>
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 11px', borderRadius: 999, background: 'var(--accent-soft)', color: 'var(--accent-400)', fontSize: 12, fontWeight: 600, marginInlineEnd: 6, border: '1px solid color-mix(in srgb, var(--accent-500) 28%, transparent)' }}>
          <Icon name={r.icon} size={13} />{T(lang, r.en, r.ku)}
        </span>
        <Button variant="accent" size="sm" icon="plus" style={{ marginInlineEnd: 6 }}>{T(lang, 'New', 'نوێ')}</Button>
        <IconBtn name="bell" title="Notifications" badge={4} />
        <IconBtn name="help" title={T(lang, 'Help', 'یارمەتی')} />
        <button onClick={onLang} className="vx-icon" title="Language" style={{ width: 'auto', padding: '0 9px', fontSize: 12, fontWeight: 600, gap: 5 }}><Icon name="globe" size={16} />{lang === 'ku' ? 'KU' : 'EN'}</button>
        <IconBtn name={dark ? 'sun' : 'moon'} onClick={onTheme} title="Theme" />
        <span style={{ width: 1, height: 22, background: 'var(--border)', margin: '0 6px' }} />
        <div style={{ position: 'relative' }}>
          <button onClick={() => setMenu(m => !m)} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'transparent', padding: 2, borderRadius: 8 }}>
            <Avatar initials={initials} size={30} /><Icon name="chevronDown" size={13} style={{ color: 'var(--ink-400)' }} />
          </button>
          {menu && (
            <div className="vx-pop" style={{ position: 'absolute', top: 'calc(100% + 8px)', insetInlineEnd: 0, width: 240, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)', padding: 6, zIndex: 50 }}>
              <div style={{ padding: '8px 10px 10px', borderBottom: '1px solid var(--border)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar initials={initials} size={34} />
                <div><div style={{ fontSize: 13, fontWeight: 600 }}>{lang === 'ku' ? r.person[1] : r.person[0]}</div><div style={{ fontSize: 11.5, color: 'var(--accent-400)', fontWeight: 600 }}>{T(lang, r.en, r.ku)} · Zagros Trading</div></div>
              </div>
              <div className="vx-nav-sec" style={{ padding: '6px 10px 4px' }}>{T(lang, 'Switch role', 'گۆڕینی ڕۆڵ')}</div>
              {ROLES.map(x => (
                <button key={x.id} className="vx-nav" style={{ height: 34 }} onClick={() => { onRole(x.id); setMenu(false); }}>
                  <span style={{ width: 22, height: 22, borderRadius: 6, background: x.id === role ? 'var(--accent-soft)' : 'var(--surface-2)', color: x.id === role ? 'var(--accent-400)' : 'var(--ink-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name={x.icon} size={13} /></span>
                  <span style={{ flex: 1, textAlign: 'start' }}>{T(lang, x.en, x.ku)}</span>
                  {x.id === role && <Icon name="check" size={15} style={{ color: 'var(--accent-500)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

const Footer: React.FC<{ lang: string }> = ({ lang }) => (
  <footer style={{ height: 34, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', fontSize: 12, color: 'var(--ink-300)', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
    <span>Vertex · v2.0 · {T(lang, 'Baghdad, Iraq', 'بەغدا، عێراق')}</span>
    <span style={{ display: 'flex', gap: 16 }}><span>IQD / USD</span><span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--success-fg)' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success-500)' }} />{T(lang, 'Operational', 'چالاک')}</span></span>
  </footer>
);

/* ─────────────── Screen: Dashboard ─────────────── */
const Dashboard: React.FC<{ lang: string; role: string; onNav: (r: string) => void }> = ({ lang, role, onNav }) => {
  const r = roleById(role);
  const recent = sampleRows(5);
  const kpis: [string, string, string, string | undefined, number, string, number[]][] = [
    ['Total revenue', 'کۆی داهات', '182.4M', 'IQD', 12.4, 'dollar', [40, 52, 48, 61, 58, 72, 80]],
    ['Net profit', 'قازانجی پاک', '88.3M', 'IQD', 31.0, 'trendUp', [20, 28, 32, 40, 44, 52, 60]],
    ['Outstanding', 'ماوە', '38.7M', 'IQD', -3.2, 'clock', [60, 58, 55, 52, 50, 48, 44]],
    ['Cash position', 'باری نەقد', '147.4M', 'IQD', 8.1, 'bank', [80, 84, 88, 90, 96, 102, 110]],
  ];
  const data = [42, 55, 48, 67, 72, 63, 80, 78, 92, 88, 102, 110]; const W = 600, H = 150, max = Math.max(...data), step = W / (data.length - 1);
  const pts = data.map((v, i) => [i * step, H - (v / max) * (H - 12) - 6]); const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return (
    <div className="vx-page">
      <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-xl)', padding: 24, marginBottom: 16, color: '#fff', background: 'linear-gradient(135deg, var(--accent-700), var(--accent-500))' }}>
        <div style={{ position: 'absolute', top: -60, insetInlineEnd: -30, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.25), transparent 70%)', filter: 'blur(30px)' }} />
        <div style={{ position: 'relative' }}>
          <div style={{ fontSize: 12, opacity: .9, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.18)', padding: '2px 9px', borderRadius: 999, fontWeight: 600 }}><Icon name={r.icon} size={12} />{T(lang, r.en, r.ku)}</span>
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 8 }}>{T(lang, 'Good morning', 'بەیانیت باش')}, {(lang === 'ku' ? r.person[1] : r.person[0]).split(' ')[0]}</div>
          <div style={{ fontSize: 14, opacity: .9, marginTop: 4 }}>{T(lang, r.greet[0], r.greet[1])}.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 14 }}>
        {kpis.map((k, i) => <Kpi key={i} idSeed={`d${i}`} title={T(lang, k[0], k[1])} value={k[2]} unit={k[3]} delta={k[4]} icon={k[5]} spark={k[6]} sparkColor={k[4] < 0 ? 'var(--warning-500)' : 'var(--accent-500)'} />)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
        <div className="vx-card" style={{ padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div><div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{T(lang, 'Revenue', 'داهات')}</div><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{T(lang, 'Last 12 months · IQD', '١٢ مانگی ڕابردوو')}</div></div>
            <Tag status="paid">+18.2% YoY</Tag>
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 150 }}>
            <defs><linearGradient id="dvg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-500)" stopOpacity="0.28" /><stop offset="100%" stopColor="var(--accent-500)" stopOpacity="0" /></linearGradient></defs>
            <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="url(#dvg)" /><path d={line} fill="none" stroke="var(--accent-500)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className="vx-card" style={{ padding: 18 }}>
          <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--ink-900)' }}>{T(lang, 'Cash position', 'باری نەقد')}</div>
          <div style={{ fontSize: 12, color: 'var(--ink-500)', marginBottom: 14 }}>{T(lang, '3 bank accounts', '٣ هەژماری بانک')}</div>
          {([['Trade Bank of Iraq', 64, 'var(--accent-500)'], ['RT Bank', 28, 'var(--info-500)'], ['Cash', 8, 'var(--success-500)']] as [string, number, string][]).map((b, i) => (
            <div key={i} style={{ marginBottom: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 5 }}><span style={{ color: 'var(--ink-700)' }}>{b[0]}</span><span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{b[1]}%</span></div>
              <div style={{ height: 7, borderRadius: 999, background: 'var(--surface-2)', overflow: 'hidden' }}><div style={{ width: b[1] + '%', height: '100%', background: b[2] }} /></div>
            </div>
          ))}
        </div>
      </div>
      <div className="vx-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 18px' }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{T(lang, 'Recent invoices', 'پسووڵە نوێیەکان')}</div><Button variant="ghost" size="sm" onClick={() => onNav('/invoices')}>{T(lang, 'View all', 'هەموو')}</Button>
        </div>
        <table className="vx-table"><thead><tr><th>{T(lang, 'Invoice', 'پسووڵە')}</th><th>{T(lang, 'Customer', 'کڕیار')}</th><th>{T(lang, 'Status', 'دۆخ')}</th><th className="vx-num">{T(lang, 'Amount', 'بڕ')}</th></tr></thead>
          <tbody>{recent.map(row => <tr key={row.id} onClick={() => onNav('/invoices')}><td style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)' }}>{row.id}</td><td style={{ color: 'var(--ink-900)' }}>{row.name}</td><td><Tag status={row.status} /></td><td className="vx-num" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{fmt(row.amt)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────── Screen: Invoices list ─────────────── */
const InvoicesList: React.FC<{ lang: string; onOpen: () => void }> = ({ lang, onOpen }) => {
  const rows = useMemo(() => sampleRows(9), []);
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const tabs: [string, string][] = [['All', 'هەموو'], ['Open', 'کراوە'], ['Paid', 'دراو'], ['Overdue', 'دواکەوتوو']];
  const filtered = rows.filter(r => !query || (r.id + r.name).toLowerCase().includes(query.toLowerCase()))
    .filter(r => tab === 0 || (tab === 1 && ['pending', 'sent', 'draft', 'partial'].includes(r.status)) || (tab === 2 && ['paid', 'posted'].includes(r.status)) || (tab === 3 && r.status === 'overdue'));
  const kpis: [string, string, string][] = [['Outstanding', 'ماوە', '38.7M'], ['Overdue', 'دواکەوتوو', '12.1M'], ['Paid (30d)', 'دراو (٣٠ڕۆژ)', '96.4M'], ['Avg. days', 'ناوەند ڕۆژ', '18']];
  return (
    <div className="vx-page">
      <PageHead title={T(lang, 'Invoices', 'پسووڵەکان')} sub={`${filtered.length} ${T(lang, 'records', 'تۆمار')} · Sales`}>
        <Button variant="default" icon="download">{T(lang, 'Export', 'هەناردن')}</Button>
        <Button variant="accent" icon="plus" onClick={onOpen}>{T(lang, 'New invoice', 'پسووڵەی نوێ')}</Button>
      </PageHead>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 14 }}>
        {kpis.map((k, i) => <div key={i} className="vx-card" style={{ padding: '12px 14px' }}><div style={{ fontSize: 12, color: 'var(--ink-500)' }}>{T(lang, k[0], k[1])}</div><div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, marginTop: 2, color: 'var(--ink-900)' }}>{k[2]} <span style={{ fontSize: 12, color: 'var(--ink-400)' }}>IQD</span></div></div>)}
      </div>
      <div className="vx-card" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 4, padding: '4px 12px 0', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
          {tabs.map((t, i) => <button key={i} onClick={() => setTab(i)} style={{ position: 'relative', border: 'none', background: 'none', padding: 12, fontSize: 13.5, fontWeight: tab === i ? 600 : 500, color: tab === i ? 'var(--accent-500)' : 'var(--ink-500)', whiteSpace: 'nowrap' }}>{T(lang, t[0], t[1])}{tab === i && <span style={{ position: 'absolute', insetInline: 8, bottom: -1, height: 2, background: 'var(--accent-500)', borderRadius: 2 }} />}</button>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <div style={{ width: 260 }}><Input prefixIcon="search" placeholder={T(lang, 'Search…', 'گەڕان…')} value={query} onChange={(e) => setQuery(e.target.value)} suffix={query ? <span onClick={() => setQuery('')} style={{ cursor: 'pointer' }}><Icon name="close" size={14} /></span> : null} /></div>
          <button className="vx-btn vx-btn-default vx-btn-sm"><Icon name="filter" size={14} />{T(lang, 'Filters', 'فلتەر')}</button>
        </div>
        <table className="vx-table">
          <thead><tr><th>{T(lang, 'Invoice', 'پسووڵە')}</th><th>{T(lang, 'Customer', 'کڕیار')}</th><th>{T(lang, 'Date', 'بەروار')}</th><th>{T(lang, 'Status', 'دۆخ')}</th><th className="vx-num">{T(lang, 'Amount', 'بڕ')}</th><th style={{ width: 40 }} /></tr></thead>
          <tbody>{filtered.map(row => (
            <tr key={row.id} onClick={onOpen}>
              <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-900)', fontWeight: 500 }}>{row.id}</td>
              <td style={{ color: 'var(--ink-900)' }}>{row.name}</td>
              <td>{row.date}</td>
              <td><Tag status={row.status} /></td>
              <td className="vx-num" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{fmt(row.amt)} <span style={{ color: 'var(--ink-400)', fontSize: 11 }}>IQD</span></td>
              <td><span className="vx-icon" style={{ width: 28, height: 28 }} onClick={(e) => e.stopPropagation()}><Icon name="more" size={16} /></span></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
};

/* ─────────────── Screen: Invoice record ─────────────── */
const InvoiceRecord: React.FC<{ lang: string; onBack: () => void }> = ({ lang, onBack }) => {
  const lines = [['Steel rebar 12mm', 240, 12500], ['Cement bag 50kg', 120, 9000], ['Labour — site crew', 1, 1850000], ['Delivery (Baghdad)', 1, 320000]] as [string, number, number][];
  const sub = lines.reduce((s, l) => s + l[1] * l[2], 0); const tax = Math.round(sub * 0.05); const total = sub + tax;
  return (
    <div className="vx-page">
      <button onClick={onBack} className="vx-btn vx-btn-ghost vx-btn-sm" style={{ marginBottom: 14 }}><Icon name="chevronRight" size={14} style={{ transform: lang === 'ku' ? 'none' : 'scaleX(-1)' }} />{T(lang, 'Back to invoices', 'گەڕانەوە')}</button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-500)', textTransform: 'uppercase', letterSpacing: '.08em' }}>INV-1042</div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: '4px 0 6px' }}>Al-Rafidain Trading</h1>
          <Tag status="pending" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="default" icon="download">{T(lang, 'PDF', 'PDF')}</Button>
          <Button variant="default" icon="edit">{T(lang, 'Edit', 'دەستکاری')}</Button>
          <Button variant="accent" icon="checkCircle">{T(lang, 'Record payment', 'تۆمارکردنی پارە')}</Button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
        <div className="vx-card" style={{ overflow: 'hidden' }}>
          <table className="vx-table">
            <thead><tr><th>{T(lang, 'Item', 'کاڵا')}</th><th className="vx-num">{T(lang, 'Qty', 'بڕ')}</th><th className="vx-num">{T(lang, 'Price', 'نرخ')}</th><th className="vx-num">{T(lang, 'Total', 'کۆ')}</th></tr></thead>
            <tbody>{lines.map((l, i) => <tr key={i} style={{ cursor: 'default' }}><td style={{ color: 'var(--ink-900)' }}>{l[0]}</td><td className="vx-num">{l[1]}</td><td className="vx-num">{fmt(l[2])}</td><td className="vx-num" style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{fmt(l[1] * l[2])}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="vx-card" style={{ padding: 18, alignSelf: 'flex-start' }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--ink-900)' }}>{T(lang, 'Summary', 'کورتە')}</div>
          {([[T(lang, 'Subtotal', 'کۆی بەشەکان'), fmt(sub)], [T(lang, 'VAT 5%', 'VAT ٥٪'), fmt(tax)]] as [string, string][]).map((row, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 10, color: 'var(--ink-700)' }}><span>{row[0]}</span><span className="vx-num">{row[1]} IQD</span></div>
          ))}
          <div className="vx-divider" style={{ margin: '6px 0 12px' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><span style={{ fontWeight: 600, color: 'var(--ink-900)' }}>{T(lang, 'Total', 'کۆی گشتی')}</span><span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--ink-900)' }} className="vx-num">{fmt(total)} <span style={{ fontSize: 13, color: 'var(--ink-500)' }}>IQD</span></span></div>
        </div>
      </div>
    </div>
  );
};

/* ─────────────── Orchestrator ─────────────── */
const VertexProof: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [role, setRole] = useState('owner');
  const [lang, setLang] = useState<'en' | 'ku'>('ku');
  const [dark, setDark] = useState(false);
  const [route, setRoute] = useState('/dash');
  const [drawer, setDrawer] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);

  useEffect(() => { applyRoleAccent(rootRef.current, roleById(role).accent); }, [role]);

  const isRTL = lang === 'ku';
  const view = recordOpen ? 'record' : route === '/dash' ? 'dash' : route === '/invoices' ? 'invoices' : 'invoices';
  const nav = (r: string) => { setRecordOpen(false); setRoute(r); setDrawer(false); };

  return (
    <div ref={rootRef} className="vx-root" data-theme={dark ? 'dark' : 'light'} dir={isRTL ? 'rtl' : 'ltr'} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      {drawer && <div className="vx-backdrop" onClick={() => setDrawer(false)} />}
      <SideNav route={route} onNav={nav} lang={lang} drawerOpen={drawer} onPalette={() => { /* demo */ }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <TopBar route={route} lang={lang} dark={dark} role={role} onLang={() => setLang(l => (l === 'ku' ? 'en' : 'ku'))} onTheme={() => setDark(d => !d)} onMenu={() => setDrawer(true)} onPalette={() => { /* demo */ }} onRole={setRole} />
        <main style={{ flex: 1, padding: 24, maxWidth: 'var(--content-max)', width: '100%', margin: '0 auto' }}>
          {view === 'dash' && <Dashboard lang={lang} role={role} onNav={nav} />}
          {view === 'invoices' && <InvoicesList lang={lang} onOpen={() => setRecordOpen(true)} />}
          {view === 'record' && <InvoiceRecord lang={lang} onBack={() => setRecordOpen(false)} />}
        </main>
        <Footer lang={lang} />
      </div>
    </div>
  );
};

export default VertexProof;
