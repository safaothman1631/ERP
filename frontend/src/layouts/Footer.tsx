import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import { palette, space, layout, zIndex } from '../theme/tokens';

interface FooterProps {
  isDark: boolean;
  isRTL: boolean;
}

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'v1.4.2';
const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined) ?? (import.meta.env.DEV ? 'dev' : 'prod');

/**
 * Footer / StatusBar — Sprint 1 v2.
 * Sticky 32px bar at bottom. Shows: connection · fiscal-year · org·user · version · env · last-sync · links.
 */
export const Footer: React.FC<FooterProps> = ({ isDark, isRTL }) => {
  const { t } = useTranslation();
  const userName = useAuthStore((s) => s.userName);
  const orgId = useAuthStore((s) => s.orgId);
  const [online, setOnline] = React.useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [lastSync, setLastSync] = React.useState<Date>(new Date());

  React.useEffect(() => {
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    const tick = setInterval(() => setLastSync(new Date()), 60_000);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
      clearInterval(tick);
    };
  }, []);

  // Fiscal year (calendar year for now; backend sync later)
  const fiscalYear = new Date().getFullYear();

  // Last sync — relative
  const syncRel = React.useMemo(() => {
    const diff = Math.floor((Date.now() - lastSync.getTime()) / 1000);
    if (diff < 60) return t('footer.just_now', 'ئێستا');
    const m = Math.floor(diff / 60);
    return t('footer.minutes_ago', '{{n}} خولەک پێشتر', { n: m });
  }, [lastSync, t]);

  const fg = isDark ? palette.darkInkMuted : palette.ink500;
  const bg = isDark ? palette.darkSurface : palette.surface;
  const sep = isDark ? palette.darkBorder : palette.border;

  const envColor = APP_ENV === 'prod'
    ? palette.success
    : APP_ENV === 'staging'
      ? palette.warning
      : palette.info;

  const dotStyle: React.CSSProperties = {
    width: 8, height: 8, borderRadius: '50%',
    background: online ? palette.success : palette.danger,
    display: 'inline-block',
    boxShadow: online ? `0 0 6px ${palette.success}` : 'none',
  };

  const Sep = () => (
    <span aria-hidden style={{ color: sep, padding: `0 ${space.sm}px`, userSelect: 'none' }}>·</span>
  );

  return (
    <footer
      role="contentinfo"
      aria-label={t('footer.label', 'شریطی دۆخ')}
      style={{
        position: 'sticky',
        bottom: 0,
        height: layout.footerHeight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: `0 ${space.lg}px`,
        background: bg,
        borderTop: `1px solid ${sep}`,
        color: fg,
        fontSize: 12,
        zIndex: zIndex.sticky,
        direction: isRTL ? 'rtl' : 'ltr',
        gap: space.sm,
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      {/* Left cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={dotStyle} aria-hidden />
        <span aria-live="polite">{online ? t('footer.online', 'سەرهێڵ') : t('footer.offline', 'دەرهێڵ')}</span>
        <Sep />
        <span>{t('footer.fiscal_year', 'ساڵی دارایی')} {fiscalYear}</span>
        <Sep />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {orgId ? `${orgId.slice(0, 8)}…` : '—'} · {userName ?? '—'}
        </span>
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontFamily: 'monospace' }}>{APP_VERSION}</span>
        <Sep />
        <span style={{
          background: `${envColor}22`,
          color: envColor,
          padding: '1px 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>{APP_ENV}</span>
        <Sep />
        <span title={lastSync.toLocaleString()}>{t('footer.synced', 'هاوکات')} {syncRel}</span>
        <Sep />
        <Link to="/docs" style={{ color: fg, textDecoration: 'none' }}>{t('footer.help', 'یارمەتی')}</Link>
        <Sep />
        <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" style={{ color: fg, textDecoration: 'none' }}>API</a>
      </div>
    </footer>
  );
};

export default Footer;
