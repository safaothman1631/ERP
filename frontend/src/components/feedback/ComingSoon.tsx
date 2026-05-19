/**
 * ComingSoon — Placeholder Empty_State for feature-flagged or "coming soon" sections.
 *
 * Renders a placeholder explaining the status in the Active_Language instead of
 * a blank white screen. Used for sections marked as "coming soon" or feature-flagged off.
 *
 * Validates: Requirements 1.12 (system-wide-ux-overhaul)
 */

import React from 'react';
import { Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { palette, space } from '../../theme/tokens';

const { Text } = Typography;

export interface ComingSoonProps {
  /** Optional i18n key for the feature name. */
  featureNameKey?: string;
  /** Optional custom description key. Defaults to 'comingSoon.description'. */
  descriptionKey?: string;
  /** Optional icon to display. Defaults to RocketOutlined. */
  icon?: React.ReactNode;
}

/**
 * ComingSoon renders a placeholder Empty_State for sections that are not yet available.
 *
 * Usage:
 * ```tsx
 * {isSoon ? <ComingSoon featureNameKey="pos.loyalty" /> : <ActualContent />}
 * ```
 */
const ComingSoonInner: React.FC<ComingSoonProps> = ({
  featureNameKey,
  descriptionKey = 'comingSoon.description',
  icon,
}) => {
  const { t } = useTranslation();
  const reduce = useReducedMotion();

  const title = t('coming_soon', 'Coming soon');
  const description = t(descriptionKey, 'This feature is under development and will be available soon.');
  const featureName = featureNameKey ? t(featureNameKey) : undefined;

  return (
    <motion.div
      role="region"
      aria-label={title}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={reduce ? undefined : { opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.md,
        padding: `${space.xxxl}px ${space.xl}px`,
        textAlign: 'center',
        minHeight: 240,
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: palette.info50,
          color: palette.info500,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
        }}
      >
        {icon ?? <RocketOutlined />}
      </div>
      <div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: palette.ink900,
            marginBottom: 4,
          }}
        >
          {featureName ? `${featureName} — ${title}` : title}
        </div>
        <Text
          style={{
            color: palette.ink500,
            fontSize: 14,
            maxWidth: 420,
            display: 'block',
          }}
        >
          {description}
        </Text>
      </div>
    </motion.div>
  );
};

export const ComingSoon = React.memo(ComingSoonInner);

export default ComingSoon;
