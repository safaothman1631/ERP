/**
 * Unit tests for the launch-readiness onboarding wizard state machine.
 *
 * Covers: T-LR.3.1 acceptance — every transition + resume-from-state.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  _internals,
  normalizeIraqPhone,
  useOnboardingWizardStore,
  type CompanyInfo,
} from './state';

// Mock axios-based api module so save()/hydrate() don't hit the network.
vi.mock('../api', () => ({
  default: {
    get: vi.fn(() => Promise.reject(new Error('no remote'))),
    put: vi.fn(() => Promise.resolve({ data: {} })),
    post: vi.fn(() => Promise.resolve({ data: {} })),
    delete: vi.fn(() => Promise.resolve({ data: {} })),
  },
}));

// Mock telemetry so events don't spam.
vi.mock('./telemetry', () => ({
  telemetry: {
    started: vi.fn(),
    stepCompleted: vi.fn(),
    stepSkipped: vi.fn(),
    completed: vi.fn(),
    abandoned: vi.fn(),
    _resetStartedFlag: vi.fn(),
  },
}));

const VALID_COMPANY: CompanyInfo = {
  company_name: 'Hawar Trading',
  vat_status: 'not_registered',
  business_type: 'retail',
  intended_use: ['retail'],
};

describe('onboarding state machine', () => {
  beforeEach(() => {
    useOnboardingWizardStore.getState()._reset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('starts on step 1 with pending status for later steps', () => {
    const s = useOnboardingWizardStore.getState();
    expect(s.currentStep).toBe(1);
    expect(s.stepStatus[1]).toBe('in_progress');
    expect(s.stepStatus[2]).toBe('pending');
    expect(s.canProceed).toBe(false);
  });

  it('canProceed flips true once company info is valid', () => {
    useOnboardingWizardStore.getState().setCompany(VALID_COMPANY);
    expect(useOnboardingWizardStore.getState().canProceed).toBe(true);
  });

  it('next() advances 1 → 2 and marks step 1 completed', () => {
    const store = useOnboardingWizardStore.getState();
    store.setCompany(VALID_COMPANY);
    store.next();
    const s = useOnboardingWizardStore.getState();
    expect(s.currentStep).toBe(2);
    expect(s.stepStatus[1]).toBe('completed');
    expect(s.stepStatus[2]).toBe('in_progress');
  });

  it('back() returns to previous step', () => {
    const store = useOnboardingWizardStore.getState();
    store.setCompany(VALID_COMPANY);
    store.next();
    store.back();
    expect(useOnboardingWizardStore.getState().currentStep).toBe(1);
  });

  it('skip() advances and marks the current step as skipped', () => {
    const store = useOnboardingWizardStore.getState();
    store.setCompany(VALID_COMPANY);
    store.next();
    // Now on step 2 — skip it
    store.skip();
    const s = useOnboardingWizardStore.getState();
    expect(s.currentStep).toBe(3);
    expect(s.stepStatus[2]).toBe('skipped');
  });

  it('skips step 4 (POS) when intended_use is service/ngo-only', () => {
    const store = useOnboardingWizardStore.getState();
    store.setCompany({ ...VALID_COMPANY, intended_use: ['services', 'ngo'] });
    store.next(); // 1 → 2
    store.setRegion({ code: 'IQ-BG', governorate_code: 'IQ-BG', krg_region: false });
    store.next(); // 2 → 3
    store.setCOA({ template: 'small_general_trade', accounts_created: 40 });
    store.next(); // 3 → expected: skip 4, land on 5
    const s = useOnboardingWizardStore.getState();
    expect(s.currentStep).toBe(5);
    expect(s.stepStatus[4]).toBe('skipped');
  });

  it('does NOT skip step 4 when intended_use is retail/restaurant/pharmacy', () => {
    const store = useOnboardingWizardStore.getState();
    store.setCompany({ ...VALID_COMPANY, intended_use: ['restaurant'] });
    store.next();
    store.setRegion({ code: 'IQ-BG', governorate_code: 'IQ-BG', krg_region: false });
    store.next();
    store.setCOA({ template: 'restaurant_cafe', accounts_created: 60 });
    store.next();
    expect(useOnboardingWizardStore.getState().currentStep).toBe(4);
  });

  it('complete() marks step 5 done and sets completedAt', async () => {
    const store = useOnboardingWizardStore.getState();
    store.start();
    store.goTo(5);
    store.setFirstSale({ first_sale_id: 'inv_test', receipt_printed: true });
    await store.complete();
    const s = useOnboardingWizardStore.getState();
    expect(s.completedAt).toBeTruthy();
    expect(s.stepStatus[5]).toBe('completed');
  });

  it('resume-from-state: hydrate() restores currentStep, stepStatus, and data', async () => {
    const api = (await import('../api')).default;
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: {
        current_step: 3,
        step_status: { 1: 'completed', 2: 'completed', 3: 'in_progress', 4: 'pending', 5: 'pending' },
        data: {
          company: VALID_COMPANY,
          region: { code: 'IQ-AR', governorate_code: 'IQ-AR', krg_region: true },
        },
        started_at: new Date(1700000000000).toISOString(),
        completed_at: null,
      },
    });
    await useOnboardingWizardStore.getState().hydrate();
    const s = useOnboardingWizardStore.getState();
    expect(s.currentStep).toBe(3);
    expect(s.data.company?.company_name).toBe('Hawar Trading');
    expect(s.data.region?.code).toBe('IQ-AR');
    expect(s.stepStatus[1]).toBe('completed');
  });

  it('computeCanProceed returns false when company name missing', () => {
    expect(_internals.computeCanProceed(1, {})).toBe(false);
  });

  it('shouldSkipPOS returns true for ngo-only', () => {
    expect(_internals.shouldSkipPOS({ company: { ...VALID_COMPANY, intended_use: ['ngo'] } })).toBe(true);
  });

  it('shouldSkipPOS returns false when retail is in intended_use', () => {
    expect(_internals.shouldSkipPOS({ company: { ...VALID_COMPANY, intended_use: ['ngo', 'retail'] } })).toBe(false);
  });
});

describe('normalizeIraqPhone', () => {
  it.each([
    ['07901234567', '+9647901234567'],
    ['00964 790 123 4567', '+9647901234567'],
    ['+9647901234567', '+9647901234567'],
    ['964-790-123-4567', '+9647901234567'],
    ['7901234567', '+9647901234567'],
  ])('normalizes %s to %s', (input, expected) => {
    expect(normalizeIraqPhone(input)).toBe(expected);
  });

  it('returns empty string for empty input', () => {
    expect(normalizeIraqPhone('')).toBe('');
  });
});
