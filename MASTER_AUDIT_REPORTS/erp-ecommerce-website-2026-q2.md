# E-commerce Audit — 2026-Q2
Agent: ERP E-commerce | Date: 2026-04-24

## A. Coverage: Odoo 0% / Zoho Commerce 0% (MOSTLY MISSING)

## B. Top 10 P0/P1 Gaps

| ID | Sev | Title | File | Ref | Effort |
|----|-----|-------|------|-----|--------|
| E01 | P0 | No product catalog or shop pages | N/A | ecommerce/configuration | 40h |
| E02 | P0 | No shopping cart system | N/A | ecommerce/checkout | 32h |
| E03 | P0 | No checkout flow | N/A | ecommerce/checkout | 40h |
| E04 | P0 | No payment gateway integration | N/A | ecommerce/checkout | 48h |
| E05 | P0 | No website builder or CMS | N/A | website/web_design | 80h |
| E06 | P1 | No customer e-commerce portal | portals.py:1 | ecommerce/order_handling | 24h |
| E07 | P1 | No product variants/options UI | N/A | ecommerce/configuration | 32h |
| E08 | P1 | No blog system | N/A | blog.rst | 40h |
| E09 | P1 | No livechat integration | N/A | livechat.rst | 32h |
| E10 | P1 | No abandoned cart recovery | N/A | ecommerce/order_handling | 24h |

## C. Quick Wins

- portals.py:15 — Extend portal token to support guest checkout (8h)
- items.py:1 — Add `published_web`, `featured`, `seo_title` fields to items schema (4h)
- contacts.py:1 — Add `wishlist[]`, `cart_id` fields to customers (3h)
- invoices.py:1 — Link web orders to invoices (6h)
- api/__init__.py:1 — Create `/api/web/` router namespace (2h)
- frontend/src/pages/ — Create Shop.tsx skeleton (4h)
- frontend/src/pages/ — Create Cart.tsx skeleton (4h)
- schemas/ — Create cart, web_order, review schemas (6h)

## D. Big Rocks

- E-commerce product catalog + filtering (15d)
- Shopping cart + session management (12d)
- Multi-step checkout flow (guest + auth) (18d)
- Payment gateway integrations (FIB, Zain Cash, Asia Hawala, Stripe) (25d)
- Website builder / CMS with blocks (40d)
- Customer portal (orders, invoices, addresses, wishlist) (12d)
- Blog system (posts, categories, comments, SEO) (15d)
- Livechat + visitor tracking (20d)

## E. Odoo features missing

- Product catalog with categories and filters
- Product variants (size, color, etc.)
- Shopping cart with session persistence
- Multi-step checkout (address, shipping, payment)
- Guest checkout
- Payment provider integrations (Stripe, PayPal, local)
- Shipping method selection
- Coupon/promo codes
- Product reviews and ratings
- Wishlist
- Abandoned cart email reminders
- Website builder with drag-drop blocks
- Blog with posts, categories, tags
- SEO tools (meta tags, sitemap, robots.txt, structured data)
- Livechat with operator assignment

## F. Zoho features missing

- All core e-commerce features (shop, cart, checkout, payments)
- All website builder/CMS features
- All blog features
- Customer e-commerce portal (only B2B invoice portal exists)
- Product variants UI for web
- Guest checkout
- Shopping cart session management
- Payment gateway integrations for web
- Coupon system
- Product reviews
- Wishlist
- Abandoned cart tracking
- Website analytics
- Livechat
- Blog/content management

## G. Counts: P0/P1/P2/QW/BR
P0: 5 | P1: 5 | P2: 12 | QW: 8 | BR: 8

## H. Lead + skills
Lead: ERP E-commerce + ERP Integration + ERP Security
Skills: api-design-fastapi, react19-patterns, antd-rtl-patterns, security-review-owasp, karpathy-guidelines
