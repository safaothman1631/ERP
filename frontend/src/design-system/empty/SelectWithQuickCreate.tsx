/**
 * @file SelectWithQuickCreate.tsx
 * @description The universal `<Select>` replacement for entities with a
 * quick-create flow. Drop-in for any of the 42+ selectors in the app.
 *
 *   <SelectWithQuickCreate
 *     entity="customer"
 *     value={contactId}
 *     onChange={setContactId}
 *     placeholder="Choose a customer…"
 *   />
 *
 * On empty (zero options + no search query): renders an `<EmptyState>` with
 * the registry's CTA inside the dropdown's `notFoundContent`. On search-empty
 * (zero options + non-empty search): renders the search-empty variant with a
 * "Clear search" CTA (Requirement 14).
 *
 * Optimistic merge:
 *   On successful quick-create, the new record is prepended to the local
 *   options cache without an additional server fetch (Requirement 8.1) and
 *   the originating selector's value is set to the new record's id.
 *   A highlight pulse plays on the new option (Requirement 6.4).
 *
 * @see design.md §4.1
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Select, Spin } from 'antd';
import type { SelectProps } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import { QUICK_CREATE_REGISTRY } from '../../data/quickCreateRegistry';
import { EmptyState } from './EmptyState';
import { StateSwitch } from './StateSwitch';
import { LoadingState } from './LoadingState';
import { ErrorState } from './ErrorState';
import { highlightPulse } from './motion';
import { useFeatureFlag } from '../../hooks/useFeatureFlag';
import { isEmptyStateV2Enabled } from '../../api/featureFlags';
import type {
  EntitySlug,
  LoadOptionsResult,
  QuickCreateResult,
  SelectWithQuickCreateProps,
} from './types';

/* ---------------------------------------------------------------------------
 * Lazy-loaded heavy chunks (Requirement 13.2).
 * ---------------------------------------------------------------------------
 */

const QuickCreateModalLazy = lazy(() =>
  import('./QuickCreateModal').then((m) => ({ default: m.QuickCreateModal })),
);
const QuickCreateDrawerLazy = lazy(() =>
  import('./QuickCreateDrawer').then((m) => ({ default: m.QuickCreateDrawer })),
);

/* ---------------------------------------------------------------------------
 * Debounce hook — small inline (so we don't drag a hook from the wider tree).
 * ---------------------------------------------------------------------------
 */

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/* ---------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------
 */

export function SelectWithQuickCreate({
  entity,
  value,
  onChange,
  loadOptions,
  options: staticOptions,
  prefillFromSearch = true,
  placeholder,
  className,
  disabled,
  ctaOverride,
  allowClear,
  style,
}: SelectWithQuickCreateProps): JSX.Element {
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const config = QUICK_CREATE_REGISTRY[entity];

  // Feature-flag gate per Requirement 15.1.
  const parentFlag = useFeatureFlag('ui.empty_state_v2');
  const v2Enabled = parentFlag.isEnabled && isEmptyStateV2Enabled(entity);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);

  const [options, setOptions] = useState<LoadOptionsResult['options']>(staticOptions ?? []);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadError, setLoadError] = useState<unknown>(null);

  // Lazy-open quick-create UI: Modal for Class A, Drawer for Class B.
  // Class C navigates to the full form via `fullFormHref`.
  const [qcOpen, setQcOpen] = useState(false);

  // Track the just-created record so we can play the highlight pulse.
  const [highlightedId, setHighlightedId] = useState<string | number | null>(null);

  /* ── Options loader ──────────────────────────────────────────────── */
  // When `staticOptions` is provided, the consumer owns the option source
  // (back-compat for migrated pages that already had local state). Skip the
  // registry's loadOptions fetch entirely.
  const fetcher = loadOptions ?? config.loadOptions;
  const useStatic = Array.isArray(staticOptions);

  useEffect(() => {
    if (useStatic) {
      setOptions(staticOptions!);
      setLoadingOptions(false);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingOptions(true);
    setLoadError(null);
    fetcher(debouncedSearch)
      .then((res) => {
        if (cancelled) return;
        setOptions(res.options);
        setLoadingOptions(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err);
        setLoadingOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, fetcher, useStatic, staticOptions]);

  /* ── Quick-create success handler ───────────────────────────────── */
  const handleSuccess = useCallback(
    (result: QuickCreateResult) => {
      // Prepend the new record to options (optimistic merge).
      setOptions((prev) => [{ value: result.id, label: result.label }, ...prev.filter((o) => o.value !== result.id)]);
      // Auto-select.
      onChange?.(result.id, result.raw);
      // Flash highlight.
      setHighlightedId(result.id);
      setTimeout(() => setHighlightedId(null), 700);
    },
    [onChange],
  );

  /* ── CTA: open modal / drawer / navigate ───────────────────────── */
  const handleCtaClick = useCallback(() => {
    if (config.class === 'C') {
      // Class C: navigate with return-token (sister agents will wire this fully).
      if (typeof window !== 'undefined') {
        const url = config.fullFormHref;
        window.location.href = url;
      }
      return;
    }
    setQcOpen(true);
  }, [config]);

  /* ── Render notFoundContent (the empty/loading/error inside dropdown) ── */
  const empty = options.length === 0;
  const isSearching = debouncedSearch.length > 0;

  const ctaAction = ctaOverride ?? {
    labelKey: `qc.${entity}.cta`,
    onClick: handleCtaClick,
    icon: <PlusOutlined />,
  };

  const notFoundContent = useMemo(() => {
    if (!v2Enabled) {
      // Legacy path — render a small spinner / no-data with no CTA.
      return loadingOptions ? <Spin size="small" /> : null;
    }
    return (
      <StateSwitch
        loading={loadingOptions}
        error={loadError}
        empty={empty}
        populated={null}
        loadingState={<LoadingState variant="selector" rows={2} />}
        errorState={<ErrorState error={loadError} variant="selector" onRetry={() => setSearch((s) => s + '')} />}
        emptyState={
          isSearching ? (
            <EmptyState
              variant="search"
              illustration="inbox"
              titleKey="empty.search_no_results"
              descriptionKey={`qc.${entity}.empty_description`}
              entity={entity}
              context={{ search: debouncedSearch }}
              primaryAction={{
                labelKey: 'empty.search_clear',
                onClick: () => setSearch(''),
              }}
            />
          ) : (
            <EmptyState
              variant="selector"
              illustration={config.illustration}
              titleKey={config.emptyTitleKey ?? `qc.${entity}.empty_title`}
              descriptionKey={config.descriptionKey}
              entity={entity}
              context={{ surface: 'selector' }}
              permissionGate={{
                resource: config.permission.split('.')[0],
                verb: config.permission.split('.')[1] ?? 'create',
              }}
              primaryAction={ctaAction}
            />
          )
        }
      />
    );
  }, [v2Enabled, loadingOptions, loadError, empty, isSearching, debouncedSearch, ctaAction, config, entity]);

  /* ── Build Antd options with optional highlight wrapper ──────────── */
  const antdOptions: SelectProps['options'] = useMemo(
    () =>
      options.map((opt) => ({
        value: opt.value,
        label:
          opt.value === highlightedId && !reduce ? (
            <motion.span
              variants={highlightPulse}
              initial="initial"
              animate="pulse"
              style={{ display: 'inline-block', borderRadius: 4, padding: '0 4px' }}
            >
              {opt.label}
            </motion.span>
          ) : (
            opt.label
          ),
      })),
    [options, highlightedId, reduce],
  );

  /* ── Determine which heavy chunk to render ─────────────────────── */
  const ModalOrDrawer =
    config.class === 'A' ? QuickCreateModalLazy : config.class === 'B' ? QuickCreateDrawerLazy : null;

  return (
    <>
      <Select<string | number>
        value={value ?? undefined}
        onChange={(v) => onChange?.(v ?? null)}
        showSearch
        filterOption={false}
        onSearch={setSearch}
        loading={loadingOptions}
        options={antdOptions}
        placeholder={placeholder ?? t('entity_select.placeholder', 'Search…')}
        notFoundContent={notFoundContent}
        disabled={disabled}
        allowClear={allowClear}
        className={className}
        data-testid={`select-quick-create-${entity}`}
        style={{ width: '100%', ...(style ?? {}) }}
      />
      {ModalOrDrawer ? (
        <Suspense fallback={null}>
          <ModalOrDrawer
            entity={entity as EntitySlug}
            open={qcOpen}
            onClose={() => setQcOpen(false)}
            onSuccess={handleSuccess}
            prefill={prefillFromSearch ? { search: debouncedSearch } : undefined}
            context={{ surface: 'selector' }}
          />
        </Suspense>
      ) : null}
    </>
  );
}

SelectWithQuickCreate.displayName = 'SelectWithQuickCreate';

export default SelectWithQuickCreate;
