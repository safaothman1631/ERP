# Requirements: Role-Adaptive Glass UX (Per-Role UI + Full Glassmorphism)

**Version:** 1.0  
**Status:** Authoritative target  
**Last updated:** 2026-05-25

---

## Introduction

ئەم spec ـە **فرۆنتئێندی tenant** (`AppShell`) و **Platform Console** (`/platform`) بە یەک سیستەمی **Role-Adaptive Glass UX** دەگات:

1. **هەر role ـێک UI ـی جیای خۆی** — home، nav، density، accent، empty states، dialogs.
2. **Glassmorphism تەواو** — هەموو surface، modal، drawer، popover، command palette، settings.
3. **Agent-advanced UX** — motion choreography، micro-interactions، accessible animations، RTL-safe.
4. **Role Identity** — user هەمیشە بزانێت «من کێم» و «چ capability ـێکم هەیە».

**پەیوەندی بە spec ـەکانی تر:**

| Spec | پەیوەندی |
|------|----------|
| `tenant-user-settings` | Settings tiers + module gate — UI دەگونجێت بە role |
| `super-admin-console` | Platform glass shell — indigo vendor theme |
| `ui-redesign-modern` | Design tokens، Framer Motion، glass base |
| `system-wide-ux-overhaul` | Help، responsive، i18n umbrella |
| `phase-2-security-rbac` | Role codes + permissions source of truth |
| `module-licensing-access` | Nav filtered by enabled modules |

**Out of scope:** Backend RBAC logic change (تەنها UI consumption); per-field ACL inside forms (v2).

---

## ⭐ رۆڵی تۆ — خاوەن سیستەم (Safa / Vendor)

ئەگەر **تۆ دروستکەری SaaS ـەکەیت** (Zoho ERP بۆ کڕیاران):

| پرسیار | وەڵام |
|--------|--------|
| **رۆڵی تۆ چیە؟** | `super_admin` + `is_platform_admin` |
| **UI ـی سەرەکی** | **Platform Console** → `/platform` |
| **Tenant ERP** | تەنها لە **impersonation** («Enter organization») |
| **Settings tenant** | نە وەک home — license/flags لە platform |
| **ڕەنگ/Theme** | **Indigo glass** (PlatformGlass) — جیا لە tenant |

ئەگەر **تۆ خاوەنی org ـێکی کڕیاریت** (کۆمپانیای خۆت ERP بەکاردەهێنێت):

| پرسیار | وەڵام |
|--------|--------|
| **رۆڵی تۆ چیە؟** | `owner` (یان `admin`) |
| **UI ـی سەرەکی** | **Tenant AppShell** → `/dashboard` |
| **Capability** | Full org config لە enabled modules |
| **ڕەنگ/Theme** | **Owner accent** — gold/amber glass highlight لە TopBar identity chip |

**Golden rule:**  
> Vendor = platform. Customer founder = `owner`. Employee = specialist roles.

---

## Glossary

| Term | Meaning |
|------|---------|
| **Role Shell** | Layout variant derived from `role` + `permissions` + `enabled_modules` |
| **Role Theme** | Accent colors، hero copy، default route، nav density for one role |
| **Glass Surface** | UI layer with backdrop-filter + translucent fill + border glow |
| **Glass Dialog Stack** | Unified Modal / Drawer / Popconfirm / PremiumModal system |
| **Role Identity Chip** | TopBar badge: role name، avatar، capability hint |
| **Adaptive Home** | Role-specific dashboard landing (not one dashboard for all) |
| **Motion Tier** | `full` \| `reduced` \| `none` based on `prefers-reduced-motion` |
| **Platform Glass** | Vendor indigo theme (`PlatformGlass.module.css`) |
| **Tenant Glass** | Customer blue/teal theme with role accent overlay |

---

## Requirement 1: Role → Real-World Persona Map

**User Story:** وەک product owner، دەمەوێت هەر role بدۆزمەوە بۆ کێ لە کۆمپانیادا.

### Acceptance Criteria

1. THE system SHALL document and implement UI personas for every built-in role (see table §1.1).
2. THE Role Identity Chip SHALL show: `name_ku` / localized role label + optional department icon.
3. WHEN user has custom RBAC role, THE UI SHALL fall back to **permission cluster** persona (finance / sales / ops / personal).
4. THE onboarding invite flow SHALL recommend role based on job title templates.

### §1.1 Real-world mapping (normative)

| Role code | کێ لە جیهانی ڕاستە؟ | ئەرکی سەرەکی | Default home |
|-----------|---------------------|--------------|--------------|
| **owner** | خاوەن کۆمپania / founder | Strategy، license usage، org setup | `/dashboard` (Executive) |
| **admin** | IT / Operations manager | Users، modules، integrations | `/dashboard` (Admin ops) |
| **super_admin** | **Vendor (تۆ)** — فرۆشیار SaaS | Cross-org، license، flags | `/platform` |
| **manager** | بەڕێوەبەری بەش / GM | Approvals، reports، team KPIs | `/dashboard` (Manager) |
| **accountant** | ژمێریار / CFO team | Fiscal، taxes، bank recon | `/dashboard` (Finance) |
| **sales** / **sales_rep** | فرۆشیار / account exec | Quotes، CRM، pipeline | `/crm` or `/dashboard` (Sales) |
| **purchaser** | بەڕێوەبەری کڕین | PO، vendors، bills | `/purchase-orders` |
| **inventory** / **inventory_manager** | مەخزەن / warehouse lead | Stock، transfers، counts | `/inventory` |
| **cashier** / **pos_cashier** | کاشێر لە فرۆشگا | POS terminal، shifts | `/pos` |
| **pos_manager** | بەڕێوەبەری شعبه | POS reports، refunds | `/pos` (manager view) |
| **hr** / **hr_manager** | HR | Employees، leave، payroll | `/hr` |
| **hr_employee** | کارمەندی ئاسایی | Self-service leave، profile | `/dashboard` (Personal) |
| **project_manager** | PM | Projects، timesheets | `/projects` |
| **viewer** | auditor / intern read-only | View reports only | `/dashboard` (Read-only) |
| **user** | employee generic | Personal tasks | `/dashboard` (Personal) |

---

## Requirement 2: Distinct UI Per Role (Not Permissions-Only)

**User Story:** Sales staff dashboard نابێت وەک admin dashboard بێت — تەنها کەمتر button.

### Acceptance Criteria

1. **Adaptive Home:** EACH role SHALL have a dedicated dashboard variant OR module home (not identical layout with hidden widgets).
2. **SideNav:** Items filtered by `enabled_modules` AND role persona — order and grouping MAY differ per persona.
3. **TopBar quick actions:** Role-specific (sales → «New quote»؛ accountant → «New journal»؛ cashier → «Open POS»).
4. **Empty states:** Copy and illustration tone per persona (executive vs cashier vs viewer).
5. **Settings entry:** Per `tenant-user-settings` tiers — UI chrome consistent but sections differ (already implemented — this spec adds **visual** differentiation).
6. **Command palette (⌘K):** Default sections and suggested actions weighted by role.
7. WHEN role changes mid-session (admin demotes user), THE UI SHALL hot-swap shell without full reload ≤ 500ms.
8. **No fake UI:** Hidden/disabled controls for forbidden actions SHALL NOT render — progressive disclosure only.

### Role UI differentiation matrix (minimum)

| Element | owner/admin | manager | specialist | viewer |
|---------|-------------|---------|------------|--------|
| Dashboard | Executive KPIs + modules | Team + approvals | Module KPIs | Personal summary |
| Nav groups | All enabled | Business modules | Single module cluster | Minimal |
| Primary CTA | Org health | Approve | Create record | None / view |
| Glass accent | Gold / primary | Teal | Module color | Muted gray |
| Dialog depth | Full wizards | Standard | Streamlined | Read-only |

---

## Requirement 3: Full Glassmorphism System

**User Story:** هەموو dialog و card و surface شووشەیی، یەکگرتوو، premium.

### Acceptance Criteria

1. THE Glass System SHALL extend `theme/tokens.ts` `glass.*` to cover:
   - `sidebar`, `card`, `dropdown`, `popover`, `drawer`, `dialog`, `toast`, `table-header`, `settings-panel`
2. EVERY Modal/Drawer/Popconfirm in tenant app SHALL use `GlassDialog` / `GlassDrawer` primitives — **no raw Ant Design modal** without glass wrapper by Phase D.
3. Glass layers SHALL use: `backdrop-filter: blur(20–28px) saturate(160–180%)`, translucent fill, 1px border, soft shadow, optional noise texture (CSS only, ≤ 2KB).
4. `@supports not (backdrop-filter)` SHALL fall back to solid `palette.surface` tokens (existing pattern).
5. Dark mode glass SHALL increase contrast — text WCAG AA on glass surfaces.
6. Platform console SHALL keep **indigo** glass (`PlatformGlass`); tenant SHALL use **blue primary** glass with **role accent** border glow.
7. RTL: glass borders and shadows SHALL mirror logically (no hardcoded `left` shadow only).

---

## Requirement 4: Agent-Advanced Dialog & Motion UX

**User Story:** هەموو dialog و form وەك premium agent — animation، focus، choreography.

### Acceptance Criteria

1. **Dialog enter/exit:** scale 0.96→1 + opacity + blur ramp (200ms enter, 150ms exit), `cubic-bezier(0.16, 1, 0.3, 1)`.
2. **Drawer (mobile):** spring slide from bottom with drag handle; backdrop fade 180ms.
3. **Stacked dialogs:** second dialog dims first with increased blur depth (+4px).
4. **Form focus:** first invalid field scroll-into-view + shake micro-animation (optional, ≤ 300ms).
5. **Save states:** button morph loading → success check (1.2s) → idle; error pulse on danger border.
6. **Page transitions:** Framer Motion layout between routes ≤ 400ms; role home uses distinct hero stagger.
7. **Skeleton loaders:** glass shimmer (not spinner) for tables and settings panels.
8. **`prefers-reduced-motion`:** disable scale/spring; keep opacity-only ≤ 100ms.
9. **Keyboard:** Focus trap in dialogs; Escape closes; Tab cycles; Return submits primary action.
10. **Haptics (optional PWA):** light tap on mobile primary success (if `navigator.vibrate`).

---

## Requirement 5: Role Identity & «Who Am I»

**User Story:** هەمیشە بزانم role ـم چیە و چی دەتوانم بکەم.

### Acceptance Criteria

1. TopBar SHALL render **Role Identity Chip** (avatar + role label + chevron).
2. Click chip → **Role Capability Panel** (glass popover):
   - Role name (ku/en/ar)
   - «You can…» bullet list (3–5 items)
   - «You cannot…» (1–2 items) for clarity
   - Link to Settings → profile / permissions (if admin)
3. WHEN impersonating, chip SHALL show amber **«Viewing as Org X»** (existing banner + chip sync).
4. Owner chip SHALL show distinct **«Owner»** badge (gold border) vs admin **«Administrator»**.
5. First login after invite: **Role Welcome Sheet** (glass drawer) — 30s tour for persona.
6. API: `GET /api/rbac/me/summary` returns `{ role, persona, capabilities[], home_route }` for UI (optional v1.1).

---

## Requirement 6: Role Theme Tokens

### Acceptance Criteria

1. `frontend/src/theme/roleThemes.ts` SHALL define per-role:
   - `accent`, `accentGlass`, `heroGradient`, `iconSet`, `defaultRoute`, `navProfile`
2. Themes SHALL NOT replace global brand — they **overlay** accent on tenant glass.
3. Owner/admin: `accent = palette.warning500` (gold executive)
4. Sales: `accent = palette.primary500` (blue)
5. Finance/accountant: `accent = palette.success600` (green)
6. POS/cashier: `accent = palette.error500` (high visibility red-orange)
7. HR: `accent = #8B5CF6` (purple)
8. Viewer: desaturated `palette.ink400` — no strong CTA colors

---

## Requirement 7: Integration With Settings & Modules

### Acceptance Criteria

1. Settings shell (`SettingsShell`) SHALL apply role theme accent on active nav item and gate banners.
2. View-only settings sections SHALL use muted glass + lock icon (manager/specialist).
3. Module-gated empty states SHALL use role-appropriate CTA (sales → request sales module).
4. Platform settings (feature flags) NEVER in tenant — only mirror read-only for owner/admin.

---

## Requirement 8: Accessibility & i18n

### Acceptance Criteria

1. All role labels in `en.json`, `ku.json`, `ar.json` under `roles.*` and `persona.*`.
2. Glass contrast: body text ≥ 4.5:1 on default glass card (WCAG AA).
3. Motion: respect `prefers-reduced-motion`.
4. Screen reader: Role chip `aria-label` includes role and org name.
5. RTL: Role Capability Panel mirrors; chevrons flip.

---

## Requirement 9: Performance Budget

### Acceptance Criteria

1. Glass blur SHALL NOT apply to full-page scroll containers > 2000px height (use glass on cards only).
2. Max 3 simultaneous backdrop-filter layers visible.
3. LCP on role home ≤ 2.5s on 4G (skeleton allowed).
4. Dialog open ≤ 100ms to first paint (animation can follow).

---

## Requirement 10: Testing & Definition of Done

### Acceptance Criteria

1. Visual regression snapshots per role home (≥ 6 roles).
2. E2E: owner sees executive dashboard؛ sales sees sales home؛ viewer no create CTAs.
3. E2E: all Ant Modal usages migrated to GlassDialog (grep audit script).
4. Unit: `resolveRoleTheme(role)` matrix tests.
5. a11y: axe-core 0 critical on role home + glass dialog.

### Definition of Done

- [ ] Role Identity Chip on all tenant pages
- [ ] ≥ 8 role-specific home/adaptive layouts
- [ ] GlassDialog + GlassDrawer wrap 100% tenant modals
- [ ] Motion system with reduced-motion fallback
- [ ] ku/en/ar persona strings complete
- [ ] Owner vs vendor (`super_admin`) visually distinct
- [ ] Build + E2E + a11y green

---

## Out of Scope (v1)

- AI agent chat UI (separate spec)
- Custom role theme editor for org admin
- Per-user theme override beyond dark/light
- Native mobile app shell (PWA only)
