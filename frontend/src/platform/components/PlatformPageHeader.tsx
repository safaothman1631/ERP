import type { ReactNode } from 'react';
import styles from '../theme/PlatformGlass.module.css';

interface PlatformPageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PlatformPageHeader({ title, subtitle, actions }: PlatformPageHeaderProps) {
  return (
    <header className={styles.pageHeader}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <h1 className={styles.pageTitle}>{title}</h1>
          {subtitle && <p className={styles.pageSubtitle}>{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  );
}
