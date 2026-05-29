/**
 * @file dev-gallery/empty-states.tsx
 * @description Visual gallery for every `<EmptyState>` variant × illustration ×
 * locale × theme combination. Gated by `import.meta.env.DEV` — never reaches
 * a production bundle.
 *
 * Wire to a route only in development, e.g. (in `App.routes.tsx`):
 *
 *   {import.meta.env.DEV && (
 *     <Route path="/dev/empty-states" lazy={() => import('./dev-gallery/empty-states')} />
 *   )}
 *
 * (NOT modified here — wiring happens in EP-0 or by a coordinated commit.)
 *
 * Spec: `.kiro/specs/empty-state-quick-create/requirements.md` §16.2 (Storybook fallback).
 */

import { useState } from 'react';
import type {
  EmptyStateVariant,
  IllustrationKey,
  EntitySlug,
} from '../design-system/empty/types';

/**
 * Lazy require so this file is tree-shaken from prod even if someone
 * accidentally imports it. The runtime check below also guards.
 */
function GalleryShell({ children }: { children: React.ReactNode }) {
  if (!import.meta.env.DEV) {
    return (
      <div style={{ padding: 24 }}>
        <p>This page is only available in development builds.</p>
      </div>
    );
  }
  return <div style={{ padding: 24 }}>{children}</div>;
}

const VARIANTS: EmptyStateVariant[] = ['selector', 'list', 'drawer', 'subform', 'search'];
const ILLUSTRATIONS: IllustrationKey[] = [
  'customers', 'items', 'documents', 'money', 'inbox', 'chart', 'box', 'lock',
];
const LOCALES = ['ku', 'en', 'ar'] as const;
const THEMES = ['light', 'dark'] as const;
const ENTITIES: EntitySlug[] = [
  'customer', 'vendor', 'tax_rate', 'expense_category',
  'item', 'account', 'team', 'employee',
];

/**
 * Renders a single empty-state preview. Because EP-0's primitives might
 * still be in flux while this file lands, we import the primitive lazily
 * and fall back to a placeholder card if the import fails — so the gallery
 * never breaks the dev build.
 */
function EmptyStatePreview(props: {
  variant: EmptyStateVariant;
  illustration: IllustrationKey;
  entity: EntitySlug;
  locale: string;
  theme: string;
}) {
  const [error, setError] = useState<string | null>(null);
  // Dynamic import to keep the gallery resilient against missing primitives
  // during EP-0 → EP-6 overlap.
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);

  if (!Comp && !error) {
    import('../design-system/empty/EmptyState')
      .then((m) => setComp(() => m.EmptyState))
      .catch((e) => setError(String(e?.message || e)));
  }

  return (
    <div
      data-locale={props.locale}
      data-theme={props.theme}
      style={{
        border: '1px solid var(--c-border, #e5e7eb)',
        borderRadius: 8,
        padding: 16,
        background: props.theme === 'dark' ? '#111' : '#fff',
        color: props.theme === 'dark' ? '#eee' : '#111',
        direction: props.locale === 'ar' || props.locale === 'ku' ? 'rtl' : 'ltr',
        minHeight: 220,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 8 }}>
        {props.variant} · {props.illustration} · {props.entity} · {props.locale}/{props.theme}
      </div>
      {Comp ? (
        <Comp
          variant={props.variant}
          illustration={props.illustration}
          entity={props.entity}
          titleKey={`qc.${props.entity}.empty_title`}
          descriptionKey={`qc.${props.entity}.description`}
          primaryAction={{
            labelKey: `qc.${props.entity}.cta`,
            onClick: () => {
              // eslint-disable-next-line no-console
              console.log('dev-gallery: primary clicked', props);
            },
          }}
        />
      ) : error ? (
        <div style={{ color: 'crimson', fontSize: 12 }}>
          Could not load EmptyState primitive: {error}. EP-0 may not be merged yet.
        </div>
      ) : (
        <div style={{ opacity: 0.4, fontSize: 12 }}>Loading primitive…</div>
      )}
    </div>
  );
}

/** Full matrix view — useful for design review and visual regression. */
export default function EmptyStatesGallery() {
  const [variant, setVariant] = useState<EmptyStateVariant>('selector');
  const [illustration, setIllustration] = useState<IllustrationKey>('customers');
  const [entity, setEntity] = useState<EntitySlug>('customer');

  return (
    <GalleryShell>
      <h1 style={{ marginTop: 0 }}>Empty-state + Quick-create — dev gallery</h1>
      <p style={{ opacity: 0.7, fontSize: 13 }}>
        Live preview of every variant × illustration × entity × locale × theme.
        Pick a slice with the controls below, or scroll for the full matrix.
      </p>

      <fieldset style={{ display: 'flex', gap: 16, flexWrap: 'wrap', margin: '16px 0' }}>
        <label>
          Variant:&nbsp;
          <select value={variant} onChange={(e) => setVariant(e.target.value as EmptyStateVariant)}>
            {VARIANTS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label>
          Illustration:&nbsp;
          <select value={illustration} onChange={(e) => setIllustration(e.target.value as IllustrationKey)}>
            {ILLUSTRATIONS.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
        <label>
          Entity:&nbsp;
          <select value={entity} onChange={(e) => setEntity(e.target.value as EntitySlug)}>
            {ENTITIES.map((v) => <option key={v}>{v}</option>)}
          </select>
        </label>
      </fieldset>

      <h2 style={{ marginTop: 24 }}>Selected slice — locale × theme</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {LOCALES.flatMap((locale) =>
          THEMES.map((theme) => (
            <EmptyStatePreview
              key={`${locale}-${theme}`}
              variant={variant}
              illustration={illustration}
              entity={entity}
              locale={locale}
              theme={theme}
            />
          )),
        )}
      </div>

      <h2 style={{ marginTop: 32 }}>Full variant matrix (en/light only)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
        {VARIANTS.flatMap((v) =>
          ILLUSTRATIONS.slice(0, 3).map((il) => (
            <EmptyStatePreview
              key={`${v}-${il}`}
              variant={v}
              illustration={il}
              entity={entity}
              locale="en"
              theme="light"
            />
          )),
        )}
      </div>

      <h2 style={{ marginTop: 32 }}>Entity gallery (all 8 entities, list variant, en/light)</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {ENTITIES.map((e) => (
          <EmptyStatePreview
            key={e}
            variant="list"
            illustration={illustration}
            entity={e}
            locale="en"
            theme="light"
          />
        ))}
      </div>
    </GalleryShell>
  );
}
