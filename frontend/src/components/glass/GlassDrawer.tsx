import React from 'react';
import { Drawer } from 'antd';
import { motion } from 'framer-motion';
import { useAuthStore } from '../../store';
import { getGlassStyle } from '../../theme/glassStyles';
import { useGlassMotion } from '../../hooks/useGlassMotion';
import { useViewport } from '../../hooks/useViewport';
import { radius, space } from '../../theme/tokens';

export interface GlassDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  placement?: 'bottom' | 'right' | 'left';
  height?: number | string;
  roleAccent?: boolean;
}

const GlassDrawer: React.FC<GlassDrawerProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  placement,
  height = '85vh',
  roleAccent = true,
}) => {
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const { isMobile } = useViewport();
  const { dialog } = useGlassMotion();
  const glass = getGlassStyle('drawer', roleAccent);
  const resolvedPlacement = placement ?? (isMobile ? 'bottom' : 'right');

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      placement={resolvedPlacement}
      height={resolvedPlacement === 'bottom' ? height : undefined}
      destroyOnHidden
      footer={footer}
      styles={{
        content: glass,
        header: {
          borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
        },
        body: { padding: space.lg },
        footer: {
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
        },
      }}
      drawerRender={(node) => (
        <motion.div
          variants={dialog}
          initial="hidden"
          animate="visible"
          exit="exit"
          style={{ height: '100%' }}
        >
          {resolvedPlacement === 'bottom' && (
            <div
              aria-hidden
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.pill,
                background: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.15)',
                margin: `${space.sm}px auto ${space.xs}px`,
              }}
            />
          )}
          {node}
        </motion.div>
      )}
    >
      {children}
    </Drawer>
  );
};

export default GlassDrawer;
