import React from 'react';
import type { CSSProperties } from 'react';
import { CheckCircleFilled } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const BRAND_GRADIENT = 'linear-gradient(135deg, #1F6FEB 0%, #0B2F66 100%)';

const BrandIllustration: React.FC = () => (
  <svg viewBox="0 0 320 260" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ width: '100%', maxWidth: 300, opacity: 0.92 }}>
    <circle cx="160" cy="130" r="110" fill="rgba(255,255,255,0.06)" />
    <circle cx="160" cy="130" r="80" fill="rgba(255,255,255,0.06)" />
    <rect x="70" y="60" width="180" height="140" rx="10" fill="rgba(255,255,255,0.18)" />
    <rect x="70" y="60" width="12" height="140" rx="6" fill="rgba(255,255,255,0.30)" />
    {[90, 108, 126, 144, 162, 180].map((y, i) => (
      <rect key={i} x="94" y={y} width={i % 2 === 0 ? 130 : 90} height="4"
        rx="2" fill="rgba(255,255,255,0.22)" />
    ))}
    <rect x="195" y="155" width="16" height="30" rx="3" fill="rgba(255,255,255,0.50)" />
    <rect x="216" y="140" width="16" height="45" rx="3" fill="rgba(255,255,255,0.70)" />
    <rect x="237" y="125" width="16" height="60" rx="3" fill="rgba(255,255,255,0.90)" />
    <ellipse cx="105" cy="215" rx="18" ry="7" fill="rgba(255,255,255,0.20)" />
    <rect x="87" y="208" width="36" height="7" rx="2" fill="rgba(255,255,255,0.25)" />
    <ellipse cx="105" cy="208" rx="18" ry="7" fill="rgba(255,255,255,0.35)" />
    <circle cx="52" cy="55" r="5" fill="rgba(255,255,255,0.30)" />
    <circle cx="272" cy="70" r="7" fill="rgba(255,255,255,0.20)" />
    <circle cx="288" cy="200" r="4" fill="rgba(255,255,255,0.25)" />
    <circle cx="40" cy="190" r="6" fill="rgba(255,255,255,0.18)" />
    <circle cx="245" cy="75" r="18" fill="rgba(255,255,255,0.25)" />
    <path d="M237 75 l5 6 l10-10" stroke="white" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const features = [
  'بەڕێوەبردنی پسووڵەکان',
  'ئامارەی دارایی تەواو',
  'ئامادەکردنی ڕاپۆرت',
  'ساختەی ئەمن',
];

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
  const { t } = useTranslation();

  return (
    <div style={s.wrapper}>
      <style>{cssOverrides}</style>
      <div style={s.container}>
        {/* Brand panel */}
        <div className="auth-brand-panel" style={s.brandPanel}>
          <div style={s.brandBubble1} />
          <div style={s.brandBubble2} />
          <BrandIllustration />
          <p style={s.brandTitle}>{t('app_name')}</p>
          <p style={s.brandSub}>بەڕێوەبردنی دارایی بە شێوازێکی مۆدێرن</p>
          <ul style={s.featureList}>
            {features.map((f) => (
              <li key={f} style={s.featureItem}>
                <CheckCircleFilled style={{ color: 'rgba(255,255,255,0.90)', fontSize: 16, flexShrink: 0 }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <span style={s.poweredBy}>Powered by شادۆ</span>
        </div>

        {/* Form panel */}
        <div className="auth-form-panel" style={s.formPanel}>
          <div style={s.logoRow}>
            <div style={s.logoIcon}>📊</div>
            <div>
              <div style={s.logoText}>{t('app_name')}</div>
              <div style={s.logoSub}>Accounting System</div>
            </div>
          </div>
          <div style={s.heading}>{title}</div>
          <span style={s.subHeading}>{subtitle}</span>
          {children}
        </div>
      </div>
    </div>
  );
};

const cssOverrides = `
  .auth-input .ant-input,
  .auth-input .ant-input-affix-wrapper {
    border-radius: 10px !important;
    border: 1.5px solid #e0e0e8 !important;
    background: #f8f8ff !important;
    font-size: 14px !important;
    transition: border-color .2s, box-shadow .2s !important;
  }
  .auth-input .ant-input:focus,
  .auth-input .ant-input-affix-wrapper:focus,
  .auth-input .ant-input-affix-wrapper-focused {
    border-color: #1F6FEB !important;
    box-shadow: 0 0 0 3px rgba(31,111,235,0.14) !important;
    background: #ffffff !important;
  }
  .auth-input .ant-input-prefix { color: #1F6FEB !important; }
  .auth-btn {
    background: linear-gradient(135deg, #1F6FEB 0%, #114393 100%) !important;
    border: none !important;
    border-radius: 10px !important;
    font-size: 15px !important;
    font-weight: 600 !important;
    height: 48px !important;
    transition: opacity .2s, transform .15s !important;
  }
  .auth-btn:hover {
    opacity: 0.92 !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 8px 20px rgba(31,111,235,0.32) !important;
  }
  .auth-google-btn {
    border-radius: 10px !important;
    height: 46px !important;
    border: 1.5px solid #e0e0e8 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 8px !important;
    font-weight: 500 !important;
    transition: border-color .2s, box-shadow .2s !important;
  }
  .auth-google-btn:hover {
    border-color: #1F6FEB !important;
    box-shadow: 0 0 0 3px rgba(31,111,235,0.10) !important;
  }
  @media (max-width: 768px) {
    .auth-brand-panel { display: none !important; }
    .auth-form-panel { flex: 1 1 100% !important; padding: 36px 28px !important; }
  }
`;

const s: Record<string, CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f2f8',
    padding: 20,
    fontFamily: "'Noto Sans Arabic', 'Segoe UI', sans-serif",
  },
  container: {
    display: 'flex',
    width: '100%',
    maxWidth: 960,
    minHeight: 580,
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 24px 64px rgba(102,126,234,0.18), 0 8px 24px rgba(0,0,0,0.10)',
    background: '#ffffff',
  },
  brandPanel: {
    flex: '0 0 55%',
    background: BRAND_GRADIENT,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 36px',
    position: 'relative',
    overflow: 'hidden',
  },
  brandBubble1: {
    position: 'absolute', top: -60, right: -60, width: 200, height: 200,
    borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
  },
  brandBubble2: {
    position: 'absolute', bottom: -80, left: -50, width: 260, height: 260,
    borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
  },
  brandTitle: {
    color: '#fff', fontSize: 26, fontWeight: 700, marginBottom: 8, marginTop: 20,
    textAlign: 'center', textShadow: '0 2px 8px rgba(0,0,0,0.15)',
  },
  brandSub: {
    color: 'rgba(255,255,255,0.82)', fontSize: 14, textAlign: 'center',
    marginBottom: 24, lineHeight: 1.7,
  },
  featureList: { listStyle: 'none', padding: 0, margin: 0, width: '100%', maxWidth: 260 },
  featureItem: {
    color: 'rgba(255,255,255,0.92)', fontSize: 14, display: 'flex',
    alignItems: 'center', gap: 10, marginBottom: 12, direction: 'rtl' as const,
  },
  poweredBy: {
    position: 'absolute', bottom: 20, color: 'rgba(255,255,255,0.55)',
    fontSize: 12, letterSpacing: 0.5,
  },
  formPanel: {
    flex: '0 0 45%', display: 'flex', flexDirection: 'column',
    justifyContent: 'center', padding: '40px 36px', direction: 'rtl',
    background: '#fff', overflowY: 'auto',
  },
  logoRow: {
    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28,
    justifyContent: 'flex-start', direction: 'rtl',
  },
  logoIcon: {
    width: 40, height: 40, borderRadius: 10, background: BRAND_GRADIENT,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 18, color: '#fff', flexShrink: 0,
  },
  logoText: { fontSize: 15, fontWeight: 700, color: '#2d2d2d', lineHeight: 1.2 },
  logoSub: { fontSize: 11, color: '#999', fontWeight: 400 },
  heading: { fontSize: 22, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 },
  subHeading: { fontSize: 13, color: '#888', marginBottom: 24, display: 'block' },
};

export default AuthLayout;
