/**
 * @file SelectWithQuickCreate.tsx
 * @description The universal `<Select>` replacement for entities with a
 * quick-create flow. Drop-in for any of the 58+ selectors in the app.
 *
 *   <SelectWithQuickCreate
 *     entity="customer"
 *     value={contactId}
 *     onChange={setContactId}
 *     placeholder="Choose a customer…"
 *   />
 *
 * **Persistent footer CTA** (spec: `persistent-quick-create-cta`):
 *   Every open dropdown — empty, populated, loading, searching, or in
 *   error — renders a single "+ Add <entity>" footer below the option
 *   list. The footer is the canonical create entry point; the empty-state
 *   body no longer renders its own inline primary action. The footer is
 *   hidden when the parent select is `disabled`, when the current role
 *   lacks the registry's create permission, or when the entity is not
 *   registered.
 *
 *   The footer uses Antd's `popupRender` (Antd 6 — `dropdownRender` is
 *   deprecated). It coexists with the StateSwitch body, which still
 *   renders loading / error / empty / search-empty illustrations.
 *
 * Optimistic merge:
 *   On successful quick-create, the new record is prepended to the local
 *   options cache without an additional server fetch (Requirement 8.1) and
 *   the originating selector's value is set to the new record's id.
 *   A highlight pulse plays on the new option (Requirement 6.4).
 *
 * @see .kiro/specs/persistent-quick-create-cta/design.md
 */

import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { isEmptyStateV2Enabled } from '../../api/featureFlags';
import { usePermission } from '../../hooks/usePermission';
import { useEmptyStateTelemetry } from './useEmptyStateTelemetry';
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
 * QuickCreateFooter — the always-visible "+ Add <entity>" row.
 *
 * Plain <button> (not Antd <Button>) on purpose: Antd's Select traps
 * keyboard inside the popup and a vanilla button keeps focus management
 * predictable. Styling lives in `EmptyState.css` under `.qc-select-footer`.
 * ---------------------------------------------------------------------------
 */

interface QuickCreateFooterProps {
  entity: string;
  labelKey: string;
  context?: Record<string, unknown>;
  onActivate: () => void;
}

function QuickCreateFooter({ entity, labelKey, context, onActivate }: QuickCreateFooterProps): JSX.Element {
  const { t } = useTranslation();
  const label = t(labelKey, context as never);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onActivate();
      }
    },
    [onActivate],
  );
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent the Select's blur-on-mousedown handler from closing the popup
    // before our click registers.
    e.preventDefault();
  }, []);
  return (
    <div className="qc-select-footer" role="presentation">
      <button
        type="button"
        className="qc-select-footer__cta"
        onMouseDown={onMouseDown}
        onClick={onActivate}
        onKeyDown={onKeyDown}
        aria-label={label}
        data-testid={`select-quick-create-footer-${entity}`}
      >
        <PlusOutlined aria-hidden="true" />
        <span>{label}</span>
      </button>
    </div>
  );
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

  // Empty-state v2 is now the default and only UI path; the parent feature
  // flag was used during rollout and is no longer consulted here. Per-entity
  // disable is still honoured via `isEmptyStateV2Enabled` which defaults true
  // — kept as an emergency kill switch for the footer + body experience.
  const v2Enabled = isEmptyStateV2Enabled(entity);

  // Permission gate: hide the footer when the role can't create this entity.
  // The body's permissionGate prop already handles the empty-state inline
  // version (now removed); we re-apply the same check at the popup level.
  const { hasPerm } = usePermission();
  const canCreate = config ? hasPerm(config.permission) : false;

  // Telemetry: footer clicks fire `empty_state.cta_clicked` with a
  // `source: 'footer'` discriminator. The hook is mounted unconditionally so
  // the events queue alongside the body's events (when the search-empty
  // body's "Clear search" CTA fires its own event).
  const telemetry = useEmptyStateTelemetry({
    variant: 'selector',
    entity,
    context: { surface: 'selector' },
  });

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
  const fetcher = loadOptions ?? config?.loadOptions;
  const useStatic = Array.isArray(staticOptions);

  useEffect(() => {
    if (useStatic) {
      setOptions(staticOptions!);
      setLoadingOptions(false);
      setLoadError(null);
      return;
    }
    if (!fetcher) {
      setOptions([]);
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
  const handleCtaClick = useCallback(
    (source: 'footer' | 'body' = 'footer') => {
      // Fire telemetry with the entry-point discriminator.
      try {
        telemetry.fireCtaClicked({ source });
      } catch {
        // Telemetry must never break the user action.
      }
      if (!config) return;
      if (config.class === 'C') {
        // Class C: navigate with return-token (sister agents will wire this fully).
        if (typeof window !== 'undefined') {
          const url = config.fullFormHref;
          window.location.href = url;
        }
        return;
      }
      setQcOpen(true);
    },
    [config, telemetry],
  );

  /* ── Render flags ─────────────────────────────────────────────── */
  const empty = options.length === 0;
  const isSearching = debouncedSearch.length > 0;

  const ctaAction = ctaOverride ?? {
    labelKey: `qc.${entity}.cta`,
    onClick: () => handleCtaClick('body'),
    icon: <PlusOutlined />,
  };

  /** True when the persistent footer should render inside the popup. */
  const footerVisible = Boolean(
    v2Enabled &&
      config &&
      canCreate &&
      !disabled,
  );

  /* ── State-switch body (no inline CTA in the non-search empty body) ── */
  const stateBody = useMemo<ReactNode>(() => {
    if (!v2Enabled) {
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
            // Non-search empty state: footer owns the CTA; we no longer
            // render the inline primaryAction here. Permission gating still
            // applies inside <EmptyState> if a future variant restores it.
            <EmptyState
              variant="selector"
              illustration={config?.illustration ?? 'inbox'}
              titleKey={config?.emptyTitleKey ?? `qc.${entity}.empty_title`}
              descriptionKey={config?.descriptionKey}
              entity={entity}
              context={{ surface: 'selector' }}
            />
          )
        }
      />
    );
  }, [v2Enabled, loadingOptions, loadError, empty, isSearching, debouncedSearch, config, entity]);

  /* ── popupRender: body + divider + persistent footer ─────────────── */
  const popupRender = useCallback(
    (originNode: ReactNode) => {
      // For the populated list we render Antd's originNode (it includes the
      // virtualized option list); for empty / loading / error / search-empty
      // we render our StateSwitch body instead so the user sees the
      // illustrated state. Footer is appended at the bottom in BOTH cases.
      const showOriginNode = !loadingOptions && !loadError && !empty;
      return (
        <>
          {showOriginNode ? originNode : stateBody}
          {footerVisible ? (
            <QuickCreateFooter
              entity={entity}
              labelKey={ctaAction.labelKey}
              context={ctaAction.context as Record<string, unknown> | undefined}
              onActivate={() => handleCtaClick('footer')}
            />
          ) : null}
        </>
      );
    },
    [loadingOptions, loadError, empty, stateBody, footerVisible, entity, ctaAction, handleCtaClick],
  );

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
    config?.class === 'A' ? QuickCreateModalLazy : config?.class === 'B' ? QuickCreateDrawerLazy : null;

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
        popupRender={popupRender}
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
