# Settings monolith — migration plan (Phase P5)

This document is the backlog for decomposing `frontend/src/settings/sections/bodies.tsx`
(4,605 LOC, 56 section components) into per-section files under
`frontend/src/pages/settings/sections/`.

**Status legend**

- ✅ done — file lives at the target path; registry entry uses the real loader.
- 🔧 in progress — being migrated in a current PR.
- ⏳ todo — still in `bodies.tsx`; the registry uses the `TODO` placeholder.

## Conventions

1. Copy `pages/settings/sections/_template/SectionTemplate.tsx` as the starting point.
2. Move the section component from `bodies.tsx` into its target file. Replace
   the `useSettingsBag(...)` / inline patterns with `useClassedQuery` (class C)
   + `useCallback` handlers + optimistic save (see `general/CompanyInfo.tsx`).
3. Wrap the default export with `React.memo`.
4. Update `pages/settings/sections.registry.ts` — swap the `TODO` loader for the
   new `lazy(() => import(...))`.
5. Delete the section from `bodies.tsx` (do **not** leave dead code behind).
6. Run `npm run lint && npm run typecheck && npm run test -- sections`.
7. PR title: `settings(P5): migrate <SectionName>`.

## Discovered sections (56 total)

LOC counted as the gap between consecutive component declarations in
`bodies.tsx` (last section bounded by EOF at line 4,605). LOC is *approximate*
because helper types and constants between sections inflate the count slightly —
use it for sizing the PR, not as a budget.

| # | Section (in bodies.tsx) | Start line | Approx LOC | Target file | Suggested owner | Status |
|--:|---|--:|--:|---|---|---|
| 1 | `GeneralSettings` | 120 | 133 | `sections/general/index.tsx` (rename → `GeneralAppSettings.tsx`) | platform | ⏳ |
| 2 | `AppearanceSettings` | 253 | 128 | `sections/general/Appearance.tsx` | platform | ⏳ |
| 3 | `FeatureFlagsSettings` | 381 | 117 | `sections/general/FeatureFlags.tsx` | platform | ⏳ |
| 4 | `ProfileSettings` | 498 | 118 | `sections/account/Profile.tsx` | identity | ⏳ |
| 5 | `OrganizationSettings` | 616 | 90 | `sections/general/CompanyInfo.tsx` | platform | ✅ (new impl) |
| 6 | `SecuritySettings` | 706 | 344 | `sections/account/Security.tsx` | identity | ⏳ |
| 7 | `NotificationSettings` | 1050 | 536 | `sections/account/Notifications.tsx` (split sub-tabs) | identity | ⏳ |
| 8 | `ModulesSettings` | 1586 | 116 | `sections/system/Modules.tsx` | platform | ⏳ |
| 9 | `FiscalYears` | 1702 | 103 | `sections/finance/FiscalYears.tsx` | finance | ⏳ |
| 10 | `Budgets` | 1805 | 111 | `sections/finance/Budgets.tsx` | finance | ⏳ |
| 11 | `Currencies` | 1916 | 149 | `sections/finance/Currencies.tsx` | finance | ⏳ |
| 12 | `InvoiceTemplates` | 2065 | 107 | `sections/finance/InvoiceTemplates.tsx` | finance | ⏳ |
| 13 | `ReminderSettings` | 2172 | 83 | `sections/finance/Reminders.tsx` | finance | ⏳ |
| 14 | `EInvoiceSettings` | 2255 | 166 | `sections/finance/EInvoice.tsx` | iraq-pack | ⏳ |
| 15 | `EmailSettings` | 2421 | 68 | `sections/content/Email.tsx` | platform | ⏳ |
| 16 | `BackupRestore` | 2489 | 86 | `sections/system/Backup.tsx` | platform | ⏳ |
| 17 | `ActivityLog` | 2575 | 94 | `sections/system/Activity.tsx` | platform | ⏳ |
| 18 | `SystemInfo` | 2669 | 96 | `sections/system/SystemInfo.tsx` | platform | ⏳ |
| 19 | `PreferencesSettings` | 2936 | 119 | `sections/account/Preferences.tsx` | identity | ⏳ |
| 20 | `BranchesSettings` | 3055 | 97 | `sections/organization/Branches.tsx` | platform | ⏳ |
| 21 | `BrandingSettings` | 3152 | 25 | `sections/general/Branding.tsx` | platform | ✅ (new impl) |
| 22 | `WorkingHoursSettings` | 3177 | 44 | `sections/organization/WorkingHours.tsx` | ops | ⏳ |
| 23 | `HolidaysSettings` | 3221 | 38 | `sections/organization/Holidays.tsx` | ops | ⏳ |
| 24 | `UsersSettings` | 3259 | 79 | `sections/users/Users.tsx` | identity | ⏳ |
| 25 | `RolesSettings` | 3338 | 77 | `sections/users/Roles.tsx` | identity | ⏳ |
| 26 | `PermissionsSettings` | 3415 | 145 | `sections/users/Permissions.tsx` | identity | ⏳ |
| 27 | `SsoSettings` | 3560 | 25 | `sections/users/Sso.tsx` | identity | ⏳ |
| 28 | `PortalsSettings` | 3585 | 27 | `sections/users/Portals.tsx` | identity | ⏳ |
| 29 | `LocalizationSettings` | 3612 | 34 | `sections/general/Localization.tsx` | platform | ✅ (new impl) |
| 30 | `LanguagesSettings` | 3646 | 20 | `sections/localization/Languages.tsx` | platform | ⏳ |
| 31 | `FormatsSettings` | 3666 | 24 | `sections/localization/Formats.tsx` | platform | ⏳ |
| 32 | `TaxesSettings` | 3690 | 82 | `sections/finance/Taxes.tsx` | finance | ⏳ |
| 33 | `BankingSettings` | 3772 | 107 | `sections/finance/Banking.tsx` | finance | ⏳ |
| 34 | `PaymentMethodsSettings` | 3879 | 46 | `sections/finance/PaymentMethods.tsx` | finance | ⏳ |
| 35 | `SalesSettings` | 3925 | 24 | `sections/commerce/Sales.tsx` | commerce | ⏳ |
| 36 | `CrmSettings` | 3949 | 25 | `sections/commerce/Crm.tsx` | commerce | ⏳ |
| 37 | `PurchasesSettings` | 3974 | 23 | `sections/commerce/Purchases.tsx` | commerce | ⏳ |
| 38 | `InventorySettings` | 3997 | 24 | `sections/commerce/Inventory.tsx` | commerce | ⏳ |
| 39 | `MrpSettings` | 4021 | 22 | `sections/commerce/Mrp.tsx` | commerce | ⏳ |
| 40 | `PosSettings` | 4043 | 25 | `sections/commerce/Pos.tsx` | pos | ⏳ |
| 41 | `EcommerceSettings` | 4068 | 24 | `sections/commerce/Ecommerce.tsx` | commerce | ⏳ |
| 42 | `HelpdeskSettings` | 4092 | 24 | `sections/commerce/Helpdesk.tsx` | crm | ⏳ |
| 43 | `HrSettings` | 4116 | 23 | `sections/operations/Hr.tsx` | hr | ⏳ |
| 44 | `PayrollSettings` | 4139 | 23 | `sections/operations/Payroll.tsx` | hr | ⏳ |
| 45 | `ProjectsSettings` | 4162 | 21 | `sections/operations/Projects.tsx` | ops | ⏳ |
| 46 | `MarketingSettings` | 4183 | 26 | `sections/operations/Marketing.tsx` | growth | ⏳ |
| 47 | `WorkflowsSettings` | 4209 | 51 | `sections/automation/Workflows.tsx` | platform | ⏳ |
| 48 | `ApprovalsSettings` | 4260 | 52 | `sections/automation/Approvals.tsx` | platform | ⏳ |
| 49 | `IntegrationsSettings` | 4312 | 38 | `sections/automation/Integrations.tsx` | platform | ⏳ |
| 50 | `WebhooksSettings` | 4350 | 28 | `sections/automation/Webhooks.tsx` | platform | ⏳ |
| 51 | `ApiTokensSettings` | 4378 | 21 | `sections/automation/ApiTokens.tsx` | platform | ⏳ |
| 52 | `DocumentsSettings` | 4399 | 21 | `sections/content/Documents.tsx` | platform | ⏳ |
| 53 | `SmsWhatsappSettings` | 4420 | 49 | `sections/content/SmsWhatsapp.tsx` | comms | ⏳ |
| 54 | `AuditSettings` | 4469 | 34 | `sections/system/Audit.tsx` | platform | ⏳ |
| 55 | `GdprSettings` | 4503 | 22 | `sections/system/Gdpr.tsx` | platform | ⏳ |
| 56 | `MobileSettings` | 4525 | ~80 | `sections/system/Mobile.tsx` | mobile | ⏳ |

**Total approx LOC accounted for:** ~4,605

## Already-migrated sections (P5 sample work)

These three are the proof-of-concept; the registry already points to them.

- `sections/general/CompanyInfo.tsx`
- `sections/general/Localization.tsx`
- `sections/general/Branding.tsx`

## Order of attack

Recommended priority order, balancing LOC payoff against blast radius:

1. **High-LOC, low-risk first** — `NotificationSettings` (536), `SecuritySettings` (344), `EInvoiceSettings` (166), `Permissions` (145).
2. **Medium-LOC commerce/finance** — taxes, banking, currencies, fiscal years.
3. **Small leaves** — the dozen ≤ 30-LOC sections at the end of `bodies.tsx`. These can be batched 3–5 per PR.

## Definition of done for the full migration

- [ ] `bodies.tsx` is deleted from `frontend/src/settings/sections/`.
- [ ] All 56 sections have own files ≤ 400 LOC.
- [ ] `pages/settings/sections.registry.ts` has no `TODO` placeholders.
- [ ] `App.tsx` routes `/settings` to `pages/settings/SettingsShell` (new path);
      the legacy `settings/shell/SettingsShell.tsx` is deleted or kept as a thin
      forwarder pending parity verification.
- [ ] CI passes including the new `pages/settings/**/*.test.tsx` smoke specs.
- [ ] No file in the settings tree exceeds 400 LOC (R8.1).
