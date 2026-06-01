/* ============================================================================
   Vertex kit primitives — ported from ui_kits/vertex-next/ui.jsx to React/TS.
   Markup + classes match the kit 1:1 so vx-kit.css styles them identically.
   `Icon` maps kit glyph names onto @ant-design/icons (already in the app).
   ============================================================================ */
import React, { useEffect, useRef, useState } from 'react';
import {
  SearchOutlined, BellOutlined, PlusOutlined, FileTextOutlined, ShoppingCartOutlined,
  InboxOutlined, CalculatorOutlined, DollarOutlined, BarChartOutlined, TeamOutlined,
  IdcardOutlined, WalletOutlined, SettingOutlined, GlobalOutlined, CheckCircleOutlined,
  DownOutlined, RightOutlined, MenuOutlined, QuestionCircleOutlined, BulbOutlined,
  BulbFilled, LogoutOutlined, CheckOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CloseOutlined, DownloadOutlined, FilterOutlined, ApartmentOutlined, RiseOutlined,
  ClockCircleOutlined, BankOutlined, ProfileOutlined, ShoppingOutlined, AppstoreOutlined,
  ControlOutlined, ReconciliationOutlined, ThunderboltOutlined, MoreOutlined, EditOutlined,
  DeleteOutlined, EyeOutlined, CopyOutlined, MailOutlined, LockOutlined,
} from '@ant-design/icons';

const ICONS: Record<string, React.ComponentType<{ style?: React.CSSProperties }>> = {
  search: SearchOutlined, bell: BellOutlined, plus: PlusOutlined, fileText: FileTextOutlined,
  cart: ShoppingCartOutlined, box: InboxOutlined, calculator: CalculatorOutlined, dollar: DollarOutlined,
  barChart: BarChartOutlined, users: TeamOutlined, briefcase: IdcardOutlined, wallet: WalletOutlined,
  settings: SettingOutlined, globe: GlobalOutlined, checkCircle: CheckCircleOutlined,
  chevronDown: DownOutlined, chevronRight: RightOutlined, menu: MenuOutlined, help: QuestionCircleOutlined,
  sun: BulbFilled, moon: BulbOutlined, logout: LogoutOutlined, check: CheckOutlined,
  arrowUp: ArrowUpOutlined, arrowDown: ArrowDownOutlined, close: CloseOutlined, download: DownloadOutlined,
  filter: FilterOutlined, building: ApartmentOutlined, trendUp: RiseOutlined, clock: ClockCircleOutlined,
  bank: BankOutlined, receipt: ProfileOutlined, shoppingBag: ShoppingOutlined, dotsGrid: AppstoreOutlined,
  command: ControlOutlined, reconcile: ReconciliationOutlined, bolt: ThunderboltOutlined, more: MoreOutlined,
  edit: EditOutlined, trash: DeleteOutlined, eye: EyeOutlined, copy: CopyOutlined,
  mail: MailOutlined, lock: LockOutlined,
};

export const Icon: React.FC<{ name: string; size?: number; style?: React.CSSProperties; className?: string }> = ({ name, size = 16, style, className }) => {
  const Cmp = ICONS[name] || AppstoreOutlined;
  return <Cmp className={className} style={{ fontSize: size, lineHeight: 0, ...style }} />;
};

/* logo mark — isometric violet square (kit uses an SVG asset; this is a token-built stand-in) */
export const Logo: React.FC<{ size?: number; wordmark?: boolean }> = ({ size = 28, wordmark = true }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
    <span style={{ width: size, height: size, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent-400), var(--accent-700))', display: 'inline-block', flexShrink: 0, boxShadow: 'var(--accent-glow)' }} />
    {wordmark && <span style={{ fontFamily: 'var(--font-display)', fontSize: size * 0.66, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink-900)' }}>Vertex</span>}
  </div>
);

type BtnVariant = 'default' | 'accent' | 'ghost' | 'danger';
export const Button: React.FC<{ variant?: BtnVariant; size?: 'sm' | 'lg'; icon?: string; iconRight?: string; children?: React.ReactNode; onClick?: () => void; style?: React.CSSProperties; type?: 'button' | 'submit'; disabled?: boolean }> =
  ({ variant = 'default', size, icon, iconRight, children, onClick, style, type, disabled }) => (
    <button type={type || 'button'} disabled={disabled} onClick={onClick} style={style} className={`vx-btn vx-btn-${variant}${size ? ' vx-btn-' + size : ''}`}>
      {icon && <Icon name={icon} size={size === 'lg' ? 17 : 15} />}{children}{iconRight && <Icon name={iconRight} size={15} />}
    </button>
  );

export const IconBtn: React.FC<{ name: string; onClick?: () => void; title?: string; badge?: number; size?: number; style?: React.CSSProperties }> =
  ({ name, onClick, title, badge, size = 18, style }) => (
    <button className="vx-icon" onClick={onClick} title={title} aria-label={title} style={style}>
      <Icon name={name} size={size} />
      {badge ? <span style={{ position: 'absolute', top: 3, insetInlineEnd: 3, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, background: 'var(--danger-500)', color: 'var(--on-accent)', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)' }}>{badge}</span> : null}
    </button>
  );

const TAG: Record<string, [string, string, string, string]> = {
  paid: ['var(--success-bg)', 'var(--success-fg)', 'var(--success-500)', 'Paid'],
  pending: ['var(--warning-bg)', 'var(--warning-fg)', 'var(--warning-500)', 'Pending'],
  overdue: ['var(--danger-bg)', 'var(--danger-fg)', 'var(--danger-500)', 'Overdue'],
  draft: ['var(--slate-100)', 'var(--ink-500)', 'var(--slate-400)', 'Draft'],
  sent: ['var(--info-bg)', 'var(--info-fg)', 'var(--info-500)', 'Sent'],
  active: ['var(--success-bg)', 'var(--success-fg)', 'var(--success-500)', 'Active'],
  posted: ['var(--info-bg)', 'var(--info-fg)', 'var(--info-500)', 'Posted'],
  partial: ['var(--warning-bg)', 'var(--warning-fg)', 'var(--warning-500)', 'Partial'],
  low: ['var(--danger-bg)', 'var(--danger-fg)', 'var(--danger-500)', 'Low stock'],
};
export const Tag: React.FC<{ status?: string; children?: React.ReactNode; dot?: boolean }> = ({ status = 'draft', children, dot = true }) => {
  const t = TAG[status] || TAG.draft;
  return <span className="vx-tag" style={{ background: t[0], color: t[1] }}>{dot && <span className="d" style={{ background: t[2] }} />}{children || t[3]}</span>;
};

export const Avatar: React.FC<{ initials?: string; size?: number }> = ({ initials = 'SA', size = 30 }) => (
  <div style={{ width: size, height: size, borderRadius: 8, flexShrink: 0, background: 'linear-gradient(135deg,var(--accent-400),var(--accent-600))', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700 }}>{initials}</div>
);

export const Input: React.FC<{ prefixIcon?: string; suffix?: React.ReactNode; placeholder?: string; value?: string; onChange?: (e: { target: { value: string } }) => void; size?: 'lg' }> =
  ({ prefixIcon, suffix, placeholder, value, onChange, size }) => (
    <div className={`vx-input${size === 'lg' ? ' lg' : ''}`}>
      {prefixIcon && <span className="ic"><Icon name={prefixIcon} size={16} /></span>}
      <input type="text" placeholder={placeholder} value={value} onChange={onChange as React.ChangeEventHandler<HTMLInputElement>} />
      {suffix && <span className="ic">{suffix}</span>}
    </div>
  );

export const Sparkline: React.FC<{ data: number[]; color?: string; w?: number; h?: number; idSeed: string }> = ({ data, color = 'var(--accent-500)', w = 240, h = 40, idSeed }) => {
  const max = Math.max(...data), min = Math.min(...data), r = max - min || 1, step = w / (data.length - 1);
  const pts = data.map((v, i) => [i * step, h - ((v - min) / r) * (h - 4) - 2]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const id = 'sp' + idSeed;
  return (
    <svg width={w} height={h} style={{ width: '100%', display: 'block' }} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.3" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <path d={`${line} L${w} ${h} L0 ${h} Z`} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const Kpi: React.FC<{ title: string; value: string; unit?: string; delta?: number; deltaLabel?: string; icon?: string; spark?: number[]; sparkColor?: string; idSeed: string }> =
  ({ title, value, unit, delta, deltaLabel, icon, spark, sparkColor, idSeed }) => {
    const up = (delta ?? 0) >= 0;
    return (
      <div className="vx-card vx-card-h" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--ink-500)' }}>{title}</span>
          {icon && <span style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent-soft)', color: 'var(--accent-400)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={16} /></span>}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', fontVariantNumeric: 'tabular-nums' }}>
          {value}{unit && <span style={{ fontSize: 14, color: 'var(--ink-500)', fontWeight: 600, fontFamily: 'var(--font-ui)' }}> {unit}</span>}
        </div>
        {delta != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, marginTop: 6, color: up ? 'var(--success-fg)' : 'var(--danger-fg)' }}>
            <Icon name={up ? 'arrowUp' : 'arrowDown'} size={12} /><span style={{ fontWeight: 600 }}>{Math.abs(delta).toFixed(1)}%</span>
            {deltaLabel && <span style={{ color: 'var(--ink-500)', fontWeight: 400 }}>· {deltaLabel}</span>}
          </div>
        )}
        {spark && <div style={{ marginTop: 10 }}><Sparkline data={spark} color={sparkColor || 'var(--accent-500)'} idSeed={idSeed} /></div>}
      </div>
    );
  };

export const PageHead: React.FC<{ title: string; sub?: string; children?: React.ReactNode }> = ({ title, sub, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
    <div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink-900)', margin: 0 }}>{title}</h1>
      {sub && <p style={{ fontSize: 13.5, color: 'var(--ink-500)', margin: '5px 0 0' }}>{sub}</p>}
    </div>
    {children && <div style={{ display: 'flex', gap: 8 }}>{children}</div>}
  </div>
);

export const Select: React.FC<{ value?: string; onChange?: (e: { target: { value: string } }) => void; options: string[]; placeholder?: string; size?: 'lg' }> =
  ({ value, onChange, options, placeholder, size }) => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (!open) return;
      const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
      document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);
    return (
      <div ref={ref} style={{ position: 'relative' }}>
        <button type="button" onClick={() => setOpen(o => !o)} className={`vx-input${size === 'lg' ? ' lg' : ''}`}
          style={{ width: '100%', cursor: 'pointer', borderColor: open ? 'var(--accent-500)' : undefined, boxShadow: open ? '0 0 0 3px var(--accent-soft)' : undefined, textAlign: 'start' }}>
          <span style={{ flex: 1, color: value ? 'var(--ink-900)' : 'var(--ink-300)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || placeholder || 'Select…'}</span>
          <Icon name="chevronDown" size={15} style={{ color: 'var(--ink-400)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .16s' }} />
        </button>
        {open && (
          <div className="vx-page vx-scroll" style={{ position: 'absolute', top: 'calc(100% + 6px)', insetInline: 0, zIndex: 60, maxHeight: 220, overflowY: 'auto', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: 5 }}>
            {options.map(o => {
              const on = o === value;
              return (
                <button key={o} type="button" onClick={() => { onChange?.({ target: { value: o } }); setOpen(false); }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 34, padding: '0 10px', border: 'none', borderRadius: 'var(--radius-sm)', background: on ? 'var(--accent-soft)' : 'transparent', color: on ? 'var(--accent-500)' : 'var(--ink-700)', fontSize: 13.5, fontWeight: on ? 600 : 500, textAlign: 'start', cursor: 'pointer' }}>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o}</span>{on && <Icon name="check" size={15} />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };
