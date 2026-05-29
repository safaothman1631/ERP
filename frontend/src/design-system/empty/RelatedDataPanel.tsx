/**
 * @file RelatedDataPanel.tsx
 * @description Empty-state wrapper for drawer / side-panel collections —
 * activity logs, payment history, related orders. By default no primary CTA
 * is rendered (related data is contextual; the user can't usually create
 * it directly from the panel).
 *
 *   <RelatedDataPanel
 *     titleKey="invoice.activity_log"
 *     empty={events.length === 0}
 *   >
 *     <ActivityList events={events} />
 *   </RelatedDataPanel>
 *
 * @see Requirement 1.3
 */

import { memo } from 'react';
import { Skeleton } from 'antd';
import { useTranslation } from 'react-i18next';
import { EmptyState } from './EmptyState';
import type { RelatedDataPanelProps } from './types';

function RelatedDataPanelBase({
  entity,
  titleKey,
  title,
  empty,
  children,
  emptyDescriptionKey,
  illustration = 'inbox',
  secondaryAction,
  className,
  // ── Legacy EP-5 shim props ──
  data,
  loading,
  emptyTitleKey,
  emptyTitleFallback,
  emptyDescriptionFallback,
  emptyCtaKey,
  onEmptyCta,
}: RelatedDataPanelProps): JSX.Element {
  const { t } = useTranslation();

  // EP-0 API: explicit `empty` flag wins. EP-5 legacy: derive from data.
  const isEmpty =
    typeof empty === 'boolean'
      ? empty
      : data === null || data === undefined || data.length === 0;

  // EP-5 legacy: while loading + no data, render skeleton.
  if (loading && isEmpty) {
    return (
      <div
        className={['empty-state__related', className].filter(Boolean).join(' ')}
        data-empty-surface="related-panel"
        data-empty-entity={entity}
      >
        <Skeleton active paragraph={{ rows: 3 }} />
      </div>
    );
  }

  // EP-5 legacy: build a primary CTA when `onEmptyCta` + `emptyCtaKey` are present.
  const legacyPrimary =
    onEmptyCta && emptyCtaKey
      ? { labelKey: emptyCtaKey, onClick: onEmptyCta }
      : undefined;

  // Resolve title/description with legacy fallbacks honored.
  const resolvedTitleKey =
    emptyTitleKey ?? 'empty.no_related_data';
  const resolvedDescriptionKey =
    emptyDescriptionKey ?? 'empty.no_related_data_description';

  return (
    <div
      className={['empty-state__related', className].filter(Boolean).join(' ')}
      data-empty-surface="related-panel"
      data-empty-entity={entity}
    >
      {titleKey || title ? (
        <h4 className="empty-state__related-title" style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
          {title ?? (titleKey ? t(titleKey) : '')}
        </h4>
      ) : null}
      {isEmpty ? (
        <EmptyState
          variant="drawer"
          illustration={illustration}
          titleKey={resolvedTitleKey}
          descriptionKey={resolvedDescriptionKey}
          title={emptyTitleFallback ? t(resolvedTitleKey, emptyTitleFallback) : undefined}
          description={
            emptyDescriptionFallback ? t(resolvedDescriptionKey, emptyDescriptionFallback) : undefined
          }
          entity={entity}
          primaryAction={
            legacyPrimary
              ? {
                  labelKey: legacyPrimary.labelKey,
                  onClick: legacyPrimary.onClick,
                }
              : undefined
          }
          secondaryAction={secondaryAction}
          context={{ surface: 'related-panel' }}
        />
      ) : (
        children
      )}
    </div>
  );
}

export const RelatedDataPanel = memo(RelatedDataPanelBase);
RelatedDataPanel.displayName = 'RelatedDataPanel';

export default RelatedDataPanel;
