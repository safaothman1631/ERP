import { defineCollection, z } from 'astro:content';

/**
 * Content collections schema for the marketing site.
 *
 * - `blog`     — MDX posts with rich frontmatter (SEO-targeted, 1.2k–1.8k words)
 * - `features` — feature pages (POS, accounting, etc.)
 * - `pricing`  — pricing plan definitions (Starter / Growth / Pro)
 */

const blogCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string().min(10).max(80),
    description: z.string().min(60).max(200),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().default('Kurdish ERP Team'),
    author_title: z.string().optional(),
    tags: z.array(z.string()).default([]),
    locale: z.enum(['ku', 'en', 'ar']).default('en'),
    translations: z
      .object({
        ku: z.string().optional(),
        en: z.string().optional(),
        ar: z.string().optional(),
      })
      .optional(),
    og_image: z.string().default('/brand/og/blog-template-1200x630.svg'),
    cover_image: z.string().optional(),
    cover_alt: z.string().optional(),
    reading_minutes: z.number().int().positive().optional(),
    target_query: z.string().optional(),
    canonical: z.string().url().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    series: z.string().optional(),
  }),
});

const featureCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    icon: z.string().optional(),
    summary: z.string(),
    order: z.number().int().default(100),
    locale: z.enum(['ku', 'en', 'ar']).default('en'),
  }),
});

const pricingPlanCollection = defineCollection({
  type: 'data',
  schema: z.object({
    id: z.enum(['starter', 'growth', 'pro']),
    name_key: z.string(),
    sub_key: z.string(),
    price_iqd_monthly: z.number().int().nonnegative(),
    price_iqd_annual: z.number().int().nonnegative(),
    price_usd_monthly: z.number().nonnegative(),
    price_usd_annual: z.number().nonnegative(),
    popular: z.boolean().default(false),
    features: z.array(z.string()), // i18n keys
    cta_key: z.string().default('pricing.cta.start'),
    upgrade_reason_key: z.string().optional(),
    max_users: z.union([z.number().int().positive(), z.literal('unlimited')]),
    max_locations: z.union([z.number().int().positive(), z.literal('unlimited')]),
    modules: z.array(z.string()),
  }),
});

export const collections = {
  blog: blogCollection,
  features: featureCollection,
  pricing: pricingPlanCollection,
};
