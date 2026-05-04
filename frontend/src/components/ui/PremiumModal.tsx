import React from 'react';
import { Modal, Button, Space } from 'antd';
import type { ModalProps } from 'antd';
import { palette, radius, space, fontSize, motion } from '../../theme/tokens';
import { useAuthStore } from '../../store';

/**
 * PremiumModal — Polished AntD Modal wrapper with consistent header,
 * generous padding, gradient accent, and clear footer alignment.
 *
 * Use instead of raw <Modal> for all CRUD/setup dialogs.
 */
export interface PremiumModalProps extends Omit<ModalProps, 'title' | 'footer'> {
  icon?: React.ReactNode;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  okText?: string;
  cancelText?: string;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
  okDanger?: boolean;
  okLoading?: boolean;
  hideFooter?: boolean;
  customFooter?: React.ReactNode;
  children?: React.ReactNode;
}

const PremiumModal: React.FC<PremiumModalProps> = ({
  icon, title, subtitle, okText = 'Save', cancelText = 'Cancel',
  onOk, onCancel, okDanger, okLoading,
  hideFooter, customFooter, children,
  width = 560,
  ...rest
}) => {
  const isDark = useAuthStore(s => s.theme) === 'dark';
  const ink = isDark ? palette.darkInk : palette.ink900;
  const inkMuted = isDark ? palette.darkInkMuted : palette.ink500;
  const border = isDark ? palette.darkBorder : palette.border;

  return (
    <Modal
      {...rest}
      width={width}
      title={null}
      footer={null}
      onCancel={onCancel}
      closable={false}
      centered
      destroyOnHidden
      styles={{
        body: { padding: 0 },
      }}
      className={['pm-modal', rest.className].filter(Boolean).join(' ')}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: space.md,
          padding: `${space.lg}px ${space.xl}px`,
          borderBottom: `1px solid ${border}`,
          background: isDark
            ? 'linear-gradient(180deg, rgba(31,111,235,0.10), transparent)'
            : 'linear-gradient(180deg, rgba(31,111,235,0.06), transparent)',
        }}
      >
        {icon && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 40, height: 40,
              borderRadius: radius.md,
              background: 'rgba(31,111,235,0.14)',
              color: palette.primary500,
              fontSize: 18,
              flexShrink: 0,
            }}
          >
            {icon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title && (
            <div style={{ fontSize: fontSize.lg, fontWeight: 600, color: ink, lineHeight: 1.3 }}>
              {title}
            </div>
          )}
          {subtitle && (
            <div style={{ marginTop: 2, fontSize: fontSize.sm, color: inkMuted, lineHeight: 1.5 }}>
              {subtitle}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          style={{
            flexShrink: 0,
            width: 28, height: 28,
            borderRadius: radius.sm,
            background: 'transparent',
            border: 'none',
            color: inkMuted,
            cursor: 'pointer',
            transition: `background ${motion.durFast}ms`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          ✕
        </button>
      </div>

      <div style={{ padding: `${space.xl}px ${space.xl}px ${space.lg}px` }}>
        {children}
      </div>

      {!hideFooter && (
        <div
          style={{
            padding: `${space.md}px ${space.xl}px`,
            borderTop: `1px solid ${border}`,
            background: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(15,23,42,0.015)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          {customFooter ?? (
            <Space>
              <Button onClick={onCancel}>{cancelText}</Button>
              <Button type="primary" danger={okDanger} loading={okLoading} onClick={onOk}>
                {okText}
              </Button>
            </Space>
          )}
        </div>
      )}
    </Modal>
  );
};

export default PremiumModal;
