import React from 'react';
import { useAuthStore } from '../../store';
import { radius } from '../../theme/tokens';
import { getGlassStyle } from '../../theme/glassStyles';

interface Props {
  children: React.ReactNode;
  className?: string;
  accent?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}

const GlassCard: React.FC<Props> = ({ children, className, accent, style, onClick }) => {
  const isDark = useAuthStore((s) => s.theme) === 'dark';

  return (
    <div
      className={`glass-card ${className ?? ''}`}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      style={{
        ...getGlassStyle('modal', accent),
        borderRadius: radius.lg,
        transition: 'transform 0.18s ease, box-shadow 0.2s ease',
        ...style,
      }}
    >
      {children}
      <style>{`
        .glass-card:hover {
          ${onClick ? 'transform: translateY(-1px);' : ''}
        }
        @supports not (backdrop-filter: blur(1px)) {
          .glass-card {
            background: ${isDark ? '#111A2E' : '#fff'} !important;
          }
        }
      `}</style>
    </div>
  );
};

export default GlassCard;
