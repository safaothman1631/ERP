/**
 * ResponsiveForm.test.tsx — unit tests for the single-column-on-mobile
 * form wrapper.
 *
 * Spec: system-wide-ux-overhaul, Task 4.3
 * Validates: Requirements 4.4, 4.5, 4.8, 5.1, 5.2
 *
 * NOTE: This file lives under `frontend/src/components/responsive/**` which
 * is scoped to the `zoho-i18n/no-hardcoded-literal` ESLint rule at error
 * severity. Test fixtures intentionally avoid JSX text content — every
 * placeholder uses `data-testid` plus an empty element so the rule does
 * not flag literal strings. This keeps the test file consistent with the
 * production lint contract instead of relying on per-file disables.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ResponsiveForm } from './ResponsiveForm';
import { formSpacing, resolveGridTemplate } from './responsiveFormSpacing';
import { asTranslationKey } from '../../i18n/types';

// ---------------------------------------------------------------------------
// Mock useTranslation — keep tests independent of i18n initialisation. The
// mock returns the key as the value so we can assert that the line-item
// toggle uses the i18n_Registry key (not a hardcoded literal).
// ---------------------------------------------------------------------------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// ---------------------------------------------------------------------------
// matchMedia + window width helpers — borrowed from useViewport.test.ts
// patterns so the mock surface is identical across the responsive suite.
// ---------------------------------------------------------------------------

function setInnerWidth(width: number): void {
  Object.defineProperty(window, 'innerWidth', {
    value: width,
    configurable: true,
    writable: true,
  });
}

function installMatchMediaMock(): void {
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  installMatchMediaMock();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// resolveGridTemplate — pure helper, easiest path to assert the layout
// contract without inspecting computed style.
// ---------------------------------------------------------------------------

describe('resolveGridTemplate — layout decisions', () => {
  /** Validates: Requirement 4.5 (Mobile_Viewport always single-column). */
  it('returns a single column on Mobile_Viewport regardless of layout', () => {
    expect(resolveGridTemplate(true, 'single')).toBe('minmax(0, 1fr)');
    expect(resolveGridTemplate(true, 'two-column')).toBe(
      'minmax(0, 1fr)',
    );
  });

  /** Validates: Requirement 4.5 (consumer layout honoured above 640 px). */
  it('honours the declared layout above Mobile_Viewport', () => {
    expect(resolveGridTemplate(false, 'single')).toBe('minmax(0, 1fr)');
    expect(resolveGridTemplate(false, 'two-column')).toBe(
      'minmax(0, 1fr) minmax(0, 1fr)',
    );
  });
});

// ---------------------------------------------------------------------------
// formSpacing — token-driven spacing values
// ---------------------------------------------------------------------------

describe('formSpacing — token-driven values', () => {
  /** Validates: Requirement 5.2 (≥ 8 px between adjacent Touch_Targets). */
  it('exposes an 8 px adjacent-target gap', () => {
    expect(formSpacing.adjacentTargetGap).toBe(8);
  });

  it('exposes a non-zero row gap and column gap', () => {
    expect(formSpacing.rowGap).toBeGreaterThan(0);
    expect(formSpacing.columnGap).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// <ResponsiveForm /> — rendered output
// ---------------------------------------------------------------------------

describe('ResponsiveForm — rendered grid container', () => {
  /** Validates: Requirement 4.5 — single-column on Mobile_Viewport. */
  it('forces a single column at Mobile_Viewport (320 px)', () => {
    setInnerWidth(320);
    render(
      <ResponsiveForm layout="two-column">
        <div data-testid="child" />
      </ResponsiveForm>,
    );
    const wrapper = screen.getByTestId('child').parentElement!;
    expect(wrapper.className).toContain('responsive-form');
    expect(wrapper.style.display).toBe('grid');
    expect(wrapper.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
  });

  /** Validates: Requirement 4.5 — declared layout honoured above 640 px. */
  it('renders two columns at Desktop_Viewport (1280 px) when layout="two-column"', () => {
    setInnerWidth(1280);
    render(
      <ResponsiveForm layout="two-column">
        <div data-testid="child" />
      </ResponsiveForm>,
    );
    const wrapper = screen.getByTestId('child').parentElement!;
    expect(wrapper.style.gridTemplateColumns).toBe(
      'minmax(0, 1fr) minmax(0, 1fr)',
    );
  });

  /** Validates: Requirement 5.2 — adjacent-target gap on the grid. */
  it('applies a row gap and column gap derived from formSpacing', () => {
    setInnerWidth(1280);
    render(
      <ResponsiveForm>
        <div data-testid="child" />
      </ResponsiveForm>,
    );
    const wrapper = screen.getByTestId('child').parentElement!;
    // jsdom serialises rowGap / columnGap as "<n>px"; tolerate both forms.
    expect(wrapper.style.rowGap).toMatch(/^\d+px$/);
    expect(wrapper.style.columnGap).toMatch(/^\d+px$/);
  });

  it('composes a consumer-supplied className alongside the responsive-form class', () => {
    setInnerWidth(1024);
    render(
      <ResponsiveForm className="my-custom-form">
        <div data-testid="child" />
      </ResponsiveForm>,
    );
    const wrapper = screen.getByTestId('child').parentElement!;
    expect(wrapper.className.split(/\s+/)).toEqual(
      expect.arrayContaining(['responsive-form', 'my-custom-form']),
    );
  });
});

// ---------------------------------------------------------------------------
// <ResponsiveForm.LineItem /> — expandable-card pattern on Mobile_Viewport
// ---------------------------------------------------------------------------

describe('ResponsiveForm.LineItem — line-item expandable card', () => {
  /** Validates: Requirement 4.8 — expandable card on Mobile_Viewport. */
  it('renders as a <details>/<summary> disclosure on Mobile_Viewport', () => {
    setInnerWidth(375);
    render(
      <ResponsiveForm>
        <ResponsiveForm.LineItem summary={<span data-testid="summary" />}>
          <div data-testid="body" />
        </ResponsiveForm.LineItem>
      </ResponsiveForm>,
    );

    // The native disclosure is the wrapper element.
    const summaryNode = screen.getByTestId('summary');
    const detailsNode = summaryNode.closest('details');
    expect(detailsNode).not.toBeNull();
    expect(detailsNode!.tagName).toBe('DETAILS');
    expect(detailsNode!.className).toContain(
      'responsive-form__line-item--card',
    );

    // Both the most-important field AND the body are in the DOM (R4.8 —
    // body sits behind the toggle but is still rendered).
    expect(screen.getByTestId('summary')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
  });

  /** Validates: Requirement 4.8 — body visible by default above 640 px. */
  it('renders inline (no <details>) above Mobile_Viewport', () => {
    setInnerWidth(1280);
    render(
      <ResponsiveForm>
        <ResponsiveForm.LineItem summary={<span data-testid="summary" />}>
          <div data-testid="body" />
        </ResponsiveForm.LineItem>
      </ResponsiveForm>,
    );

    const summaryNode = screen.getByTestId('summary');
    expect(summaryNode.closest('details')).toBeNull();

    // Both summary and body render inline above 640 px.
    const wrapper = summaryNode.closest(
      '.responsive-form__line-item',
    ) as HTMLElement | null;
    expect(wrapper).not.toBeNull();
    expect(wrapper!.className).toContain(
      'responsive-form__line-item--inline',
    );
  });

  /** Validates: Requirement 11.4 — toggle label resolved via t(). */
  it('uses the i18n_Registry key for the disclosure toggle on Mobile_Viewport', () => {
    setInnerWidth(375);
    render(
      <ResponsiveForm>
        <ResponsiveForm.LineItem summary={<span data-testid="summary" />}>
          <div data-testid="body" />
        </ResponsiveForm.LineItem>
      </ResponsiveForm>,
    );

    // The mock t() returns the key — assert the default key is rendered.
    const toggle = document.querySelector(
      '.responsive-form__line-item-toggle',
    );
    expect(toggle).not.toBeNull();
    expect(toggle!.textContent).toBe(
      'responsiveForm.lineItem.editDetails',
    );
  });

  it('respects a consumer-supplied toggleLabelKey on Mobile_Viewport', () => {
    setInnerWidth(375);
    render(
      <ResponsiveForm>
        <ResponsiveForm.LineItem
          summary={<span data-testid="summary" />}
          toggleLabelKey={asTranslationKey('lineItem.expand')}
        >
          <div data-testid="body" />
        </ResponsiveForm.LineItem>
      </ResponsiveForm>,
    );

    const toggle = document.querySelector(
      '.responsive-form__line-item-toggle',
    );
    expect(toggle!.textContent).toBe('lineItem.expand');
  });

  it('respects defaultOpen on Mobile_Viewport', () => {
    setInnerWidth(375);
    render(
      <ResponsiveForm>
        <ResponsiveForm.LineItem
          summary={<span data-testid="summary" />}
          defaultOpen
        >
          <div data-testid="body" />
        </ResponsiveForm.LineItem>
      </ResponsiveForm>,
    );

    const details = document.querySelector(
      'details.responsive-form__line-item--card',
    ) as HTMLDetailsElement | null;
    expect(details).not.toBeNull();
    expect(details!.open).toBe(true);
  });
});
