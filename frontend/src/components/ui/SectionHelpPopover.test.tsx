/**
 * Unit tests for SectionHelpPopover
 *
 * Tests:
 * 1. Icon renders with correct aria-label in English ("Help")
 * 2. Icon renders with correct aria-label in Kurdish ("یارمەتی")
 * 3. Clicking the icon opens the popover (shows what, why, and steps content)
 * 4. Pressing Escape closes the popover
 *
 * Requirements: 7.4, 7.5, 7.6
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import SectionHelpPopover from './SectionHelpPopover';

// ---------------------------------------------------------------------------
// i18n test instances — one per language to avoid shared state issues
// ---------------------------------------------------------------------------

const enI18n = i18n.createInstance();
enI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: {
    en: { translation: { help: 'Help' } },
    ku: { translation: { help: 'یارمەتی' } },
  },
  interpolation: { escapeValue: false },
});

const kuI18n = i18n.createInstance();
kuI18n.use(initReactI18next).init({
  lng: 'ku',
  fallbackLng: 'ku',
  resources: {
    en: { translation: { help: 'Help' } },
    ku: { translation: { help: 'یارمەتی' } },
  },
  interpolation: { escapeValue: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  what: 'This section manages fiscal years.',
  why: 'You need a fiscal year before creating budgets.',
  steps: ['Click New Fiscal Year.', 'Set start and end dates.', 'Save.'],
};

function renderWithEn(props = defaultProps) {
  return render(
    <I18nextProvider i18n={enI18n}>
      <SectionHelpPopover {...props} />
    </I18nextProvider>,
  );
}

function renderWithKu(props = defaultProps) {
  return render(
    <I18nextProvider i18n={kuI18n}>
      <SectionHelpPopover {...props} />
    </I18nextProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SectionHelpPopover', () => {
  afterEach(() => {
    cleanup();
  });

  // -------------------------------------------------------------------------
  // 1. aria-label in English
  // -------------------------------------------------------------------------
  it('renders the icon with aria-label "Help" in English', () => {
    renderWithEn();
    const icon = screen.getByRole('button', { name: 'Help' });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-label', 'Help');
  });

  // -------------------------------------------------------------------------
  // 2. aria-label in Kurdish
  // -------------------------------------------------------------------------
  it('renders the icon with aria-label "یارمەتی" in Kurdish', () => {
    renderWithKu();
    const icon = screen.getByRole('button', { name: 'یارمەتی' });
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-label', 'یارمەتی');
  });

  // -------------------------------------------------------------------------
  // 3. Clicking the icon opens the popover
  // -------------------------------------------------------------------------
  it('shows what, why, and steps content after clicking the icon', async () => {
    renderWithEn();
    const icon = screen.getByRole('button', { name: 'Help' });

    await act(async () => {
      fireEvent.click(icon);
    });

    await waitFor(() => {
      expect(screen.getByText(defaultProps.what)).toBeInTheDocument();
      expect(screen.getByText(defaultProps.why)).toBeInTheDocument();
      defaultProps.steps.forEach((step) => {
        expect(screen.getByText(step)).toBeInTheDocument();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4. Pressing Escape closes the popover
  //
  // Ant Design Popover with trigger="click" closes on Escape. In jsdom,
  // CSS animations don't run so the popover element stays in the DOM but
  // transitions to a "leave" state (ant-zoom-big-leave class) and gets
  // pointer-events: none. We verify the popover is no longer interactive
  // by checking it has the leave animation class applied.
  // -------------------------------------------------------------------------
  it('closes the popover when Escape is pressed', async () => {
    renderWithEn();
    const icon = screen.getByRole('button', { name: 'Help' });

    // Open the popover
    await act(async () => {
      fireEvent.click(icon);
    });

    // Confirm it opened — content is visible
    await waitFor(() => {
      expect(screen.getByText(defaultProps.what)).toBeInTheDocument();
    });

    // Confirm the popover is in an open state (no leave class yet)
    const popoverEl = document.querySelector('.ant-popover');
    expect(popoverEl).not.toBeNull();
    expect(popoverEl!.className).not.toMatch(/ant-zoom-big-leave/);

    // Press Escape to close
    await act(async () => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape', keyCode: 27 });
    });

    // After Escape, Ant Design adds leave animation classes and sets
    // pointer-events: none — the popover is dismissed
    await waitFor(() => {
      const closingPopover = document.querySelector('.ant-popover');
      // Either the popover is gone entirely, or it has the leave class
      // (animation in progress) or pointer-events: none (dismissed)
      if (closingPopover) {
        const isLeaving = closingPopover.className.includes('ant-zoom-big-leave');
        const style = (closingPopover as HTMLElement).style.pointerEvents;
        const isHidden = style === 'none';
        expect(isLeaving || isHidden).toBe(true);
      }
      // If the popover element is gone, the test passes trivially
    });
  });
});
