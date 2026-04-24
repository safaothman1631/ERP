# UX Audit — 2026-Q2
**Agent:** ERP UX Designer | **Date:** 2026-04-24

## A. Coverage

| Feature | Status | Notes |
|---------|--------|-------|
| Dark Mode | ✅ Partial | theme toggle + AppConfigProvider, NO auto/system preference |
| PWA | ⚠️ Partial | manifest.webmanifest + sw.js manual, NO vite-plugin-pwa, NO install prompt UI |
| Ctrl+K | ✅ Complete | CommandPalette implemented, Ctrl+K working |
| a11y | ⚠️ Partial | Keyboard nav exists, NO skip links, NO ARIA audit, NO focus trap |
| Mobile | ✅ Good | useIsMobile hook, responsive layout, collapsible sidebar |
| RTL | ✅ Complete | ConfigProvider direction="rtl", Kurdish/Arabic support |
| Design System | ✅ Good | design-system/ folder with 8 components (EmptyState, KpiCard, etc.) |

## B. Top 10 Gaps

| ID | Sev | Title | File | Effort |
|----|-----|-------|------|--------|
| UX-01 | High | Dashboard widgets grid missing | pages/Dashboard.tsx | 8h |
| UX-02 | High | Onboarding tour missing | App.tsx | 6h |
| UX-03 | Med | Keyboard shortcuts help modal missing | layouts/AppShell.tsx | 4h |
| UX-04 | Med | Loading Skeleton not used | pages/*.tsx | 3h |
| UX-05 | Med | PWA install prompt missing | main.tsx | 2h |
| UX-06 | Low | Tag size inline style (deprecated AntD 6) | pos/LoyaltyCardLookup.tsx, AuditLog.tsx | 1h |
| UX-07 | Med | Auto theme (system preference) missing | store.ts | 2h |
| UX-08 | Med | Celebration animations missing | design-system/ | 3h |
| UX-09 | Low | Global shortcuts (G+I, G+C) missing | layouts/AppShell.tsx | 3h |
| UX-10 | Low | vite-plugin-pwa not configured | vite.config.ts | 2h |

## C. Quick Wins (max 8)

1. **Add Skeleton loading** — Replace Card loading={true} with Skeleton (1h)
2. **Remove Tag size props** — Use style={{fontSize}} inline per AntD 6.3 (30m)
3. **Add auto theme** — store.ts: theme: 'light'|'dark'|'auto', detect prefers-color-scheme (1h)
4. **PWA install banner** — Show prompt on beforeinstallprompt event (1h)
5. **Keyboard shortcuts modal** — Ctrl+/ to show shortcuts list (2h)
6. **Empty state illustrations** — Add friendly SVG to EmptyState component (1h)
7. **Toast notification position** — ConfigProvider notification placement (30m)
8. **Command palette shortcuts** — Add actions like "New Invoice" to Ctrl+K results (1h)

## D. Big Rocks (max 8)

1. **Dashboard widgets grid** — react-grid-layout, drag-drop, resize, widget catalog (12h)
2. **Onboarding tour** — react-joyride, 5-step guided tour for new users (8h)
3. **Global keyboard shortcuts** — react-hotkeys-hook, G+I → Invoices, Ctrl+N → New (6h)
4. **Confetti celebrations** — canvas-confetti on payment received, invoice sent (2h)
5. **A11y audit pass** — Skip links, focus trap modals, ARIA landmarks, screen reader test (8h)
6. **Custom templates UI** — Invoice/email template editor with live preview (16h)
7. **Advanced animations** — Page transitions (Framer Motion AnimatePresence), micro-interactions (6h)
8. **Custom dashboards builder** — Drag widgets, save layouts, multiple dashboards (20h)

## E. Odoo UX Features Missing (max 10)

1. Studio-like widget builder (drag fields, customize views)
2. Kanban board drag-drop (CRM, tasks)
3. Gantt chart views (projects, manufacturing)
4. Calendar view (meetings, events)
5. Activity chatter/timeline (bottom of forms)
6. Form view automation rules (conditional visibility)
7. Smart buttons (top of form: "5 Invoices")
8. Breadcrumb navigation (top bar)
9. Favorites/bookmarks (star icon, save filters)
10. Advanced filter builder (domain syntax UI)

## F. Zoho UX Patterns Missing (max 10)

1. Custom views builder (save column order, filters)
2. Automation workflows UI (visual builder)
3. Zoho Flow integration panel
4. Blueprints (visual process designer)
5. Deluge scripting UI (custom functions)
6. Email templates with drag-drop designer
7. Multi-level approval workflows UI
8. Multi-currency switcher widget (top bar)
9. Scheduled reports UI (email at 9 AM every Monday)
10. Dashboard sharing (role-based dashboard templates)

## G. Counts

- **Components in design-system/:** 8 (PageHeader, KpiCard, StatusTag, EmptyState, MoneyInput, FilterBar, DataTable, ConfirmDialog)
- **Deprecated AntD 6.3 props found:** 2 (Tag size in 2 files)
- **Pages with mobile support:** ~80+ (via useIsMobile hook)
- **Keyboard shortcuts implemented:** 1 (Ctrl+K)
- **PWA features implemented:** 2/4 (manifest ✅, sw ✅, install prompt ❌, vite-plugin-pwa ❌)
- **Dark mode coverage:** Theme toggle ✅, system preference ❌
- **Onboarding tour steps:** 0 (not implemented)
- **Dashboard widgets:** 6 static (no grid, no drag-drop)

## H. Lead + Skills

**Lead:** ERP UX Designer + دەڤەلۆپەر (frontend)  
**Skills:** `.github/skills/frontend/react19-patterns.md`, `.github/skills/frontend/antd-rtl-patterns.md`, `.github/skills/testing/e2e-playwright.md`  
**Priority:** Quick Wins → Dashboard widgets → Onboarding → Keyboard shortcuts → A11y audit
