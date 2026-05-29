# Odoo Parity Gap Matrix — Zoho ERP

Quick reference for the parity advisor. Score each 0–5. **P0** = fix first.

## Platform & SaaS (you lead vs Odoo)

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Multi-tenant SaaS | ❌ (DB per customer) | ✅ org_id | Win — keep |
| Vendor platform console | Partner-only | ✅ `/platform` | Win — keep |
| Module licensing | Per-app install | ✅ bundles | Win — keep |
| Owner provisioning on create org | N/A | ❌ owner_email gap | P0 |
| Portal users (customer/vendor) | ✅ | ❌ | P1 |

## Security & RBAC

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| ACL (model CRUD) | ✅ groups | ✅ permissions | OK |
| Record rules (row filter) | ✅ ir.rule | ⚠️ org_id only | P1 |
| Group inheritance | ✅ | ❌ | P2 |
| Field-level security | ✅ | ❌ | P2 |
| 2FA / TOTP | ✅ | ✅ | OK |
| Audit chain | Enterprise | ✅ hash chain | Win |
| Impersonation | Partner | ✅ platform | Win |

## Accounting

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Double-entry JE | ✅ | ✅ | OK |
| Lock dates / period close | ✅ | ✅ | OK |
| Bank reconciliation | ✅ AI (Ent) | ⚠️ partial | P1 |
| Reconciliation models | ✅ | ❌ | P2 |
| Fiscal positions | ✅ | ⚠️ partial | P1 |
| Analytic accounting | ✅ | ⚠️ partial | P1 |
| Multi-currency revaluation | ✅ | ❌ | P2 |
| Assets / depreciation | Enterprise | ⚠️ partial | P2 |
| Deferred revenue | Enterprise | ❌ | P2 |
| Budgets | ✅ | ❌ | P2 |

## Inventory

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Multi-warehouse | ✅ | ⚠️ partial | P1 |
| Lot/serial + expiry | ✅ | ✅ grn_lots | OK |
| Routes push/pull | ✅ | ❌ | P2 |
| Multi-step receive/deliver | ✅ | ❌ | P2 |
| FIFO/AVCO/Standard costing | ✅ | ⚠️ partial | P1 |
| Landed costs | Enterprise | ❌ | P2 |
| Reordering min/max | ✅ | ⚠️ partial | P1 |
| Drop-ship / cross-dock | ✅ | ❌ | P2 |

## Sales & CRM

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Pipeline + stages | ✅ | ✅ | OK |
| Pricelists (formula) | ✅ | ⚠️ partial | P1 |
| Subscriptions / recurring | Enterprise | ❌ | P1 |
| Coupons / promotions | ✅ | ❌ | P2 |
| Quotation templates + e-sign | ✅ | ⚠️ partial | P1 |

## Manufacturing

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| BOM + routing | ✅ | ⚠️ partial | P1 |
| Work orders | ✅ | ⚠️ partial | P1 |
| MRP scheduler | ✅ | ❌ | P2 |
| Quality control | Enterprise | ❌ | P2 |

## POS

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Sessions + cash control | ✅ | ✅ | OK |
| Offline sync | ✅ | ⚠️ scaffold | P0 |
| Restaurant KDS | Enterprise | ⚠️ tier-3 | P2 |
| IoT hardware | ✅ | ❌ | P3 |

## HR & Payroll

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Employee directory | ✅ | ✅ | OK |
| Time off / attendance | ✅ | ⚠️ partial | P1 |
| Payroll Iraq | ❌ Odoo gap | ⚠️ partial | Win — deepen |
| Recruitment | ✅ | ❌ | P2 |

## Automation & Integration

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Automated actions | ✅ base.automation | ⚠️ partial runner | P0 |
| Scheduled actions | ✅ ir.cron | ✅ scheduler | OK |
| Mail templates | ✅ | ⚠️ partial | P1 |
| Webhooks (tenant-managed) | OCA/Ent | ⚠️ partial | P0 |
| API surface | XML/JSON-RPC huge | ⚠️ v1 ~10 resources | P0 |
| Mail aliases (email→record) | ✅ | ❌ | P2 |

## UX & Productivity

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Chatter on all records | ✅ mixin | ⚠️ partial | P0 |
| Activities widget | ✅ | ⚠️ partial | P1 |
| Studio no-code | Enterprise | ❌ | P3 |
| Role-adaptive UI | ❌ default | ✅ glass UX | Win |
| Pivot/Spreadsheet BI | Ent spreadsheet | ⚠️ analytics v1 | P1 |
| Website / eCommerce | ✅ | ❌ | P2 |
| Helpdesk + SLA | Enterprise | ❌ | P2 |

## Iraq / MENA (your moat)

| Feature | Odoo | You | Priority |
|---------|------|-----|----------|
| Iraq chart + tax | ❌ weak | ✅ | Win — market |
| ITA e-invoice | ❌ | ⚠️ preview | P0 config |
| FIB/Zain payments | ❌ | ⚠️ stub | P0 config |
| Kurdish/Arabic RTL | partial | ✅ | Win |

## Scorecard dimensions (current ~3.2 overall)

Focus order to reach **3.4 (90d)**:

1. API v1 + webhooks (Integrations 2.5→3.5)
2. Automation engine (Workflow 2.0→3.0)
3. Chatter universal (trust + collaboration)
4. POS offline complete (Mobile 2.0→2.5)
5. Integration health UX (already started)

Focus order to reach **3.6 (6mo)**:

6. Multi-entity TopBar + consolidation
7. Subscriptions + dunning depth
8. Record-level rules for sales/inventory teams
9. Bank reconciliation models
