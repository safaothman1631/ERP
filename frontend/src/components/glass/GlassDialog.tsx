import React from 'react';
import { Modal } from 'antd';
import { useAuthStore } from '../../store';
import { getGlassStyle } from '../../theme/glassStyles';
import { radius, space, zIndex } from '../../theme/tokens';
import GlassDialogFooter, { type GlassDialogFooterProps } from './GlassDialogFooter';

export type GlassDialogSize = 'sm' | 'md' | 'lg' | 'full';

const SIZE_MAP: Record<GlassDialogSize, number | string> = {
  sm: 420,
  md: 560,
  lg: 720,
  full: '92vw',
};

export interface GlassDialogProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  footerProps?: GlassDialogFooterProps;
  size?: GlassDialogSize;
  roleAccent?: boolean;
  stackDepth?: number;
  destroyOnClose?: boolean;
  maskClosable?: boolean;
  zIndexOverride?: number;
}

const GlassDialog: React.FC<GlassDialogProps> = ({
  open,
  onClose,
  title,
  children,
  footer,
  footerProps,
  size = 'md',
  roleAccent = true,
  stackDepth = 0,
  destroyOnClose = true,
  maskClosable = true,
  zIndexOverride,
}) => {
  const isDark = useAuthStore((s) => s.theme) === 'dark';
  const glass = getGlassStyle('dialog', roleAccent);

  const modalRender = (node: React.ReactNode) => (
    <div
      style={{
        ...glass,
        borderRadius: radius.lg,
        overflow: 'hidden',
      }}
    >
      {node}
    </div>
  );

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={title}
      footer={
        footer ??
        (footerProps ? (
          <GlassDialogFooter {...footerProps} />
        ) : null)
      }
      destroyOnHidden={destroyOnClose}
      maskClosable={maskClosable}
      keyboard
      width={SIZE_MAP[size]}
      zIndex={zIndexOverride ?? zIndex.modal + stackDepth}
      modalRender={modalRender}
          styles={{
            content: {
              padding: 0,
              background: 'transparent',
              boxShadow: 'none',
            },
            header: {
              padding: `${space.lg}px ${space.xl}px`,
              marginBottom: 0,
              background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.5)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
            },
            body: {
              padding: `${space.lg}px ${space.xl}px`,
            },
            footer: {
              padding: `${space.md}px ${space.xl}px`,
              marginTop: 0,
              background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
              borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
            },
          }}
        >
          {children}
        </Modal>
  );
};

export default GlassDialog;
