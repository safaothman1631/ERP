# Role Personas — Customer vs Vendor

## Vendor (SaaS operator)

| Account | Role | First screen | UI |
|---------|------|--------------|-----|
| Safa / platform team | `super_admin` | `/platform` | Indigo PlatformGlass console |

Platform admins **never** see the tenant owner gold executive UI unless **impersonating** a customer org.

## Customer org roles

| Role | Persona | Accent | Home |
|------|---------|--------|------|
| `owner` | Executive founder | Gold | Organization overview + full KPIs |
| `admin` | Administrator | Blue | Users, modules, settings |
| `manager` | Operations lead | Teal | Approvals + team KPIs |
| `accountant` | Finance | Green | AR/AP, journals, compliance |
| `sales` / `sales_rep` | Sales | Blue | Pipeline, quotes, CRM |
| `purchaser` | Purchasing | Purple | POs, vendors |
| `inventory` / `inventory_manager` | Warehouse | Cyan | Stock, transfers |
| `cashier` / POS roles | POS staff | Red | POS terminal first |
| `hr` / `hr_manager` | HR | Violet | People, leave, payroll |
| `viewer` | Read-only | Gray | Reports only — no create CTAs |
| `user` | Employee | Neutral | Personal workspace |

## Resolver chain

```
JWT role + permissions
  → resolveRoleTheme()   // accent, navProfile, quickActions, defaultRoute
  → resolveRolePersona() // capability copy (can / cannot)
  → RoleIdentityChip + RoleHomeHero + DashboardRouter home
```

## Security note

Role UX is **progressive disclosure** only. Backend RBAC remains the source of truth.

See also: [GLASS.md](./GLASS.md), `.kiro/specs/role-adaptive-glass-ux/`

## Strategy & competitive benchmark

- Spec: [`.kiro/specs/erp-competitive-benchmark/`](../../.kiro/specs/erp-competitive-benchmark/)
- Living scorecard: [`docs/strategy/COMPETITIVE_SCORECARD.md`](../strategy/COMPETITIVE_SCORECARD.md)
- Module tiers: [`docs/ux/MODULE_MATURITY.md`](./MODULE_MATURITY.md)

## Demo accounts (Role UX testing)

One shared tenant org with a user per persona. Password for all demo accounts: **`Demo@2026`**.

| Email | Role |
|-------|------|
| `demo-owner@zohoerp.example.com` | `owner` |
| `demo-admin@zohoerp.example.com` | `admin` |
| `demo-manager@zohoerp.example.com` | `manager` |
| `demo-accountant@zohoerp.example.com` | `accountant` |
| `demo-sales@zohoerp.example.com` | `sales_rep` |
| `demo-purchaser@zohoerp.example.com` | `purchaser` |
| `demo-inventory@zohoerp.example.com` | `inventory_manager` |
| `demo-cashier@zohoerp.example.com` | `cashier` |
| `demo-hr@zohoerp.example.com` | `hr` |
| `demo-projects@zohoerp.example.com` | `project_manager` |
| `demo-viewer@zohoerp.example.com` | `viewer` |
| `demo-user@zohoerp.example.com` | `user` |

**Vendor (platform only):** `safaothman1631@gmail.com` — `super_admin` only, not a tenant demo user.

Seed or refresh:

```powershell
cd backend
.\venv\Scripts\python.exe scripts\seed_role_demo_users.py --apply
```

Dry-run first (no writes): omit `--apply`.

## Navbar, setup & settings audit

Automated checks for per-role sidebar sections, setup leaves, settings tabs, and TopBar smoke (density + user menu). Spec: [`.kiro/specs/role-navbar-settings-audit/`](../../.kiro/specs/role-navbar-settings-audit/).

**E2E (Playwright)** — requires frontend dev server and backend API:

```powershell
cd frontend
npx playwright test e2e/role-full-audit.spec.ts
```

JSON reports are written to `frontend/e2e/reports/role-audit-{timestamp}.json` (gitignored). Owner and admin are skipped when login returns `2fa_code_required`.

**Unit tests (Vitest)** — audit matrix + settings role scope:

```powershell
cd frontend
npx vitest run src/audit src/settings/registry/__tests__/roleModuleScope
```
