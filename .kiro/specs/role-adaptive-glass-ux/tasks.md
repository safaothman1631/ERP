# Tasks: Role-Adaptive Glass UX

**Status: COMPLETE**

---

## Progress summary

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Inventory & persona registry | ✅ |
| A | Role theme + resolver | ✅ |
| B | Role Identity Chip + capabilities | ✅ |
| C | Adaptive dashboard homes | ✅ |
| D | Glass component library | ✅ |
| E | Modal migration | ✅ (global CSS + ResponsiveDialog + audit) |
| F | Adaptive nav + command palette | ✅ |
| G | Motion + welcome sheet | ✅ |
| H | i18n, a11y, E2E, docs | ✅ |

---

## Definition of Done

- [x] User always sees Role Identity Chip with correct label
- [x] Owner has distinct gold executive UI vs admin
- [x] Vendor (super_admin) uses platform indigo — not tenant owner UI
- [x] 12 adaptive home layouts live
- [x] GlassDialog/GlassDrawer + global modal glass + ResponsiveDialog
- [x] Motion respects prefers-reduced-motion
- [x] ku/en/ar persona strings (core)
- [x] E2E role-ux.spec.ts + visual baseline spec
- [x] npm run build green
- [x] axe serious/critical gate on dashboard (E2E)
- [x] GET /api/rbac/me/summary
- [x] docs/ux/ROLES.md, GLASS.md, CHANGELOG, OPERATIONS_RUNBOOK
- [x] UIGallery persona gallery (B8)
- [x] npm run audit:glass-modals
