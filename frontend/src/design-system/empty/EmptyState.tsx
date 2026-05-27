/**
 * @file EmptyState.tsx
 * @description The workhorse empty-state component.
 *
 * Renders an illustration, title, description, and optional primary/secondary
 * CTAs. Fires telemetry on mount (`empty_state.shown`) and on CTA click
 * (`empty_state.cta_clicked`).
 *
 * Permission-aware: if `permissionGate` is supplied and the current user lacks
 * the permission, the primary CTA is replaced by a tertiary "Request access"
 * link (Requirement 9.1).
 *
 * Accessibility:
 *   - `role="status"`, `aria-live="polite"` — announced when the empty state
 *     appears.
 *   - Illustration is `aria-hidden="true"` — decorative only.
 *   - Buttons inherit Antd's keyboard handling and meet the 44×44 hit target.
 *
 * Motion:
 *   - Fade + scale-up via spring(stiffness=240, damping=22).
 *   - Respects `prefers-reduced-motion`.
 *
 * @see Requirement 4
 */

import { useEffect, useMemo, type ReactNode } from 'react';
import { Button } from 'antd';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { EmptyStateIllustration } from './EmptyStateIllustration';
import { useEmptyStateTelemetry } from './useEmptyStateTelemetry';
import { entranceVariants, DURATION_NORMAL } from './motion';
import { usePermission } from '../../hooks/usePermission';
import type { EmptyStateAction, EmptyStateProps } from './types';
import './EmptyState.css';

/* ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
 */

/**
 * Resolve the CTA to show: either the supplied primary action OR — when a
 * permission gate denies the user — a tertiary "Request access" link.
 */
function useResolveCta(
  primary: EmptyStateAction | undefined,
  permission: string | undefined,
): { cta: EmptyStateAction | undefined; locked: boolean } {
  const { hasPerm, isAuthenticated } = usePermission();

  return useMemo(() => {
    if (!primary) return { cta: undefined, locked: false };
    if (!permission) return { cta: primary, locked: false };
    const allowed = isAuthenticated && hasPerm(permission);
    if (allowed) return { cta: primary, locked: false };
    return {
      cta: {
        labelKey: 'empty.request_access',
        onClick: () => {
          // Fire the existing admin-notification flow. Tracked as a "Request access" CTA.
          // The actual notification dispatch lives elsewhere; here we just emit an event
          // by clicking. The implementation defaults to a no-op so callers can override.
          try {
            window.dispatchEvent(
              new CustomEvent('empty-state:request-access', {
                detail: { permission },
              }),
            );
          } catch {
            /* swallow */
          }
        },
      },
      locked: true,
    };
  }, [primary, permission, hasPerm, isAuthenticated]);
}

/* ---------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------
 */

/**
 * `<EmptyState>` — the single sanctioned empty UI in the app.
 *
 * Render only inside `<StateSwitch>` — the `local/state-switch-required`
 * lint rule enforces this.
 */
export function EmptyState({
  variant,
  illustration,
  titleKey,
  descriptionKey,
  title,
  description,
  primaryAction,
  secondaryAction,
  permissionGate,
  context,
  entity,
  ariaLabel,
  className,
}: EmptyStateProps): JSX.Element {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const telemetry = useEmptyStateTelemetry({ variant, entity, context });

  const permission = permissionGate ? `${permissionGate.resource}.${permissionGate.verb}` : undefined;
  const { cta, locked } = useResolveCta(primaryAction, permission);

  // Fire shown telemetry once on mount.
  useEffect(() => {
    telemetry.fireShown({ locked_by_permission: locked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolvedTitle: ReactNode = title ?? t(titleKey);
  const resolvedDescription: ReactNode = description ?? t(descriptionKey);
  const variants = entranceVariants(reduce);

  // List variant uses a larger illustration (Requirement 4 / design §4.2).
  const illuSize = variant === 'list' ? 96 : variant === 'subform' ? 48 : 64;

  return (
    <motion.div
      role="status"
      aria-live="polite"
      aria-label={ariaLabel ?? (typeof resolvedTitle === 'string' ? resolvedTitle : undefined)}
      variants={variants}
      initial="hidden"
      animate="visible"
      transition={reduce ? { duration: 0.12 } : { duration: DURATION_NORMAL }}
      className={['empty-state', `empty-state--${variant}`, className].filter(Boolean).join(' ')}
      data-testid={`empty-state-${variant}`}
      data-entity={entity}
    >
      <EmptyStateIllustration name={illustration} size={illuSize} />
      <h3 className="empty-state__title">{resolvedTitle}</h3>
      <p className="empty-state__description">{resolvedDescription}</p>
      <div className="empty-state__actions">
        {cta ? (
          <Button
            type={locked ? 'link' : 'primary'}
            icon={cta.icon}
            disabled={cta.disabled}
            onClick={() => {
              telemetry.fireCtaClicked({ locked_by_permission: locked });
              cta.onClick();
            }}
            data-testid={`empty-state-cta-${variant}`}
          >
            {t(cta.labelKey)}
          </Button>
        ) : null}
        {secondaryAction ? (
          <Button type="link" onClick={secondaryAction.onClick}>
            {t(secondaryAction.labelKey)}
          </Button>
        ) : null}
      </div>
    </motion.div>
  );
}

EmptyState.displayName = 'EmptyState';

export default EmptyState;
