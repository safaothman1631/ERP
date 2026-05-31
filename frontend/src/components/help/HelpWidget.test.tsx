/**
 * Tests for HelpWidget (G2 / R2.6).
 */
import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { HelpWidget } from './HelpWidget';

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
});

describe('HelpWidget', () => {
  afterEach(() => cleanup());

  it('renders the floating help toggle button', () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <HelpWidget route="/" />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('help-widget-toggle')).toBeTruthy();
  });

  it('does not render when onlyOn does not include the current route', () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <HelpWidget route="/dashboard" onlyOn={['/pos']} />
      </I18nextProvider>,
    );
    expect(screen.queryByTestId('help-widget-toggle')).toBeNull();
  });

  it('opens the panel when the toggle is clicked', async () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <HelpWidget route="/pos" />
      </I18nextProvider>,
    );
    fireEvent.click(screen.getByTestId('help-widget-toggle'));
    // The panel is React.lazy-loaded and mounts into an AntD Drawer portal, so
    // its appearance is asynchronous (dynamic import + portal render). Poll for
    // the canonical open-drawer element (`.ant-drawer`) — AntD v6 does not
    // forward `rootClassName`/`data-testid` to a queryable DOM node, so the
    // framework class is the reliable signal that the panel opened.
    await waitFor(() => {
      expect(document.querySelector('.ant-drawer')).not.toBeNull();
    });
  });
});
