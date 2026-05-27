/**
 * @file ListWithEmptyState.tsx
 * @description Wraps list-page tables with a deterministic state machine and
 * a list-variant empty state.
 *
 * Usage:
 *   <ListWithEmptyState
 *     entity="customer"
 *     data={customers}
 *     loading={isLoading}
 *     error={error}
 *     render={(rows) => <ResponsiveTable rows={rows} />}
 *     onRetry={refetch}
 *   />
 *
 * The empty-state variant is `list` — a larger 96px illustration and a more
 * prominent CTA (design.md §4.2).
 *
 * For entities that have a `quickCreateRegistry` entry, clicking the CTA opens
 * the registry's quick-create modal/drawer. For entities NOT in the registry,
 * supply a `ctaOverride` to wire to a custom handler.
 *
 * @see Requirement 1.2
 */

import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { QUICK_CREATE_REGISTRY } from '../../data/quickCreateRegistry';
import { EmptyState } from './EmptyState';
import { StateSwitch } from './StateSwitch';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import type {
  EmptyStateAction,
  EmptyStateContext,
  EntitySlug,
  IllustrationKey,
  QuickCreateResult,
} from './types';

const QuickCreateModalLazy = lazy(() =>
  import('./QuickCreateModal').then((m) => ({ default: m.QuickCreateModal })),
);
const QuickCreateDrawerLazy = lazy(() =>
  import('./QuickCreateDrawer').then((m) => ({ default: m.QuickCreateDrawer })),
);

/* ---------------------------------------------------------------------------
 * Props
 * ---------------------------------------------------------------------------
 */

export interface ListWithEmptyStateProps<TRow> {
  /** Entity slug — drives empty-state copy + illustration. May be unregistered. */
  entity: EntitySlug | string;
  /** Current rows. Empty / undefined triggers the empty state. */
  data: TRow[] | undefined;
  /** True while data is loading. */
  loading: boolean;
  /** Error from the fetch. When truthy, renders `<ErrorState>` with Retry. */
  error?: unknown;
  /** Renders the populated table/list. */
  render: (rows: TRow[]) => ReactNode;
  /** Retry handler — wired to the ErrorState button. */
  onRetry?: () => void;
  /** Overrides the registry CTA — required when entity is not in the registry. */
  ctaOverride?: EmptyStateAction;
  /**
   * Legacy compatibility shim — invoked when the empty-state primary CTA is
   * clicked. Prefer `ctaOverride` for new code. When both are provided,
   * `ctaOverride` wins. When neither is provided AND the entity is in the
   * registry, the CTA opens the registry's modal/drawer.
   */
  onCreate?: () => void;
  /** Active search query — non-empty triggers search-empty variant. */
  searchQuery?: string;
  /** Clears the search — wired to the search-empty CTA. */
  onClearSearch?: () => void;
  /** Optional copy overrides for unregistered entities. */
  titleKey?: string;
  descriptionKey?: string;
  /** Illustration override for unregistered entities. */
  illustration?: IllustrationKey;
  className?: string;
  /** Telemetry context. */
  context?: EmptyStateContext;
}

/* ---------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------
 */

export function ListWithEmptyState<TRow>({
  entity,
  data,
  loading,
  error,
  render,
  onRetry,
  ctaOverride,
  onCreate,
  searchQuery,
  onClearSearch,
  titleKey,
  descriptionKey,
  illustration,
  className,
  context,
}: ListWithEmptyStateProps<TRow>): JSX.Element {
  const isRegistered = entity in QUICK_CREATE_REGISTRY;
  const config = isRegistered ? QUICK_CREATE_REGISTRY[entity as EntitySlug] : null;

  const [qcOpen, setQcOpen] = useState(false);

  const handleCtaClick = useCallback(() => {
    if (!config) return;
    if (config.class === 'C') {
      if (typeof window !== 'undefined') {
        window.location.href = config.fullFormHref;
      }
      return;
    }
    setQcOpen(true);
  }, [config]);

  const handleSuccess = useCallback((_result: QuickCreateResult) => {
    setQcOpen(false);
  }, []);

  const empty = !data || data.length === 0;
  const isSearchEmpty = empty && Boolean(searchQuery && searchQuery.trim().length > 0);

  const ModalOrDrawer = config
    ? config.class === 'A'
      ? QuickCreateModalLazy
      : config.class === 'B'
        ? QuickCreateDrawerLazy
        : null
    : null;

  // Build the empty state.
  let emptyNode: ReactNode;
  if (isSearchEmpty) {
    emptyNode = (
      <EmptyState
        variant="search"
        illustration="inbox"
        titleKey="empty.search_no_results"
        descriptionKey={`qc.${entity}.empty_description`}
        entity={entity}
        context={{ surface: 'list', search: searchQuery, ...(context ?? {}) }}
        primaryAction={
          onClearSearch
            ? { labelKey: 'empty.search_clear', onClick: onClearSearch }
            : undefined
        }
        className={className}
      />
    );
  } else {
    // Resolution order: ctaOverride (preferred) → onCreate (legacy) →
    // registry-derived (Class A/B opens modal/drawer; Class C navigates).
    const ctaAction =
      ctaOverride ??
      (onCreate
        ? {
            labelKey: config ? `qc.${entity}.cta` : 'common.create',
            onClick: onCreate,
            icon: <PlusOutlined />,
          }
        : config
          ? {
              labelKey: `qc.${entity}.cta`,
              onClick: handleCtaClick,
              icon: <PlusOutlined />,
            }
          : undefined);

    emptyNode = (
      <EmptyState
        variant="list"
        illustration={illustration ?? config?.illustration ?? 'inbox'}
        titleKey={titleKey ?? config?.emptyTitleKey ?? `qc.${entity}.empty_title`}
        descriptionKey={descriptionKey ?? config?.descriptionKey ?? `qc.${entity}.empty_description`}
        entity={entity}
        context={{ surface: 'list', ...(context ?? {}) }}
        permissionGate={
          config
            ? {
                resource: config.permission.split('.')[0],
                verb: config.permission.split('.')[1] ?? 'create',
              }
            : undefined
        }
        primaryAction={ctaAction}
        className={className}
      />
    );
  }

  return (
    <>
      <StateSwitch
        loading={loading}
        error={error}
        empty={empty}
        populated={data ? render(data) : null}
        loadingState={<LoadingState variant="list" rows={6} className={className} />}
        errorState={
          <ErrorState error={error} variant="list" onRetry={onRetry} className={className} />
        }
        emptyState={emptyNode}
      />
      {ModalOrDrawer && config ? (
        <Suspense fallback={null}>
          <ModalOrDrawer
            entity={entity as EntitySlug}
            open={qcOpen}
            onClose={() => setQcOpen(false)}
            onSuccess={handleSuccess}
            context={{ surface: 'list', ...(context ?? {}) }}
          />
        </Suspense>
      ) : null}
    </>
  );
}

ListWithEmptyState.displayName = 'ListWithEmptyState';

export default ListWithEmptyState;
