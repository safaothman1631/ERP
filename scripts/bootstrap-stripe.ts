#!/usr/bin/env node
/**
 * bootstrap-stripe.ts — create Stripe Products + Prices for every SaaS plan.
 *
 * Idempotent: re-running the script does not create duplicates. We look up
 * existing Prices by ``lookup_key`` (the same key produced by
 * ``Plan.stripe_lookup_key`` on the backend) and only create when missing.
 *
 * Output: ``audit/stripe-prices.json`` — a mapping the backend reads at
 * runtime to pick the right Price ID for a given plan/currency/cycle.
 *
 * Usage:
 *     export STRIPE_SECRET_KEY=sk_test_…
 *     npx tsx scripts/bootstrap-stripe.ts
 *
 * NOTE: The plans catalogue lives in ``backend/app/billing/plans.py`` (Python).
 * We mirror it here verbatim — if you change one, change both. A future
 * improvement is to expose a ``GET /api/saas-billing/plans/_bootstrap`` route
 * that returns this shape so we can avoid the duplicate definition.
 *
 * Blocked on R7.7: Safa needs a Stripe-supported legal entity before this
 * script can be run against a real account.
 */

import fs from 'node:fs';
import path from 'node:path';

// Conditionally import; supports running --help without the dep installed.
type StripeLike = {
  products: {
    list(args: { limit: number; ids?: string[] }): Promise<{ data: Array<{ id: string; metadata?: Record<string, string> }> }>;
    create(args: { id?: string; name: string; metadata?: Record<string, string> }): Promise<{ id: string }>;
  };
  prices: {
    list(args: { lookup_keys: string[]; active?: boolean; limit: number }): Promise<{ data: Array<{ id: string; lookup_key: string }> }>;
    create(args: {
      product: string;
      currency: string;
      unit_amount: number;
      recurring: { interval: 'month' | 'year' };
      lookup_key: string;
      metadata?: Record<string, string>;
    }): Promise<{ id: string }>;
  };
};

interface PlanDef {
  slug: string;
  name_en: string;
  iqd_monthly: number;
  iqd_annual: number;
  usd_monthly: number;       // dollars; converted to cents for Stripe.
  usd_annual: number;
}

// Mirror of backend/app/billing/plans.py — keep these in sync.
const PLANS: PlanDef[] = [
  {
    slug: 'starter', name_en: 'Starter',
    iqd_monthly: 30_000, iqd_annual: 300_000,
    usd_monthly: 25, usd_annual: 250,
  },
  {
    slug: 'growth', name_en: 'Growth',
    iqd_monthly: 80_000, iqd_annual: 800_000,
    usd_monthly: 60, usd_annual: 600,
  },
  {
    slug: 'pro', name_en: 'Pro',
    iqd_monthly: 200_000, iqd_annual: 2_000_000,
    usd_monthly: 150, usd_annual: 1500,
  },
];

const ZERO_DECIMAL = new Set(['IQD', 'JPY', 'KRW', 'VND']);

function toStripeAmount(amount: number, currency: string): number {
  if (ZERO_DECIMAL.has(currency.toUpperCase())) return amount;
  return Math.round(amount * 100);
}

function lookupKey(slug: string, currency: string, cycle: 'monthly' | 'annual'): string {
  return `${slug}_${currency.toLowerCase()}_${cycle}`;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set. Aborting.');
    process.exit(1);
  }

  // Lazy-import the SDK so the script imports cleanly without it.
  const StripeMod = await import('stripe').catch(() => null);
  if (!StripeMod) {
    console.error(
      'The `stripe` npm package is not installed. Run `npm i -D stripe` first.',
    );
    process.exit(1);
  }
  // @ts-expect-error stripe default export.
  const stripe: StripeLike = new StripeMod.default(key, { apiVersion: '2024-06-20' });

  const result: Record<string, Record<string, string>> = {};

  for (const plan of PLANS) {
    console.log(`\n=== Plan: ${plan.slug} (${plan.name_en}) ===`);
    const productId = `prod_saas_${plan.slug}`;
    // Try to find/create the product.
    let product;
    try {
      const existing = await stripe.products.list({ limit: 1, ids: [productId] });
      product = existing.data[0];
    } catch {
      // older SDK signatures don't support ids; fall through to create.
    }
    if (!product) {
      product = await stripe.products.create({
        id: productId,
        name: `Zoho Kurdistan — ${plan.name_en}`,
        metadata: { plan_slug: plan.slug, source: 'bootstrap-stripe.ts' },
      });
      console.log(`  + product created: ${product.id}`);
    } else {
      console.log(`  = product exists: ${product.id}`);
    }

    result[plan.slug] = {};

    const variants: Array<{
      currency: 'IQD' | 'USD';
      cycle: 'monthly' | 'annual';
      amount: number;
      interval: 'month' | 'year';
    }> = [
      { currency: 'IQD', cycle: 'monthly', amount: plan.iqd_monthly, interval: 'month' },
      { currency: 'IQD', cycle: 'annual',  amount: plan.iqd_annual,  interval: 'year'  },
      { currency: 'USD', cycle: 'monthly', amount: plan.usd_monthly, interval: 'month' },
      { currency: 'USD', cycle: 'annual',  amount: plan.usd_annual,  interval: 'year'  },
    ];

    for (const v of variants) {
      const lk = lookupKey(plan.slug, v.currency, v.cycle);
      const search = await stripe.prices.list({
        lookup_keys: [lk], active: true, limit: 1,
      });
      let priceId: string;
      if (search.data.length > 0) {
        priceId = search.data[0].id;
        console.log(`  = price exists for ${lk}: ${priceId}`);
      } else {
        const created = await stripe.prices.create({
          product: product.id,
          currency: v.currency.toLowerCase(),
          unit_amount: toStripeAmount(v.amount, v.currency),
          recurring: { interval: v.interval },
          lookup_key: lk,
          metadata: { plan_slug: plan.slug, cycle: v.cycle },
        });
        priceId = created.id;
        console.log(`  + price created for ${lk}: ${priceId}`);
      }
      result[plan.slug][`${v.currency.toLowerCase()}_${v.cycle}`] = priceId;
    }
  }

  const outDir = path.join(process.cwd(), 'audit');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'stripe-prices.json');
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
