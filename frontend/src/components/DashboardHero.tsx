import React from 'react';
import { Button, Space } from 'antd';
import {
  PlusOutlined, FileTextOutlined, WalletOutlined,
  DollarOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';
import { palette, radius, space } from '../theme/tokens';

/**
 * DashboardHero — Premium greeting card for the Dashboard page
 * - Time-aware greeting (morning/afternoon/evening) in Kurdish + English
 * - Personalized with user name
 * - Live date display
 * - Quick-action chips
 * - Decorative gradient + glow
 */

interface Props {
  onCreateInvoice?: () => void;
}

const DashboardHero: React.FC<Props> = ({ onCreateInvoice }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const userName = useAuthStore((s) => s.userName) || t('user');

  const hour = new Date().getHours();
  const greetingKey =
    hour < 5 ? 'greeting_night'
    : hour < 12 ? 'greeting_morning'
    : hour < 17 ? 'greeting_afternoon'
    : hour < 21 ? 'greeting_evening'
    : 'greeting_night';

  const today = new Date();
  const dateLocale = i18n.language?.startsWith('ku') ? 'ckb' : i18n.language || 'en';
  let dateLabel: string;
  try {
    dateLabel = new Intl.DateTimeFormat(dateLocale, {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }).format(today);
  } catch {
    dateLabel = today.toDateString();
  }

  const quickChips = [
    { icon: <FileTextOutlined />, label: t('new_invoice'), onClick: onCreateInvoice ?? (() => navigate('/invoices/new')) },
    { icon: <WalletOutlined />,   label: t('expenses'),    onClick: () => navigate('/expenses') },
    { icon: <DollarOutlined />,   label: t('payments'),    onClick: () => navigate('/banking') },
    { icon: <BarChartOutlined />, label: t('reports'),     onClick: () => navigate('/reports') },
  ];

  return (
    <div style={styles.wrap}>
      <style>{css}</style>
      <div className="dh-glow dh-glow-1" aria-hidden />
      <div className="dh-glow dh-glow-2" aria-hidden />

      <div style={styles.inner}>
        <div style={styles.left}>
          <div style={styles.eyebrow}>{dateLabel}</div>
          <div style={styles.greeting}>
            {t(greetingKey)}<span style={styles.userName}>، {userName}</span>
          </div>
          <div style={styles.sub}>{t('dashboard_hero_sub')}</div>

          <Space size={[8, 8]} wrap style={{ marginTop: space.md }}>
            {quickChips.map((c) => (
              <Button
                key={c.label}
                type="default"
                size="middle"
                icon={c.icon}
                onClick={c.onClick}
                className="dh-chip"
              >
                {c.label}
              </Button>
            ))}
          </Space>
        </div>

        <div style={styles.right}>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={onCreateInvoice ?? (() => navigate('/invoices/new'))}
            className="dh-cta"
          >
            {t('new_invoice')}
          </Button>
        </div>
      </div>
    </div>
  );
};

const css = `
  .dh-glow {
    position: absolute;
    border-radius: 50%;
    filter: blur(40px);
    pointer-events: none;
  }
  .dh-glow-1 {
    top: -60px; inset-inline-end: -40px;
    width: 220px; height: 220px;
    background: radial-gradient(circle, rgba(91,141,239,0.45) 0%, transparent 70%);
  }
  .dh-glow-2 {
    bottom: -80px; inset-inline-start: 20%;
    width: 240px; height: 240px;
    background: radial-gradient(circle, rgba(22,163,74,0.28) 0%, transparent 70%);
  }
  .dh-chip {
    border-radius: 999px !important;
    border: 1px solid rgba(255,255,255,0.28) !important;
    background: rgba(255,255,255,0.14) !important;
    color: #fff !important;
    font-weight: 500 !important;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    transition: background .18s, transform .15s, border-color .18s;
  }
  .dh-chip:hover {
    background: rgba(255,255,255,0.22) !important;
    border-color: rgba(255,255,255,0.45) !important;
    transform: translateY(-1px);
    color: #fff !important;
  }
  .dh-cta {
    background: rgba(255,255,255,0.96) !important;
    color: #114393 !important;
    border: none !important;
    font-weight: 700 !important;
    border-radius: 12px !important;
    height: 48px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
    transition: transform .15s, box-shadow .2s;
  }
  .dh-cta:hover {
    transform: translateY(-1px);
    box-shadow: 0 12px 28px rgba(0,0,0,0.24) !important;
    color: #0B2F66 !important;
  }
`;

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.xl,
    background: 'linear-gradient(135deg, #1F6FEB 0%, #114393 55%, #0B2F66 100%)',
    color: '#fff',
    padding: `${space.xl}px ${space.xl}px`,
    marginBottom: space.lg,
    boxShadow: '0 12px 32px rgba(31,111,235,0.22)',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space.md,
  },
  left: { flex: '1 1 auto', minWidth: 280 },
  right: { flexShrink: 0 },
  eyebrow: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0.4,
    fontWeight: 500,
    marginBottom: 6,
  },
  greeting: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1.25,
    color: '#fff',
    textShadow: '0 2px 12px rgba(0,0,0,0.18)',
  },
  userName: { fontWeight: 700, color: '#fff' },
  sub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 6,
    lineHeight: 1.6,
    maxWidth: 560,
  },
};

// suppress unused palette import if styles ever drop it
void palette;

export default DashboardHero;
