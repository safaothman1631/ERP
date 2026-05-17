/**
 * LandingPage.tsx
 *
 * پەرەی سەرەتای گشتی (Public Marketing Landing Page)
 *
 * بەشەکان:
 *  - Hero: ئەنیمەیشنی داخڵبوون بە Framer Motion لەناو 1000ms
 *  - Features: تایبەتمەندییەکانی سیستەم لەگەڵ hover animations
 *  - Plans: پلانەکانی نرخ لەگەڵ hover animations
 *  - Testimonials: شاهیدەکان
 *  - CTA: Call to Action
 *  - CustomCursor: کێرسەری کەستەم بۆ دێسکتۆپ
 *
 * داواکاری: ١.١، ١.٢، ١.٣، ١.٤، ١.٥، ١.٦، ١.٧، ١.٨
 *
 * Task 2.2 — ریسپانسیڤ و زمان:
 *  - Responsive layout لە 320px تا 1920px+ بە clamp() و auto-fit grids
 *  - دوگمەی گۆڕینی زمان (کوردی/ئینگلیزی) لە navbar
 *  - ئەنیمەیشنی سمۆث (exit fade-out) لەکاتی navigate بۆ پەرەی تۆمارکردن
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion';
import {
  RocketOutlined,
  BarChartOutlined,
  TeamOutlined,
  SafetyOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  StarFilled,
} from '@ant-design/icons';

// ---------------------------------------------------------------------------
// Custom Cursor (دێسکتۆپ تەنها)
// ---------------------------------------------------------------------------

const CustomCursor: React.FC = () => {
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const dotX = useMotionValue(-100);
  const dotY = useMotionValue(-100);

  // Spring smoothing for the outer ring
  const springX = useSpring(cursorX, { stiffness: 150, damping: 20 });
  const springY = useSpring(cursorY, { stiffness: 150, damping: 20 });

  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX - 16);
      cursorY.set(e.clientY - 16);
      dotX.set(e.clientX - 4);
      dotY.set(e.clientY - 4);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[data-hoverable]')
      ) {
        setIsHovering(true);
      } else {
        setIsHovering(false);
      }
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleMouseOver);
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, [cursorX, cursorY, dotX, dotY]);

  // Only show on non-touch devices
  if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) {
    return null;
  }

  return (
    <>
      {/* Outer ring */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: springX,
          y: springY,
          width: 32,
          height: 32,
          borderRadius: '50%',
          border: '2px solid rgba(31, 111, 235, 0.7)',
          pointerEvents: 'none',
          zIndex: 99999,
          mixBlendMode: 'difference',
          scale: isHovering ? 1.6 : 1,
          transition: 'scale 0.2s ease',
        }}
        animate={{ scale: isHovering ? 1.6 : 1 }}
        transition={{ duration: 0.2 }}
      />
      {/* Inner dot */}
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          x: dotX,
          y: dotY,
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: '#1F6FEB',
          pointerEvents: 'none',
          zIndex: 99999,
        }}
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Animation Variants
// ---------------------------------------------------------------------------

const heroContainerVariants: import("framer-motion").Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.18,
      delayChildren: 0.1,
    },
  },
};

const heroItemVariants: import("framer-motion").Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: 'easeOut' },
  }),
};

// ---------------------------------------------------------------------------
// Feature data
// ---------------------------------------------------------------------------

const features = [
  {
    icon: <BarChartOutlined style={{ fontSize: 28, color: '#1F6FEB' }} />,
    titleKu: 'ئەکاونتینگ و دارایی',
    titleEn: 'Accounting & Finance',
    descKu: 'بەڕێوەبردنی تەواوی دارایی لەگەڵ ڕاپۆرتی ریەل-تایم',
    descEn: 'Complete financial management with real-time reporting',
  },
  {
    icon: <TeamOutlined style={{ fontSize: 28, color: '#7C3AED' }} />,
    titleKu: 'HR و پارەدان',
    titleEn: 'HR & Payroll',
    descKu: 'بەڕێوەبردنی کارمەندان و پارەدانی مانگانە بە ئاسانی',
    descEn: 'Employee management and monthly payroll made easy',
  },
  {
    icon: <RocketOutlined style={{ fontSize: 28, color: '#059669' }} />,
    titleKu: 'فرۆشتن و CRM',
    titleEn: 'Sales & CRM',
    descKu: 'شارەزایی فرۆشتن لە Quote تا پارەدان',
    descEn: 'Sales mastery from quote to payment',
  },
  {
    icon: <GlobalOutlined style={{ fontSize: 28, color: '#DC2626' }} />,
    titleKu: 'ئینڤێنتۆری',
    titleEn: 'Inventory',
    descKu: 'کۆنترۆڵی ئەستۆک لە چەندین کۆگا',
    descEn: 'Stock control across multiple warehouses',
  },
  {
    icon: <SafetyOutlined style={{ fontSize: 28, color: '#D97706' }} />,
    titleKu: 'سیکوریتی',
    titleEn: 'Security',
    descKu: 'RBAC و encryption بۆ پاراستنی داتاکانت',
    descEn: 'RBAC and encryption to protect your data',
  },
  {
    icon: <ThunderboltOutlined style={{ fontSize: 28, color: '#0EA5E9' }} />,
    titleKu: 'پێرفۆرمانسی بەرز',
    titleEn: 'High Performance',
    descKu: 'بارکردنی خێرا و ئینتەرفەیسی سمۆث',
    descEn: 'Fast loading and smooth interface',
  },
];

// ---------------------------------------------------------------------------
// Plans data
// ---------------------------------------------------------------------------

const plans = [
  {
    nameKu: 'دەستپێکردن',
    nameEn: 'Starter',
    price: '$29',
    period: '/mo',
    featuresKu: ['تا ٥ بەکارهێنەر', 'فرۆشتن و کڕین', 'ئەکاونتینگ بنچینەیی', 'پشتگیری ئیمەیڵ'],
    featuresEn: ['Up to 5 users', 'Sales & Purchasing', 'Basic Accounting', 'Email Support'],
    highlighted: false,
  },
  {
    nameKu: 'کارگێڕی',
    nameEn: 'Business',
    price: '$79',
    period: '/mo',
    featuresKu: ['تا ٢٥ بەکارهێنەر', 'هەموو مۆدیوڵەکان', 'HR و پارەدان', 'پشتگیری ٢٤/٧'],
    featuresEn: ['Up to 25 users', 'All Modules', 'HR & Payroll', '24/7 Support'],
    highlighted: true,
  },
  {
    nameKu: 'کۆرپۆرەیت',
    nameEn: 'Enterprise',
    price: '$199',
    period: '/mo',
    featuresKu: ['بەکارهێنەری نامحدود', 'هەموو تایبەتمەندییەکان', 'SSO و MFA', 'مەنەجەری تایبەت'],
    featuresEn: ['Unlimited users', 'All Features', 'SSO & MFA', 'Dedicated Manager'],
    highlighted: false,
  },
];

// ---------------------------------------------------------------------------
// Testimonials data
// ---------------------------------------------------------------------------

const testimonials = [
  {
    nameKu: 'ئەحمەد کەریم',
    nameEn: 'Ahmed Karim',
    roleKu: 'بەڕێوەبەری دارایی',
    roleEn: 'Finance Manager',
    textKu: 'سیستەمەکە ژیانی کارمان گۆڕی. ئەکاونتینگ ئێستا ٣ جار خێراترە.',
    textEn: 'This system changed our work life. Accounting is now 3x faster.',
    rating: 5,
  },
  {
    nameKu: 'سارا ئەحمەد',
    nameEn: 'Sara Ahmed',
    roleKu: 'بەڕێوەبەری HR',
    roleEn: 'HR Manager',
    textKu: 'پارەدانی مانگانە کە پێشتر ٢ ڕۆژ دەبرد، ئێستا لە ٢ ساعەتدا تەواو دەبێت.',
    textEn: 'Monthly payroll that used to take 2 days now completes in 2 hours.',
    rating: 5,
  },
  {
    nameKu: 'کارزان عومەر',
    nameEn: 'Karzan Omar',
    roleKu: 'بەڕێوەبەری فرۆشتن',
    roleEn: 'Sales Manager',
    textKu: 'CRM و pipeline ی فرۆشتن تەواو گۆڕانکاری کرد لە چۆنیەتی کارکردنمان.',
    textEn: 'CRM and sales pipeline completely changed how we work.',
    rating: 5,
  },
];

// ---------------------------------------------------------------------------
// Main LandingPage Component
// ---------------------------------------------------------------------------

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isKu = i18n.language === 'ku';
  const isRTL = isKu;

  // Hide default cursor on desktop
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  // ── Smooth exit animation state (Requirement 1.7) ──────────────────────
  // When the user clicks a CTA, we fade the page out before navigating.
  const [isExiting, setIsExiting] = useState(false);
  const exitTargetRef = useRef<string>('/signup');

  /**
   * Trigger a smooth fade-out exit animation, then navigate.
   * Duration matches the exit transition (300ms) so the page is gone before
   * React Router unmounts it.
   */
  const navigateWithAnimation = useCallback(
    (to: string) => {
      if (isExiting) return; // prevent double-trigger
      exitTargetRef.current = to;
      setIsExiting(true);
      // Wait for the exit animation to complete before navigating
      setTimeout(() => {
        navigate(to);
      }, 320);
    },
    [isExiting, navigate]
  );

  const handleGetStarted = useCallback(() => {
    navigateWithAnimation('/signup');
  }, [navigateWithAnimation]);

  const handleLogin = useCallback(() => {
    navigateWithAnimation('/login');
  }, [navigateWithAnimation]);

  const toggleLanguage = () => {
    const next = isKu ? 'en' : 'ku';
    i18n.changeLanguage(next);
  };

  // ── Mobile navbar state ─────────────────────────────────────────────────
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // Close mobile menu on resize to desktop
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 640) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const cursorStyle = isTouchDevice ? 'auto' : 'none';

  return (
    // AnimatePresence drives the exit animation when isExiting becomes true
    <AnimatePresence mode="wait">
      {!isExiting ? (
        <motion.div
          key="landing-page"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: 'easeInOut' }}
          dir={isRTL ? 'rtl' : 'ltr'}
          style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
            color: '#f8fafc',
            fontFamily: isRTL ? "'Noto Sans Arabic', sans-serif" : "'Inter', sans-serif",
            cursor: cursorStyle,
            overflowX: 'hidden',
          }}
        >
      {/* Custom Cursor — desktop only */}
      {!isTouchDevice && <CustomCursor />}

      {/* ── Responsive CSS — controls desktop/mobile nav visibility ── */}
      <style>{`
        /* Desktop nav: visible on sm+ (≥640px) */
        .landing-nav-desktop { display: flex !important; }
        .landing-nav-mobile-toggle { display: none !important; }

        @media (max-width: 639px) {
          .landing-nav-desktop { display: none !important; }
          .landing-nav-mobile-toggle { display: flex !important; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 clamp(16px, 5vw, 80px)',
          height: 64,
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Brand logo */}
        <motion.div
          initial={{ opacity: 0, x: isRTL ? 20 : -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 16,
              color: '#fff',
              flexShrink: 0,
            }}
          >
            E
          </div>
          <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: -0.5 }}>
            ERP<span style={{ color: '#60A5FA' }}>IQ</span>
          </span>
        </motion.div>

        {/* Desktop nav buttons — hidden below 640px via CSS class */}
        <motion.div
          initial={{ opacity: 0, x: isRTL ? -20 : 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
          className="landing-nav-desktop"
        >
          {/* Language toggle — Requirement 1.8 */}
          <button
            data-hoverable="true"
            onClick={toggleLanguage}
            aria-label={isKu ? 'Switch to English' : 'گۆڕین بۆ کوردی'}
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: '#cbd5e1',
              padding: '6px 14px',
              fontSize: 13,
              cursor: cursorStyle,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.14)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)';
            }}
          >
            {isKu ? 'English' : 'کوردی'}
          </button>
          <button
            data-hoverable="true"
            onClick={handleLogin}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 8,
              color: '#e2e8f0',
              padding: '6px 18px',
              fontSize: 14,
              cursor: cursorStyle,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#60A5FA';
              (e.currentTarget as HTMLButtonElement).style.color = '#60A5FA';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.2)';
              (e.currentTarget as HTMLButtonElement).style.color = '#e2e8f0';
            }}
          >
            {isKu ? 'چوونەژوورەوە' : 'Login'}
          </button>
          <button
            data-hoverable="true"
            onClick={handleGetStarted}
            style={{
              background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              padding: '7px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: cursorStyle,
              transition: 'all 0.2s',
              boxShadow: '0 4px 14px rgba(31,111,235,0.4)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 20px rgba(31,111,235,0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 14px rgba(31,111,235,0.4)';
            }}
          >
            {isKu ? 'دەست پێبکە' : 'Get Started'}
          </button>
        </motion.div>

        {/* Mobile hamburger — visible below 640px */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileMenuOpen}
          className="landing-nav-mobile-toggle"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: '#cbd5e1',
            width: 40,
            height: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 5,
            cursor: cursorStyle,
            padding: 0,
          }}
        >
          <span
            style={{
              display: 'block',
              width: 18,
              height: 2,
              background: '#cbd5e1',
              borderRadius: 2,
              transition: 'transform 0.2s, opacity 0.2s',
              transform: mobileMenuOpen ? 'translateY(7px) rotate(45deg)' : 'none',
            }}
          />
          <span
            style={{
              display: 'block',
              width: 18,
              height: 2,
              background: '#cbd5e1',
              borderRadius: 2,
              transition: 'opacity 0.2s',
              opacity: mobileMenuOpen ? 0 : 1,
            }}
          />
          <span
            style={{
              display: 'block',
              width: 18,
              height: 2,
              background: '#cbd5e1',
              borderRadius: 2,
              transition: 'transform 0.2s, opacity 0.2s',
              transform: mobileMenuOpen ? 'translateY(-7px) rotate(-45deg)' : 'none',
            }}
          />
        </motion.button>
      </nav>

      {/* ── Mobile dropdown menu ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 64,
              left: 0,
              right: 0,
              zIndex: 999,
              background: 'rgba(15, 23, 42, 0.97)',
              backdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              padding: '16px clamp(16px, 5vw, 80px)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Language toggle in mobile menu */}
            <button
              onClick={() => { toggleLanguage(); setMobileMenuOpen(false); }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#cbd5e1',
                padding: '10px 16px',
                fontSize: 14,
                cursor: 'pointer',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              🌐 {isKu ? 'English' : 'کوردی'}
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); handleLogin(); }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                color: '#e2e8f0',
                padding: '10px 16px',
                fontSize: 14,
                cursor: 'pointer',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {isKu ? 'چوونەژوورەوە' : 'Login'}
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); handleGetStarted(); }}
              style={{
                background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              {isKu ? '🚀 دەست پێبکە' : '🚀 Get Started'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Hero Section ── */}
      <section
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 'clamp(80px, 10vw, 120px) clamp(16px, 5vw, 80px) 60px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background glow blobs */}
        <div
          style={{
            position: 'absolute',
            top: '20%',
            left: '10%',
            width: 400,
            height: 400,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(31,111,235,0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '20%',
            right: '10%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <motion.div
          variants={heroContainerVariants}
          initial="hidden"
          animate="visible"
          style={{ maxWidth: 800, position: 'relative', zIndex: 1 }}
        >
          {/* Badge */}
          <motion.div variants={heroItemVariants}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'rgba(31,111,235,0.15)',
                border: '1px solid rgba(31,111,235,0.3)',
                borderRadius: 100,
                padding: '5px 16px',
                fontSize: 13,
                color: '#93C5FD',
                marginBottom: 24,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#60A5FA', display: 'inline-block' }} />
              {isKu ? 'سیستەمی ERP بۆ کۆمپانیاکانی عێراق' : 'ERP System for Iraqi Companies'}
            </span>
          </motion.div>

          {/* Main heading */}
          <motion.h1
            variants={heroItemVariants}
            style={{
              fontSize: 'clamp(36px, 6vw, 72px)',
              fontWeight: 800,
              lineHeight: 1.1,
              margin: '0 0 24px',
              letterSpacing: -1,
              background: 'linear-gradient(135deg, #f8fafc 0%, #93C5FD 50%, #C4B5FD 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isKu
              ? 'کارگێڕی کۆمپانیاکەت بە یەک سیستەم'
              : 'Manage Your Business with One System'}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={heroItemVariants}
            style={{
              fontSize: 'clamp(16px, 2vw, 20px)',
              color: '#94a3b8',
              lineHeight: 1.7,
              margin: '0 0 40px',
              maxWidth: 600,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {isKu
              ? 'فرۆشتن، کڕین، ئەکاونتینگ، HR، ئینڤێنتۆری، و CRM — هەموو لە یەک شوێندا. دروستکراو بۆ کۆمپانیاکانی کوردستان و عێراق.'
              : 'Sales, Purchasing, Accounting, HR, Inventory, and CRM — all in one place. Built for Kurdistan and Iraq companies.'}
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            variants={heroItemVariants}
            style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <motion.button
              data-hoverable="true"
              onClick={handleGetStarted}
              whileHover={{ scale: 1.04, boxShadow: '0 8px 30px rgba(31,111,235,0.5)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                padding: '14px 36px',
                fontSize: 16,
                fontWeight: 700,
                cursor: cursorStyle,
                boxShadow: '0 4px 20px rgba(31,111,235,0.4)',
                transition: 'box-shadow 0.2s',
              }}
            >
              {isKu ? '🚀 دەست پێبکە بەخۆڕایی' : '🚀 Start for Free'}
            </motion.button>
            <motion.button
              data-hoverable="true"
              onClick={handleLogin}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#e2e8f0',
                padding: '14px 36px',
                fontSize: 16,
                fontWeight: 600,
                cursor: cursorStyle,
                backdropFilter: 'blur(8px)',
              }}
            >
              {isKu ? 'چوونەژوورەوە' : 'Sign In'}
            </motion.button>
          </motion.div>

          {/* Stats row */}
          <motion.div
            variants={heroItemVariants}
            style={{
              display: 'flex',
              gap: 'clamp(24px, 4vw, 48px)',
              justifyContent: 'center',
              marginTop: 56,
              flexWrap: 'wrap',
            }}
          >
            {[
              { num: '500+', labelKu: 'کۆمپانیا', labelEn: 'Companies' },
              { num: '50K+', labelKu: 'بەکارهێنەر', labelEn: 'Users' },
              { num: '99.9%', labelKu: 'ئاپتایم', labelEn: 'Uptime' },
            ].map((stat) => (
              <div key={stat.num} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, color: '#60A5FA' }}>
                  {stat.num}
                </div>
                <div style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
                  {isKu ? stat.labelKu : stat.labelEn}
                </div>
              </div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ── Features Section ── */}
      <section
        id="features"
        style={{
          padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeInUp}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 800,
              margin: '0 0 16px',
              background: 'linear-gradient(135deg, #f8fafc, #93C5FD)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isKu ? 'تایبەتمەندییەکان' : 'Features'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 16, maxWidth: 500, margin: '0 auto' }}>
            {isKu
              ? 'هەموو ئەوەی پێویستە بۆ بەڕێوەبردنی کۆمپانیاکەت'
              : 'Everything you need to manage your company'}
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {features.map((feat, i) => (
            <motion.div
              key={i}
              data-hoverable="true"
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeInUp}
              whileHover={{
                scale: 1.03,
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                y: -4,
              }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '28px 24px',
                cursor: cursorStyle,
                transition: 'border-color 0.2s',
              }}
              onHoverStart={(e) => {
                (e.target as HTMLElement).style.borderColor = 'rgba(96,165,250,0.3)';
              }}
              onHoverEnd={(e) => {
                (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
              }}
            >
              <div style={{ marginBottom: 16 }}>{feat.icon}</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 10px', color: '#f1f5f9' }}>
                {isKu ? feat.titleKu : feat.titleEn}
              </h3>
              <p style={{ fontSize: 14, color: '#64748b', margin: 0, lineHeight: 1.6 }}>
                {isKu ? feat.descKu : feat.descEn}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Plans Section ── */}
      <section
        id="plans"
        style={{
          padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)',
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeInUp}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 800,
              margin: '0 0 16px',
              background: 'linear-gradient(135deg, #f8fafc, #C4B5FD)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isKu ? 'پلانەکان' : 'Plans'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 16 }}>
            {isKu ? 'پلانی گونجاو بۆ هەر قەبارەیەک' : 'The right plan for every size'}
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 24,
            maxWidth: 1000,
            margin: '0 auto',
          }}
        >
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              data-hoverable="true"
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeInUp}
              whileHover={{
                scale: 1.04,
                boxShadow: plan.highlighted
                  ? '0 24px 50px rgba(31,111,235,0.4)'
                  : '0 20px 40px rgba(0,0,0,0.3)',
                y: -6,
              }}
              style={{
                background: plan.highlighted
                  ? 'linear-gradient(135deg, rgba(31,111,235,0.2), rgba(124,58,237,0.2))'
                  : 'rgba(255,255,255,0.04)',
                border: plan.highlighted
                  ? '1px solid rgba(31,111,235,0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                padding: '32px 28px',
                cursor: cursorStyle,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {plan.highlighted && (
                <div
                  style={{
                    position: 'absolute',
                    top: 16,
                    ...(isRTL ? { left: 16 } : { right: 16 }),
                    background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
                    borderRadius: 100,
                    padding: '3px 12px',
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                  }}
                >
                  {isKu ? 'باشترین' : 'Popular'}
                </div>
              )}
              <h3 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: '#f1f5f9' }}>
                {isKu ? plan.nameKu : plan.nameEn}
              </h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 24 }}>
                <span style={{ fontSize: 40, fontWeight: 800, color: plan.highlighted ? '#60A5FA' : '#f1f5f9' }}>
                  {plan.price}
                </span>
                <span style={{ fontSize: 14, color: '#64748b' }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(isKu ? plan.featuresKu : plan.featuresEn).map((f, fi) => (
                  <li key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: '#cbd5e1' }}>
                    <CheckCircleOutlined style={{ color: plan.highlighted ? '#60A5FA' : '#4ade80', fontSize: 14 }} />
                    {f}
                  </li>
                ))}
              </ul>
              <motion.button
                data-hoverable="true"
                onClick={handleGetStarted}
                whileTap={{ scale: 0.97 }}
                style={{
                  width: '100%',
                  background: plan.highlighted
                    ? 'linear-gradient(135deg, #1F6FEB, #7C3AED)'
                    : 'rgba(255,255,255,0.08)',
                  border: plan.highlighted ? 'none' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10,
                  color: '#fff',
                  padding: '12px',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: cursorStyle,
                  boxShadow: plan.highlighted ? '0 4px 16px rgba(31,111,235,0.35)' : 'none',
                }}
              >
                {isKu ? 'دەست پێبکە' : 'Get Started'}
              </motion.button>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Testimonials Section ── */}
      <section
        id="testimonials"
        style={{
          padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)',
          background: 'rgba(255,255,255,0.02)',
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={fadeInUp}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <h2
            style={{
              fontSize: 'clamp(28px, 4vw, 48px)',
              fontWeight: 800,
              margin: '0 0 16px',
              background: 'linear-gradient(135deg, #f8fafc, #86EFAC)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isKu ? 'شاهیدەکان' : 'Testimonials'}
          </h2>
          <p style={{ color: '#64748b', fontSize: 16 }}>
            {isKu ? 'ئەوانەی کە پێیان باشە' : 'What our customers say'}
          </p>
        </motion.div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              data-hoverable="true"
              custom={i}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: '-40px' }}
              variants={fadeInUp}
              whileHover={{
                scale: 1.03,
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                y: -4,
              }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '28px 24px',
                cursor: cursorStyle,
              }}
            >
              {/* Stars */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                {Array.from({ length: t.rating }).map((_, si) => (
                  <StarFilled key={si} style={{ color: '#FBBF24', fontSize: 14 }} />
                ))}
              </div>
              <p style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.7, margin: '0 0 20px', fontStyle: 'italic' }}>
                "{isKu ? t.textKu : t.textEn}"
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 16,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  {(isKu ? t.nameKu : t.nameEn).charAt(0)}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9' }}>
                    {isKu ? t.nameKu : t.nameEn}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    {isKu ? t.roleKu : t.roleEn}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <section
        id="cta"
        style={{
          padding: 'clamp(60px, 8vw, 100px) clamp(16px, 5vw, 80px)',
          textAlign: 'center',
        }}
      >
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          variants={heroContainerVariants}
          style={{
            maxWidth: 700,
            margin: '0 auto',
            background: 'linear-gradient(135deg, rgba(31,111,235,0.12), rgba(124,58,237,0.12))',
            border: '1px solid rgba(31,111,235,0.2)',
            borderRadius: 24,
            padding: 'clamp(40px, 6vw, 72px) clamp(24px, 4vw, 56px)',
          }}
        >
          <motion.h2
            variants={heroItemVariants}
            style={{
              fontSize: 'clamp(28px, 4vw, 44px)',
              fontWeight: 800,
              margin: '0 0 16px',
              background: 'linear-gradient(135deg, #f8fafc, #93C5FD)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            {isKu ? 'ئامادەی دەست پێکردنی؟' : 'Ready to Get Started?'}
          </motion.h2>
          <motion.p
            variants={heroItemVariants}
            style={{ color: '#94a3b8', fontSize: 16, margin: '0 0 36px', lineHeight: 1.7 }}
          >
            {isKu
              ? 'ئەمڕۆ تۆمار بکە و ١٤ ڕۆژ بەخۆڕایی تاقی بکەرەوە. کارتی کرێدیت پێویست نییە.'
              : 'Sign up today and try free for 14 days. No credit card required.'}
          </motion.p>
          <motion.div
            variants={heroItemVariants}
            style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}
          >
            <motion.button
              data-hoverable="true"
              onClick={handleGetStarted}
              whileHover={{ scale: 1.05, boxShadow: '0 10px 30px rgba(31,111,235,0.5)' }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
                border: 'none',
                borderRadius: 12,
                color: '#fff',
                padding: '14px 40px',
                fontSize: 16,
                fontWeight: 700,
                cursor: cursorStyle,
                boxShadow: '0 4px 20px rgba(31,111,235,0.4)',
              }}
            >
              {isKu ? '🚀 تۆمار بکە ئێستا' : '🚀 Sign Up Now'}
            </motion.button>
            <motion.button
              data-hoverable="true"
              onClick={handleLogin}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.97 }}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                color: '#e2e8f0',
                padding: '14px 40px',
                fontSize: 16,
                fontWeight: 600,
                cursor: cursorStyle,
              }}
            >
              {isKu ? 'چوونەژوورەوە' : 'Sign In'}
            </motion.button>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '32px clamp(16px, 5vw, 80px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
          color: '#475569',
          fontSize: 13,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #1F6FEB, #7C3AED)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 13,
              color: '#fff',
            }}
          >
            E
          </div>
          <span style={{ fontWeight: 600, color: '#64748b' }}>
            ERPIQ © {new Date().getFullYear()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {(isKu
            ? ['تایبەتمەندییەکان', 'نرخەکان', 'پەیوەندی']
            : ['Features', 'Pricing', 'Contact']
          ).map((link) => (
            <span
              key={link}
              data-hoverable="true"
              style={{ cursor: cursorStyle, transition: 'color 0.2s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLSpanElement).style.color = '#60A5FA'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLSpanElement).style.color = '#475569'; }}
            >
              {link}
            </span>
          ))}
        </div>
      </footer>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default LandingPage;


