/**
 * ConnectionStatus.test.tsx
 *
 * Unit tests for the ConnectionStatus component.
 * Validates Requirement 4.12:
 *   WHERE بەکارهێنەر ئینتەرنێتی لەدەست دات، THE سیستەم SHALL offline indicator نیشان بدات.
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConnectionStatus } from './ConnectionStatus';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate the browser going offline by firing the 'offline' window event. */
function goOffline() {
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('offline'));
  });
}

/** Simulate the browser coming back online by firing the 'online' window event. */
function goOnline() {
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
}

// ---------------------------------------------------------------------------
// Mock i18next so tests don't need the full i18n setup
// ---------------------------------------------------------------------------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

// ---------------------------------------------------------------------------
// Tests — tag variant (default)
// ---------------------------------------------------------------------------
describe('ConnectionStatus — tag variant', () => {
  beforeEach(() => {
    // Start each test in online state
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    // Restore online state after each test
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('shows "online" tag when navigator.onLine is true', () => {
    render(<ConnectionStatus variant="tag" />);
    expect(screen.getByText('سەرهێڵ')).toBeInTheDocument();
  });

  it('shows "offline" tag after the offline event fires', () => {
    render(<ConnectionStatus variant="tag" />);
    goOffline();
    expect(screen.getByText('دەرهێڵ')).toBeInTheDocument();
  });

  it('returns to "online" tag after the online event fires', () => {
    render(<ConnectionStatus variant="tag" />);
    goOffline();
    goOnline();
    expect(screen.getByText('سەرهێڵ')).toBeInTheDocument();
  });

  it('has role="status" for accessibility', () => {
    render(<ConnectionStatus variant="tag" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — banner variant
// ---------------------------------------------------------------------------
describe('ConnectionStatus — banner variant', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('renders nothing visible when online', () => {
    const { container } = render(<ConnectionStatus variant="banner" />);
    // The AnimatePresence wrapper renders but the banner content should not be present
    expect(screen.queryByText('دەرهێڵ — ئینتەرنێت نییە')).not.toBeInTheDocument();
    // Container should be essentially empty (just the AnimatePresence wrapper)
    expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
  });

  it('shows offline banner when navigator goes offline', () => {
    render(<ConnectionStatus variant="banner" />);
    goOffline();
    expect(screen.getByText('دەرهێڵ — ئینتەرنێت نییە')).toBeInTheDocument();
  });

  it('hides offline banner when connection is restored', async () => {
    render(<ConnectionStatus variant="banner" />);
    goOffline();
    expect(screen.getByText('دەرهێڵ — ئینتەرنێت نییە')).toBeInTheDocument();
    goOnline();
    // After going online, the banner should no longer be rendered.
    // AnimatePresence may keep the element briefly during exit animation in jsdom,
    // so we check that the component re-renders without the offline content.
    // The state update is synchronous via act(), so the element should be gone.
    expect(screen.queryByText('دەرهێڵ — ئینتەرنێت نییە')).not.toBeInTheDocument();
  });

  it('shows description text when offline', () => {
    render(<ConnectionStatus variant="banner" />);
    goOffline();
    expect(
      screen.getByText(/پەیوەندی ئینتەرنێتت بڕاوە/),
    ).toBeInTheDocument();
  });

  it('has aria-live="polite" for screen reader announcements', () => {
    render(<ConnectionStatus variant="banner" />);
    goOffline();
    const statusEl = screen.getByRole('status');
    expect(statusEl).toHaveAttribute('aria-live', 'polite');
  });
});

// ---------------------------------------------------------------------------
// Tests — default variant (no prop = tag)
// ---------------------------------------------------------------------------
describe('ConnectionStatus — default variant', () => {
  it('defaults to tag variant when no variant prop is given', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    render(<ConnectionStatus />);
    expect(screen.getByText('سەرهێڵ')).toBeInTheDocument();
  });
});
