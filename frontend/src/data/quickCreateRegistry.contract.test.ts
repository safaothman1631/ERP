/**
 * @file quickCreateRegistry.contract.test.ts
 * @description Contract test for the quick-create registry — T-LR.0.7.
 *
 * For every entity in `QUICK_CREATE_REGISTRY`, this test asserts the
 * structural invariants the runtime consumers (`<SelectWithQuickCreate>`,
 * `<ListWithEmptyState>`, ...) depend on:
 *
 *   1. Required keys present: class, titleKey, fields, apiCreate,
 *      loadOptions, permission, fullFormHref.
 *   2. `class` is exactly 'A' | 'B' | 'C'.
 *   3. `fields` has at least one required field.
 *   4. `apiCreate` and `loadOptions` are functions.
 *   5. URLs implied by apiCreate / loadOptions resolve to non-empty
 *      string paths (we stub the network and inspect the call).
 *   6. Every Class A/B endpoint lives on the R1-canonical path list.
 *
 * Drift is rejected loudly — the test is the spec.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  QUICK_CREATE_REGISTRY,
  REGISTERED_ENTITIES,
} from './quickCreateRegistry';
import type { EntitySlug } from '../design-system/empty/types';

/* --------------------------------------------------------------------------
 * R1-canonical endpoint paths.
 *
 * These are the routes confirmed live in `backend/app/api/quick_create.py`
 * (Phase R1, 2026-05-29 — see _deltas/launch-readiness-REMAINING-WORK.md
 * § "ئەوەی R1 دروستی کرد"), plus the long-lived ones used by Class A/B
 * entities that predate R1 (contacts, items, taxes, accounts).
 * -------------------------------------------------------------------------- */

const CANONICAL_PATHS: Readonly<Record<EntitySlug, string>> = {
  customer: '/api/contacts',
  vendor: '/api/contacts',
  tax_rate: '/api/taxes/rates',
  expense_category: '/api/expense-categories',
  equipment_category: '/api/equipment-categories',
  currency: '/api/currencies',
  tag: '/api/tags',
  payment_method: '/api/payment-methods',
  item: '/api/items',
  account: '/api/accounts',
  bank_account: '/api/bank-accounts',
  team: '/api/teams',
  subscription_plan: '/api/subscription-plans',
  location: '/api/locations',
  employee: '/api/employees',
};

/* --------------------------------------------------------------------------
 * Stub the API client so apiCreate/loadOptions can be observed without
 * a network round-trip. We capture the URL and immediately resolve.
 * -------------------------------------------------------------------------- */

const apiCalls: Array<{ method: string; url: string }> = [];

vi.mock('../api', () => ({
  default: {
    get: vi.fn(async (url: string) => {
      apiCalls.push({ method: 'GET', url });
      return { data: { items: [] } };
    }),
    post: vi.fn(async (url: string, _body: unknown) => {
      apiCalls.push({ method: 'POST', url });
      return { data: { id: 'stub-id', name: 'stub', display_name: 'stub', code: 'STB' } };
    }),
  },
}));

beforeEach(() => {
  apiCalls.length = 0;
});

/* --------------------------------------------------------------------------
 * Sanity: registry presence
 * -------------------------------------------------------------------------- */

describe('quickCreateRegistry — top-level invariants', () => {
  it('registers every EntitySlug in CANONICAL_PATHS', () => {
    for (const slug of REGISTERED_ENTITIES) {
      expect(CANONICAL_PATHS[slug as EntitySlug], `Missing canonical path for ${slug}`).toBeDefined();
    }
  });

  it('CANONICAL_PATHS covers every registered slug exactly', () => {
    expect(new Set(REGISTERED_ENTITIES)).toEqual(new Set(Object.keys(CANONICAL_PATHS)));
  });
});

/* --------------------------------------------------------------------------
 * describe.each — one suite per entity
 * -------------------------------------------------------------------------- */

const cases: Array<[EntitySlug]> = REGISTERED_ENTITIES.map((s) => [s as EntitySlug]);

describe.each(cases)('entity: %s', (slug) => {
  const cfg = QUICK_CREATE_REGISTRY[slug];

  it('has all required top-level keys', () => {
    expect(cfg).toBeDefined();
    expect(cfg.class, 'class').toBeDefined();
    expect(cfg.titleKey, 'titleKey').toBeTypeOf('string');
    expect(cfg.fields, 'fields').toBeInstanceOf(Array);
    expect(cfg.apiCreate, 'apiCreate').toBeTypeOf('function');
    expect(cfg.loadOptions, 'loadOptions').toBeTypeOf('function');
    expect(cfg.permission, 'permission').toBeTypeOf('string');
    expect(cfg.fullFormHref, 'fullFormHref').toBeTypeOf('string');
  });

  it("class is one of 'A' | 'B' | 'C'", () => {
    expect(['A', 'B', 'C']).toContain(cfg.class);
  });

  it('fields has at least one required field', () => {
    const required = cfg.fields.filter((f) => f.required);
    expect(required.length, 'at least one required field').toBeGreaterThan(0);
  });

  it('titleKey looks like an i18n key (qc.<slug>.title)', () => {
    expect(cfg.titleKey).toMatch(/^qc\.[a-z_]+\.title$/);
  });

  it('permission looks like a resource.verb pair', () => {
    expect(cfg.permission).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });

  it('fullFormHref starts with /', () => {
    expect(cfg.fullFormHref.startsWith('/'), `${cfg.fullFormHref} must be a root-relative URL`).toBe(true);
    expect(cfg.fullFormHref.length).toBeGreaterThan(1);
  });

  it('loadOptions hits the canonical endpoint', async () => {
    await cfg.loadOptions('');
    const gets = apiCalls.filter((c) => c.method === 'GET');
    // It may make 0 calls only for Class C if `loadOptions` is a stub; in
    // our registry, all classes implement loadOptions for the selector.
    expect(gets.length, 'loadOptions should perform at least one GET').toBeGreaterThan(0);
    const url = gets[0].url;
    expect(url, `loadOptions url must be a non-empty string`).toBeTypeOf('string');
    expect(url.length).toBeGreaterThan(0);
    expect(url.startsWith(CANONICAL_PATHS[slug])).toBe(true);
  });

  if (cfg.class !== 'C') {
    it('apiCreate hits the canonical endpoint (Class A/B only)', async () => {
      // Build a minimal valid-shape payload by stubbing required fields.
      const values: Record<string, unknown> = {};
      for (const f of cfg.fields) {
        if (f.required) values[f.name] = (f.default ?? 'stub');
      }
      await cfg.apiCreate(values, { signal: new AbortController().signal });
      const posts = apiCalls.filter((c) => c.method === 'POST');
      expect(posts.length, 'apiCreate should perform a POST').toBeGreaterThan(0);
      const url = posts[0].url;
      expect(url).toBeTypeOf('string');
      expect(url.length).toBeGreaterThan(0);
      expect(url).toBe(CANONICAL_PATHS[slug]);
    });
  } else {
    it('apiCreate throws (Class C navigates instead)', async () => {
      // Class C entities navigate to fullFormHref; calling apiCreate is
      // misuse and must throw.
      await expect(cfg.apiCreate({}, { signal: new AbortController().signal })).rejects.toThrow();
    });
  }
});
