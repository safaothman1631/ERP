/**
 * Tests for ImpersonationBanner (G2 / R2.3).
 */
import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import i18n from 'i18next';
import { initReactI18next, I18nextProvider } from 'react-i18next';
import { ImpersonationBanner } from './ImpersonationBanner';
import {
  clearImpersonationToken,
  storeImpersonationToken,
} from '../utils/impersonation';

const testI18n = i18n.createInstance();
testI18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  resources: { en: { translation: {} } },
});

vi.mock('../api', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: { status: 'ended' } }) },
}));

function makeFakeJwt(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  return `${enc({ alg: 'HS256' })}.${enc(payload)}.sig`;
}

describe('ImpersonationBanner', () => {
  beforeEach(() => {
    clearImpersonationToken();
    cleanup();
  });

  it('renders nothing when not impersonating', () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <ImpersonationBanner />
      </I18nextProvider>,
    );
    expect(screen.queryByTestId('impersonation-banner')).toBeNull();
  });

  it('renders the banner with the tenant name when impersonating', () => {
    const token = makeFakeJwt({
      sub: 'u-target',
      impersonation: true,
      read_only: true,
      tenant_id: 'tenant-XYZ',
      act: { sub: 'u-super' },
      exp: Math.floor(Date.now() / 1000) + 1800,
    });
    storeImpersonationToken(token, {
      audit_id: 'aud-1',
      tenant_id: 'tenant-XYZ',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    render(
      <I18nextProvider i18n={testI18n}>
        <ImpersonationBanner />
      </I18nextProvider>,
    );

    expect(screen.getByTestId('impersonation-banner')).toBeTruthy();
    expect(
      screen.getByText(/VIEWING AS tenant-XYZ/i, { exact: false }),
    ).toBeTruthy();
    expect(screen.getByTestId('impersonation-end-btn')).toBeTruthy();
  });

  it('calls the end endpoint when the End button is clicked', async () => {
    const token = makeFakeJwt({
      sub: 'u-target',
      impersonation: true,
      read_only: true,
      tenant_id: 'tenant-1',
      act: { sub: 'u-super' },
      audit_id: 'aud-1',
      exp: Math.floor(Date.now() / 1000) + 1800,
    });
    storeImpersonationToken(token, {
      audit_id: 'aud-1',
      tenant_id: 'tenant-1',
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    const api = (await import('../api')).default as any;
    // Best-effort stub so jsdom does not attempt a real navigation. Modern
    // jsdom marks window.location.assign non-configurable, so tolerate the
    // redefine failing — the real assign is a harmless no-op in jsdom and the
    // assertion below (the POST to /end) is the observable contract.
    let assignRedefined = false;
    try {
      Object.defineProperty(window.location, 'assign', {
        configurable: true,
        value: vi.fn(),
      });
      assignRedefined = true;
    } catch {
      assignRedefined = false;
    }

    render(
      <I18nextProvider i18n={testI18n}>
        <ImpersonationBanner />
      </I18nextProvider>,
    );

    fireEvent.click(screen.getByTestId('impersonation-end-btn'));

    // Wait one tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(api.post).toHaveBeenCalledWith(
      '/api/admin/impersonate/end',
      expect.objectContaining({ audit_id: 'aud-1' }),
    );

    // Cleanup — only if we actually redefined `assign` above. Restore a plain
    // no-op (jsdom's native assign is already a no-op, so this keeps later
    // tests from navigating without depending on a captured original).
    if (assignRedefined) {
      Object.defineProperty(window.location, 'assign', {
        configurable: true,
        value: () => {},
      });
    }
  });
});
