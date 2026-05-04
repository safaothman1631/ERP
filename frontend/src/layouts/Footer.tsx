import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store';
import { palette, space, layout, zIndex, radius } from '../theme/tokens';

interface FooterProps {
  isDark: boolean;
  isRTL: boolean;
}

const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) ?? 'v1.4.2';
const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined) ?? (import.meta.env.DEV ? 'dev' : 'prod');

/**
 * Footer / StatusBar v2 — premium chip-based status bar.
 * Glass surface, pill chips, gradient accent, minimal but information-dense.
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

  const fiscalYear = new Date().getFullYear();

  const syncRel = React.useMemo(() => {
    const diff = Math.floor((Date.now() - lastSync.getTime()) / 1000);
    if (diff < 60) return t('footer.just_now', 'ئێستا');
    const m = Math.floor(diff / 60);
    return t('footer.minutes_ago', '{{n}} خولەک پێشتر', { n: m });
  }, [lastSync, t]);

  const fg     = isDark ? palette.darkInkMuted : palette.ink500;
  const fgBold = isDark ? palette.darkInk      : palette.ink900;
  const bg     = isDark
    ? 'linear-gradient(180deg, rgba(17,26,46,0.86) 0%, rgba(17,26,46,0.94) 100%)'
    : 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(255,255,255,0.96) 100%)';
  const sep    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
  const chipBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.04)';
  const chipBorder = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';

  const envColor = APP_ENV === 'prod'
    ? palette.success
    : APP_ENV === 'staging'
      ? palette.warning
      : palette.info;

  const Chip: React.FC<{ children: React.ReactNode; title?: string; tone?: 'default' | 'accent' }> = ({ children, title, tone }) => (
    <span
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: tone === 'accent' ? `${palette.primary500}14` : chipBg,
        border: `1px solid ${tone === 'accent' ? `${palette.primary500}28` : chipBorder}`,
        borderRadius: radius.pill,
        padding: '3px 10px',
        fontSize: 11.5,
        lineHeight: 1.3,
        color: tone === 'accent' ? palette.primary600 : fg,
        whiteSpace: 'nowrap',
        fontWeight: 500,
      }}
    >
      {children}
    </span>
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
        backdropFilter: 'blur(18px) saturate(160%)',
        WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      }}
    >
      {/* Left cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Chip title={online ? 'Online' : 'Offline'}>
          <span
            aria-hidden
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: online ? palette.success : palette.danger,
              boxShadow: online ? `0 0 0 3px ${palette.success}22` : 'none',
              animation: online ? 'fb-pulse 2.4s ease-in-out infinite' : undefined,
            }}
          />
          <span aria-live="polite" style={{ color: fgBold, fontWeight: 600 }}>
            {online ? t('footer.online', 'سەرهێڵ') : t('footer.offline', 'دەرهێڵ')}
          </span>
        </Chip>

        <Chip>
          <span>{t('footer.fiscal_year', 'ساڵی دارایی')}</span>
          <span style={{ color: fgBold, fontWeight: 600 }}>{fiscalYear}</span>
        </Chip>

        <Chip title={orgId ?? undefined} tone="accent">
          <span>{userName ?? '—'}</span>
          {orgId && (
            <span style={{ opacity: 0.7, fontFamily: '"SF Mono",Consolas,monospace', fontSize: 10.5 }}>
              · {orgId.slice(0, 6)}
            </span>
          )}
        </Chip>
      </div>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Chip>
          <span title={lastSync.toLocaleString()}>
            {t('footer.synced', 'هاوکات')} <span style={{ color: fgBold, fontWeight: 600 }}>{syncRel}</span>
          </span>
        </Chip>

        <Chip>
          <span style={{ fontFamily: '"SF Mono",Consolas,monospace', color: fgBold, fontWeight: 600 }}>
            {APP_VERSION}
          </span>
        </Chip>

        <span
          style={{
            background: `${envColor}1f`,
            color: envColor,
            border: `1px solid ${envColor}3a`,
            padding: '2px 9px',
            borderRadius: radius.pill,
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}
        >
          {APP_ENV}
        </span>

        <Link
          to="/docs"
          style={{ color: fg, textDecoration: 'none', padding: '2px 6px', borderRadius: 6, fontSize: 11.5 }}
          className="fb-link"
        >
          {t('footer.help', 'یارمەتی')}
        </Link>
        <a
          href="http://localhost:8000/docs"
          target="_blank"
          rel="noreferrer"
          style={{ color: fg, textDecoration: 'none', padding: '2px 6px', borderRadius: 6, fontSize: 11.5 }}
          className="fb-link"
        >
          API
        </a>
      </div>

      <style>{`
        @keyframes fb-pulse {
          0%, 100% { box-shadow: 0 0 0 0 ${palette.success}40; }
          50%      { box-shadow: 0 0 0 5px ${palette.success}00; }
        }
        .fb-link:hover {
          color: ${palette.primary600} !important;
          background: ${palette.primary500}10;
        }
      `}</style>
    </footer>
  );
};

export default Footer;
