import React from 'react';
import type { CSSProperties } from 'react';
import {
  CheckCircleFilled, SafetyCertificateOutlined,
  ThunderboltOutlined, GlobalOutlined, LineChartOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { glass, palette } from '../theme/tokens';
import LanguageSwitcher from './LanguageSwitcher';

/**
 * AuthLayout v2 — Premium auth shell
 * - Animated mesh gradient backdrop
 * - Glassmorphism container
 * - SVG brand mark (no emoji)
 * - Trust strip + i18n feature list
 * - Same public API as v1 ({title, subtitle, children}) — drop-in
 */

const BRAND_GRADIENT = 'linear-gradient(135deg, #7B61FF 0%, #5638D6 50%, #2C1B73 100%)';

const BrandMark: React.FC<{ size?: number }> = ({ size = 40 }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="amg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#9275FF" />
        <stop offset="100%" stopColor="#7B61FF" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="36" height="36" rx="10" fill="url(#amg)" />
    <path
      d="M12 26 L12 14 L18 14 L18 20 L24 14 L30 14 L23 20.5 L30 26 L23 26 L18 21.5 L18 26 Z"
      fill="white"
      opacity="0.96"
    />
    <circle cx="32" cy="9" r="3" fill="#16A34A" stroke="white" strokeWidth="1.5" />
  </svg>
);

const HeroIllustration: React.FC = () => (
  <svg viewBox="0 0 400 320" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', maxWidth: 360 }}>
    <defs>
      <linearGradient id="card1" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.28)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.10)" />
      </linearGradient>
      <linearGradient id="card2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="rgba(255,255,255,0.40)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0.18)" />
      </linearGradient>
      <filter id="blur1" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="20" />
      </filter>
    </defs>

    <circle cx="320" cy="60" r="50" fill="rgba(146,117,255,0.45)" filter="url(#blur1)" />
    <circle cx="80" cy="260" r="60" fill="rgba(22,163,74,0.30)" filter="url(#blur1)" />

    <rect x="60" y="50" width="240" height="160" rx="16" fill="url(#card1)"
      stroke="rgba(255,255,255,0.30)" strokeWidth="1" />
    <rect x="76" y="68" width="80" height="8" rx="4" fill="rgba(255,255,255,0.55)" />
    <rect x="76" y="82" width="50" height="6" rx="3" fill="rgba(255,255,255,0.30)" />
    {[
      { x: 80, h: 38 }, { x: 110, h: 62 }, { x: 140, h: 50 },
      { x: 170, h: 78 }, { x: 200, h: 90 }, { x: 230, h: 70 }, { x: 260, h: 100 },
    ].map((b, i) => (
      <rect key={i} x={b.x} y={200 - b.h} width="18" height={b.h} rx="3"
        fill={`rgba(255,255,255,${0.55 + i * 0.04})`} />
    ))}
    <polyline
      points="80,170 110,150 140,160 170,130 200,115 230,128 260,100"
      fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      opacity="0.95"
    />

    <rect x="200" y="160" width="160" height="120" rx="14" fill="url(#card2)"
      stroke="rgba(255,255,255,0.45)" strokeWidth="1" />
    <rect x="216" y="178" width="60" height="6" rx="3" fill="rgba(255,255,255,0.55)" />
    <rect x="216" y="194" width="100" height="14" rx="4" fill="rgba(255,255,255,0.85)" />
    <rect x="216" y="218" width="40" height="6" rx="3" fill="rgba(22,163,74,0.95)" />
    <rect x="216" y="240" width="120" height="4" rx="2" fill="rgba(255,255,255,0.30)" />
    <rect x="216" y="252" width="80" height="4" rx="2" fill="rgba(255,255,255,0.20)" />

    <circle cx="346" cy="178" r="20" fill="rgba(245,158,11,0.95)" />
    <text x="346" y="184" textAnchor="middle" fontFamily="system-ui" fontSize="16" fontWeight="700" fill="white">$</text>

    <circle cx="80" cy="80" r="18" fill="rgba(22,163,74,0.95)" />
    <path d="M71 80 l6 6 l12-12" stroke="white" strokeWidth="2.8"
      strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ku' || i18n.language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  const features = [
    { icon: <LineChartOutlined />,         key: 'auth_feature_finance' },
    { icon: <SafetyCertificateOutlined />, key: 'auth_feature_secure' },
    { icon: <ThunderboltOutlined />,       key: 'auth_feature_fast' },
    { icon: <GlobalOutlined />,            key: 'auth_feature_local' },
  ];

  return (
    <div style={s.wrapper} className="responsive-shell">
      <style>{cssOverrides}</style>

      <div className="auth-mesh" aria-hidden />
      <div className="auth-mesh-2" aria-hidden />

      {/* LanguageSwitcher — accessible before authentication (Requirement 3.2, 16.4) */}
      <div
        style={{
          position: 'fixed',
          top: 16,
          insetInlineEnd: 16,
          zIndex: 10,
        }}
      >
        <LanguageSwitcher size="small" type="default" />
      </div>

      <div style={s.container} className="auth-container">
        <div className="auth-brand-panel" style={s.brandPanel}>
          <div className="auth-bubble auth-bubble-1" />
          <div className="auth-bubble auth-bubble-2" />
          <div className="auth-bubble auth-bubble-3" />

          <div style={s.brandTop}>
            <BrandMark size={44} />
            <div>
              <div style={s.brandWordmark}>{t('app_name')}</div>
              <div style={s.brandTag}>{t('auth_brand_tag')}</div>
            </div>
          </div>

          <div style={s.illustrationWrap}>
            <HeroIllustration />
          </div>

          <div style={s.brandHeading}>{t('auth_brand_heading')}</div>
          <div style={s.brandSub}>{t('auth_brand_sub')}</div>

          <ul style={s.featureList}>
            {features.map((f) => (
              <li key={f.key} style={s.featureItem}>
                <span style={s.featureIcon}>{f.icon}</span>
                <span>{t(f.key)}</span>
                <CheckCircleFilled style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, marginInlineStart: 'auto' }} />
              </li>
            ))}
          </ul>

          <div style={s.trustStrip}>
            <span style={s.trustDot} />
            <span>{t('auth_trust_strip')}</span>
          </div>
        </div>

        <div className="auth-form-panel" style={{ ...s.formPanel, direction: dir }}>
          <div className="auth-form-inner">
            <div style={s.logoRow}>
              <BrandMark size={36} />
              <div>
                <div style={s.logoText}>{t('app_name')}</div>
                <div style={s.logoSub}>{t('auth_brand_tag')}</div>
              </div>
            </div>

            <div style={s.heading}>{title}</div>
            <span style={s.subHeading}>{subtitle}</span>

            <div className="auth-form-content">
              {children}
            </div>

            <div style={s.legalFoot}>
              {t('auth_legal_prefix')}{' '}
              <span style={s.legalLink}>{t('auth_terms')}</span>
              {' \u00B7 '}
              <span style={s.legalLink}>{t('auth_privacy')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const cssOverrides = `
  @keyframes auth-mesh-1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    33%      { transform: translate(60px, -40px) scale(1.08); }
    66%      { transform: translate(-40px, 60px) scale(0.94); }
  }
  @keyframes auth-mesh-2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50%      { transform: translate(-80px, 40px) scale(1.10); }
  }
  @keyframes auth-bubble-float {
    0%, 100% { transform: translateY(0); }
    50%      { transform: translateY(-14px); }
  }
  @keyframes auth-card-in {
    0%   { opacity: 0; transform: translateY(12px); }
    100% { opacity: 1; transform: translateY(0); }
  }
  .auth-mesh, .auth-mesh-2 {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    filter: blur(80px);
    opacity: 0.55;
  }
  .auth-mesh {
    background:
      radial-gradient(circle at 20% 30%, #9275FF 0%, transparent 38%),
      radial-gradient(circle at 80% 20%, #7B61FF 0%, transparent 32%),
      radial-gradient(circle at 70% 80%, #16A34A 0%, transparent 30%);
    animation: auth-mesh-1 22s ease-in-out infinite;
  }
  .auth-mesh-2 {
    background:
      radial-gradient(circle at 30% 80%, #F59E0B 0%, transparent 26%),
      radial-gradient(circle at 90% 50%, #0EA5E9 0%, transparent 28%);
    opacity: 0.32;
    animation: auth-mesh-2 28s ease-in-out infinite;
  }
  .auth-container {
    animation: auth-card-in 0.55s cubic-bezier(0.2, 0, 0, 1);
  }
  .auth-bubble {
    position: absolute;
    border-radius: 50%;
    background: rgba(255,255,255,0.10);
    pointer-events: none;
  }
  .auth-bubble-1 { top: -80px; right: -60px; width: 220px; height: 220px; animation: auth-bubble-float 12s ease-in-out infinite; }
  .auth-bubble-2 { bottom: -100px; left: -70px; width: 280px; height: 280px; background: rgba(255,255,255,0.06); animation: auth-bubble-float 16s ease-in-out infinite reverse; }
  .auth-bubble-3 { top: 30%; right: 10%; width: 80px; height: 80px; background: rgba(22,163,74,0.18); animation: auth-bubble-float 9s ease-in-out infinite; }
  .auth-form-inner {
    width: 100%;
    max-width: 380px;
    margin: 0 auto;
  }

  /* Glass morphism on login card — @supports gate — Requirements 12.4, 12.5, 12.6 */
  @supports (backdrop-filter: blur(1px)) {
    .auth-container {
      background: ${glass.login.light.bg} !important;
      backdrop-filter: ${glass.login.light.blur} !important;
      -webkit-backdrop-filter: ${glass.login.light.blur} !important;
      border: 1px solid ${glass.login.light.border} !important;
    }
  }
  /* Fallback: solid surface when backdrop-filter is unsupported — Requirement 12.5 */
  @supports not (backdrop-filter: blur(1px)) {
    .auth-container {
      background: ${palette.surface} !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
  }

  .auth-input .ant-input,
  .auth-input .ant-input-affix-wrapper {
    border-radius: 12px !important;
    border: 1.5px solid #E5E7EB !important;
    background: #FAFBFC !important;
    font-size: 14px !important;
    height: 48px !important;
    transition: border-color .18s, box-shadow .18s, background .18s !important;
    display: flex !important;
    align-items: center !important;
  }
  .auth-input .ant-input-affix-wrapper { padding: 0 14px !important; }
  .auth-input .ant-input { background: transparent !important; height: auto !important; box-shadow: none !important; }
  .auth-input .ant-input:focus,
  .auth-input .ant-input-affix-wrapper:focus,
  .auth-input .ant-input-affix-wrapper-focused {
    border-color: #7B61FF !important;
    box-shadow: 0 0 0 3px rgba(123,97,255,0.12) !important;
    background: #ffffff !important;
    outline: none !important;
  }
  .auth-input .ant-input-affix-wrapper:hover {
    border-color: rgba(123,97,255,0.40) !important;
    box-shadow: none !important;
  }
  .auth-input .ant-input-prefix {
    color: #94A3B8 !important;
    margin-inline-end: 10px !important;
    display: flex !important;
    align-items: center !important;
  }
  /* Force LTR layout on auth inputs when document is RTL */
  .auth-form-ltr .auth-input .ant-input-affix-wrapper,
  .auth-form-ltr .auth-input .ant-input {
    direction: ltr !important;
    text-align: start !important;
  }
  .auth-form-ltr .auth-input .ant-input::placeholder {
    text-align: start !important;
  }
  /* Force LTR layout on auth inputs when document is RTL */
  .auth-form-ltr .auth-input .ant-input-affix-wrapper,
  .auth-form-ltr .auth-input .ant-input {
    direction: ltr !important;
    text-align: start !important;
  }
  .auth-form-ltr .auth-input .ant-input::placeholder {
    text-align: start !important;
  }
  .auth-btn {
    background: linear-gradient(135deg, #7B61FF 0%, #5638D6 100%) !important;
    border: none !important;
    border-radius: 12px !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    height: 48px !important;
    box-shadow: 0 6px 16px rgba(123,97,255,0.28) !important;
    transition: transform .15s, box-shadow .2s, opacity .2s !important;
  }
  .auth-btn:hover:not(:disabled) {
    transform: translateY(-1px) !important;
    box-shadow: 0 10px 24px rgba(123,97,255,0.36) !important;
  }
  .auth-btn:active:not(:disabled) { transform: translateY(0) !important; }
  .auth-google-btn {
    border-radius: 12px !important;
    height: 46px !important;
    border: 1.5px solid #E5E7EB !important;
    background: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 10px !important;
    font-weight: 500 !important;
    transition: border-color .18s, box-shadow .18s, transform .15s !important;
  }
  .auth-google-btn:hover {
    border-color: #7B61FF !important;
    box-shadow: 0 0 0 4px rgba(123,97,255,0.10) !important;
    transform: translateY(-1px) !important;
  }
  @media (max-width: 880px) {
    .auth-brand-panel { display: none !important; }
    .auth-form-panel  { flex: 1 1 100% !important; padding: 32px 24px !important; }
    .auth-container   { max-width: 460px !important; min-height: 0 !important; }
  }
  @media (prefers-reduced-motion: reduce) {
    .auth-mesh, .auth-mesh-2, .auth-bubble, .auth-container { animation: none !important; }
  }
`;

const s: Record<string, CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#EEF2F8',
    // Logical-property padding so RTL inverts and safe-area-insets respect
    // device notches (Requirements 2.5, 2.7, 3.8, 14.7).
    paddingInlineStart: 'max(20px, env(safe-area-inset-left))',
    paddingInlineEnd:   'max(20px, env(safe-area-inset-right))',
    paddingBlockStart:  'max(20px, env(safe-area-inset-top))',
    paddingBlockEnd:    'max(20px, env(safe-area-inset-bottom))',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Vazirmatn', 'Noto Sans Arabic', 'Inter', 'Segoe UI', system-ui, sans-serif",
  },
  container: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    width: '100%',
    maxWidth: 1040,
    minHeight: 620,
    borderRadius: 24,
    overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)',
    // Base: solid surface fallback (overridden by @supports block in cssOverrides when backdrop-filter is supported)
    // Requirements: 12.4, 12.5, 12.6
    background: palette.surface,
    border: `1px solid ${glass.login.light.border}`,
  },
  brandPanel: {
    flex: '0 0 52%',
    background: BRAND_GRADIENT,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '40px 36px',
    position: 'relative',
    overflow: 'hidden',
    color: '#fff',
    direction: 'rtl',
  },
  brandTop: {
    display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 2,
  },
  brandWordmark: {
    fontSize: 18, fontWeight: 700, color: '#fff', lineHeight: 1.15,
  },
  brandTag: {
    fontSize: 11, color: 'rgba(255,255,255,0.70)', letterSpacing: 0.4,
  },
  illustrationWrap: {
    position: 'relative', zIndex: 2, alignSelf: 'center', width: '100%',
    display: 'flex', justifyContent: 'center', margin: '8px 0',
  },
  brandHeading: {
    position: 'relative', zIndex: 2, fontSize: 22, fontWeight: 700,
    lineHeight: 1.4, color: '#fff', textShadow: '0 2px 12px rgba(0,0,0,0.18)',
  },
  brandSub: {
    position: 'relative', zIndex: 2, fontSize: 13, color: 'rgba(255,255,255,0.82)',
    lineHeight: 1.7, marginTop: 4, marginBottom: 16,
  },
  featureList: {
    position: 'relative', zIndex: 2, listStyle: 'none', padding: 0, margin: 0,
    width: '100%', display: 'flex', flexDirection: 'column', gap: 8,
  },
  featureItem: {
    color: 'rgba(255,255,255,0.94)', fontSize: 13, display: 'flex',
    alignItems: 'center', gap: 10, padding: '10px 12px',
    borderRadius: 10, background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  },
  featureIcon: {
    width: 26, height: 26, borderRadius: 8,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(255,255,255,0.18)', fontSize: 14,
    flexShrink: 0,
  },
  trustStrip: {
    position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center',
    gap: 8, fontSize: 11, color: 'rgba(255,255,255,0.70)',
    letterSpacing: 0.3, marginTop: 8,
  },
  trustDot: {
    width: 8, height: 8, borderRadius: '50%', background: '#16A34A',
    boxShadow: '0 0 0 4px rgba(22,163,74,0.20)',
  },
  formPanel: {
    flex: '1 1 48%',
    display: 'flex', flexDirection: 'column',
    justifyContent: 'center', padding: '48px 40px',
    background: 'rgba(255,255,255,0.96)', overflowY: 'auto',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32,
  },
  logoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', lineHeight: 1.2 },
  logoSub:  { fontSize: 11, color: '#94A3B8', fontWeight: 500, letterSpacing: 0.3 },
  heading:  { fontSize: 24, fontWeight: 700, color: '#0F172A', marginBottom: 6, lineHeight: 1.3 },
  subHeading: { fontSize: 13, color: '#64748B', marginBottom: 28, display: 'block', lineHeight: 1.6 },
  legalFoot: {
    marginTop: 24, fontSize: 11, color: '#94A3B8', textAlign: 'center',
    lineHeight: 1.7,
  },
  legalLink: { color: '#7B61FF', fontWeight: 500, cursor: 'pointer' },
};

export default AuthLayout;
