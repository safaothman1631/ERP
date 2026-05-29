import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../api';
import { useViewport } from '../../hooks/useViewport';
import PlatformSideNav from './PlatformSideNav';
import PlatformTopBar from './PlatformTopBar';
import PlatformCommandPalette from '../components/PlatformCommandPalette';
import styles from '../theme/PlatformGlass.module.css';

export default function PlatformShell() {
  const { isMobile } = useViewport();
  const [navOpen, setNavOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['platform', 'stats'],
    queryFn: async () => {
      const res = await api.get('/api/platform/stats');
      return res.data as { pending_module_requests?: number };
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-shell', 'platform');
    return () => { document.documentElement.removeAttribute('data-shell'); };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.ambient} aria-hidden>
        <div className={styles.orbA} />
        <div className={styles.orbB} />
      </div>
      <div className={styles.layout}>
        <PlatformSideNav
            isMobile={isMobile}
            mobileOpen={navOpen}
            pendingCount={stats?.pending_module_requests ?? 0}
          />
        <div className={styles.main}>
          <PlatformTopBar showMenu={isMobile} onMenuClick={() => setNavOpen(v => !v)} />
          <main className={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
      <PlatformCommandPalette />
    </div>
  );
}
