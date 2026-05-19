/**
 * `EmptySelectState` — bridge between the `nav-settings-cleanup` Empty-Select
 * escape-hatch and the system-wide `EmptyState` component.
 *
 * When a Settings section's Select has zero options because no records exist,
 * this component renders the shared `EmptyState` with a CTA that navigates
 * to the creation screen — reusing the same component product-wide (R17.2).
 *
 * This replaces any ad-hoc inline empty states in Settings sections that
 * previously rendered their own "no data" UI. The `buildAddOption` utility
 * still handles the Select-dropdown-level escape-hatch; this component
 * handles the section-level empty state.
 *
 * _Validates: Requirements 9.8, 17.2_
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

import { asTranslationKey, type TranslationKey } from '../../i18n/types';
import { EmptyState } from './EmptyState';

export interface EmptySelectStateProps {
  /** Translation key for the empty state title. */
  titleKey: TranslationKey;
  /** Translation key for the empty state description. */
  descriptionKey: TranslationKey;
  /** Translation key for the CTA button label (e.g., "Add Fiscal Year"). */
  ctaKey: TranslationKey;
  /** Route to navigate to when the CTA is clicked. */
  route: string;
  /** Optional illustration/icon. */
  illustration?: React.ReactNode;
  /** Whether the add action is mandatory (from useAddGate). Defaults to true. */
  mandatory?: boolean;
}

/**
 * Renders the shared `EmptyState` component for Settings sections where
 * a Select has zero options. Navigates to the creation route on CTA click.
 */
export const EmptySelectState: React.FC<EmptySelectStateProps> = ({
  titleKey,
  descriptionKey,
  ctaKey,
  route,
  illustration,
  mandatory = true,
}) => {
  const navigate = useNavigate();

  return (
    <EmptyState
      illustration={illustration}
      titleKey={titleKey}
      descriptionKey={descriptionKey}
      ctaKey={ctaKey}
      onCta={() => navigate(route)}
      mandatory={mandatory}
    />
  );
};

export default EmptySelectState;
