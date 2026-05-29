/**
 * @file ErrorState.tsx
 * @description Error variant of the empty-state shell. Renders a single-line
 * message and a Retry button. Never surfaces a stack trace user-facing
 * (Requirement 7.1).
 *
 * Uses the same illustration framework as `<EmptyState>` so motion and spacing
 * stay consistent.
 */

import { memo } from 'react';
import { Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { EmptyStateIllustration } from './EmptyStateIllustration';
import { entranceVariants, DURATION_NORMAL } from './motion';
import type { ErrorStateProps } from './types';
import './EmptyState.css';

/** Derive a developer-friendly single-line message from any error shape. */
function deriveMessage(err: unknown): string | undefined {
  if (!err) return undefined;
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in (err as Record<string, unknown>)) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return undefined;
}

function ErrorStateBase({
  error,
  onRetry,
  variant = 'list',
  className,
  ariaLabel,
}: ErrorStateProps): JSX.Element {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const variants = entranceVariants(reduce);

  const errorHint = deriveMessage(error);

  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      aria-label={ariaLabel ?? t('error.title', 'Something went wrong')}
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={reduce ? { duration: 0.12 } : { duration: DURATION_NORMAL }}
      className={['empty-state', 'empty-state--error', `empty-state--${variant}`, className]
        .filter(Boolean)
        .join(' ')}
      data-testid={`error-state-${variant}`}
    >
      <EmptyStateIllustration name="lock" size={variant === 'list' ? 96 : 64} />
      <h3 className="empty-state__title">{t('error.title', 'Something went wrong')}</h3>
      <p className="empty-state__description">
        {errorHint ?? t('error.generic_message', 'Please try again in a moment.')}
      </p>
      {onRetry ? (
        <div className="empty-state__actions">
          <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry} data-testid="error-state-retry">
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      ) : null}
    </motion.div>
  );
}

export const ErrorState = memo(ErrorStateBase);
ErrorState.displayName = 'ErrorState';

export default ErrorState;
