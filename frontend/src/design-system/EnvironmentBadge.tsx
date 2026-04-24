import React from 'react';
import { Tag } from 'antd';

export interface EnvironmentBadgeProps {
  env?: 'production' | 'staging' | 'development' | 'test';
}

const COLORS: Record<string, string> = {
  production: 'green',
  staging: 'orange',
  development: 'blue',
  test: 'purple',
};

/**
 * EnvironmentBadge — Sprint 10 — visible env indicator.
 * Auto-detects from import.meta.env.MODE if not provided.
 */
export const EnvironmentBadge: React.FC<EnvironmentBadgeProps> = ({ env }) => {
  const mode = env ?? (import.meta.env.MODE as 'production' | 'development' | 'test');
  if (mode === 'production') return null; // hide in prod
  return (
    <Tag color={COLORS[mode] ?? 'default'} style={{ margin: 0, fontWeight: 600, textTransform: 'uppercase' }}>
      {mode}
    </Tag>
  );
};

export default EnvironmentBadge;
