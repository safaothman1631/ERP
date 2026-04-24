import React from 'react';
import { Skeleton, Card, Space } from 'antd';
import { space } from '../theme/tokens';

export type SkeletonVariant = 'page' | 'table' | 'card' | 'list' | 'detail' | 'kpis';

export interface LoadingSkeletonProps {
  variant?: SkeletonVariant;
  rows?: number;
  /** For 'kpis' variant. Default 4. */
  count?: number;
}

/**
 * LoadingSkeleton — page-level skeleton فۆڕم بۆ loading states.
 * بریتییە لە جێگرتنی <Spin/> ـی full-page.
 */
export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ variant = 'page', rows = 4, count = 4 }) => {
  if (variant === 'table') {
    return (
      <div>
        <Skeleton.Input active style={{ width: '40%', marginBottom: space.md }} />
        <Card>
          <Skeleton active paragraph={{ rows }} title={false} />
        </Card>
      </div>
    );
  }
  if (variant === 'card') {
    return (
      <Card>
        <Skeleton active paragraph={{ rows }} avatar />
      </Card>
    );
  }
  if (variant === 'list') {
    return (
      <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} size="small">
            <Skeleton active paragraph={{ rows: 1 }} title={{ width: '30%' }} />
          </Card>
        ))}
      </Space>
    );
  }
  if (variant === 'detail') {
    return (
      <div>
        <Skeleton active title={{ width: '40%' }} paragraph={{ rows: 2, width: ['80%', '60%'] }} />
        <div style={{ marginTop: space.lg }}>
          <Card><Skeleton active paragraph={{ rows: 4 }} /></Card>
        </div>
      </div>
    );
  }
  if (variant === 'kpis') {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, gap: space.md }}>
        {Array.from({ length: count }).map((_, i) => (
          <Card key={i}>
            <Skeleton active paragraph={{ rows: 1 }} title={{ width: '50%' }} />
          </Card>
        ))}
      </div>
    );
  }
  // page (default)
  return (
    <div>
      <Skeleton active title={{ width: '30%' }} paragraph={{ rows: 1, width: ['60%'] }} />
      <div style={{ marginTop: space.lg }}>
        <Card><Skeleton active paragraph={{ rows }} /></Card>
      </div>
    </div>
  );
};

export default LoadingSkeleton;
