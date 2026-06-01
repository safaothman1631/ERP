/**
 * Tests for HelpWidget (G2 / R2.6).
 *
 * The widget is now headless: the trigger lives in the TopBar (kit-style), and
 * HelpWidget opens the HelpPanel when the `open-help-panel` window event fires.
 * HelpPanel is mocked here so the test exercises HelpWidget's open logic without
 * the panel's heavy lazy-loaded dependency graph (markdown loader, AntD Drawer).
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, waitFor, act } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { HelpWidget } from './HelpWidget';

vi.mock('./HelpPanel', () => ({
  default: ({ open }: { open: boolean }) =>
    open ? <div data-testid="help-panel-open" /> : null,
}));

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
});

const renderWidget = (props: { route?: string; onlyOn?: string[] }) =>
  render(
    <I18nextProvider i18n={testI18n}>
      <HelpWidget {...props} />
    </I18nextProvider>,
  );

describe('HelpWidget', () => {
  afterEach(() => cleanup());

  it('is headless — no floating button and no panel by default', () => {
    renderWidget({ route: '/' });
    expect(screen.queryByTestId('help-widget-toggle')).toBeNull();
    expect(screen.queryByTestId('help-panel-open')).toBeNull();
  });

  it('does not open when onlyOn does not include the current route', async () => {
    renderWidget({ route: '/dashboard', onlyOn: ['/pos'] });
    act(() => { window.dispatchEvent(new Event('open-help-panel')); });
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByTestId('help-panel-open')).toBeNull();
  });

  it('opens the panel when the open-help-panel event fires', async () => {
    renderWidget({ route: '/pos' });
    act(() => { window.dispatchEvent(new Event('open-help-panel')); });
    await waitFor(() => {
      expect(screen.getByTestId('help-panel-open')).toBeTruthy();
    });
  });
});
