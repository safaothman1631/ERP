/**
 * PageErrorState — Error screen for page-level failures.
 *
 * Shown when:
 *  - A data fetch takes ≥ 5000ms (useLoadingState returns isError: true)
 *  - A page fails to load (caught by ErrorBoundary or explicit error state)
 *
 * Displays:
 *  - Translated error message
 *  - "Retry" button (calls onRetry)
 *  - "Go to Dashboard" link (navigates to /)
 *
 * Validates: Requirements 9.3, 9.6
 */

import React from 'react';
import { Button, Result, Space } from 'antd';
import { HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export interface PageErrorStateProps {
  /**
   * Called when the user clicks "Retry".
   * Typically this is the refetch / reload function from your data hook.
   */
  onRetry?: () => void;
  /**
   * Optional custom title. Defaults to the i18n key `errors.pageLoadFailed`.
   */
  title?: string;
  /**
   * Optional custom subtitle. Defaults to the i18n key `errors.pageLoadFailedDesc`.
   */
  subtitle?: string;
  /**
   * Whether the error was caused by a timeout (≥ 5000ms).
   * When true, the subtitle mentions the timeout.
   * @default false
   */
  isTimeout?: boolean;
}

/**
 * PageErrorState renders a full-page error screen with Retry + Go to Dashboard.
 *
 * Usage with useLoadingState:
 * ```tsx
 * const { showSkeleton, isError } = useLoadingState(isFetching);
 *
 * if (isError) return <PageErrorState onRetry={refetch} isTimeout />;
 * if (showSkeleton) return <LoadingSkeleton variant="table" />;
 * return <DataTable ... />;
 * ```
 *
 * Usage for explicit fetch errors:
 * ```tsx
 * if (error) return <PageErrorState onRetry={refetch} />;
 * ```
 */
const PageErrorState: React.FC<PageErrorStateProps> = ({
  onRetry,
  title,
  subtitle,
  isTimeout = false,
}) => {
  const { t } = useTranslation(['errors', 'common']);
  const navigate = useNavigate();

  const resolvedTitle = title ?? t('errors:pageLoadFailed', 'Page failed to load');
  const resolvedSubtitle =
    subtitle ??
    (isTimeout
      ? t('errors:pageLoadTimeout', 'The page took too long to load. Please try again.')
      : t('errors:pageLoadFailedDesc', 'Something went wrong while loading this page.'));

  const handleGoToDashboard = () => {
    navigate('/');
  };

  return (
    <Result
      status="error"
      title={resolvedTitle}
      subTitle={resolvedSubtitle}
      extra={
        <Space wrap>
          {onRetry && (
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={onRetry}
              aria-label={t('common:retry', 'Retry')}
            >
              {t('common:retry', 'Retry')}
            </Button>
          )}
          <Button
            icon={<HomeOutlined />}
            onClick={handleGoToDashboard}
            aria-label={t('common:goToDashboard', 'Go to Dashboard')}
          >
            {t('common:goToDashboard', 'Go to Dashboard')}
          </Button>
        </Space>
      }
    />
  );
};

export default PageErrorState;
