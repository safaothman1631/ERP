/**
 * `AddGateSection` — wrapper that wires `useAddGate(sectionId)` into a
 * list section that exposes an "Add" / "Create" primary action.
 *
 * This component:
 * 1. Calls `useAddGate(sectionId)` and syncs the record count.
 * 2. Renders the mandatory `EmptyState` CTA when `mode === 'mandatory'`
 *    (i.e., the section has zero records).
 * 3. Adds `data-addgate-section` and `data-add-action` attributes for
 *    the route-walk test.
 * 4. Passes through children when records exist (`mode === 'optional'`).
 *
 * _Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5, 9.8, 17.2_
 */

import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import type { SectionId } from '../../help/sectionIds';
import { asTranslationKey, type TranslationKey } from '../../i18n/types';
import { useAddGate } from './useAddGate';
import { EmptyState } from './EmptyState';

export interface AddGateSectionProps {
  /** The section identifier for the AddGate store. */
  sectionId: SectionId;
  /** Current record count for this section (from API response). */
  recordCount: number;
  /** Translation key for the empty state title. */
  emptyTitleKey: TranslationKey;
  /** Translation key for the empty state description. */
  emptyDescriptionKey: TranslationKey;
  /** Translation key for the Add/Create CTA button label. */
  ctaKey: TranslationKey;
  /** Handler for the Add/Create CTA. */
  onAdd: () => void;
  /** Optional illustration/icon for the empty state. */
  illustration?: React.ReactNode;
  /** The list content to render when records exist. */
  children: React.ReactNode;
}

/**
 * Wraps a list section with AddGate logic. Renders `EmptyState` when
 * the section is empty (mandatory mode), otherwise renders children.
 */
export const AddGateSection: React.FC<AddGateSectionProps> = ({
  sectionId,
  recordCount,
  emptyTitleKey,
  emptyDescriptionKey,
  ctaKey,
  onAdd,
  illustration,
  children,
}) => {
  const { mode, setRecordCount } = useAddGate(sectionId);

  // Sync the record count into the AddGate store whenever it changes.
  useEffect(() => {
    setRecordCount(recordCount);
  }, [recordCount, setRecordCount]);

  return (
    <div data-addgate-section={sectionId}>
      {mode === 'mandatory' && recordCount === 0 ? (
        <EmptyState
          illustration={illustration}
          titleKey={emptyTitleKey}
          descriptionKey={emptyDescriptionKey}
          ctaKey={ctaKey}
          onCta={onAdd}
          mandatory
        />
      ) : (
        children
      )}
    </div>
  );
};

export default AddGateSection;
