/**
 * Tests for HelpWidget (G2 / R2.6).
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
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
    // The lazy-loaded panel needs a tick before it mounts.
    await new Promise((r) => setTimeout(r, 50));
    // The panel mounts inside a Drawer portal — search the document.
    const drawer = document.querySelector('[data-testid="help-panel"]');
    expect(drawer).not.toBeNull();
  });
});
