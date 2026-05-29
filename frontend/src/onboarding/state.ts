/**
 * Onboarding wizard state machine (T-LR.3.1)
 *
 * Spec: .kiro/specs/launch-readiness/design.md §4.1
 *
 * A finite-state machine for the 5-step "first 60 seconds" experience.
 *
 *     idle
 *      └─► step1_company
 *            └─► step2_region
 *                  └─► step3_coa
 *                        └─► step4_pos? (optional)
 *                              └─► step5_first_sale
 *                                    └─► completed
 *
 * Each transition persists to `tenants/{tenant_id}/onboarding/state` via
 * `PUT /api/onboarding/state` (T-LR.3.11). Mounting calls
 * `GET /api/onboarding/state` and resumes at the last incomplete step.
 *
 * Co-located with `frontend/src/onboarding/store.ts` (the legacy
 * industry/module wizard) — both stores can coexist; this file is for the
 * NEW launch-readiness wizard. They do NOT share state.
 */

import { create } from 'zustand';
import api from '../api';
import { telemetry } from './telemetry';

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

export type StepNumber = 1 | 2 | 3 | 4 | 5;
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type BusinessType =
  | 'retail'
  | 'restaurant'
  | 'pharmacy'
  | 'services'
  | 'manufacturing'
  | 'wholesale'
  | 'ngo';

export interface CompanyInfo {
  company_name: string;
  legal_name?: string;
  governorate_code?: string;
  city?: string;
  district?: string;
  address_line?: string;
  phone?: string;        // E.164 normalized
  email?: string;
  tax_id?: string;       // Iraqi commercial registration
  vat_status: 'registered' | 'not_registered' | 'pending';
  business_type: BusinessType;
  intended_use?: BusinessType[];
}

export interface IraqRegion {
  code: string;             // e.g. 'IQ-BG'
  governorate_code: string; // same as code in our preset table
  krg_region: boolean;
  applied_tax_rate_ids?: string[];
}

export type COATemplateId =
  | 'small_general_trade'
  | 'medium_general_trade'
  | 'restaurant_cafe'
  | 'pharmacy'
  | 'construction_contractor';

export interface COATemplateChoice {
  template: COATemplateId;
  accounts_created?: number;
  applied_at?: string;
}

export interface POSHardwareConfig {
  printer_device_id?: string;
  printer_device_name?: string;
  paper_width: 58 | 80;
  cash_drawer_enabled: boolean;
  cash_drawer_pin?: 2 | 5;
  fallback_browser_print: boolean;
  tested_ok?: boolean;
}

export interface FirstSaleResult {
  first_product_id?: string;
  first_customer_id?: string;
  first_sale_id?: string;
  receipt_printed: boolean;
  completed_at?: string;
}

export interface OnboardingData {
  company?: CompanyInfo;
  region?: IraqRegion;
  coa?: COATemplateChoice;
  pos?: POSHardwareConfig;
  firstSale?: FirstSaleResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────────────────────

export interface OnboardingState {
  currentStep: StepNumber;
  stepStatus: Record<number, StepStatus>;
  data: OnboardingData;
  startedAt: number | null;
  completedAt: number | null;
  stepStartedAt: number | null;

  // Derived
  canProceed: boolean;

  // Mutations on data
  setCompany: (info: CompanyInfo) => void;
  setRegion: (region: IraqRegion) => void;
  setCOA: (coa: COATemplateChoice) => void;
  setPOS: (pos: POSHardwareConfig) => void;
  setFirstSale: (s: FirstSaleResult) => void;

  // Transitions
  start: () => void;
  next: () => void;
  back: () => void;
  skip: () => void;
  goTo: (step: StepNumber) => void;
  complete: () => Promise<void>;

  // Persistence
  save: () => Promise<void>;
  hydrate: () => Promise<void>;

  // Reset (testing)
  _reset: () => void;
}

const STEP_ORDER: StepNumber[] = [1, 2, 3, 4, 5];

const initialStatus: Record<number, StepStatus> = {
  1: 'in_progress',
  2: 'pending',
  3: 'pending',
  4: 'pending',
  5: 'pending',
};

/** Compute `canProceed` for the current step based on `data`. */
function computeCanProceed(step: StepNumber, data: OnboardingData): boolean {
  switch (step) {
    case 1: {
      const c = data.company;
      return !!(c && c.company_name && c.company_name.trim().length >= 2 && c.business_type && c.vat_status);
    }
    case 2:
      return !!data.region?.code;
    case 3:
      return !!data.coa?.template;
    case 4:
      // POS is always skippable — proceed if config exists OR explicitly skipped via skip()
      return true;
    case 5:
      return !!data.firstSale?.first_sale_id || !!data.firstSale?.completed_at;
    default:
      return false;
  }
}

/** Should step 4 (POS hardware) be skipped entirely? */
function shouldSkipPOS(data: OnboardingData): boolean {
  const intended = data.company?.intended_use || [];
  // Skip POS for service/ngo businesses unless restaurant/retail/pharmacy is also selected
  const posOriented = new Set<BusinessType>(['retail', 'restaurant', 'pharmacy']);
  if (intended.length === 0) return false;
  return !intended.some((b) => posOriented.has(b));
}

interface ApiOnboardingState {
  current_step: number;
  step_status: Record<string, StepStatus>;
  data: OnboardingData;
  started_at: string | null;
  completed_at: string | null;
}

export const useOnboardingWizardStore = create<OnboardingState>((set, get) => ({
  currentStep: 1,
  stepStatus: { ...initialStatus },
  data: {},
  startedAt: null,
  completedAt: null,
  stepStartedAt: null,
  canProceed: false,

  setCompany: (info) =>
    set((s) => ({
      data: { ...s.data, company: info },
      canProceed: computeCanProceed(s.currentStep, { ...s.data, company: info }),
    })),

  setRegion: (region) =>
    set((s) => ({
      data: { ...s.data, region },
      canProceed: computeCanProceed(s.currentStep, { ...s.data, region }),
    })),

  setCOA: (coa) =>
    set((s) => ({
      data: { ...s.data, coa },
      canProceed: computeCanProceed(s.currentStep, { ...s.data, coa }),
    })),

  setPOS: (pos) =>
    set((s) => ({
      data: { ...s.data, pos },
      canProceed: computeCanProceed(s.currentStep, { ...s.data, pos }),
    })),

  setFirstSale: (firstSale) =>
    set((s) => ({
      data: { ...s.data, firstSale },
      canProceed: computeCanProceed(s.currentStep, { ...s.data, firstSale }),
    })),

  start: () => {
    const now = Date.now();
    set({ startedAt: now, stepStartedAt: now });
    telemetry.started();
  },

  next: () => {
    const { currentStep, data, stepStatus, stepStartedAt } = get();
    const elapsed = stepStartedAt ? Date.now() - stepStartedAt : 0;
    telemetry.stepCompleted(currentStep, elapsed);

    let nextStep: StepNumber = currentStep;
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx < STEP_ORDER.length - 1) {
      nextStep = STEP_ORDER[idx + 1];
      // Skip POS if marked by company intended_use
      if (nextStep === 4 && shouldSkipPOS(data)) {
        nextStep = 5;
        // mark step 4 as skipped
        set({
          stepStatus: { ...stepStatus, [currentStep]: 'completed', 4: 'skipped' },
        });
        telemetry.stepSkipped(4);
      } else {
        set({
          stepStatus: {
            ...stepStatus,
            [currentStep]: 'completed',
            [nextStep]: 'in_progress',
          },
        });
      }
    }
    set({
      currentStep: nextStep,
      stepStartedAt: Date.now(),
      canProceed: computeCanProceed(nextStep, data),
    });
    // Fire-and-forget save
    void get().save();
  },

  back: () => {
    const { currentStep, data, stepStatus } = get();
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx <= 0) return;
    let prevStep = STEP_ORDER[idx - 1];
    // Skip POS on backward if it was previously skipped
    if (prevStep === 4 && stepStatus[4] === 'skipped') {
      prevStep = 3;
    }
    set({
      currentStep: prevStep,
      stepStartedAt: Date.now(),
      canProceed: computeCanProceed(prevStep, data),
    });
  },

  skip: () => {
    const { currentStep, data, stepStatus } = get();
    telemetry.stepSkipped(currentStep);
    const idx = STEP_ORDER.indexOf(currentStep);
    if (idx >= STEP_ORDER.length - 1) {
      // skip on last step is treated as complete
      void get().complete();
      return;
    }
    const nextStep = STEP_ORDER[idx + 1];
    set({
      currentStep: nextStep,
      stepStartedAt: Date.now(),
      stepStatus: {
        ...stepStatus,
        [currentStep]: 'skipped',
        [nextStep]: 'in_progress',
      },
      canProceed: computeCanProceed(nextStep, data),
    });
    void get().save();
  },

  goTo: (step) => {
    const { data, stepStatus } = get();
    set({
      currentStep: step,
      stepStartedAt: Date.now(),
      stepStatus: { ...stepStatus, [step]: 'in_progress' },
      canProceed: computeCanProceed(step, data),
    });
  },

  complete: async () => {
    const { startedAt, stepStatus } = get();
    const now = Date.now();
    const totalElapsed = startedAt ? now - startedAt : 0;
    const skipped: number[] = Object.entries(stepStatus)
      .filter(([, s]) => s === 'skipped')
      .map(([k]) => Number(k));
    set({
      completedAt: now,
      stepStatus: { ...stepStatus, 5: 'completed' },
    });
    telemetry.completed(totalElapsed, skipped);
    try {
      await api.put('/api/onboarding/state', {
        current_step: 5,
        step_status: get().stepStatus,
        data: get().data,
        started_at: startedAt ? new Date(startedAt).toISOString() : null,
        completed_at: new Date(now).toISOString(),
      });
    } catch {
      /* swallow — confetti still plays */
    }
  },

  save: async () => {
    const { currentStep, stepStatus, data, startedAt, completedAt } = get();
    try {
      await api.put('/api/onboarding/state', {
        current_step: currentStep,
        step_status: stepStatus,
        data,
        started_at: startedAt ? new Date(startedAt).toISOString() : null,
        completed_at: completedAt ? new Date(completedAt).toISOString() : null,
      });
    } catch {
      /* offline-tolerant: state is recoverable from in-memory + next save */
    }
  },

  hydrate: async () => {
    try {
      const res = await api.get<ApiOnboardingState>('/api/onboarding/state');
      const remote = res.data;
      const stepStatus: Record<number, StepStatus> = { ...initialStatus };
      if (remote.step_status && typeof remote.step_status === 'object') {
        for (const [k, v] of Object.entries(remote.step_status)) {
          stepStatus[Number(k)] = v;
        }
      }
      const step = (Math.max(1, Math.min(5, Number(remote.current_step) || 1)) as StepNumber);
      set({
        currentStep: step,
        stepStatus,
        data: remote.data || {},
        startedAt: remote.started_at ? Date.parse(remote.started_at) : null,
        completedAt: remote.completed_at ? Date.parse(remote.completed_at) : null,
        stepStartedAt: Date.now(),
        canProceed: computeCanProceed(step, remote.data || {}),
      });
    } catch {
      // First mount with no remote state — leave defaults.
    }
  },

  _reset: () =>
    set({
      currentStep: 1,
      stepStatus: { ...initialStatus },
      data: {},
      startedAt: null,
      completedAt: null,
      stepStartedAt: null,
      canProceed: false,
    }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for tests)
// ─────────────────────────────────────────────────────────────────────────────

export const _internals = {
  computeCanProceed,
  shouldSkipPOS,
  STEP_ORDER,
};

/** Normalize an Iraqi phone number to E.164 (+964...). */
export function normalizeIraqPhone(raw: string): string {
  if (!raw) return '';
  let v = raw.replace(/[\s\-()]/g, '').trim();
  if (v.startsWith('00964')) v = '+964' + v.slice(5);
  else if (v.startsWith('964')) v = '+' + v;
  else if (v.startsWith('07')) v = '+964' + v.slice(1);
  else if (v.startsWith('7') && v.length >= 10) v = '+964' + v;
  else if (!v.startsWith('+')) v = '+964' + v;
  return v;
}
