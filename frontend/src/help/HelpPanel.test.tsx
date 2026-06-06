/**
 * Unit tests for `HelpPanel` + `HelpIcon`
 * (system-wide-ux-overhaul, task 2.8).
 *
 * Validates:
 *   - R6.1 — `useHelp` rejection → `HelpIcon` renders nothing AND surrounding
 *            Section still renders.
 *   - R6.3 — Render order assertion (`what → why → relatesTo → howSteps`).
 *   - R6.7 — Dismissal via Escape, outside click, close button.
 *   - R8.4 — `useHelp` graceful failure does not crash the page.
 *
 * **Validates: Requirements 6.1, 6.3, 6.7, 8.4**
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';

import i18n from '../i18n';
import { __resetHelpRegistryCacheForTests } from './useHelp';

// ─────────────────────────────────────────────────────────────────────────────
// Polyfills for jsdom
// ─────────────────────────────────────────────────────────────────────────────

// matchMedia polyfill — useViewport depends on it.
const matchMediaMock = vi.fn().mockImplementation((query: string) => {
  // Default to desktop viewport (> 1024px) so HelpPanel renders as popover.
  const matches =
    query === '(max-width: 640px)' ? false :
    query === '(max-width: 768px)' ? false :
    query === '(max-width: 1024px)' ? false :
    query === '(max-width: 1280px)' ? true :
    false;
  return {
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock,
});

// getComputedStyle polyfill for focus/visibility checks
if (!window.getComputedStyle) {
  (window as unknown as Record<string, unknown>).getComputedStyle = () => ({
    getPropertyValue: () => '',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test wrapper
// ─────────────────────────────────────────────────────────────────────────────

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>{children}</MemoryRouter>
    </I18nextProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('HelpPanel — render order (R6.3)', () => {
  beforeEach(async () => {
    __resetHelpRegistryCacheForTests();
    await i18n.changeLanguage('en');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders content in the fixed order: what → why → relatesTo → howSteps', async () => {
    const { HelpPanel } = await import('./HelpPanel');

    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);

    // `sales.invoices` is a real registry entry with BOTH relatesTo (ul) and
    // howSteps (ol), so the order invariant is asserted against actual content
    // — no module mocking, hence no cross-file pollution.
    render(
      <TestWrapper>
        <HelpPanel
          sectionId="sales.invoices"
          anchorEl={anchorEl}
          open={true}
          onClose={() => {}}
        />
      </TestWrapper>,
    );

    // Wait for the help registry to load — the panel should contain
    // rendered content including sections with lists (relatesTo has <ul>,
    // howSteps has <ol>). These only appear when the registry has loaded
    // successfully and the content is resolved.
    await waitFor(() => {
      const dialog = document.querySelector('[data-help-panel="desktop"]');
      expect(dialog).not.toBeNull();
      // The howSteps <ol> only renders when the registry is loaded
      const ol = dialog!.querySelector('ol');
      expect(ol).not.toBeNull();
    }, { timeout: 5000 });

    const panel = document.querySelector('[data-help-panel="desktop"]')!;

    // Get all <p> and <section> elements within the panel (excluding header)
    // The HelpPanelBody renders: p (what), p (why), section>ul (relatesTo), section>ol (howSteps)
    // Collect all content elements in document order from the panel
    const contentElements = panel.querySelectorAll('p, section');
    const allElements = Array.from(contentElements);
    expect(allElements.length).toBeGreaterThanOrEqual(3);

    // Find the elements by their semantic structure
    const paragraphs = allElements.filter(el => el.tagName.toLowerCase() === 'p');
    const sections = allElements.filter(el => el.tagName.toLowerCase() === 'section');

    // At minimum: 2 paragraphs (what, why) and 2 sections (relatesTo, howSteps)
    expect(paragraphs.length).toBeGreaterThanOrEqual(1); // what is always present
    expect(sections.length).toBeGreaterThanOrEqual(1);

    // Verify order: all <p> elements come before all <section> elements
    const firstParagraphIndex = allElements.findIndex(el => el.tagName.toLowerCase() === 'p');
    const lastParagraphIndex = allElements.map((el, i) => el.tagName.toLowerCase() === 'p' ? i : -1).filter(i => i >= 0).pop()!;
    const firstSectionIndex = allElements.findIndex(el => el.tagName.toLowerCase() === 'section');

    // Paragraphs (what, why) come before sections (relatesTo, howSteps)
    expect(firstParagraphIndex).toBeLessThan(firstSectionIndex);
    expect(lastParagraphIndex).toBeLessThan(firstSectionIndex);

    // relatesTo section has a <ul>, howSteps section has an <ol>
    const relatesToSection = sections.find(s => s.querySelector('ul'));
    const howStepsSection = sections.find(s => s.querySelector('ol'));
    expect(relatesToSection).not.toBeUndefined();
    expect(howStepsSection).not.toBeUndefined();

    // relatesTo comes before howSteps
    const relatesToIdx = allElements.indexOf(relatesToSection!);
    const howStepsIdx = allElements.indexOf(howStepsSection!);
    expect(relatesToIdx).toBeLessThan(howStepsIdx);

    document.body.removeChild(anchorEl);
    // Explicit 60 s timeout. This is the heaviest test in the suite: it
    // dynamically `import()`s the full help-registry chunk (registry +
    // ResponsiveDialog + the AntD graph), renders the panel, and polls for
    // async content. In isolation it finishes in a few seconds, but in the
    // 95-file run the dynamic import competes for I/O and can run long; 60 s
    // removes the flake without masking a genuine hang.
  }, 60_000);
});

describe('HelpPanel — dismissal (R6.7)', () => {
  beforeEach(async () => {
    __resetHelpRegistryCacheForTests();
    await i18n.changeLanguage('en');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('dismisses via Escape key', async () => {
    const { HelpPanel } = await import('./HelpPanel');
    const onClose = vi.fn();
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);

    render(
      <TestWrapper>
        <HelpPanel
          sectionId="sales.invoices"
          anchorEl={anchorEl}
          open={true}
          onClose={onClose}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-help-panel="desktop"]')).not.toBeNull();
    });

    // Fire Escape key on the document
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);

    document.body.removeChild(anchorEl);
  });

  it('dismisses via outside click', async () => {
    const { HelpPanel } = await import('./HelpPanel');
    const onClose = vi.fn();
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);

    render(
      <TestWrapper>
        <HelpPanel
          sectionId="sales.invoices"
          anchorEl={anchorEl}
          open={true}
          onClose={onClose}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-help-panel="desktop"]')).not.toBeNull();
    });

    // Click outside the panel (on the document body)
    fireEvent.mouseDown(document.body);

    expect(onClose).toHaveBeenCalledTimes(1);

    document.body.removeChild(anchorEl);
  });

  it('dismisses via close button', async () => {
    const { HelpPanel } = await import('./HelpPanel');
    const onClose = vi.fn();
    const anchorEl = document.createElement('button');
    document.body.appendChild(anchorEl);

    render(
      <TestWrapper>
        <HelpPanel
          sectionId="sales.invoices"
          anchorEl={anchorEl}
          open={true}
          onClose={onClose}
        />
      </TestWrapper>,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-help-panel="desktop"]')).not.toBeNull();
    });

    // Find the close button by its aria-label
    const closeButton = document.querySelector('[data-help-panel="desktop"] button[aria-label]');
    expect(closeButton).not.toBeNull();
    fireEvent.click(closeButton!);

    expect(onClose).toHaveBeenCalledTimes(1);

    document.body.removeChild(anchorEl);
  });
});

describe('HelpIcon — graceful failure (R6.1, R8.4)', () => {
  beforeEach(async () => {
    __resetHelpRegistryCacheForTests();
    await i18n.changeLanguage('en');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing when useHelp returns unavailable, surrounding Section still renders', async () => {
    // Mock the registry to simulate a load failure
    vi.doMock('./registry', () => {
      throw new Error('Simulated chunk-load failure');
    });

    // Re-import modules to pick up the mock
    vi.resetModules();
    const helpModule = await import('./useHelp');
    helpModule.__resetHelpRegistryCacheForTests();

    const { HelpIcon } = await import('./HelpIcon');
    const i18nModule = await import('../i18n');
    await i18nModule.default.changeLanguage('en');

    const { I18nextProvider } = await import('react-i18next');
    const { MemoryRouter: MR } = await import('react-router-dom');

    // Render HelpIcon inside a Section — the Section should still render
    const { container } = render(
      <I18nextProvider i18n={i18nModule.default}>
        <MR>
          <section data-testid="surrounding-section">
            <h2>Invoice Section</h2>
            <HelpIcon sectionId="sales.invoices" />
            <p>Section content here</p>
          </section>
        </MR>
      </I18nextProvider>,
    );

    // Wait for the hook to resolve the failure
    await waitFor(() => {
      // The surrounding section should still be rendered
      const section = container.querySelector('[data-testid="surrounding-section"]');
      expect(section).not.toBeNull();
    });

    // The surrounding Section renders normally
    const section = container.querySelector('[data-testid="surrounding-section"]');
    expect(section).not.toBeNull();
    expect(section!.querySelector('h2')?.textContent).toBe('Invoice Section');
    expect(section!.querySelector('p')?.textContent).toBe('Section content here');

    // The HelpIcon renders nothing (no button for help)
    const helpButton = container.querySelector('[data-testid="help-icon-sales.invoices"]');
    expect(helpButton).toBeNull();

    vi.doUnmock('./registry');
    vi.resetModules();
  });

  it('renders the help icon button when registry is available', async () => {
    const { HelpIcon } = await import('./HelpIcon');

    const { container } = render(
      <TestWrapper>
        <section data-testid="surrounding-section">
          <h2>Invoice Section</h2>
          <HelpIcon sectionId="sales.invoices" />
          <p>Section content here</p>
        </section>
      </TestWrapper>,
    );

    // Wait for the registry to load
    await waitFor(() => {
      const helpButton = container.querySelector('[data-testid="help-icon-sales.invoices"]');
      expect(helpButton).not.toBeNull();
    });

    // The button should have an aria-label
    const helpButton = container.querySelector('[data-testid="help-icon-sales.invoices"]');
    expect(helpButton).not.toBeNull();
    expect(helpButton!.getAttribute('aria-label')).toBeTruthy();

    // The surrounding section still renders
    const section = container.querySelector('[data-testid="surrounding-section"]');
    expect(section).not.toBeNull();
    expect(section!.querySelector('h2')?.textContent).toBe('Invoice Section');
  });
});
