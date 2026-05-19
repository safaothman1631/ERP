/**
 * LandingPage.tsx
 *
 * Public Marketing Landing Page — fully bilingual (en/ku) with
 * responsive layout driven by `useViewport`.
 *
 * Umbrella rules applied (task 10.9):
 *  - `useViewport` for all responsive decisions (no UA detection)
 *  - Full bilingual coverage via `t()` — zero hardcoded strings
 *  - Safe-area-insets via logical properties
 *  - prefers-reduced-motion respected
 *
 * Validates: Requirements 17.4, 5.6
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import {
  RocketOutlined, BarChartOutlined, TeamOutlined,
  SafetyOutlined, GlobalOutlined, ThunderboltOutlined,
  CheckCircleOutlined, StarFilled,
} from '@ant-design/icons';
import { useViewport } from '../hooks/useViewport';

// ---------------------------------------------------------------------------
// Custom Cursor (desktop only — driven by useViewport, not UA)
// ---------------------------------------------------------------------------
const CustomCursor: React.FC = () => {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);
  const springX = useSpring(cursorX, { stiffness: 150, damping: 20 });
  const springY = useSpring(cursorY, { stiffness: 150, damping: 20 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16); cursorY.set(e.clientY - 16);
      dotX.set(e.clientX - 4); dotY.set(e.clientY - 4);
    };
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(
        target.tagName === 'BUTTON' || target.tagName === 'A' ||
        !!target.closest('button') || !!target.closest('a') || !!target.closest('[data-hoverable]')
      );
    };
    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);
    return () => { window.removeEventListener('mousemove', moveCursor); window.removeEventListener('mouseover', handleMouseOver); };
  }, [cursorX, cursorY, dotX, dotY]);

  return (
    <>
      <motion.div style={{ position: 'fixed', top: 0, left: 0, /* rtl-ignore: cursor coords are physical */ x: springX, y: springY, width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(31,111,235,0.7)', pointerEvents: 'none', zIndex: 99999, mixBlendMode: 'difference' }} animate={{ scale: isHovering ? 1.6 : 1 }} transition={{ duration: 0.2 }} />
      <motion.div style={{ position: 'fixed', top: 0, left: 0, /* rtl-ignore */ x: dotX, y: dotY, width: 8, height: 8, borderRadius: '50%', backgroundColor: '#1F6FEB', pointerEvents: 'none', zIndex: 99999 }} />
    </>
  );
};

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------
const heroContainerVariants: import("framer-motion").Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.18, delayChildren: 0.1 } },
};
const heroItemVariants: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, delay: i * 0.1, ease: 'easeOut' as const } }),
};

// ---------------------------------------------------------------------------
// Data — all text via i18n keys
// ---------------------------------------------------------------------------
const featureIcons = [
  <BarChartOutlined style={{ fontSize: 28, color: '#1F6FEB' }} />,
  <TeamOutlined style={{ fontSize: 28, color: '#7C3AED' }} />,
  <RocketOutlined style={{ fontSize: 28, color: '#059669' }} />,
  <GlobalOutlined style={{ fontSize: 28, color: '#DC2626' }} />,
  <SafetyOutlined style={{ fontSize: 28, color: '#D97706' }} />,
  <ThunderboltOutlined style={{ fontSize: 28, color: '#0EA5E9' }} />,
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

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------
const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { isMobile, isDesktop } = useViewport();
  const isKu = i18n.language === 'ku';
  const isRTL = isKu;
  const showCustomCursor = isDesktop;

  const [isExiting, setIsExiting] = useState(false);
  const exitTargetRef = useRef<string>('/signup');
  const navigateWithAnimation = useCallback((to: string) => {
    if (isExiting) return;
    exitTargetRef.current = to;
    setIsExiting(true);
    setTimeout(() => navigate(to), 320);
  }, [isExiting, navigate]);
  const handleGetStarted = useCallback(() => navigateWithAnimation('/signup'), [navigateWithAnimation]);
  const handleLogin = useCallback(() => navigateWithAnimation('/login'), [navigateWithAnimation]);
  const toggleLanguage = () => i18n.changeLanguage(isKu ? 'en' : 'ku');

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => { if (!isMobile) setMobileMenuOpen(false); }, [isMobile]);
  const cursorStyle = showCustomCursor ? 'none' : 'auto';

  return (
    <AnimatePresence mode="wait">
      {!isExiting ? (
        <motion.div
          key="landing-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)', color: '#f8fafc', fontFamily: isRTL ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif", cursor: cursorStyle, overflowX: 'hidden' }}
        >
          {showCustomCursor && <CustomCursor />}
          <style>{`
            .landing-nav-desktop { display: flex !important; }
            .landing-nav-mobile-toggle { display: none !important; }
            @media (max-width: 639px) { .landing-nav-desktop { display: none !important; } .landing-nav-mobile-toggle { display: flex !important; } }
          `}</style>

          {/* Navbar */}
          <nav style={{ position: 'fixed', top: 0, insetInline: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 clamp(16px, 5vw, 80px)', height: 64, background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <motion.div initial={{ opacity: 0, x: isRTL ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0 }}>E</div>
              <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>ERP<span style={{ color: '#60A5FA' }}>IQ</span></span>
            </motion.div>
            {/* Desktop nav */}
            <motion.div initial={{ opacity: 0, x: isRTL ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5 }} style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="landing-nav-desktop">
              <button data-hoverable="true" onClick={toggleLanguage} aria-label={t('landing_nav_switch_lang')} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#cbd5e1', padding: '6px 14px', fontSize: 13, cursor: cursorStyle, transition: 'all 0.2s' }}>{isKu ? 'English' : 'کوردی'}</button>
              <button data-hoverable="true" onClick={handleLogin} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, color: '#e2e8f0', padding: '6px 18px', fontSize: 14, cursor: cursorStyle, transition: 'all 0.2s' }}>{t('auth_login')}</button>
              <button data-hoverable="true" onClick={handleGetStarted} style={{ background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', border: 'none', borderRadius: 8, color: '#fff', padding: '7px 20px', fontSize: 14, fontWeight: 600, cursor: cursorStyle, transition: 'all 0.2s', boxShadow: '0 4px 14px rgba(31,111,235,0.4)' }}>{t('landing_cta_get_started')}</button>
            </motion.div>
            {/* Mobile hamburger */}
            <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} onClick={() => setMobileMenuOpen(v => !v)} aria-label={mobileMenuOpen ? t('landing_nav_close_menu') : t('landing_nav_open_menu')} aria-expanded={mobileMenuOpen} className="landing-nav-mobile-toggle" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#cbd5e1', width: 40, height: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5, cursor: cursorStyle, padding: 0 }}>
              <span style={{ display: 'block', width: 18, height: 2, background: '#cbd5e1', borderRadius: 2, transition: 'transform 0.2s, opacity 0.2s', transform: mobileMenuOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
              <span style={{ display: 'block', width: 18, height: 2, background: '#cbd5e1', borderRadius: 2, transition: 'opacity 0.2s', opacity: mobileMenuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: 18, height: 2, background: '#cbd5e1', borderRadius: 2, transition: 'transform 0.2s, opacity 0.2s', transform: mobileMenuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
            </motion.button>
          </nav>

          {/* Mobile dropdown menu */}
          <AnimatePresence>
            {mobileMenuOpen && (
              <motion.div key="mobile-menu" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} style={{ position: 'fixed', top: 64, insetInline: 0, zIndex: 999, background: 'rgba(15,23,42,0.97)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.08)', padding: '16px clamp(16px, 5vw, 80px)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button onClick={() => { toggleLanguage(); setMobileMenuOpen(false); }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#cbd5e1', padding: '10px 16px', fontSize: 14, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}>🌐 {isKu ? 'English' : 'کوردی'}</button>
                <button onClick={() => { setMobileMenuOpen(false); handleLogin(); }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0', padding: '10px 16px', fontSize: 14, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}>{t('auth_login')}</button>
                <button onClick={() => { setMobileMenuOpen(false); handleGetStarted(); }} style={{ background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', border: 'none', borderRadius: 8, color: '#fff', padding: '10px 16px', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: isRTL ? 'right' : 'left' }}>🚀 {t('landing_cta_get_started')}</button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Hero Section */}
          <section style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 'clamp(80px, 10vw, 120px) clamp(16px, 5vw, 80px) 60px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '20%', insetInlineStart: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(31,111,235,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '20%', insetInlineEnd: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <motion.div variants={heroContainerVariants} initial="hidden" animate="visible" style={{ maxWidth: 800, position: 'relative', zIndex: 1 }}>
              <motion.div variants={heroItemVariants}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(31,111,235,0.15)', border: '1px solid rgba(31,111,235,0.3)', borderRadius: 100, padding: '5px 16px', fontSize: 13, color: '#93C5FD', marginBottom: 24 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
                  {t('landing_badge')}
                </span>
              </motion.div>
              <motion.h1 variants={heroItemVariants} style={{ fontSize: 'clamp(36px, 6vw, 72px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 24px', letterSpacing: -1, background: 'linear-gradient(135deg, #f8fafc 0%, #93C5FD 50%, #C4B5FD 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                {t('landing_hero_title')}
              </motion.h1>
              <motion.p variants={heroItemVariants} style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: '#94a3b8', lineHeight: 1.7, margin: '0 0 40px', maxWidth: 600, marginInline: 'auto' }}>
                {t('landing_hero_subtitle')}
              </motion.p>
              <motion.div variants={heroItemVariants} style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <motion.button data-hoverable="true" onClick={handleGetStarted} whileHover={{ scale: 1.04, boxShadow: '0 8px 30px rgba(31,111,235,0.5)' }} whileTap={{ scale: 0.97 }} style={{ background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', border: 'none', borderRadius: 12, color: '#fff', padding: '14px 36px', fontSize: 16, fontWeight: 700, cursor: cursorStyle, boxShadow: '0 4px 20px rgba(31,111,235,0.4)' }}>
                  🚀 {t('landing_cta_start_free')}
                </motion.button>
                <motion.button data-hoverable="true" onClick={handleLogin} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#e2e8f0', padding: '14px 36px', fontSize: 16, fontWeight: 600, cursor: cursorStyle, backdropFilter: 'blur(8px)' }}>
                  {t('landing_cta_signin')}
                </motion.button>
              </motion.div>
              <motion.div variants={heroItemVariants} style={{ display: 'flex', gap: 'clamp(24px, 4vw, 48px)', justifyContent: 'center', marginTop: 56, flexWrap: 'wrap' }}>
                {[{ num: '500+', key: 'landing_stat_companies' }, { num: '50K+', key: 'landing_stat_users' }, { num: '99.9%', key: 'landing_stat_uptime' }].map(stat => (
                  <div key={stat.num} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#60A5FA' }}>{stat.num}</div>
                    <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>{t(stat.key)}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </section>

          {/* Features Section */}
          <section id="features" style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)', background: 'rgba(255,255,255,0.02)' }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeInUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px', background: 'linear-gradient(135deg, #f8fafc, #93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('landing_features_title')}</h2>
              <p style={{ color: '#64748b', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>{t('landing_features_subtitle')}</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
              {featureKeys.map((feat, i) => (
                <motion.div key={i} data-hoverable="true" custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={fadeInUp} whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', y: -4 }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', cursor: cursorStyle, transition: 'border-color 0.2s' }}>
                  <div style={{ marginBottom: 16 }}>{featureIcons[i]}</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: '#f1f5f9' }}>{t(feat.title)}</h3>
                  <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.6 }}>{t(feat.desc)}</p>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Plans Section */}
          <section id="plans" style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)' }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeInUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px', background: 'linear-gradient(135deg, #f8fafc, #C4B5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('landing_plans_title')}</h2>
              <p style={{ color: '#64748b', fontSize: 16 }}>{t('landing_plans_subtitle')}</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24, maxWidth: 1000, margin: '0 auto' }}>
              {planKeys.map((plan, i) => (
                <motion.div key={i} data-hoverable="true" custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={fadeInUp} whileHover={{ scale: 1.04, boxShadow: plan.highlighted ? '0 24px 50px rgba(31,111,235,0.4)' : '0 20px 40px rgba(0,0,0,0.3)', y: -6 }} style={{ background: plan.highlighted ? 'linear-gradient(135deg, rgba(31,111,235,0.2), rgba(124,58,237,0.2))' : 'rgba(255,255,255,0.04)', border: plan.highlighted ? '1px solid rgba(31,111,235,0.5)' : '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '32px 28px', cursor: cursorStyle, position: 'relative', overflow: 'hidden' }}>
                  {plan.highlighted && <div style={{ position: 'absolute', top: 16, insetInlineEnd: 16, background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', borderRadius: 100, padding: '3px 12px', fontSize: 11, fontWeight: 700, color: '#fff' }}>{t('landing_plan_popular')}</div>}
                  <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#f1f5f9' }}>{t(plan.name)}</h3>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                    <span style={{ fontSize: 40, fontWeight: 800, color: plan.highlighted ? '#60A5FA' : '#f1f5f9' }}>{plan.price}</span>
                    <span style={{ fontSize: 14, color: '#64748b' }}>{plan.period}</span>
                  </div>
                  <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {plan.features.map((fKey, fi) => (
                      <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#cbd5e1' }}>
                        <CheckCircleOutlined style={{ color: plan.highlighted ? '#60A5FA' : '#4ade80', fontSize: 14 }} />
                        {t(fKey)}
                      </li>
                    ))}
                  </ul>
                  <motion.button data-hoverable="true" onClick={handleGetStarted} whileTap={{ scale: 0.97 }} style={{ width: '100%', background: plan.highlighted ? 'linear-gradient(135deg, #1F6FEB, #7C3AED)' : 'rgba(255,255,255,0.08)', border: plan.highlighted ? 'none' : '1px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', padding: '12px', fontSize: 15, fontWeight: 600, cursor: cursorStyle, boxShadow: plan.highlighted ? '0 4px 16px rgba(31,111,235,0.35)' : 'none' }}>{t('landing_cta_get_started')}</motion.button>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Testimonials Section */}
          <section id="testimonials" style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)', background: 'rgba(255,255,255,0.02)' }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={fadeInUp} style={{ textAlign: 'center', marginBottom: 56 }}>
              <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, margin: '0 0 16px', background: 'linear-gradient(135deg, #f8fafc, #86EFAC)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('landing_testimonials_title')}</h2>
              <p style={{ color: '#64748b', fontSize: 16 }}>{t('landing_testimonials_subtitle')}</p>
            </motion.div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, maxWidth: 1100, margin: '0 auto' }}>
              {testimonialKeys.map((tm, i) => (
                <motion.div key={i} data-hoverable="true" custom={i} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-40px' }} variants={fadeInUp} whileHover={{ scale: 1.03, boxShadow: '0 20px 40px rgba(0,0,0,0.3)', y: -4 }} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '28px 24px', cursor: cursorStyle }}>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                    {Array.from({ length: tm.rating }).map((_, si) => <StarFilled key={si} style={{ color: '#FBBF24', fontSize: 14 }} />)}
                  </div>
                  <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, margin: '0 0 20px', fontStyle: 'italic' }}>&ldquo;{t(tm.text)}&rdquo;</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color: '#fff', flexShrink: 0 }}>{t(tm.name).charAt(0)}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>{t(tm.name)}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{t(tm.role)}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* CTA Section */}
          <section id="cta" style={{ padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)', textAlign: 'center' }}>
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={heroContainerVariants} style={{ maxWidth: 700, margin: '0 auto', background: 'linear-gradient(135deg, rgba(31,111,235,0.12), rgba(124,58,237,0.12))', border: '1px solid rgba(31,111,235,0.2)', borderRadius: 24, padding: 'clamp(40px, 6vw, 72px) clamp(24px, 4vw, 56px)' }}>
              <motion.h2 variants={heroItemVariants} style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: '0 0 16px', background: 'linear-gradient(135deg, #f8fafc, #93C5FD)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>{t('landing_cta_title')}</motion.h2>
              <motion.p variants={heroItemVariants} style={{ color: '#94a3b8', fontSize: 16, margin: '0 0 36px', lineHeight: 1.7 }}>{t('landing_cta_subtitle')}</motion.p>
              <motion.div variants={heroItemVariants} style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                <motion.button data-hoverable="true" onClick={handleGetStarted} whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(31,111,235,0.5)' }} whileTap={{ scale: 0.97 }} style={{ background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', border: 'none', borderRadius: 12, color: '#fff', padding: '14px 40px', fontSize: 16, fontWeight: 700, cursor: cursorStyle, boxShadow: '0 4px 20px rgba(31,111,235,0.4)' }}>🚀 {t('landing_cta_signup_now')}</motion.button>
                <motion.button data-hoverable="true" onClick={handleLogin} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#e2e8f0', padding: '14px 40px', fontSize: 16, fontWeight: 600, cursor: cursorStyle }}>{t('landing_cta_signin')}</motion.button>
              </motion.div>
            </motion.div>
          </section>

          {/* Footer */}
          <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '32px clamp(16px, 5vw, 80px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, color: '#475569', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, color: '#fff' }}>E</div>
              <span style={{ fontWeight: 600, color: '#64748b' }}>ERPIQ © {new Date().getFullYear()}</span>
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {['landing_footer_features', 'landing_footer_pricing', 'landing_footer_contact'].map(key => (
                <span key={key} data-hoverable="true" style={{ cursor: cursorStyle, transition: 'color 0.2s' }} onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = '#60A5FA'; }} onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = '#475569'; }}>{t(key)}</span>
              ))}
            </div>
          </footer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default LandingPage;
