import { NavLink } from 'react-router-dom';
import { Badge } from 'antd';
import { useTranslation } from 'react-i18next';
import { platformNavItems } from '../theme/platformTokens';
import styles from '../theme/PlatformGlass.module.css';

interface PlatformSideNavProps {
  mobileOpen?: boolean;
  isMobile?: boolean;
  pendingCount?: number;
}

export default function PlatformSideNav({ mobileOpen, isMobile, pendingCount = 0 }: PlatformSideNavProps) {
  const { t } = useTranslation();

  return (
    <nav
      className={`${styles.sideNav}${isMobile && !mobileOpen ? ` ${styles.sideNavMobileHidden}` : ''}${isMobile && mobileOpen ? ` ${styles.sideNavOpen}` : ''}`}
      aria-label={t('platform.nav_label', 'Platform navigation')}
    >
      <div className={styles.brand}>{t('platform.brand', 'Platform Console')}</div>
      {platformNavItems.map(item => {
        const label = t(`platform.nav.${item.key}`, item.key);
        const badge = item.badgeKey === 'pending_module_requests' && pendingCount > 0
          ? pendingCount
          : 0;
        return (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === '/platform'}
            className={({ isActive }) => `${styles.navItem}${isActive ? ` ${styles.navItemActive}` : ''}`}
          >
            <Badge count={badge} size="small" offset={[6, 0]}>
              <span>{label}</span>
            </Badge>
          </NavLink>
        );
      })}
    </nav>
  );
}
