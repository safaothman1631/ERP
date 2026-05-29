/**
 * @file LoadingState.tsx
 * @description Skeleton-based loading indicator. Used by `<StateSwitch>` while
 * a collection-bound surface is fetching its first page.
 *
 * The skeleton shape mirrors the EmptyState shell so cross-fades between
 * loading → empty / populated feel continuous.
 *
 * @see Requirement 7.1
 */

import { memo } from 'react';
import { Skeleton } from 'antd';
import type { LoadingStateProps } from './types';
import './EmptyState.css';

function LoadingStateBase({ rows = 5, variant, className }: LoadingStateProps): JSX.Element {
  const classes = [
    'empty-state__loading',
    variant ? `empty-state__loading--${variant}` : undefined,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // For selector and search variants, render a tight 2-line skeleton.
  if (variant === 'selector' || variant === 'search') {
    return (
      <div className={classes} aria-busy="true" aria-live="polite" data-testid="loading-state">
        <Skeleton active title={false} paragraph={{ rows: 2, width: ['80%', '60%'] }} />
      </div>
    );
  }

  return (
    <div className={classes} aria-busy="true" aria-live="polite" data-testid="loading-state">
      <Skeleton active title paragraph={{ rows }} />
    </div>
  );
}

export const LoadingState = memo(LoadingStateBase);
LoadingState.displayName = 'LoadingState';

export default LoadingState;
