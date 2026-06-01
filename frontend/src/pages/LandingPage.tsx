/**
 * LandingPage.tsx — Vertex "Slate & Signal" marketing landing.
 *
 * Fully rebuilt on the Vertex kit design language: dark slate canvas (#0B0E14),
 * a masked dotted grid + soft violet/cyan glow orbs, Inter Tight display
 * headings, the kit's electric-violet accent, hairline slate cards and the
 * flat-accent CTA. All colours resolve from the global Vertex tokens
 * (theme/vertex-tokens.css) via a `data-theme="dark"` wrapper, so it stays in
 * lock-step with the rest of the app.
 *
 * Bilingual (en/ku) via `t()` — zero hardcoded copy. Responsive via `useViewport`
 * (no UA sniffing). Logical properties only (RTL-safe). Respects reduced-motion.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import {
  RocketOutlined, BarChartOutlined, TeamOutlined, SafetyOutlined, GlobalOutlined,
  ThunderboltOutlined, CheckCircleOutlined, StarFilled,
} from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';

/* ── Custom cursor (desktop only, via useViewport) ── */
const CustomCursor: React.FC = () => {
  const cursorX = useMotionValue(-100); const cursorY = useMotionValue(-100);
  const dotX = useMotionValue(-100); const dotY = useMotionValue(-100);
  const springX = useSpring(cursorX, { stiffness: 150, damping: 20 });
  const springY = useSpring(cursorY, { stiffness: 150, damping: 20 });
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const move = (e: MouseEvent) => { cursorX.set(e.clientX - 16); cursorY.set(e.clientY - 16); dotX.set(e.clientX - 4); dotY.set(e.clientY - 4); };
    const over = (e: MouseEvent) => { const tg = e.target as HTMLElement; setHover(tg.tagName === 'BUTTON' || tg.tagName === 'A' || !!tg.closest('button') || !!tg.closest('a') || !!tg.closest('[data-hoverable]')); };
    window.addEventListener('mousemove', move); window.addEventListener('mouseover', over);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseover', over); };
  }, [cursorX, cursorY, dotX, dotY]);
  return (
    <>
      <motion.div style={{ position: 'fixed', top: 0, left: 0, /* rtl-ignore: cursor coords are physical */ x: springX, y: springY, width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(123,97,255,0.7)', pointerEvents: 'none', zIndex: 99999, mixBlendMode: 'difference' }} animate={{ scale: hover ? 1.6 : 1 }} transition={{ duration: 0.2 }} />
      <motion.div style={{ position: 'fixed', top: 0, left: 0, /* rtl-ignore */ x: dotX, y: dotY, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#7B61FF', pointerEvents: 'none', zIndex: 99999 }} />
    </>
  );
};

const heroContainer: import('framer-motion').Variants = { hidden: {}, visible: { transition: { staggerChildren: 0.16, delayChildren: 0.08 } } };
// Capture-safe: animate transform only (never opacity-from-0) per the kit rule.
const heroItem: import('framer-motion').Variants = { hidden: { y: 28 }, visible: { y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } } };
const rise = { hidden: { y: 24 }, visible: (i = 0) => ({ y: 0, transition: { duration: 0.5, delay: i * 0.08, ease: 'easeOut' as const } }) };

const featureIcons = [
  <BarChartOutlined style={{ fontSize: 26 }} />, <TeamOutlined style={{ fontSize: 26 }} />,
  <RocketOutlined style={{ fontSize: 26 }} />, <GlobalOutlined style={{ fontSize: 26 }} />,
  <SafetyOutlined style={{ fontSize: 26 }} />, <ThunderboltOutlined style={{ fontSize: 26 }} />,
];
const featureKeys = [
  { title: 'landing_feature_accounting_title', desc: 'landing_feature_accounting_desc' },
  { title: 'landing_feature_hr_title', desc: 'landing_feature_hr_desc' },
  { title: 'landing_feature_sales_title', desc: 'landing_feature_sales_desc' },
  { title: 'landing_feature_inventory_title', desc: 'landing_feature_inventory_desc' },
  { title: 'landing_feature_security_title', desc: 'landing_feature_security_desc' },
  { title: 'landing_feature_performance_title', desc: 'landing_feature_performance_desc' },
];
const planKeys = [
  { name: 'landing_plan_starter', price: '$29', period: '/mo', features: ['landing_plan_starter_f1', 'landing_plan_starter_f2', 'landing_plan_starter_f3', 'landing_plan_starter_f4'], highlighted: false },
  { name: 'landing_plan_business', price: '$79', period: '/mo', features: ['landing_plan_business_f1', 'landing_plan_business_f2', 'landing_plan_business_f3', 'landing_plan_business_f4'], highlighted: true },
  { name: 'landing_plan_enterprise', price: '$199', period: '/mo', features: ['landing_plan_enterprise_f1', 'landing_plan_enterprise_f2', 'landing_plan_enterprise_f3', 'landing_plan_enterprise_f4'], highlighted: false },
];
const testimonialKeys = [
  { name: 'landing_testimonial_1_name', role: 'landing_testimonial_1_role', text: 'landing_testimonial_1_text', rating: 5 },
  { name: 'landing_testimonial_2_name', role: 'landing_testimonial_2_role', text: 'landing_testimonial_2_text', rating: 5 },
  { name: 'landing_testimonial_3_name', role: 'landing_testimonial_3_role', text: 'landing_testimonial_3_text', rating: 5 },
];

/* shared inline styles built from kit tokens */
const accentBtn: React.CSSProperties = { background: 'var(--accent-500)', border: '1px solid transparent', borderRadius: 'var(--radius-md)', color: '#fff', padding: '13px 28px', fontSize: 15, fontWeight: 600, cursor: 'inherit', boxShadow: 'var(--accent-glow)' };
const ghostBtn: React.CSSProperties = { background: 'color-mix(in srgb, var(--surface) 60%, transparent)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--ink-700)', padding: '13px 28px', fontSize: 15, fontWeight: 600, cursor: 'inherit', backdropFilter: 'blur(8px)' };
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' };
const display: React.CSSProperties = { fontFamily: 'var(--font-display)', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--ink-900)' };

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isMobile, isDesktop } = useViewport();
  const isKu = i18n.language === 'ku';
  const isRTL = isKu;
  const showCursor = isDesktop;
  const [isExiting, setIsExiting] = useState(false);
  const exitTarget = useRef<string>('/signup');
  const go = useCallback((to: string) => { if (isExiting) return; exitTarget.current = to; setIsExiting(true); setTimeout(() => navigate(to), 300); }, [isExiting, navigate]);
  const getStarted = useCallback(() => go('/signup'), [go]);
  const login = useCallback(() => go('/login'), [go]);
  const toggleLang = () => i18n.changeLanguage(isKu ? 'en' : 'ku');
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => { if (!isMobile) setMenuOpen(false); }, [isMobile]);
  const cur = showCursor ? 'none' : 'auto';

  return (
    <AnimatePresence mode="wait">
      {!isExiting && (
        <motion.div key="landing" data-theme="dark" dir={isRTL ? 'rtl' : 'ltr'}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.3 }}
          style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-900)', fontFamily: isRTL ? 'var(--font-rtl)' : 'var(--font-ui)', cursor: cur, overflowX: 'hidden', position: 'relative' }}>
          {showCursor && <CustomCursor />}
          {/* dotted grid + glow orbs (kit marketing atmosphere) */}
          <div aria-hidden style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '34px 34px', WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 35%, transparent 75%)', maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, #000 35%, transparent 75%)' }} />
          <div aria-hidden style={{ position: 'fixed', top: '-10%', insetInlineStart: '8%', width: 460, height: 460, borderRadius: '50%', background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-500) 30%, transparent), transparent 70%)', filter: 'blur(80px)', pointerEvents: 'none' }} />
          <div aria-hidden style={{ position: 'fixed', bottom: '0%', insetInlineEnd: '6%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(46,143,224,0.22), transparent 70%)', filter: 'blur(90px)', pointerEvents: 'none' }} />

          <style>{`
            .lp-nav-d { display: flex !important; } .lp-nav-m { display: none !important; }
            @media (max-width: 639px) { .lp-nav-d { display: none !important; } .lp-nav-m { display: flex !important; } }
          `}</style>

          {/* Navbar — kit glass top bar */}
          <nav style={{ position: 'fixed', top: 0, insetInline: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(16px, 5vw, 72px)', height: 60, background: 'var(--glass-bg)', WebkitBackdropFilter: 'var(--glass-blur)', backdropFilter: 'var(--glass-blur)', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, var(--accent-400), var(--accent-700))', boxShadow: 'var(--accent-glow)', flexShrink: 0 }} />
              <span style={{ ...display, fontSize: 19, letterSpacing: '-0.02em' }}>ERP<span style={{ color: 'var(--accent-400)' }}>IQ</span></span>
            </div>
            <div className="lp-nav-d" style={{ alignItems: 'center', gap: 10 }}>
              <button data-hoverable onClick={toggleLang} aria-label={t('landing_nav_switch_lang')} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--ink-700)', padding: '7px 14px', fontSize: 13, cursor: cur, fontWeight: 600 }}>{isKu ? 'English' : 'کوردی'}</button>
              <button data-hoverable onClick={login} style={{ background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--ink-900)', padding: '7px 18px', fontSize: 14, cursor: cur, fontWeight: 600 }}>{t('auth_login')}</button>
              <button data-hoverable onClick={getStarted} style={{ ...accentBtn, padding: '8px 18px', fontSize: 14, cursor: cur }}>{t('landing_cta_get_started')}</button>
            </div>
            <button onClick={() => setMenuOpen(v => !v)} aria-label={menuOpen ? t('landing_nav_close_menu') : t('landing_nav_open_menu')} aria-expanded={menuOpen} className="lp-nav-m" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--ink-700)', width: 40, height: 40, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: cur, padding: 0 }}>
              <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
              <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'opacity .2s', opacity: menuOpen ? 0 : 1 }} />
              <span style={{ width: 18, height: 2, background: 'currentColor', borderRadius: 2, transition: 'transform .2s', transform: menuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
            </button>
          </nav>

          <AnimatePresence>
            {menuOpen && (
              <motion.div key="m" initial={{ y: -8 }} animate={{ y: 0 }} exit={{ y: -8 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', top: 60, insetInline: 0, zIndex: 999, background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '16px clamp(16px, 5vw, 72px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { toggleLang(); setMenuOpen(false); }} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--ink-700)', padding: '10px 16px', fontSize: 14, cursor: 'pointer', textAlign: 'start' }}>{isKu ? 'English' : 'کوردی'}</button>
                <button onClick={() => { setMenuOpen(false); login(); }} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', color: 'var(--ink-900)', padding: '10px 16px', fontSize: 14, cursor: 'pointer', textAlign: 'start' }}>{t('auth_login')}</button>
                <button onClick={() => { setMenuOpen(false); getStarted(); }} style={{ ...accentBtn, padding: '10px 16px', fontSize: 14, textAlign: 'start' }}>{t('landing_cta_get_started')}</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hero */}
          <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(96px, 12vw, 140px) clamp(16px, 5vw, 72px) 60px', position: 'relative', zIndex: 1 }}>
            <motion.div variants={heroContainer} initial="hidden" animate="visible" style={{ maxWidth: 820 }}>
              <motion.div variants={heroItem}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent-500) 30%, transparent)', borderRadius: 100, padding: '5px 16px', fontSize: 13, fontWeight: 600, color: 'var(--accent-300)', marginBottom: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-400)' }} />{t('landing_badge')}
                </span>
              </motion.div>
              <motion.h1 variants={heroItem} style={{ ...display, fontSize: 'clamp(38px, 6vw, 72px)', lineHeight: 1.05, margin: '0 0 22px', background: 'linear-gradient(135deg, var(--ink-900) 0%, var(--accent-300) 55%, #C9BCFF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('landing_hero_title')}</motion.h1>
              <motion.p variants={heroItem} style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--ink-500)', lineHeight: 1.65, margin: '0 0 40px', maxWidth: 600, marginInline: 'auto' }}>{t('landing_hero_subtitle')}</motion.p>
              <motion.div variants={heroItem} style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <motion.button data-hoverable onClick={getStarted} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ ...accentBtn, padding: '15px 36px', fontSize: 16, cursor: cur }}>{t('landing_cta_start_free')}</motion.button>
                <motion.button data-hoverable onClick={login} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ ...ghostBtn, padding: '15px 36px', fontSize: 16, cursor: cur }}>{t('landing_cta_signin')}</motion.button>
              </motion.div>
              <motion.div variants={heroItem} style={{ display: 'flex', gap: 'clamp(24px, 4vw, 48px)', justifyContent: 'center', marginTop: 56, flexWrap: 'wrap' }}>
                {[{ num: '500+', key: 'landing_stat_companies' }, { num: '50K+', key: 'landing_stat_users' }, { num: '99.9%', key: 'landing_stat_uptime' }].map(s => (
                  <div key={s.num} style={{ textAlign: 'center' }}>
                    <div style={{ ...display, fontSize: 'clamp(24px, 3vw, 36px)', color: 'var(--accent-400)', fontVariantNumeric: 'tabular-nums' }}>{s.num}</div>
                    <div style={{ fontSize: 13, color: 'var(--ink-400)', marginTop: 4 }}>{t(s.key)}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </section>

          {/* Features */}
          <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 72px)', background: 'var(--surface-2)', position: 'relative', zIndex: 1 }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={rise} style={{ textAlign: 'center', marginBottom: 52 }}>
              <h2 style={{ ...display, fontSize: 'clamp(28px, 4vw, 46px)', margin: '0 0 14px' }}>{t('landing_features_title')}</h2>
              <p style={{ color: 'var(--ink-500)', fontSize: 16, maxWidth: 520, margin: '0 auto' }}>{t('landing_features_subtitle')}</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, maxWidth: 1180, margin: '0 auto' }}>
              {featureKeys.map((f, i) => (
                <motion.div key={i} data-hoverable custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={rise} whileHover={{ y: -4 }} style={{ ...card, padding: '26px 24px', cursor: cur }}>
                  <span style={{ display: 'inline-flex', width: 48, height: 48, borderRadius: 'var(--radius-md)', background: 'var(--accent-soft)', color: 'var(--accent-400)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>{featureIcons[i]}</span>
                  <h3 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--ink-900)' }}>{t(f.title)}</h3>
                  <p style={{ fontSize: 14, color: 'var(--ink-500)', margin: 0, lineHeight: 1.6 }}>{t(f.desc)}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Plans */}
          <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 72px)', position: 'relative', zIndex: 1 }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={rise} style={{ textAlign: 'center', marginBottom: 52 }}>
              <h2 style={{ ...display, fontSize: 'clamp(28px, 4vw, 46px)', margin: '0 0 14px' }}>{t('landing_plans_title')}</h2>
              <p style={{ color: 'var(--ink-500)', fontSize: 16 }}>{t('landing_plans_subtitle')}</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18, maxWidth: 1000, margin: '0 auto' }}>
              {planKeys.map((p, i) => (
                <motion.div key={i} data-hoverable custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={rise} whileHover={{ y: -6 }} style={{ ...card, padding: '30px 26px', cursor: cur, position: 'relative', overflow: 'hidden', borderColor: p.highlighted ? 'color-mix(in srgb, var(--accent-500) 45%, transparent)' : 'var(--border)', background: p.highlighted ? 'linear-gradient(180deg, color-mix(in srgb, var(--accent-500) 12%, var(--surface)), var(--surface) 60%)' : 'var(--surface)' }}>
                  {p.highlighted && <div style={{ position: 'absolute', top: 16, insetInlineEnd: 16, background: 'var(--accent-500)', borderRadius: 100, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>{t('landing_plan_popular')}</div>}
                  <h3 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 8px', color: 'var(--ink-900)' }}>{t(p.name)}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 22 }}>
                    <span style={{ ...display, fontSize: 38, color: p.highlighted ? 'var(--accent-400)' : 'var(--ink-900)' }}>{p.price}</span>
                    <span style={{ fontSize: 14, color: 'var(--ink-400)' }}>{p.period}</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {p.features.map((fk, fi) => (
                      <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--ink-700)' }}>
                        <CheckCircleOutlined style={{ color: p.highlighted ? 'var(--accent-400)' : 'var(--success-fg)', fontSize: 14 }} />{t(fk)}
                      </li>
                    ))}
                  </ul>
                  <motion.button data-hoverable onClick={getStarted} whileTap={{ scale: 0.97 }} style={p.highlighted ? { ...accentBtn, width: '100%', padding: 12 } : { ...ghostBtn, width: '100%', padding: 12 }}>{t('landing_cta_get_started')}</motion.button>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Testimonials */}
          <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 72px)', background: 'var(--surface-2)', position: 'relative', zIndex: 1 }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={rise} style={{ textAlign: 'center', marginBottom: 52 }}>
              <h2 style={{ ...display, fontSize: 'clamp(28px, 4vw, 46px)', margin: '0 0 14px' }}>{t('landing_testimonials_title')}</h2>
              <p style={{ color: 'var(--ink-500)', fontSize: 16 }}>{t('landing_testimonials_subtitle')}</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, maxWidth: 1100, margin: '0 auto' }}>
              {testimonialKeys.map((tm, i) => (
                <motion.div key={i} data-hoverable custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={rise} whileHover={{ y: -4 }} style={{ ...card, padding: '26px 24px', cursor: cur }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>{Array.from({ length: tm.rating }).map((_, si) => <StarFilled key={si} style={{ color: 'var(--warning-500)', fontSize: 14 }} />)}</div>
                  <p style={{ fontSize: 15, color: 'var(--ink-700)', lineHeight: 1.7, margin: '0 0 20px' }}>&ldquo;{t(tm.text)}&rdquo;</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--accent-400), var(--accent-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#fff' }}>{t(tm.name).charAt(0)}</div>
                    <div><div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-900)' }}>{t(tm.name)}</div><div style={{ fontSize: 12, color: 'var(--ink-400)' }}>{t(tm.role)}</div></div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <section style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 72px)', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={heroContainer} style={{ maxWidth: 700, margin: '0 auto', background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-500) 14%, var(--surface)), var(--surface))', border: '1px solid color-mix(in srgb, var(--accent-500) 28%, transparent)', borderRadius: 'var(--radius-2xl)', padding: 'clamp(40px, 6vw, 68px) clamp(24px, 4vw, 56px)' }}>
              <motion.h2 variants={heroItem} style={{ ...display, fontSize: 'clamp(28px, 4vw, 44px)', margin: '0 0 14px' }}>{t('landing_cta_title')}</motion.h2>
              <motion.p variants={heroItem} style={{ color: 'var(--ink-500)', fontSize: 16, margin: '0 0 34px', lineHeight: 1.65 }}>{t('landing_cta_subtitle')}</motion.p>
              <motion.div variants={heroItem} style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                <motion.button data-hoverable onClick={getStarted} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ ...accentBtn, padding: '15px 40px', fontSize: 16, cursor: cur }}>{t('landing_cta_signup_now')}</motion.button>
                <motion.button data-hoverable onClick={login} whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} style={{ ...ghostBtn, padding: '15px 40px', fontSize: 16, cursor: cur }}>{t('landing_cta_signin')}</motion.button>
              </motion.div>
            </motion.div>
          </section>

          {/* Footer */}
          <footer style={{ borderTop: '1px solid var(--border)', padding: '28px clamp(16px, 5vw, 72px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, color: 'var(--ink-400)', fontSize: 13, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 26, height: 26, borderRadius: 7, background: 'linear-gradient(135deg, var(--accent-400), var(--accent-700))', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, color: 'var(--ink-500)' }}>ERPIQ © {new Date().getFullYear()}</span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {['landing_footer_features', 'landing_footer_pricing', 'landing_footer_contact'].map(k => (
                <span key={k} data-hoverable style={{ cursor: cur }}>{t(k)}</span>
              ))}
            </div>
          </footer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LandingPage;
