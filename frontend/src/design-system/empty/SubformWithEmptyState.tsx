/**
 * @file SubformWithEmptyState.tsx
 * @description Inline empty state for repeating subform sections (line items,
 * schedules, members). Renders compactly at the row position when the section
 * has zero entries.
 *
 *   <SubformWithEmptyState
 *     entity="line_items"
 *     empty={lines.length === 0}
 *     onAdd={addLine}
 *   >
 *     <LineItemsTable rows={lines} />
 *   </SubformWithEmptyState>
 *
 * @see Requirement 1.4
 */

import { memo, type ReactNode } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { EmptyState } from './EmptyState';
import type { SubformWithEmptyStateProps } from './types';

function SubformWithEmptyStateBase({
  entity,
  empty,
  children,
  onAdd,
  titleKey,
  descriptionKey,
  ctaKey,
  illustration = 'box',
  className,
  // ── Legacy EP-5 shim props ──
  items,
  onAddFirst,
  render,
  emptyTitleKey,
  emptyDescriptionKey,
  emptyCtaKey,
  icon,
}: SubformWithEmptyStateProps): ReactNode {
  // EP-0 API: explicit `empty` flag wins. EP-5 legacy: derive from items.
  const isEmpty =
    typeof empty === 'boolean' ? empty : Array.isArray(items) ? items.length === 0 : false;

  if (!isEmpty) {
    // EP-0 API renders children; EP-5 renders via the legacy `render` prop.
    if (children !== undefined) return children;
    if (typeof render === 'function') return render();
    return null;
  }

  const resolvedTitleKey = titleKey ?? emptyTitleKey ?? `qc.${entity}.empty_title`;
  const resolvedDescriptionKey = descriptionKey ?? emptyDescriptionKey ?? `qc.${entity}.empty_description`;
  const resolvedCtaKey = ctaKey ?? emptyCtaKey ?? `qc.${entity}.cta`;
  const handleAdd = onAdd ?? onAddFirst ?? (() => undefined);

  return (
    <EmptyState
      variant="subform"
      illustration={illustration}
      titleKey={resolvedTitleKey}
      descriptionKey={resolvedDescriptionKey}
      entity={entity}
      context={{ surface: 'subform' }}
      primaryAction={{
        labelKey: resolvedCtaKey,
        onClick: handleAdd,
        icon: icon ?? <PlusOutlined />,
      }}
      className={className}
    />
  );
}

export const SubformWithEmptyState = memo(SubformWithEmptyStateBase);
SubformWithEmptyState.displayName = 'SubformWithEmptyState';

export default SubformWithEmptyState;
