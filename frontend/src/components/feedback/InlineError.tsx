/**
 * InlineError — Inline error state with localized message + Retry action.
 *
 * Replaces silent fall-through-to-empty error states across the product.
 * Renders an inline error containing a human-readable error message in the
 * Active_Language and a "Retry" action button.
 *
 * Validates: Requirements 1.3 (system-wide-ux-overhaul)
 */

import React from 'react';
import { Button, Space, Typography } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { palette, space, radius } from '../../theme/tokens';

const { Text } = Typography;

export interface InlineErrorProps {
  /** Optional custom error message key. Defaults to 'error_loading'. */
  messageKey?: string;
  /** Optional custom error message string (overrides messageKey). */
  message?: string;
  /** Called when the user clicks "Retry". */
  onRetry?: () => void;
  /** Whether to show a compact version (no icon, smaller padding). */
  compact?: boolean;
}

/**
 * InlineError renders an inline error state with a localized message and
 * a Retry action. Used in place of silent fall-through-to-empty patterns.
 *
 * Usage:
 * ```tsx
 * if (error) return <InlineError onRetry={refetch} />;
 * ```
 */
const InlineErrorInner: React.FC<InlineErrorProps> = ({
  messageKey = 'error_loading',
  message: customMessage,
  onRetry,
  compact = false,
}) => {
  const { t } = useTranslation();

  const errorMessage = customMessage ?? t(messageKey, 'Error loading data');

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        flexDirection: compact ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? space.sm : space.md,
        padding: compact ? `${space.md}px ${space.lg}px` : `${space.xxl}px ${space.xl}px`,
        borderRadius: radius.md,
        background: palette.error50,
        border: `1px solid ${palette.error200}`,
        textAlign: 'center',
      }}
    >
      {!compact && (
        <WarningOutlined
          style={{ fontSize: 32, color: palette.danger }}
          aria-hidden="true"
        />
      )}
      <Space direction={compact ? 'horizontal' : 'vertical'} size={compact ? 8 : 12} align="center">
        <Text style={{ color: palette.error700, fontSize: 14 }}>
          {errorMessage}
        </Text>
        {onRetry && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={onRetry}
            size={compact ? 'small' : 'middle'}
            aria-label={t('retry', 'Retry')}
          >
            {t('retry', 'Retry')}
          </Button>
        )}
      </Space>
    </div>
  );
};

export const InlineError = React.memo(InlineErrorInner);

export default InlineError;
