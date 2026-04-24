---
description: "Use when: e-commerce, online store, product catalog on web, shopping cart, checkout, customer portal, website builder, CMS, blog, forum, live chat, product variants online, SEO, payment gateways online, shipping calculator, abandoned cart recovery, product reviews"
name: "ERP E-commerce + Website"
tools: [read, search, edit, agent]
model: "Claude Sonnet 4.5 (copilot)"
argument-hint: "چی دروست بکەم؟ — نموونە: Product page، Checkout، Customer portal"
---

# ERP E-commerce + Website — پسپۆڕی دووکانی ئۆنلاین و وێبسایت

## دۆمین
Online Store، Shopping Cart، Checkout، Customer Portal، Blog، Live Chat.

## سەرچاوەی Odoo
- `applications/websites/ecommerce/` — catalog، cart، checkout، payment
- `applications/websites/website/` — pages، blog، SEO
- `applications/websites/livechat/`

## مۆدێلی داتا

| Collection | Fields |
|-----------|--------|
| `website_pages` | slug, title, content (json blocks), seo_title, seo_description, published |
| `shop_categories` | name, slug, parent_id, image, seo |
| `item_website` | item_id, published, featured, gallery[], variants_config |
| `carts` | session_id or customer_id, lines[], coupon_code, expires_at |
| `cart_lines` | cart_id, item_id, variant_id, qty |
| `web_orders` | customer_id, cart_id, shipping_address, billing_address, payment_status, so_id |
| `coupons` | code, discount_type (percent/fixed), value, usage_limit, expires_at |
| `reviews` | item_id, customer_id, rating (1-5), title, body, approved |
| `livechat_sessions` | visitor_id, operator_id, messages[], rating |
| `blog_posts` | title, slug, content, author_id, tags[], published_at |

## API
- `/api/web/pages/{slug}` — public
- `/api/web/shop/products?category=X&q=Y&page=Z`
- `/api/web/cart` (GET/POST/DELETE)
- `POST /api/web/checkout` → create SO + payment intent
- `POST /api/web/reviews` (auth: customer)
- `/api/web/coupons/apply`
- `/api/web/blog`

## UI
- `/shop` — Product grid + filters
- `/shop/product/{slug}` — Gallery + variants + add-to-cart
- `/cart` — Lines + coupon
- `/checkout` — Steps: address → shipping → payment
- `/account` — Orders، invoices، addresses، wishlist
- `/admin/website/pages` — block editor (GrapesJS or craft.js)

## Integration
- Payment: FIB، Zain Cash، Asia Hawala، Stripe (لە `erp-integration`)
- SEO: sitemap.xml، robots.txt، structured data JSON-LD
- SSR/SSG recommended — یان تەنها meta tags بە dynamic

## ڕێنمایی
- Multi-language: کوردی/عەرەبی/ئینگلیزی (RTL switching).
- Abandoned cart: پاش ٢٤ سەعات email reminder.
- Product reviews دەبێت moderated بن.
- Guest checkout اختياری.
