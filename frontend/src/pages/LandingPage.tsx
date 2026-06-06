/**
 * LandingPage.tsx — Vertex "Slate & Signal" marketing landing.
 *
 * Faithful port of the kit's landing (design-system/.../landing/index.html):
 * glass nav, hero + product mock, modules grid, product split, "Built for Iraq"
 * band, stats, gradient CTA, footer — with the dotted grid + violet/blue glow
 * orbs and Inter Tight display type. All colours resolve from the global Vertex
 * tokens (theme/vertex-tokens.css) via a `data-theme="dark"` wrapper.
 *
 * Bilingual (en/ku) via an inline T() helper, RTL-correct (logical properties),
 * CTAs wired to /signup + /login. Responsive via useViewport.
 */
import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useViewport } from '../hooks/useViewport';

const T = (ku: boolean, en: string, k: string) => (ku ? k : en);

/* stacked-vertex logo mark (from the kit asset) */
const LogoMark: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 20 40" style={{ display: 'block', flexShrink: 0 }} aria-hidden>
    <path d="M10 0 L20 6 L10 12 L0 6 Z" fill="#7B61FF" />
    <path d="M10 14 L20 20 L10 26 L0 20 Z" fill="#9275FF" />
    <path d="M10 28 L20 34 L10 40 L0 34 Z" fill="#AC97FF" />
  </svg>
);

/* inline icon set used across the page (kit SVG paths) */
const I: Record<string, React.ReactNode> = {
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <><circle cx="12" cy="12" r="9" /><path d="m10 9 5 3-5 3z" fill="currentColor" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  accounting: <><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v2" /></>,
  sales: <><path d="M2.5 3h2l2.6 13h11.4l1.5-8H6" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  inventory: <><path d="M3 9 12 4l9 5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 9l9 5 9-5M12 14v8" /></>,
  pos: <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />,
  hr: <><path d="M20 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2ZM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>,
  reports: <path d="M3 21h18M7 21V11M12 21V5M17 21v-7" />,
  cmd: <path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3Z" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 3.8 5.7 3.8 9s-1.3 6.5-3.8 9" /></>,
  shield: <><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  offline: <><path d="M12 3a9 9 0 1 0 9 9" /><path d="M21 3v6h-6" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
  whatsapp: <path d="M21 11.5a8.5 8.5 0 0 1-12.5 7.5L3 21l2-5.5A8.5 8.5 0 1 1 21 11.5Z" />,
  dash: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
};
const Svg: React.FC<{ p: string; w?: number }> = ({ p, w = 22 }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: w, height: w }}>{I[p]}</svg>
);

const LANDING_CSS = `
.vx-landing { background: var(--bg); color: var(--ink-900); font-family: var(--font-ui); -webkit-font-smoothing: antialiased; overflow-x: hidden; min-height: 100vh; position: relative; }
.vx-landing[dir="rtl"] { font-family: var(--font-rtl); }
.vx-landing *, .vx-landing *::before, .vx-landing *::after { box-sizing: border-box; }
.vx-landing a { color: inherit; text-decoration: none; }
.vx-landing ::selection { background: var(--accent-soft); }
.vx-landing .wrap { max-width: 1200px; margin: 0 auto; padding: 0 32px; }
.vx-landing svg { display: block; }
.vx-landing .bg-fx { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
.vx-landing .orb { position: absolute; border-radius: 50%; filter: blur(90px); }
.vx-landing .orb-1 { width: 600px; height: 600px; top: -240px; left: -120px; /* rtl-ignore decorative */ background: radial-gradient(circle, var(--accent-500) 0%, transparent 68%); opacity: .4; }
.vx-landing .orb-2 { width: 520px; height: 520px; top: 120px; right: -160px; /* rtl-ignore decorative */ background: radial-gradient(circle, #2E8FE0 0%, transparent 70%); opacity: .2; }
.vx-landing .grid-fx { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px); background-size: 56px 56px; -webkit-mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 100%); mask-image: radial-gradient(ellipse 80% 50% at 50% 0%, #000 40%, transparent 100%); }
.vx-landing nav { position: sticky; top: 0; z-index: 50; background: var(--glass-bg); -webkit-backdrop-filter: var(--glass-blur); backdrop-filter: var(--glass-blur); border-bottom: 1px solid var(--glass-border); }
.vx-landing .nav-in { height: 64px; display: flex; align-items: center; gap: 28px; }
.vx-landing .brand { display: flex; align-items: center; gap: 10px; font-family: var(--font-display); font-weight: 800; font-size: 19px; letter-spacing: -0.02em; }
.vx-landing .nav-links { display: flex; gap: 26px; margin-inline-start: 12px; }
.vx-landing .nav-links a { font-size: 14px; color: var(--ink-500); font-weight: 500; transition: color .15s, transform .14s; }
.vx-landing .nav-links a:hover { color: var(--ink-900); transform: translateY(-1px); }
.vx-landing .nav-cta { margin-inline-start: auto; display: flex; align-items: center; gap: 14px; }
.vx-landing .btn { display: inline-flex; align-items: center; gap: 8px; height: 40px; padding: 0 18px; border-radius: var(--radius-md); font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: transform .14s var(--ease-standard), box-shadow .2s, border-color .15s, color .15s, background-color .15s; white-space: nowrap; }
.vx-landing .btn:active { transform: translateY(0) scale(.96); }
.vx-landing .btn-accent { background-color: var(--accent-500); color: #fff; box-shadow: var(--accent-glow); }
.vx-landing .btn-accent:hover { transform: translateY(-1px); background-color: var(--accent-400); }
.vx-landing .btn-ghost { background: transparent; color: var(--ink-700); border-color: var(--border-strong); }
.vx-landing .btn-ghost:hover { border-color: var(--accent-500); color: var(--ink-900); }
.vx-landing .btn-lg { height: 50px; padding: 0 26px; font-size: 15.5px; border-radius: var(--radius-lg); }
.vx-landing .btn-text { background: transparent; color: var(--ink-700); padding: 0; height: auto; border: none; font-size: 14px; font-weight: 600; cursor: pointer; }
.vx-landing .btn-text:hover { color: var(--accent-400); }
.vx-landing section { position: relative; z-index: 1; }
.vx-landing .hero { padding: 88px 0 72px; }
.vx-landing .chip { display: inline-flex; align-items: center; gap: 8px; height: 30px; padding: 0 14px; border-radius: var(--radius-pill); background: var(--accent-soft); border: 1px solid color-mix(in srgb, var(--accent-500) 30%, transparent); color: var(--accent-300); font-size: 12.5px; font-weight: 600; margin-bottom: 26px; }
.vx-landing .chip .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-400); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent-500) 25%, transparent); }
.vx-landing .hero h1 { font-family: var(--font-display); font-size: clamp(40px, 6.4vw, 76px); line-height: 1.02; font-weight: 800; letter-spacing: -0.035em; max-width: 16ch; margin: 0; }
.vx-landing .hero h1 .hl { background: linear-gradient(110deg, var(--accent-300), var(--accent-500) 55%, #5FB0F0); -webkit-background-clip: text; background-clip: text; color: transparent; }
.vx-landing .hero p.sub { font-size: 19px; line-height: 1.6; color: var(--ink-500); max-width: 56ch; margin: 26px 0 34px; }
.vx-landing .hero-cta { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }
.vx-landing .hero-note { display: flex; gap: 20px; margin-top: 26px; font-size: 13px; color: var(--ink-500); flex-wrap: wrap; }
.vx-landing .hero-note span { display: flex; align-items: center; gap: 7px; }
.vx-landing .hero-note svg { width: 15px; height: 15px; color: var(--success-fg); }
.vx-landing .mock-wrap { margin-top: 64px; position: relative; }
.vx-landing .mock-glow { position: absolute; inset-block-start: -1px; inset-inline: -1px; height: 200px; background: radial-gradient(ellipse 60% 100% at 50% 0%, color-mix(in srgb, var(--accent-500) 40%, transparent), transparent 70%); filter: blur(40px); z-index: 0; }
.vx-landing .mock { position: relative; z-index: 1; border-radius: 16px; border: 1px solid var(--border); background: var(--surface); box-shadow: var(--shadow-xl); overflow: hidden; }
.vx-landing .mock-bar { height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid var(--border); background: var(--surface-2); }
.vx-landing .tl { width: 11px; height: 11px; border-radius: 50%; }
.vx-landing .mock-body { display: flex; min-height: 420px; }
.vx-landing .mk-side { width: 200px; border-inline-end: 1px solid var(--border); padding: 16px 12px; flex-shrink: 0; background: var(--surface-2); }
.vx-landing .mk-logo { display: flex; align-items: center; gap: 8px; font-family: var(--font-display); font-weight: 800; font-size: 15px; margin-bottom: 18px; padding: 0 6px; }
.vx-landing .mk-nav { display: flex; flex-direction: column; gap: 2px; }
.vx-landing .mk-item { display: flex; align-items: center; gap: 10px; height: 32px; padding: 0 10px; border-radius: 7px; font-size: 13px; color: var(--ink-500); font-weight: 500; }
.vx-landing .mk-item.on { background: var(--accent-soft); color: var(--accent-300); }
.vx-landing .mk-item svg { width: 15px; height: 15px; }
.vx-landing .mk-main { flex: 1; padding: 20px; min-width: 0; }
.vx-landing .mk-kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
.vx-landing .mk-kpi { border: 1px solid var(--border); border-radius: 10px; padding: 14px; background: var(--surface); }
.vx-landing .mk-kpi .lab { font-size: 11px; color: var(--ink-500); }
.vx-landing .mk-kpi .val { font-family: var(--font-display); font-size: 22px; font-weight: 700; margin-top: 4px; letter-spacing: -0.02em; }
.vx-landing .mk-kpi .d { font-size: 11px; margin-top: 4px; color: var(--success-fg); font-weight: 600; }
.vx-landing .mk-chart { border: 1px solid var(--border); border-radius: 10px; padding: 16px; background: var(--surface); }
.vx-landing .mk-chart .ct { font-size: 12px; color: var(--ink-500); margin-bottom: 12px; }
.vx-landing .strip { padding: 28px 0 8px; }
.vx-landing .strip .lbl { text-align: center; font-size: 12px; letter-spacing: .14em; text-transform: uppercase; color: var(--ink-500); margin-bottom: 20px; }
.vx-landing .logos { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px 40px; opacity: .7; }
.vx-landing .logos span { font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--ink-500); letter-spacing: -0.01em; }
.vx-landing .sec { padding: 96px 0; }
.vx-landing .sec-head { max-width: 640px; margin-bottom: 52px; }
.vx-landing .sec-head .ey, .vx-landing .ey { color: var(--accent-400); font-size: 13px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; margin-bottom: 14px; }
.vx-landing .sec-head h2 { font-family: var(--font-display); font-size: clamp(30px, 4vw, 46px); line-height: 1.08; font-weight: 800; letter-spacing: -0.025em; margin: 0; }
.vx-landing .sec-head p { font-size: 17px; color: var(--ink-500); line-height: 1.6; margin-top: 16px; }
.vx-landing .feat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.vx-landing .feat { border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 24px; background: var(--surface); transition: transform .18s var(--ease-standard), border-color .18s, box-shadow .2s; }
.vx-landing .feat:hover { transform: translateY(-3px); border-color: var(--accent-500); box-shadow: var(--shadow-md); }
.vx-landing .feat .ic { width: 44px; height: 44px; border-radius: 11px; background: var(--accent-soft); color: var(--accent-300); display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
.vx-landing .feat h3 { font-family: var(--font-display); font-size: 18px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
.vx-landing .feat p { font-size: 14px; color: var(--ink-500); line-height: 1.6; margin-top: 8px; }
.vx-landing .split { display: grid; grid-template-columns: 1fr 1fr; gap: 56px; align-items: center; }
.vx-landing .split h2 { font-family: var(--font-display); font-size: clamp(28px,3.6vw,42px); line-height: 1.1; font-weight: 800; letter-spacing: -0.025em; margin: 0; }
.vx-landing .split-list { display: flex; flex-direction: column; gap: 22px; margin-top: 28px; }
.vx-landing .split-li { display: flex; gap: 14px; }
.vx-landing .split-li .b { width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0; background: var(--accent-soft); color: var(--accent-300); display: flex; align-items: center; justify-content: center; }
.vx-landing .split-li h4 { font-size: 15px; font-weight: 600; color: var(--ink-900); margin: 0; }
.vx-landing .split-li p { font-size: 14px; color: var(--ink-500); line-height: 1.55; margin-top: 3px; }
.vx-landing .panel { border: 1px solid var(--border); border-radius: var(--radius-xl); background: var(--surface); box-shadow: var(--shadow-lg); overflow: hidden; }
.vx-landing .iraq { border: 1px solid var(--border); border-radius: var(--radius-2xl); background: linear-gradient(135deg, var(--surface), var(--surface-2)); padding: 48px; }
.vx-landing .iraq h2 { font-family: var(--font-display); font-size: clamp(28px,3.6vw,42px); font-weight: 800; letter-spacing: -0.025em; max-width: 18ch; margin: 0; }
.vx-landing .iraq-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; margin-top: 36px; }
.vx-landing .iraq-it .n { font-family: var(--font-display); font-size: 17px; font-weight: 700; display: flex; align-items: center; gap: 9px; }
.vx-landing .iraq-it .n svg { width: 18px; height: 18px; color: var(--accent-400); }
.vx-landing .iraq-it p { font-size: 13.5px; color: var(--ink-500); line-height: 1.55; margin-top: 8px; }
.vx-landing .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; }
.vx-landing .stat { text-align: center; padding: 12px; }
.vx-landing .stat .num { font-family: var(--font-display); font-size: 46px; font-weight: 800; letter-spacing: -0.03em; background: linear-gradient(120deg, var(--accent-300), var(--accent-500)); -webkit-background-clip: text; background-clip: text; color: transparent; }
.vx-landing .stat .cap { font-size: 13.5px; color: var(--ink-500); margin-top: 6px; }
.vx-landing .cta-band { border-radius: var(--radius-2xl); padding: 72px 48px; text-align: center; position: relative; overflow: hidden; background: linear-gradient(135deg, var(--accent-700), var(--accent-600) 55%, var(--accent-500)); }
.vx-landing .cta-band::after { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse 60% 100% at 50% 0%, rgba(255,255,255,0.18), transparent 60%); }
.vx-landing .cta-band h2 { position: relative; font-family: var(--font-display); font-size: clamp(30px, 4vw, 48px); font-weight: 800; letter-spacing: -0.025em; color: #fff; margin: 0; }
.vx-landing .cta-band p { position: relative; font-size: 18px; color: rgba(255,255,255,0.82); margin: 16px auto 32px; max-width: 52ch; }
.vx-landing .cta-band .btn-accent { background: #fff; color: var(--accent-700); box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
.vx-landing .cta-band .btn-ghost { color: #fff; border-color: rgba(255,255,255,0.4); }
.vx-landing footer { border-top: 1px solid var(--border); padding: 56px 0 36px; position: relative; z-index: 1; }
.vx-landing .foot-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr; gap: 32px; margin-bottom: 40px; }
.vx-landing .foot-col h5 { font-size: 12px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-500); margin-bottom: 14px; }
.vx-landing .foot-col a { display: block; font-size: 14px; color: var(--ink-700); margin-bottom: 10px; transition: color .15s; }
.vx-landing .foot-col a:hover { color: var(--accent-400); }
.vx-landing .foot-about p { font-size: 13.5px; color: var(--ink-500); line-height: 1.6; margin-top: 14px; max-width: 30ch; }
.vx-landing .foot-bot { display: flex; justify-content: space-between; align-items: center; padding-top: 24px; border-top: 1px solid var(--border); font-size: 13px; color: var(--ink-500); gap: 14px; flex-wrap: wrap; }
.vx-landing .lp-mob { display: none; }
@media (max-width: 860px) {
  .vx-landing .nav-links { display: none; }
  .vx-landing .mock-body { min-height: 0; } .vx-landing .mk-side { display: none; }
  .vx-landing .feat-grid, .vx-landing .iraq-grid, .vx-landing .stats, .vx-landing .foot-grid { grid-template-columns: 1fr 1fr; }
  .vx-landing .split { grid-template-columns: 1fr; gap: 32px; }
  .vx-landing .lp-mob { display: inline-flex; }
}
@media (max-width: 640px) {
  .vx-landing .wrap { padding: 0 18px; }
  .vx-landing .hero { padding: 46px 0 38px; } .vx-landing .hero p.sub { font-size: 16px; margin: 22px 0 28px; }
  .vx-landing .hero-cta { flex-direction: column; align-items: stretch; } .vx-landing .hero-cta .btn { width: 100%; justify-content: center; }
  .vx-landing .sec { padding: 54px 0; } .vx-landing .sec-head { margin-bottom: 36px; }
  .vx-landing .feat-grid, .vx-landing .iraq-grid, .vx-landing .stats, .vx-landing .foot-grid { grid-template-columns: 1fr; }
  .vx-landing .iraq { padding: 30px 20px; } .vx-landing .cta-band { padding: 46px 22px; }
  .vx-landing .mk-kpis { grid-template-columns: 1fr 1fr; }
  .vx-landing .foot-bot { flex-direction: column; gap: 14px; text-align: center; }
}
@media (prefers-reduced-motion: reduce) { .vx-landing * { transition: none !important; } }
`;

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const { isMobile } = useViewport();
  const ku = i18n.language === 'ku';
  const goSignup = useCallback(() => navigate('/signup'), [navigate]);
  const goLogin = useCallback(() => navigate('/login'), [navigate]);
  const toggleLang = () => i18n.changeLanguage(ku ? 'en' : 'ku');
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  const modules = [
    ['accounting', 'Accounting', 'ژمێریاری', 'Double-entry GL, journals, chart of accounts and statements that always reconcile.', 'GL دووجاره‌یی، تۆمار، پێرستی هەژمار و ڕاپۆرتی دارایی کە هەمیشە دەگونجێن.'],
    ['sales', 'Sales & CRM', 'فرۆشتن و CRM', 'Quotes, sales orders, invoices and a pipeline — from first lead to collected payment.', 'نرخنامە، داواکاری فرۆشتن، پسووڵە و پایپلاین — لە یەکەم لیدەوە تا وەرگرتنی پارە.'],
    ['inventory', 'Inventory', 'کۆگا', 'Multi-warehouse stock, items, cycle counts and reorder points that update on every sale.', 'ستۆکی فرە-کۆگا، کاڵا، ژماردن و خاڵی دووبارە داواکردن کە لەگەڵ هەر فرۆشتنێک نوێ دەبن.'],
    ['pos', 'Point of Sale', 'خاڵی فرۆشتن', 'A fast retail terminal that works offline and syncs the moment you are back online.', 'تێرمیناڵی خێرا کە ئۆفلاین کاردەکات و هاوکات دەبێت کاتێک ئۆنلاین دەبیتەوە.'],
    ['hr', 'HR & Payroll', 'کارمەند و مووچە', 'Employees, attendance, leave and Iraq-ready payroll with payslips in a couple of clicks.', 'کارمەند، ئامادەبوون، پشوو و مووچەی ئامادە بۆ عێراق لەگەڵ پسووڵەی مووچە بە چەند کلیکێک.'],
    ['reports', 'Reports', 'ڕاپۆرتەکان', 'Live dashboards and drill-down reports across every module — no exports, no waiting.', 'داشبۆردی زیندوو و ڕاپۆرتی ورد بەسەر هەموو مۆدیوولێکدا — بێ هەناردن، بێ چاوەڕوانی.'],
  ];
  const splitFeatures = [
    ['cmd', 'Command palette (⌘K)', 'پالێتی فەرمان (⌘K)', 'Jump to any record, run any action, in a keystroke. Built for power users.', 'بە یەک کلیل بچۆ بۆ هەر تۆمارێک و هەر کارێک ئەنجام بدە. بۆ بەکارهێنەرە بەهێزەکان.'],
    ['globe', 'Arabic · Kurdish · English', 'عەرەبی · کوردی · ئینگلیزی', 'Full right-to-left support and live language switching, with no compromise on layout.', 'پشتگیری تەواوی RTL و گۆڕینی زمانی زیندوو، بەبێ زیان بە ڕووکار.'],
    ['shield', 'Role-based access', 'دەستڕاگەیشتنی ڕۆڵ-بنەما', 'Owners, accountants, cashiers and managers each see exactly what they need — nothing more.', 'خاوەن، ژمێریار، فرۆشیار و بەڕێوەبەر هەریەکە تەنها ئەوە دەبینێت کە پێویستیەتی — نە زیاتر.'],
    ['offline', 'Works offline', 'ئۆفلاین کاردەکات', 'Keep selling and recording during outages — Vertex syncs automatically when you reconnect.', 'لە کاتی پچڕانی کارەبادا بەردەوام بفرۆشە و تۆمار بکە — Vertex خۆکارانە هاوکات دەبێت.'],
  ];
  const iraqItems = [
    ['pos', 'IQD & USD', 'IQD و USD', 'Dual-currency everywhere, with live rates and clean reporting in both.', 'دوو دراو لە هەموو شوێنێک، لەگەڵ نرخی زیندوو و ڕاپۆرتی پاک بە هەردووکیان.'],
    ['file', 'E-invoicing', 'e-فاکتورە', 'Generate and submit compliant electronic invoices straight from the app.', 'پسووڵەی ئەلیکترۆنی یاسایی دروست بکە و ڕاستەوخۆ لە ئەپەکەوە بینێرە.'],
    ['globe', '3 languages', '٣ زمان', 'Arabic, Kurdish and English — switch instantly, fully right-to-left.', 'عەرەبی، کوردی و ئینگلیزی — دەستبەجێ بگۆڕە، بە تەواوی RTL.'],
    ['whatsapp', 'WhatsApp', 'واتساپ', 'Send invoices, quotes and reminders to customers over WhatsApp.', 'پسووڵە، نرخنامە و بیرخستنەوە بۆ کڕیاران بە واتساپ بنێرە.'],
  ];
  const stats = [['6+', 'Modules in one app', 'مۆدیوول لە یەک ئەپدا'], ['3', 'Languages, full RTL', 'زمان، RTL تەواو'], ['99.9%', 'Uptime, cloud-hosted', 'بەردەوامی، کلاود'], ['<5min', 'To first invoice', 'بۆ یەکەم پسووڵە']];

  return (
    <div className="vx-landing" data-theme="dark" dir={ku ? 'rtl' : 'ltr'}>
      <style>{LANDING_CSS}</style>
      <div className="bg-fx"><div className="grid-fx" /><div className="orb orb-1" /><div className="orb orb-2" /></div>

      <nav><div className="wrap nav-in">
        <a className="brand" href="#" onClick={(e) => e.preventDefault()}><LogoMark />Vertex</a>
        <div className="nav-links">
          <a onClick={() => scrollTo('modules')}>{T(ku, 'Modules', 'مۆدیوولەکان')}</a>
          <a onClick={() => scrollTo('product')}>{T(ku, 'Product', 'بەرهەم')}</a>
          <a onClick={() => scrollTo('iraq')}>{T(ku, 'Built for Iraq', 'بۆ عێراق')}</a>
          <a onClick={() => scrollTo('pricing')}>{T(ku, 'Pricing', 'نرخ')}</a>
        </div>
        <div className="nav-cta">
          <button className="btn-text" onClick={toggleLang}>{ku ? 'English' : 'کوردی'}</button>
          <button className="btn-text" onClick={goLogin}>{T(ku, 'Sign in', 'چوونەژوورەوە')}</button>
          {!isMobile && <button className="btn btn-accent" onClick={goSignup}>{T(ku, 'Get started', 'دەستپێبکە')}</button>}
        </div>
      </div></nav>

      {/* HERO */}
      <section className="hero"><div className="wrap">
        <span className="chip"><span className="dot" />{T(ku, 'Built for Iraqi business · IQD & USD', 'دروستکراو بۆ بزنسی عێراقی · IQD و USD')}</span>
        <h1>{T(ku, 'Run your whole business on ', 'هەموو بزنسەکەت بەڕێوەببە لەسەر ')}<span className="hl">{T(ku, 'one platform.', 'یەک پلاتفۆرم.')}</span></h1>
        <p className="sub">{T(ku, 'Vertex unifies accounting, sales, inventory, POS, and payroll into a single, fast, Arabic-Kurdish-English system — engineered for how SMBs in Iraq actually operate.', 'Vertex ژمێریاری، فرۆشتن، کۆگا، POS و مووچە یەکدەخات لە یەک سیستەمی خێرا و عەرەبی-کوردی-ئینگلیزیدا — دروستکراو بۆ چۆنیەتی کارکردنی ڕاستەقینەی بزنسەکانی عێراق.')}</p>
        <div className="hero-cta">
          <button className="btn btn-accent btn-lg" onClick={goSignup}>{T(ku, 'Start free trial', 'تاقیکردنەوەی بێبەرامبەر')}<Svg p="arrow" w={20} /></button>
          <button className="btn btn-ghost btn-lg" onClick={() => scrollTo('product')}><Svg p="play" w={20} />{T(ku, 'Watch demo', 'بینینی نمایش')}</button>
        </div>
        <div className="hero-note">
          {[['No card required', 'بێ پێویستی کارت'], ['Set up in minutes', 'ڕێکخستن لە چەند خولەکدا'], ['E-invoice ready', 'ئامادە بۆ e-فاکتورە']].map((n, i) => (
            <span key={i}><Svg p="check" w={15} />{T(ku, n[0], n[1])}</span>
          ))}
        </div>
        <div className="mock-wrap">
          <div className="mock-glow" />
          <div className="mock">
            <div className="mock-bar"><span className="tl" style={{ background: '#E23D5C' }} /><span className="tl" style={{ background: '#E0900B' }} /><span className="tl" style={{ background: '#1FAE63' }} /><span style={{ marginInlineStart: 14, fontSize: 12, color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}>app.vertex.iq/dashboard</span></div>
            <div className="mock-body">
              <div className="mk-side">
                <div className="mk-logo"><LogoMark size={20} />Vertex</div>
                <div className="mk-nav">
                  {[['dash', 'Dashboard', 'داشبۆرد', true], ['file', 'Invoices', 'پسووڵە', false], ['sales', 'Sales', 'فرۆشتن', false], ['inventory', 'Inventory', 'کۆگا', false], ['accounting', 'Accounting', 'ژمێریاری', false]].map((m, i) => (
                    <div key={i} className={`mk-item${m[3] ? ' on' : ''}`}><Svg p={m[0] as string} w={15} />{T(ku, m[1] as string, m[2] as string)}</div>
                  ))}
                </div>
              </div>
              <div className="mk-main">
                <div className="mk-kpis">
                  <div className="mk-kpi"><div className="lab">{T(ku, 'Revenue', 'داهات')}</div><div className="val">182.4M</div><div className="d">↑ 12.4%</div></div>
                  <div className="mk-kpi"><div className="lab">{T(ku, 'Outstanding', 'ماوە')}</div><div className="val">38.7M</div><div className="d" style={{ color: 'var(--warning-fg)' }}>↓ 3.2%</div></div>
                  <div className="mk-kpi"><div className="lab">{T(ku, 'Paid invoices', 'پسووڵەی دراو')}</div><div className="val">312</div><div className="d">↑ 8.1%</div></div>
                </div>
                <div className="mk-chart">
                  <div className="ct">{T(ku, 'Revenue · last 12 months · IQD', 'داهات · ١٢ مانگی ڕابردوو · IQD')}</div>
                  <svg viewBox="0 0 600 150" preserveAspectRatio="none" style={{ width: '100%', height: 150 }}>
                    <defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent-500)" stopOpacity="0.35" /><stop offset="100%" stopColor="var(--accent-500)" stopOpacity="0" /></linearGradient></defs>
                    <path d="M0 120 L55 110 L110 116 L165 92 L220 98 L275 74 L330 82 L385 58 L440 64 L495 40 L550 30 L600 22 L600 150 L0 150 Z" fill="url(#mg)" />
                    <path d="M0 120 L55 110 L110 116 L165 92 L220 98 L275 74 L330 82 L385 58 L440 64 L495 40 L550 30 L600 22" fill="none" stroke="var(--accent-500)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div></section>

      {/* LOGOS */}
      <section className="strip"><div className="wrap">
        <div className="lbl">{T(ku, 'Trusted by growing businesses across Iraq', 'متمانەی بزنسە گەشەسەندووەکانی سەرتاسەری عێراق')}</div>
        <div className="logos">{['Zagros Trading', 'Tigris Electronics', 'Al-Rafidain', 'Babylon Hardware', 'Erbil Motors', 'Najaf Pharma'].map(s => <span key={s}>{s}</span>)}</div>
      </div></section>

      {/* MODULES */}
      <section className="sec" id="modules"><div className="wrap">
        <div className="sec-head">
          <div className="ey">{T(ku, 'One system', 'یەک سیستەم')}</div>
          <h2>{T(ku, 'Every part of your business, connected.', 'هەموو بەشێکی بزنسەکەت، پەیوەستکراو.')}</h2>
          <p>{T(ku, 'Stop stitching together spreadsheets and disconnected apps. Vertex runs your operations end-to-end, with every module sharing the same data in real time.', 'وازبهێنە لە یەکخستنی spreadsheet و ئەپی جیاواز. Vertex کارەکانت سەرتاسەری بەڕێوەدەبات، هەموو مۆدیوولێک هەمان داتا بە کاتی ڕاستەقینە بەکاردەهێنن.')}</p>
        </div>
        <div className="feat-grid">
          {modules.map((m, i) => (
            <div className="feat" key={i}><div className="ic"><Svg p={m[0]} /></div><h3>{T(ku, m[1], m[2])}</h3><p>{T(ku, m[3], m[4])}</p></div>
          ))}
        </div>
      </div></section>

      {/* PRODUCT SPLIT */}
      <section className="sec" id="product"><div className="wrap">
        <div className="split">
          <div>
            <div className="ey">{T(ku, 'Built to move fast', 'دروستکراو بۆ خێرایی')}</div>
            <h2>{T(ku, 'A console your team actually enjoys using.', 'کۆنسۆڵێک کە تیمەکەت بەڕاستی حەزی لێیە.')}</h2>
            <div className="split-list">
              {splitFeatures.map((f, i) => (
                <div className="split-li" key={i}><div className="b"><Svg p={f[0]} w={18} /></div><div><h4>{T(ku, f[1], f[2])}</h4><p>{T(ku, f[3], f[4])}</p></div></div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="mock-bar"><span className="tl" style={{ background: '#E23D5C' }} /><span className="tl" style={{ background: '#E0900B' }} /><span className="tl" style={{ background: '#1FAE63' }} /></div>
            <div style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}><div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17 }}>{T(ku, 'Invoices', 'پسووڵەکان')}</div><span className="btn btn-accent" style={{ height: 32, fontSize: 13 }}>+ {T(ku, 'New', 'نوێ')}</span></div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <tbody>
                  <tr style={{ color: 'var(--ink-500)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em' }}><td style={{ padding: '8px 6px' }}>{T(ku, 'Invoice', 'پسووڵە')}</td><td>{T(ku, 'Customer', 'کڕیار')}</td><td>{T(ku, 'Status', 'دۆخ')}</td><td style={{ textAlign: 'end' }}>{T(ku, 'Amount', 'بڕ')}</td></tr>
                  {[['INV-0042', 'Al-Rafidain', 'paid', '4,200,000'], ['INV-0041', 'Zagros Foods', 'pending', '1,875,000'], ['INV-0040', 'Tigris', 'overdue', '9,650,000'], ['INV-0039', 'Babylon', 'paid', '2,340,000']].map((r, i) => {
                    const tag = r[2] === 'paid' ? ['var(--success-bg)', 'var(--success-fg)', T(ku, 'Paid', 'دراو')] : r[2] === 'pending' ? ['var(--warning-bg)', 'var(--warning-fg)', T(ku, 'Pending', 'چاوەڕوان')] : ['var(--danger-bg)', 'var(--danger-fg)', T(ku, 'Overdue', 'دواکەوتوو')];
                    return (
                      <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '11px 6px', fontFamily: 'var(--font-mono)' }}>{r[0]}</td><td>{r[1]}</td>
                        <td><span style={{ background: tag[0], color: tag[1], padding: '2px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>{tag[2]}</span></td>
                        <td style={{ textAlign: 'end', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r[3]}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div></section>

      {/* BUILT FOR IRAQ */}
      <section className="sec" id="iraq"><div className="wrap"><div className="iraq">
        <div className="ey">{T(ku, 'Local by design', 'خۆماڵی بە دیزاین')}</div>
        <h2>{T(ku, 'Made for the way Iraq does business.', 'دروستکراو بۆ شێوازی بازرگانی عێراق.')}</h2>
        <div className="iraq-grid">
          {iraqItems.map((it, i) => (
            <div className="iraq-it" key={i}><div className="n"><Svg p={it[0]} w={18} />{T(ku, it[1], it[2])}</div><p>{T(ku, it[3], it[4])}</p></div>
          ))}
        </div>
      </div></div></section>

      {/* STATS */}
      <section className="sec" style={{ paddingTop: 0 }}><div className="wrap"><div className="stats">
        {stats.map((s, i) => <div className="stat" key={i}><div className="num">{s[0]}</div><div className="cap">{T(ku, s[1], s[2])}</div></div>)}
      </div></div></section>

      {/* CTA */}
      <section className="sec" id="pricing" style={{ paddingTop: 0 }}><div className="wrap"><div className="cta-band">
        <h2>{T(ku, 'Ready to run Vertex?', 'ئامادەیت بۆ بەکارهێنانی Vertex؟')}</h2>
        <p>{T(ku, 'Start a free trial today — no credit card, no setup fees. Be invoicing within minutes.', 'ئەمڕۆ تاقیکردنەوەی بێبەرامبەر دەستپێبکە — بێ کارتی بانکی، بێ کرێی ڕێکخستن. لە چەند خولەکدا پسووڵە دەکەیت.')}</p>
        <div style={{ position: 'relative', display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-accent btn-lg" onClick={goSignup}>{T(ku, 'Start free trial', 'تاقیکردنەوەی بێبەرامبەر')}</button>
          <button className="btn btn-ghost btn-lg" onClick={goLogin}>{T(ku, 'Talk to sales', 'پەیوەندی بە فرۆشتن')}</button>
        </div>
      </div></div></section>

      {/* FOOTER */}
      <footer><div className="wrap">
        <div className="foot-grid">
          <div className="foot-about">
            <a className="brand" href="#" onClick={(e) => e.preventDefault()}><LogoMark />Vertex</a>
            <p>{T(ku, 'The all-in-one ERP built for small and mid-sized businesses across Iraq.', 'ERP-ی هەمەلایەنە دروستکراو بۆ بزنسە بچووک و مامناوەندەکانی سەرتاسەری عێراق.')}</p>
          </div>
          <div className="foot-col"><h5>{T(ku, 'Product', 'بەرهەم')}</h5><a onClick={() => scrollTo('modules')}>{T(ku, 'Modules', 'مۆدیوولەکان')}</a><a onClick={() => scrollTo('product')}>{T(ku, 'Product tour', 'گەشتی بەرهەم')}</a><a onClick={() => scrollTo('pricing')}>{T(ku, 'Pricing', 'نرخ')}</a><a onClick={goLogin}>{T(ku, 'Sign in', 'چوونەژوورەوە')}</a></div>
          <div className="foot-col"><h5>{T(ku, 'Company', 'کۆمپانیا')}</h5><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'About', 'دەربارە')}</a><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'Careers', 'هەلی کار')}</a><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'Contact', 'پەیوەندی')}</a><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'Blog', 'بلۆگ')}</a></div>
          <div className="foot-col"><h5>{T(ku, 'Resources', 'سەرچاوەکان')}</h5><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'Documentation', 'دۆکیومێنت')}</a><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'Help center', 'ناوەندی یارمەتی')}</a><a href="#" onClick={e => e.preventDefault()}>{T(ku, 'Status', 'دۆخ')}</a><a href="#" onClick={e => e.preventDefault()}>API</a></div>
        </div>
        <div className="foot-bot">
          <span>© {new Date().getFullYear()} Vertex · {T(ku, 'Baghdad, Iraq', 'بەغدا، عێراق')}</span>
          <span>IQD / USD · {T(ku, 'Operational', 'چالاک')}</span>
        </div>
      </div></footer>
    </div>
  );
};

export default LandingPage;
