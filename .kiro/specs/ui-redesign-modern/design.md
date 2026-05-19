# Design Document — UI Redesign Modern

## Overview

This document describes the technical design for the complete UI/UX redesign of the Zoho ERP system targeting the Iraqi and Kurdistan market. The redesign is a **frontend-only** change — no Backend API modifications. The goal is a modern, professional, and accessible ERP that feels fast and natural for Kurdish Sorani (RTL), Arabic (RTL), and English (LTR) users.

The system is built on React 19 + TypeScript + Vite, Ant Design 6, Zustand 5, React Router 7, i18next 26, Framer Motion 12, and recharts 3. The redesign introduces a unified Design Token system, a Glass Morphism visual language, a Command Palette, advanced Skeleton Loading, and property-based correctness guarantees.

### Key Design Principles

1. **Token-first** — every color, spacing, and motion value lives in `theme/tokens.ts`. No inline values anywhere.
2. **RTL-native** — the system is designed RTL-first (Kurdish Sorani is the default language) with LTR as a secondary direction.
3. **Performance-first** — initial bundle < 300 KB gzipped, LCP ≤ 2s on Slow 4G, code-split per route.
4. **Accessibility-first** — WCAG AA throughout, Lighthouse accessibility ≥ 95.
5. **Reduced-motion respect** — all animations are gated on `prefers-reduced-motion`.

---

## Architecture

### High-Level Component Hierarchy

```
App.tsx
└── QueryClientProvider
    └── ConfigProvider (AntD — theme tokens, direction, font)
        └── AntApp
            └── BrowserRouter
                └── Suspense (route-level code splitting)
                    └── AnimatePresence (page transitions)
                        └── Routes
                            ├── AuthLayout          ← /login, /signup, /forgot-password
                            │   └── LoginPage
                            └── AppShell            ← all authenticated routes
                                ├── SideNav
                                ├── TopBar
                                │   ├── OrgSwitcher
                                │   ├── BranchSwitcher
                                │   ├── QuickSearch (⌘K trigger)
                                │   ├── NotificationsDrawer trigger
                                │   ├── LanguageSwitcher
                                │   └── ThemeToggle
                                ├── CommandPalette  ← global overlay
                                ├── NotificationsDrawer
                                └── Layout.Content
                                    └── <Outlet />  ← lazy-loaded feature pages
```

### Data Flow

```
User Action
    │
    ▼
Zustand Store (uiStore / authStore / navStore)
    │
    ▼
React Component re-render
    │
    ├── AntD ConfigProvider (theme tokens, direction)
    ├── Framer Motion (page transitions, micro-interactions)
    └── i18next (translated strings, RTL/LTR direction)
```

### State Management Architecture

| Store | Responsibility | Persisted |
|---|---|---|
| `useAuthStore` | user, token, theme, layoutMode | localStorage |
| `useUiStore` | sidebarCollapsed, density, language | localStorage |
| `useNavStore` | favorites[], recents[] | localStorage |
| `useOrgStore` | currentOrg, currentBranch | localStorage |
| `useNotificationsStore` | notifications, unread count | session |
| `useCommandStore` | palette open/close, query | session |
| `useDraftsStore` | form drafts by entity+id | localStorage |

---

## Components and Interfaces

### Folder Structure

```
frontend/src/
├── theme/
│   ├── tokens.ts              ← single source of truth for all design values
│   ├── AppConfigProvider.tsx  ← AntD ConfigProvider wrapper (tokens → AntD theme)
│   └── globalStyles.css       ← CSS reset, RTL fixes, focus ring, print base
│
├── design-system/             ← reusable atoms and molecules
│   ├── index.ts               ← barrel export
│   ├── PageHeader.tsx
│   ├── FilterBar.tsx
│   ├── DataTable.tsx          ← ProTable-style wrapper around AntD Table
│   ├── EditableLineItems.tsx  ← drag-reorder editable table for form line items
│   ├── KpiCard.tsx            ← title + value + delta + sparkline + icon
│   ├── StatusTag.tsx          ← semantic status chip (paid/draft/overdue/…)
│   ├── EmptyState.tsx         ← illustration + headline + CTA
│   ├── ConfirmDialog.tsx      ← danger/neutral confirmation modal
│   ├── MoneyInput.tsx         ← IQD/USD multi-currency input
│   ├── MoneyDisplay.tsx       ← formatted money with bdi wrapper
│   ├── DateRangePickerRTL.tsx ← RTL-aware date range picker
│   ├── EntitySelect.tsx       ← async select for Customer/Item/Account
│   ├── AttachmentDrop.tsx     ← file upload with drag-and-drop
│   ├── AuditTimeline.tsx      ← event timeline for detail pages
│   ├── LoadingSkeleton.tsx    ← row/card/chart/table skeleton variants
│   ├── OptimizedImage.tsx     ← lazy + WebP/JPEG fallback image
│   ├── BulkActionBar.tsx      ← bulk actions toolbar for list pages
│   ├── ExportMenu.tsx         ← CSV/Excel/PDF export dropdown
│   ├── FormLayout.tsx         ← two-column form + sticky summary panel
│   ├── PrintView.tsx          ← print template wrapper
│   └── ChartCard.tsx          ← recharts wrapper with skeleton + error state
│
├── layouts/
│   ├── AppShell.tsx           ← Sidebar + Topbar + Outlet composition
│   ├── SideNav.tsx            ← collapsible sectioned navigation
│   ├── TopBar.tsx             ← sticky topbar with glass morphism
│   ├── CommandPalette.tsx     ← ⌘K global search overlay
│   ├── NotificationsDrawer.tsx
│   ├── OrgSwitcher.tsx
│   ├── QuickCreateMenu.tsx
│   └── AuthLayout.tsx         ← 50/50 split-screen for auth pages
│
├── features/                  ← feature-sliced modules
│   ├── sales/
│   │   ├── invoices/
│   │   │   ├── InvoicesList.tsx
│   │   │   ├── InvoiceDetail.tsx
│   │   │   ├── InvoiceForm.tsx
│   │   │   ├── hooks.ts
│   │   │   └── api.ts
│   │   └── …
│   ├── purchases/ inventory/ accounting/ banking/ crm/ pos/ hr/ mfg/ projects/ reports/ iraq/ settings/
│
├── pages/                     ← thin route components (re-export from features)
├── stores/                    ← Zustand stores
├── hooks/                     ← shared hooks
├── utils/                     ← format.ts, message.ts, permissions.ts
└── locales/
    ├── ku/                    ← Kurdish Sorani (default, RTL)
    ├── en/                    ← English (LTR)
    └── ar/                    ← Arabic (RTL)
```

### Key Component Interfaces

```typescript
// KpiCard
interface KpiCardProps {
  title: string;
  value: number;
  delta?: number;          // percentage change
  sparklineData?: number[];
  icon?: React.ReactNode;
  currency?: 'IQD' | 'USD';
  loading?: boolean;
  onClick?: () => void;
}

// LoadingSkeleton
type SkeletonVariant = 'row' | 'card' | 'chart' | 'table';
interface LoadingSkeletonProps {
  variant: SkeletonVariant;
  rows?: number;           // for 'table' variant
  isDark?: boolean;
}

// DataTable (ProTable wrapper)
interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  dataSource: T[];
  loading?: boolean;
  rowSelection?: boolean;
  onBulkAction?: (action: string, keys: React.Key[]) => void;
  exportConfig?: ExportConfig;
  virtualize?: boolean;    // auto-enabled for ≥200 rows
  stickyHeader?: boolean;
}

// CommandPalette
interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

// GlassMorphism style helper
interface GlassStyle {
  backdropFilter: string;
  background: string;
  border: string;
  boxShadow: string;
}
export const getGlassStyle = (mode: 'light' | 'dark', blur: number): GlassStyle
```

---

## Data Models

### Design Token Structure (`theme/tokens.ts`)

The token file exports these top-level objects, all typed as `const`:

```typescript
export const palette      // brand + semantic + neutral color scales
export const space        // named spacing aliases (xxs → xxxl)
export const spacing      // numeric 4pt grid (0 → 128)
export const radius       // border radius scale (xs → pill)
export const fontFamily   // rtl / ltr / mono stacks
export const fontSize     // xs → 5xl + legacy h1-h4 aliases
export const fontWeight   // light → extrabold
export const lineHeight   // unitless + pixel variants
export const controlHeight // compact / default / comfort
export const duration     // instant / fast / normal / slow / verySlow
export const motion       // legacy aliases (kept for compat)
export const easing       // standard / emphasized / decelerate / accelerate
export const shadow       // none / sm / md / lg / xl + dark variants
export const status       // success / warning / danger / info / neutral surfaces
export const zIndex       // base → tooltip scale
export const typography   // semantic ramp (display → overline)
export const dataViz      // categorical / sequential / diverging palettes
export const elevation    // flat → popover + dark variants
export const transitions  // micro / base / emph shorthand strings
export const layout       // topbarHeight / sidebarWidth / sidebarCollapsed / …
export const a11y         // minTouchTarget / focusRingWidth / focusRingColor
export type Density = 'compact' | 'default' | 'comfort'
export const buildAntTokens  // (mode, density, isRTL) → AntD token object
export const buildAntComponents // (mode) → AntD component overrides
```

### Zustand Store Shapes

```typescript
// uiStore — persisted to localStorage
interface UiState {
  sidebarCollapsed: boolean;
  density: 'compact' | 'comfortable' | 'spacious';
  language: 'ku' | 'en' | 'ar';
  setSidebarCollapsed: (v: boolean) => void;
  setDensity: (d: UiState['density']) => void;
  setLanguage: (l: UiState['language']) => void;
}

// navStore — persisted to localStorage
interface NavState {
  favorites: NavItem[];   // max 10
  recents: NavItem[];     // max 5
  pin: (item: NavItem) => void;
  unpin: (key: string) => void;
  addRecent: (item: NavItem) => void;
}

// draftsStore — persisted to localStorage
interface DraftsState {
  drafts: Record<string, Record<string, unknown>>;  // entity → id → payload
  saveDraft: (entity: string, id: string, payload: unknown) => void;
  clearDraft: (entity: string, id: string) => void;
}
```

### i18n Namespace Map

```typescript
const I18N_NAMESPACES = [
  'common', 'nav', 'auth', 'dashboard', 'sales', 'purchases',
  'inventory', 'accounting', 'banking', 'crm', 'pos', 'hr',
  'payroll', 'manufacturing', 'projects', 'reports', 'settings',
  'errors', 'validation', 'iraq'
] as const;
type I18nNamespace = typeof I18N_NAMESPACES[number];
```

---

## Design Token System

### Token Hierarchy

```
tokens.ts
├── palette          ← raw color values (never used directly in components)
├── semantic tokens  ← status, elevation, shadow (reference palette)
└── component tokens ← buildAntTokens() maps semantic → AntD token API
```

Components must only reference semantic tokens or the AntD token API — never `palette` directly.

### Theme Switching

Theme switching is driven by `useAuthStore.theme` (`'light' | 'dark'`). The `AppConfigProvider` reads this value and passes the result of `buildAntTokens(mode, density, isRTL)` to AntD's `ConfigProvider`. The CSS transition is applied globally:

```css
/* globalStyles.css */
*, *::before, *::after {
  transition: background-color 200ms cubic-bezier(0.2, 0, 0, 1),
              border-color 200ms cubic-bezier(0.2, 0, 0, 1),
              color 200ms cubic-bezier(0.2, 0, 0, 1);
}
```

The `data-theme` attribute on `<html>` enables CSS variable overrides for values outside AntD's token system.

### Density Modes

| Mode | Base Grid | controlHeight | Page Padding |
|---|---|---|---|
| `compact` | 4px | 32px | 16px |
| `comfortable` | 6px | 36px | 20px |
| `spacious` | 8px | 44px | 24px |

`compact` is the ERP default. Density is stored in `uiStore` and passed to `buildAntTokens`.

### Glass Morphism Token

```typescript
// theme/tokens.ts — glass morphism helper
export const glass = {
  topbar: {
    light: { bg: 'rgba(255,255,255,0.82)', blur: 'blur(20px) saturate(160%)', border: 'rgba(15,23,42,0.08)' },
    dark:  { bg: 'rgba(17,26,46,0.86)',    blur: 'blur(20px) saturate(160%)', border: 'rgba(255,255,255,0.12)' },
  },
  palette: {
    light: { bg: 'rgba(255,255,255,0.70)', blur: 'blur(24px)', border: 'rgba(15,23,42,0.08)' },
    dark:  { bg: 'rgba(17,26,46,0.15)',    blur: 'blur(24px)', border: 'rgba(255,255,255,0.12)' },
  },
  login: {
    light: { bg: 'rgba(255,255,255,0.70)', blur: 'blur(16px)', border: 'rgba(15,23,42,0.08)' },
    dark:  { bg: 'rgba(17,26,46,0.70)',    blur: 'blur(16px)', border: 'rgba(255,255,255,0.12)' },
  },
  modal: {
    light: { bg: 'rgba(255,255,255,0.70)', blur: 'blur(20px)', border: 'rgba(15,23,42,0.08)' },
    dark:  { bg: 'rgba(17,26,46,0.86)',    blur: 'blur(20px)', border: 'rgba(255,255,255,0.12)' },
  },
  fallback: {
    light: palette.surface,
    dark:  palette.darkSurface,
  },
} as const;
```

The `@supports (backdrop-filter: blur(1px))` CSS feature query gates glass morphism; the fallback uses the solid `surface` token.

---

## AppShell Layout

### Composition

```
<Layout direction={isRTL ? 'rtl' : 'ltr'}>
  <SideNav collapsed={collapsed} width={240} collapsedWidth={64} />
  <Layout marginInlineStart={sideOffset}>
    <TopBar height={60} sticky glass />
    <Layout.Content>
      <Outlet />
    </Layout.Content>
    <Footer />
  </Layout>
  <CommandPalette />
  <NotificationsDrawer />
</Layout>
```

### Sidebar Behavior

| State | Width | Content |
|---|---|---|
| Expanded (desktop) | 240px | Icons + labels + section headers |
| Collapsed (desktop) | 64px | Icons only + Tooltip on hover |
| Mobile (< 768px) | Drawer overlay | Full width drawer |

The collapsed state is persisted in `uiStore.sidebarCollapsed` (localStorage key `ui.sidebarCollapsed`).

**Favorites** (max 10) and **Recents** (max 5) are stored in `navStore` and rendered at the top of the sidebar. When a new page is visited, `navStore.addRecent()` is called; if recents exceeds 5, the oldest entry is removed (FIFO).

### Topbar

The Topbar is 60px tall, `position: sticky; top: 0; z-index: 1100`. It applies glass morphism via:

```css
.topbar {
  backdrop-filter: blur(20px) saturate(160%);
  background: rgba(255,255,255,0.82);  /* light */
  border-bottom: 1px solid rgba(15,23,42,0.08);
}
[data-theme="dark"] .topbar {
  background: rgba(17,26,46,0.86);
  border-bottom: 1px solid rgba(255,255,255,0.12);
}
@supports not (backdrop-filter: blur(1px)) {
  .topbar { background: var(--color-surface); }
}
```

---

## Language Switcher and RTL/LTR Direction Switching

### Architecture

The language switcher is a controlled component that calls `i18n.changeLanguage(code)`. The direction change is handled in `App.tsx`:

```typescript
const isRTL = ['ku', 'ar'].includes(i18n.language);

useEffect(() => {
  document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', i18n.language);
}, [i18n.language, isRTL]);
```

The AntD `ConfigProvider` receives `direction={isRTL ? 'rtl' : 'ltr'}` which flips all AntD component layouts.

### Language Resolution

```typescript
const VALID_LANGUAGES = ['ku', 'en', 'ar'] as const;
type Language = typeof VALID_LANGUAGES[number];

export function resolveLanguage(code: string): Language {
  if (VALID_LANGUAGES.includes(code as Language)) return code as Language;
  return 'ku'; // default fallback
}
```

### Persistence

Language is persisted in two places:
1. `localStorage['i18n.language']` — restored on page load by i18next's `languageDetector`
2. `uiStore.language` — Zustand persist middleware

If localStorage is unavailable, the in-memory Zustand value is used.

### RTL CSS Strategy

All directional CSS uses logical properties:

```css
/* ✅ Correct */
margin-inline-start: 16px;
padding-inline-end: 8px;
border-inline-start: 2px solid var(--color-primary);

/* ❌ Never */
margin-left: 16px;
padding-right: 8px;
```

Directional icons (chevrons, arrows) use a `.flip-rtl` utility class:

```css
[dir="rtl"] .flip-rtl {
  transform: scaleX(-1);
}
```

---

## Command Palette (⌘K)

### Implementation

The Command Palette uses the existing `cmdk` pattern (already implemented in `layouts/CommandPalette.tsx`). The design specifies:

- Opens with `⌘K` (Mac) / `Ctrl+K` (Windows/Linux) from any page
- Glass morphism background: `backdrop-filter: blur(24px)`
- Fuzzy search across pages, actions, and recent records
- Results appear within 100ms (synchronous in-memory search)
- Full keyboard navigation: ↑↓ to move, Enter to select, Escape to close
- Focus trap while open; focus returns to trigger on close

### Search Index

```typescript
interface CommandItem {
  id: string;
  label: string;           // translated label
  labelEn: string;         // English label for fuzzy matching
  category: 'page' | 'action' | 'recent';
  icon?: React.ReactNode;
  shortcut?: string;
  action: () => void;
}
```

The search index is built once on mount from `navDestinations` + quick actions + recent records from `navStore.recents`. Fuzzy matching uses a simple substring/trigram approach (no external library needed for < 500 items).

### Accessibility

- `role="dialog"` with `aria-modal="true"` and `aria-label`
- Focus trapped with a focus sentinel pattern
- `aria-activedescendant` tracks the highlighted item
- `aria-live="polite"` announces result count changes

---

## Skeleton Loader System

### Variants

| Variant | Use Case | Shape |
|---|---|---|
| `row` | List items, table rows | Horizontal bars of varying width |
| `card` | KPI cards, summary cards | Rectangular block with header + body |
| `chart` | recharts areas | Rectangular block with axis lines |
| `table` | DataTable loading | Header row + N body rows |

### Shimmer Animation

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.skeleton {
  background: linear-gradient(
    90deg,
    var(--skeleton-base) 25%,
    var(--skeleton-highlight) 50%,
    var(--skeleton-base) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

[dir="rtl"] .skeleton {
  animation-direction: reverse; /* right-to-left sweep in RTL */
}

@media (prefers-reduced-motion: reduce) {
  .skeleton { animation: none; }
}
```

Light mode: `--skeleton-base: #E2E8F0; --skeleton-highlight: #F1F5F9`
Dark mode: `--skeleton-base: rgba(255,255,255,0.06); --skeleton-highlight: rgba(255,255,255,0.12)`

### Loading Threshold Logic

```typescript
// hooks/useLoadingState.ts
export function useLoadingState(isLoading: boolean) {
  const [showSkeleton, setShowSkeleton] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (isLoading) {
      timerRef.current = setTimeout(() => setShowSkeleton(true), 300);
    } else {
      clearTimeout(timerRef.current);
      setShowSkeleton(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [isLoading]);

  return showSkeleton;
}
```

If data loads in < 300ms, neither skeleton nor spinner is shown. If ≥ 300ms, the appropriate skeleton variant is shown. If ≥ 5000ms, an error state with retry is shown.

---

## Page Transition Strategy

### Implementation

Page transitions use Framer Motion's `AnimatePresence` with `mode="wait"` (already in `App.tsx`). Each page is wrapped in a `PageTransition` component:

```typescript
// components/PageTransition.tsx
const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: -8 },
};

const pageTransition = {
  duration: 0.2,
  ease: [0.2, 0, 0, 1],
};

export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) return <>{children}</>;
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
};
```

The `AnimatePresence mode="wait"` ensures the exit animation completes before the enter animation starts (sequential, not simultaneous).

### Reduced Motion

All Framer Motion components check `useReducedMotion()` from Framer Motion. When `prefers-reduced-motion: reduce` is set, transitions are instant (duration: 0).

---

## React Bits + Framer Motion Integration

### React Bits Usage

React Bits (`react-bits` ^1.0.0) provides ready-made animation components. The integration strategy:

| Effect | React Bits Component | Used In |
|---|---|---|
| Typewriter text | `<Typewriter>` | Login hero, Dashboard hero |
| Gradient text | `<GradientText>` | KPI values, section headings |
| Shimmer text | `<ShimmerText>` | Loading states, skeleton labels |
| Counter animation | `<CountUp>` | KPI card values |
| Particle background | `<Particles>` | Login branding side, Dashboard hero |

All React Bits components are wrapped in a `MotionGate` HOC that checks `prefers-reduced-motion` and renders the final state immediately if motion is disabled:

```typescript
// components/MotionGate.tsx
export function MotionGate<P>({ Component, fallback, ...props }: MotionGateProps<P>) {
  const prefersReducedMotion = useReducedMotion();
  if (prefersReducedMotion) return fallback ?? null;
  return <Component {...(props as P)} />;
}
```

### Framer Motion Usage

Framer Motion handles:
- Page transitions (AnimatePresence + motion.div)
- Sidebar collapse/expand (layout animation)
- Modal/Drawer entrance (spring ease)
- Micro-interactions (hover/tap variants on buttons and cards)

```typescript
// Micro-interaction variants for buttons
const buttonVariants = {
  rest:    { y: 0, boxShadow: shadow.sm },
  hover:   { y: -2, boxShadow: shadow.md, transition: { duration: 0.15 } },
  pressed: { y: 1, boxShadow: shadow.none, transition: { duration: 0.05 } },
};
```

---

## Dashboard and KPI Cards

### KPI Card Structure

```
┌─────────────────────────────────────┐
│ [Icon]  Title              Delta %  │
│         ████████ Value              │
│         ▁▂▃▄▅▆▇ Sparkline          │
└─────────────────────────────────────┘
```

The value uses `<CountUp>` from React Bits (or Framer Motion's `useMotionValue` + `useTransform` as fallback). The sparkline uses recharts `<AreaChart>` with minimal axes.

### Dashboard Grid

12-column CSS Grid with responsive breakpoints:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
}
.kpi-card { grid-column: span 3; }  /* 4 per row on desktop */
.chart-card { grid-column: span 6; } /* 2 per row on desktop */

@media (max-width: 1024px) {
  .kpi-card { grid-column: span 6; }
}
@media (max-width: 768px) {
  .kpi-card { grid-column: span 12; }
  .chart-card { grid-column: span 12; }
}
```

---

## ProTable / List Pages

### Anatomy

Every list page follows this structure:

```
<PageHeader title actions />
<FilterBar filters savedViews />
<BulkActionBar visible={selectedRows.length > 0} />
<DataTable
  columns={columns}
  dataSource={data}
  loading={isLoading}
  rowSelection
  stickyHeader
  virtualize={data.length >= 200}
/>
<Pagination />
```

### Virtualization

For datasets ≥ 200 rows, `DataTable` automatically enables `rc-virtual-list` (already a dependency of AntD). The threshold is checked in `DataTable`:

```typescript
const shouldVirtualize = dataSource.length >= 200 || props.virtualize;
```

### Column Actions

Row hover reveals quick actions via CSS opacity transition:

```css
.table-row-actions { opacity: 0; transition: opacity 150ms; }
.ant-table-row:hover .table-row-actions { opacity: 1; }
```

---

## Form Pages and Auto-Save

### Two-Column Layout

```
┌──────────────────────────┬──────────────┐
│  Main Form (8 cols)      │ Summary      │
│  ┌─ Header fields ─────┐ │ Panel        │
│  │ Customer, Date, Ref  │ │ (4 cols,     │
│  └─────────────────────┘ │  sticky)     │
│  ┌─ Line Items ─────────┐ │              │
│  │ EditableTable        │ │ Subtotal     │
│  │ + drag handles       │ │ Tax          │
│  └─────────────────────┘ │ Total        │
│  ┌─ Footer fields ──────┐ │              │
│  │ Notes, Terms         │ │ [Save ▼]    │
│  └─────────────────────┘ │              │
└──────────────────────────┴──────────────┘
```

### Auto-Save Implementation

```typescript
// hooks/useAutoSave.ts
export function useAutoSave(entity: string, id: string, formValues: unknown) {
  const saveDraft = useDraftsStore(s => s.saveDraft);
  const showToast = useToast();

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        saveDraft(entity, id, formValues);
      } catch {
        showToast({ type: 'error', message: t('errors.autoSaveFailed') });
      }
    }, 30_000);
    return () => clearInterval(timer);
  }, [entity, id, formValues, saveDraft, showToast]);
}
```

### Unsaved Changes Guard

React Router's `useBlocker` is used to intercept navigation when the form has unsaved changes:

```typescript
const blocker = useBlocker(isDirty);
// When blocker.state === 'blocked', show ConfirmDialog
```

---

## Login Page Redesign

### Layout

```
┌─────────────────────┬─────────────────────┐
│  Branding Side      │  Form Side          │
│  (50%, hidden <768) │  (50%, full <768)   │
│                     │                     │
│  [Particles bg]     │  [Glass card]       │
│  Company logo       │  ┌───────────────┐  │
│  Tagline            │  │ Email         │  │
│  Typewriter text    │  │ Password      │  │
│                     │  │ [Login btn]   │  │
│                     │  └───────────────┘  │
│                     │                     │
│                     │  [LanguageSwitcher] │
└─────────────────────┴─────────────────────┘
```

### Login Lock Logic

```typescript
interface LoginAttemptState {
  count: number;
  lockedUntil: number | null;  // timestamp
}

function isLocked(state: LoginAttemptState): boolean {
  if (state.lockedUntil === null) return false;
  return Date.now() < state.lockedUntil;
}

function recordFailedAttempt(state: LoginAttemptState): LoginAttemptState {
  const newCount = state.count + 1;
  if (newCount >= 5) {
    return { count: newCount, lockedUntil: Date.now() + 15 * 60 * 1000 };
  }
  return { count: newCount, lockedUntil: null };
}
```

---

## Print Templates

### Structure

Each print template is a React component that renders a clean A4 document:

```typescript
interface PrintTemplateProps {
  document: Invoice | Quote | Bill | PurchaseOrder | Receipt;
  company: CompanyInfo;
  isRTL: boolean;
  currency: 'IQD' | 'USD';
}
```

### Print CSS

```css
/* print.css */
@media print {
  .sidebar, .topbar, .no-print { display: none !important; }
  .print-only { display: block !important; }
  @page { size: A4; margin: 20mm; }
  body { font-size: 12pt; }
}
```

The `PrintView` component wraps the template and calls `window.print()`. Navigation and sidebar are hidden via the `@media print` rules.

---

## Performance Strategy

### Code Splitting

Every feature route uses `React.lazy`:

```typescript
// App.routes.tsx
const InvoicesList = lazy(() => import('./features/sales/invoices/InvoicesList'));
const InvoiceForm  = lazy(() => import('./features/sales/invoices/InvoiceForm'));
// … all ~75 pages
```

Each lazy boundary is wrapped in `<Suspense fallback={<LoadingSkeleton variant="table" />}>`.

### Bundle Budget

| Chunk | Target |
|---|---|
| Initial (vendor + shell) | < 300 KB gzipped |
| Per-feature chunk | < 50 KB gzipped |
| AntD (tree-shaken) | < 120 KB gzipped |
| Framer Motion | < 30 KB gzipped |

Vite's `build.rollupOptions.output.manualChunks` splits AntD, recharts, and framer-motion into separate vendor chunks.

### Memoization Strategy

- `React.memo` on all design-system components (KpiCard, StatusTag, DataTable rows)
- `useMemo` for column definitions, filter options, and formatted values
- `useCallback` for event handlers passed to memoized children
- `React.memo` is applied when profiling shows render time ≥ 50ms

### Image Optimization

All images use `OptimizedImage` (already in design-system):

```typescript
<OptimizedImage
  src="/logo.webp"
  fallback="/logo.png"
  loading="lazy"
  width={120}
  height={40}
  alt={t('common.companyLogo')}
/>
```

---

## Accessibility (WCAG AA) Implementation

### Focus Ring

Applied globally via CSS:

```css
:focus-visible {
  outline: 2px solid var(--color-primary-500);
  outline-offset: 2px;
  border-radius: 4px;
}
:focus:not(:focus-visible) {
  outline: none;
}
```

### ARIA Roles

| Component | ARIA Role |
|---|---|
| Modal/Dialog | `role="dialog" aria-modal="true"` |
| SideNav | `role="navigation" aria-label` |
| CommandPalette | `role="dialog" aria-modal="true"` |
| DataTable | `role="grid"` |
| StatusTag | `role="status"` |
| BulkActionBar | `role="toolbar"` |
| Toast/Alert | `role="alert" aria-live="assertive"` |
| Dropdown menu | `role="menu"` + `role="menuitem"` |

### Focus Management

Modal and overlay components use a focus trap pattern:

```typescript
// hooks/useFocusTrap.ts
export function useFocusTrap(containerRef: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active || !containerRef.current) return;
    const focusable = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0] as HTMLElement;
    const last = focusable[focusable.length - 1] as HTMLElement;
    first?.focus();
    // Tab/Shift+Tab cycling logic
  }, [active]);
}
```

### Touch Targets

All interactive elements on mobile have `min-height: 44px; min-width: 44px` enforced via the `a11y.minTouchTarget` token.

---

## i18n/l10n Architecture

### Namespace Loading Strategy

Namespaces are loaded lazily per route to keep the initial bundle small:

```typescript
// i18n.ts
i18n.use(Backend).init({
  defaultNS: 'common',
  ns: ['common'],  // only common loaded initially
  backend: { loadPath: '/locales/{{lng}}/{{ns}}.json' },
  fallbackLng: 'ku',
  fallbackNS: 'common',
  interpolation: { escapeValue: false },
});

// Each feature loads its namespace on mount:
// useTranslation(['sales', 'common'])
```

### Number and Currency Formatting

```typescript
// utils/format.ts
export function formatMoney(amount: number, currency: 'IQD' | 'USD', lang: Language): string {
  const locale = lang === 'en' ? 'en-US' : 'ar-IQ';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'IQD' ? 0 : 2,
  }).format(amount);
}

export function formatDate(date: Date | string, lang: Language): string {
  return dayjs(date).locale(lang === 'ku' ? 'ar' : lang).format('DD MMM YYYY');
}
```

### Mixed-Direction Strings

Numbers embedded in Kurdish/Arabic text are wrapped with `<bdi>`:

```typescript
// design-system/MoneyDisplay.tsx
export const MoneyDisplay: React.FC<{ amount: number; currency: string }> = ({ amount, currency }) => (
  <span>
    <bdi>{formatMoney(amount, currency, i18n.language)}</bdi>
  </span>
);
```

### Locale Completeness CI Check

A Vitest test (`i18n.integration.test.ts`) verifies that every key present in `ku/` also exists in `en/` and `ar/`, and vice versa. This runs in CI and blocks deployment on failure.

---

## Error Handling

### Error Boundary

`ErrorBoundary` (already in `components/ErrorBoundary.tsx`) wraps the `<Outlet>` in AppShell. On error it renders a friendly screen with:
- Translated error message
- "Retry" button (resets error boundary state)
- "Go to Dashboard" link

### API Error Handling

All API calls go through `api.ts` which uses axios interceptors:

```typescript
// api.ts
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) authStore.logout();
    if (error.response?.status >= 500) showErrorToast(t('errors.serverError'));
    return Promise.reject(error);
  }
);
```

### Form Validation

Forms use AntD Form's built-in validation with i18n error messages. A summary banner at the top of the form lists all validation errors when the user attempts to submit an invalid form.

---

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

Unit tests focus on:
- Design token correctness (token values, buildAntTokens output)
- Utility functions (formatMoney, formatDate, resolveLanguage)
- Store logic (navStore favorites/recents limits, draftsStore auto-save)
- Component rendering (skeleton variants, KpiCard structure, StatusTag)
- Accessibility (aria attributes, focus management)

### Property-Based Tests (fast-check)

Property-based tests (using `fast-check`, already in devDependencies) verify universal correctness properties. Each test runs a minimum of 100 iterations. Tests are tagged with the design property they validate.

### Integration Tests

Integration tests verify:
- i18n locale completeness (all keys present in all three locales)
- Route code-splitting (all feature routes use React.lazy)
- RTL audit (no `left`/`right` CSS properties outside tokens.ts)

### E2E Tests (Playwright)

Playwright smoke flows:
- Login → Dashboard → Create Invoice → Mark Paid → Print
- Language switch (ku → en → ar) with RTL/LTR verification
- Command Palette (⌘K) navigation
- Accessibility audit (axe-core)

### Storybook

All design-system components have Storybook stories covering:
- Default state
- Dark mode
- RTL mode
- Loading state
- Empty state
- Error state

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Theme modes produce distinct background colors

*For any* density mode and RTL setting, `buildAntTokens('light', density, isRTL).colorBgBase` must not equal `buildAntTokens('dark', density, isRTL).colorBgBase`.

**Validates: Requirements 1.2**

### Property 2: Density modes produce distinct control heights

*For any* theme mode and RTL setting, `buildAntTokens(mode, 'compact', isRTL).controlHeight` must be strictly less than `buildAntTokens(mode, 'comfortable', isRTL).controlHeight`.

**Validates: Requirements 1.5**

### Property 3: RTL font family contains Vazirmatn; LTR contains Inter

*For any* theme mode and density, `buildAntTokens(mode, density, true).fontFamily` must include the string `'Vazirmatn'`, and `buildAntTokens(mode, density, false).fontFamily` must include the string `'Inter'`.

**Validates: Requirements 1.7**

### Property 4: Theme and density preferences round-trip through localStorage

*For any* valid theme value (`'light'` or `'dark'`) and density value (`'compact'`, `'comfortable'`, or `'spacious'`), setting the value in `uiStore` must result in `localStorage.getItem('ui.theme')` and `localStorage.getItem('ui.density')` returning those exact values.

**Validates: Requirements 1.9**

### Property 5: Reduced-motion disables all animation durations

*For any* animation configuration object, when `shouldReduceMotion()` returns `true`, the resolved animation duration must be `0` (or the animation must not be applied).

**Validates: Requirements 2.5, 7.6, 9.7**

### Property 6: All non-page-transition duration tokens are ≤ 300ms

*For any* duration token in `tokens.ts` that is not the page-transition token (`verySlow`), its value must be ≤ 300.

**Validates: Requirements 2.6, 7.7**

### Property 7: RTL languages set dir="rtl" on the html element

*For any* language code in `['ku', 'ar']`, calling `changeLanguage(code)` must result in `document.documentElement.getAttribute('dir') === 'rtl'`.

**Validates: Requirements 3.5**

### Property 8: Language selection persists to localStorage

*For any* language code in `['ku', 'en', 'ar']`, switching to that language must result in `localStorage.getItem('i18n.language') === code`.

**Validates: Requirements 3.7**

### Property 9: Invalid language codes fall back to Kurdish Sorani

*For any* string that is not `'ku'`, `'en'`, or `'ar'`, `resolveLanguage(code)` must return `'ku'`.

**Validates: Requirements 3.8**

### Property 10: Sidebar favorites never exceed 10 items

*For any* sequence of pin operations (of any length), `navStore.favorites.length` must always be ≤ 10.

**Validates: Requirements 4.7**

### Property 11: Sidebar recents never exceed 5 items and most recent is always first

*For any* sequence of page visits (of any length ≥ 1), `navStore.recents.length` must be ≤ 5, and `navStore.recents[0]` must equal the most recently visited page.

**Validates: Requirements 4.7, 4.8**

### Property 12: Sidebar search returns only matching items

*For any* non-empty search query string, all items returned by the sidebar filter function must contain the query string (case-insensitive) in their label or section name.

**Validates: Requirements 5.2**

### Property 13: Sidebar only shows sections for enabled modules

*For any* subset of enabled modules, the sidebar navigation items must only include sections whose module key is in the enabled set.

**Validates: Requirements 5.9**

### Property 14: Command Palette fuzzy search finds items by substring

*For any* item in the command palette registry and any non-empty substring of its label, searching for that substring must return the item in the results list.

**Validates: Requirements 6.2**

### Property 15: Command Palette works correctly in both RTL and LTR

*For any* direction (`'rtl'` or `'ltr'`), the CommandPalette must render without errors and return correct search results for any query.

**Validates: Requirements 6.7**

### Property 16: Typewriter animation duration is within bounds

*For any* string of length `n`, the total typewriter animation duration must be between `n × 40ms` and `n × 60ms`, and must not exceed 3000ms.

**Validates: Requirements 7.1**

### Property 17: Counter animation duration is within 800–1200ms

*For any* positive numeric value, the counter animation duration must be ≥ 800ms and ≤ 1200ms.

**Validates: Requirements 7.4**

### Property 18: All micro-interaction duration tokens are ≤ 150ms

*For any* micro-interaction duration token (hover, press, focus), its value must be ≤ 150.

**Validates: Requirements 8.8**

### Property 19: Skeleton is shown for loading durations ≥ 300ms; not shown for < 300ms

*For any* loading duration `d`, `useLoadingState` must return `true` (show skeleton) if and only if `d ≥ 300ms`. For `d < 300ms`, it must return `false`.

**Validates: Requirements 9.3, 9.4, 11.3, 11.7**

### Property 20: Directional icons are flipped in RTL mode

*For any* directional icon component, rendering with `isRTL=true` must apply `transform: scaleX(-1)` or the `flip-rtl` CSS class.

**Validates: Requirements 10.2**

### Property 21: IQD money formatting uses ar-IQ locale

*For any* positive number `n`, `formatMoney(n, 'IQD', 'ku')` must produce the same string as `new Intl.NumberFormat('ar-IQ', { style: 'currency', currency: 'IQD' }).format(n)`.

**Validates: Requirements 10.4**

### Property 22: Date formatting returns non-empty strings for all locales

*For any* valid date and any locale in `['ku', 'en', 'ar']`, `formatDate(date, locale)` must return a non-empty string.

**Validates: Requirements 10.5**

### Property 23: Skeleton variants have distinct colors in dark vs light mode

*For any* skeleton variant, the background color in dark mode must differ from the background color in light mode.

**Validates: Requirements 11.6**

### Property 24: Glass morphism fallback uses solid surface token

*For any* glass morphism component, when `@supports (backdrop-filter: blur(1px))` is false, the background must equal the solid `surface` token value for the current mode.

**Validates: Requirements 12.5**

### Property 25: Glass morphism border is correct for each mode

*For any* glass morphism surface, in dark mode the border must be `'1px solid rgba(255,255,255,0.12)'` and in light mode it must be `'1px solid rgba(15,23,42,0.08)'`.

**Validates: Requirements 12.6**

### Property 26: KpiCard renders all five required elements for any KPI data

*For any* KPI data object with title, value, delta, sparkline data, and icon, the rendered `KpiCard` must contain all five elements in the DOM.

**Validates: Requirements 13.1**

### Property 27: List pages contain all five required structural elements

*For any* list page component, the rendered output must contain `PageHeader`, `FilterBar`, `BulkActionBar`, `DataTable`, and `Pagination` components.

**Validates: Requirements 14.1**

### Property 28: Virtualization is used for datasets ≥ 200 rows

*For any* dataset with `n ≥ 200` rows, the number of rendered DOM rows in `DataTable` must be less than `n` (virtualized rendering).

**Validates: Requirements 14.5, 18.5**

### Property 29: Auto-save persists form state after 30 seconds

*For any* form state object, after advancing fake timers by 30,000ms, `localStorage` must contain the draft under the correct entity+id key.

**Validates: Requirements 15.3**

### Property 30: Login form is locked after ≥ 5 failed attempts

*For any* number of failed login attempts `n`, the form must be locked if and only if `n ≥ 5`.

**Validates: Requirements 16.6**

### Property 31: All interactive design-system elements have aria-label or aria-labelledby

*For any* interactive component rendered by the design system (button, link, input, select), the rendered DOM element must have either an `aria-label` or `aria-labelledby` attribute.

**Validates: Requirements 17.1**

### Property 32: Token color pairs meet WCAG AA contrast ratio

*For any* text color and background color pair defined in the token system, the WCAG contrast ratio must be ≥ 4.5:1 for normal text and ≥ 3:1 for large text and UI elements.

**Validates: Requirements 17.4**

### Property 33: Custom components have correct ARIA roles

*For any* custom component type (modal, nav, list, dropdown, alert), the rendered element must have the correct ARIA role attribute as specified in the ARIA roles table.

**Validates: Requirements 17.6**

### Property 34: All feature routes use React.lazy

*For any* feature route in `App.routes.tsx`, the component must be loaded via `React.lazy` (not a static import).

**Validates: Requirements 18.2**

### Property 35: Images are rendered via OptimizedImage

*For any* image element in design-system components, it must be wrapped in `OptimizedImage` (not a raw `<img>` tag).

**Validates: Requirements 18.6**

### Property 36: Print templates render with correct direction

*For any* print template, rendering with `isRTL=true` must produce an element with `dir="rtl"`, and rendering with `isRTL=false` must produce `dir="ltr"`.

**Validates: Requirements 19.3**

### Property 37: Print templates format currency correctly

*For any* positive amount, the print template must format IQD using the `ar-IQ` locale and USD using the `en-US` locale.

**Validates: Requirements 19.4**

### Property 38: Print templates always contain company logo and info

*For any* print template (Invoice, Quote, Bill, PO, Receipt), the rendered output must contain company logo and company info elements.

**Validates: Requirements 19.6**

### Property 39: All error message keys exist in all three locale files

*For any* key in the `errors` namespace of any locale file, that key must also exist in the other two locale files.

**Validates: Requirements 20.2**

### Property 40: Each locale has ≥ 700 i18n keys

*For any* locale in `['ku', 'en', 'ar']`, the total number of i18n keys across all namespaces must be ≥ 700.

**Validates: Requirements 20.4**

### Property 41: Missing i18n keys fall back to the key string

*For any* string that is not a valid i18n key, `t(key)` must return the key string itself (not an empty string or undefined).

**Validates: Requirements 20.5**

### Property 42: IQD and USD formatting differ for the same amount

*For any* positive number, `formatMoney(n, 'IQD', 'ku')` must produce a different string than `formatMoney(n, 'USD', 'en')`.

**Validates: Requirements 20.6**

### Property 43: All i18n keys are present in all three locale files (locale completeness)

*For any* i18n key present in any one locale file, that key must also be present in the other two locale files.

**Validates: Requirements 20.7**
