import type { ReactNode } from 'react';
import styles from '../theme/PlatformGlass.module.css';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
}

export default function GlassCard({ children, className }: GlassCardProps) {
  return (
    <div className={`${styles.glassCard}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
