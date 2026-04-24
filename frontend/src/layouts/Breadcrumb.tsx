import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RightOutlined, LeftOutlined, HomeOutlined } from '@ant-design/icons';
import { palette, space } from '../theme/tokens';
import { buildNavSections } from './navigation';

interface BreadcrumbProps {
  isDark: boolean;
  isRTL: boolean;
}

/**
 * Breadcrumb — Sprint 2 v2 — auto-derived from current route + nav sections.
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({ isDark, isRTL }) => {
  const loc = useLocation();
  const { t } = useTranslation();
  const sections = React.useMemo(() => buildNavSections(t), [t]);

  const crumbs = React.useMemo(() => {
    const path = loc.pathname;
    if (path === '/' || path === '') return [];
    // Find matching section + leaf
    for (const section of sections) {
      for (const item of section.items ?? []) {
        if (item.key === path || (item.key && path.startsWith(item.key + '/'))) {
          return [
            { label: section.label, path: undefined as string | undefined },
            { label: item.label, path: item.key },
          ];
        }
      }
    }
    // Fallback — show route segments
    const parts = path.split('/').filter(Boolean);
    return parts.map((p, i) => ({
      label: p.replace(/[-_]/g, ' '),
      path: '/' + parts.slice(0, i + 1).join('/'),
    }));
  }, [loc.pathname, sections]);

  if (crumbs.length === 0) return null;

  const Sep = isRTL ? LeftOutlined : RightOutlined;
  const fg = isDark ? palette.darkInkMuted : palette.ink500;
  const fgActive = isDark ? palette.darkInk : palette.ink900;

  return (
    <nav aria-label={t('topbar.breadcrumb', 'ڕێگا')} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 13, color: fg, minWidth: 0, overflow: 'hidden',
    }}>
      <Link to="/" style={{ color: fg, display: 'flex', alignItems: 'center', textDecoration: 'none' }}>
        <HomeOutlined />
      </Link>
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <React.Fragment key={i}>
            <Sep style={{ fontSize: 9, opacity: 0.5 }} aria-hidden />
            {c.path && !last ? (
              <Link to={c.path} style={{ color: fg, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                {c.label}
              </Link>
            ) : (
              <span style={{
                color: last ? fgActive : fg,
                fontWeight: last ? 600 : 400,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200,
              }}>{c.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};

export default Breadcrumb;
