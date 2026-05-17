# Design Document — nav-settings-cleanup

## Overview

This feature cleans up two tightly coupled areas of the ERP frontend:

1. **Navigation sidebar** (`navigation.tsx`) — eliminates duplicate route paths across sections, enforces clean section-label styling, and ensures every label resolves to the correct language with no mixed-language fallbacks.
2. **Settings page** (`Settings.tsx`) — adds an "Add …" escape-hatch to every `<Select>` that can render empty, adds contextual help popovers to every section, and fixes the one duplicate render conditional.

The work is purely frontend. No backend API changes are required. All changes are in TypeScript/React + Ant Design, with translation additions to `en.json` and `ku.json`.

---

## Architecture

The feature touches three layers:

```
┌─────────────────────────────────────────────────────────┐
│  navigation.tsx  (pure data — no React state)           │
│  buildNavSections(t) → NavSection[]                     │
│  flattenRoutes(sections) → FlattenedNavLeaf[]           │
└────────────────────┬────────────────────────────────────┘
                     │ consumed by
┌────────────────────▼────────────────────────────────────┐
│  Sidebar component (renders NavSection[])               │
│  CSS / style tokens (section label decoration)          │
└────────────────────┬────────────────────────────────────┘
                     │ parallel track
┌────────────────────▼────────────────────────────────────┐
│  Settings.tsx  (page component, ~3900 lines)            │
│  SectionCard + SettingsRow primitives                   │
│  Ant Design Select, Popover, Tooltip                    │
└────────────────────┬────────────────────────────────────┘
                     │ i18n
┌────────────────────▼────────────────────────────────────┐
│  en.json / ku.json  (locale files)                      │
└─────────────────────────────────────────────────────────┘
```

No new dependencies are introduced. The existing Ant Design `<Popover>` and `<Select>` components cover all new UI needs.

---

## Components and Interfaces

### 1. `buildNavSections` — deduplication strategy

The current file has these overlapping groups:

| Standalone section | Overlapping extended section | Overlapping routes |
|---|---|---|
| `quality` (5 items, `/quality/*`) | `ext-ops` (7 items, `/wave-a/quality` + maintenance + PLM) | `/quality`, `/quality/plans`, `/quality/checks`, `/quality/ncr`, `/quality/capa` |
| `ai-assist` (5 items, `/ai/*`) | `ext-platform` (5 items, `/ext/studio`, `/ext/rental`, `/ext/ai`, `/ext/mobile`, `/ext/iot`) | No direct overlap — `ai-assist` uses `/ai/*`, `ext-platform` uses `/ext/ai` |
| `admin-config` (6 items) | `setup` (9 items) | `/settings` appears in both |
| `field-service` (standalone) | `ext-engagement` (contains `/wave-a/field-service`) | `/wave-a/field-service` vs standalone `/field-service/*` |
| `hotel` (standalone) | `ext-vertical` (contains `/ext/hotel`) | `/ext/hotel` vs standalone `/hotel`, `/hotel/rooms` |
| `restaurant` (standalone) | `ext-vertical` (contains `/ext/restaurant`) | `/ext/restaurant` vs standalone `/restaurant/*` |
| — | `ext-engagement` | `/helpdesk` and `/wave-a/helpdesk` both present |

**Resolution decisions:**

- **`quality` vs `ext-ops`**: Remove the standalone `quality` section entirely. Its 5 routes (`/quality`, `/quality/plans`, `/quality/checks`, `/quality/ncr`, `/quality/capa`) are added to `ext-ops` as proper NavLeafs with full labels, descriptions, and keywords. The `ext-ops` section already has `/wave-a/quality` which is a different route — both are kept. Rationale: `ext-ops` is the canonical "Quality & Maintenance" home; the standalone section was a legacy duplicate.

- **`ai-assist` vs `ext-platform`**: These do **not** share route paths (`/ai/*` vs `/ext/ai`). However, having two sections both labeled as AI-related in the same zone (`finance-control`) is confusing. Resolution: Remove `ai-assist` as a standalone section. Its 5 routes (`/ai`, `/ai/anomalies`, `/ai/suggestions`, `/ai/ocr`, `/ai/predictions`) are moved into `ext-platform`, which is renamed to "Platform & AI" (already its label). The `/ext/ai` item in `ext-platform` is replaced by the full `/ai/*` subtree. Rationale: consolidates all AI navigation into one place.

- **`admin-config` vs `setup`**: Both contain `/settings`. Resolution: Remove `admin-config` entirely. All its unique items (`/settings/numbering`, `/automation-rules`, `/audit-log-viewer`, `/admin/job-runs`, `/studio`) are merged into `setup`. The `/settings` item already exists in `setup` so it is not duplicated. Rationale: `setup` is the more complete section; `admin-config` was a partial duplicate.

- **`ext-engagement` `/helpdesk` vs `/wave-a/helpdesk`**: Remove `/wave-a/helpdesk` from `ext-engagement`. The canonical helpdesk routes are `/helpdesk`, `/helpdesk/tickets`, `/helpdesk/settings` — these are already present. `/wave-a/helpdesk` is a legacy Wave-A stub.

- **`ext-engagement` `/wave-a/field-service` vs standalone `field-service`**: Remove `/wave-a/field-service` from `ext-engagement`. The standalone `field-service` section with its 4 proper routes is the canonical home. Field service does not belong in the engagement domain (Requirement 4.2).

- **`ext-vertical` `/ext/hotel` vs standalone `hotel`**: Remove `/ext/hotel` from `ext-vertical`. The standalone `hotel` section with `/hotel` and `/hotel/rooms` is the canonical home.

- **`ext-vertical` `/ext/restaurant` vs standalone `restaurant`**: Remove `/ext/restaurant` from `ext-vertical`. The standalone `restaurant` section with its 3 routes is the canonical home.

### 2. `SectionHelpPopover` — new shared component

A small reusable component placed in `src/components/ui/SectionHelpPopover.tsx`:

```typescript
interface SectionHelpPopoverProps {
  what: string;       // one-sentence "what is this"
  why: string;        // one-sentence "why use it"
  steps: string[];    // 2–7 step-by-step instructions
}
```

Rendered as an Ant Design `<Popover>` wrapping an `<InfoCircleOutlined />` icon. The trigger is `"click"` for touch-friendly access. The icon has `aria-label={t('help')}` for screen reader accessibility.

The component is placed in the `actions` slot of `SectionCard` so it appears in the top-right of every card header without requiring changes to `SectionCard` itself.

### 3. `AddOption` utility — empty Select escape-hatch

A utility function `buildAddOption(entityName: string, route: string, navigate: NavigateFunction)` returns an Ant Design Select option object:

```typescript
{
  label: <span style={{ color: token.colorTextSecondary }}>＋ {t('add_entity', { entity: entityName })}</span>,
  value: '__add__',
  className: 'add-option',
}
```

An `onChange` handler on the Select checks `if (value === '__add__') { navigate(route); return; }` before processing normal selections.

The option is injected only when the `options` array is empty:

```typescript
const effectiveOptions = options.length === 0
  ? [buildAddOption(entityName, route, navigate)]
  : options;
```

### 4. CSS — section label decoration fix

The sidebar renders section labels via Ant Design's `Menu` component. The fix targets the CSS class that applies `text-decoration: underline` or `border-bottom` to section group labels. The override is added to the global stylesheet or the sidebar's CSS module:

```css
.ant-menu-item-group-title,
.nav-section-label {
  text-decoration: none !important;
  border-bottom: none !important;
}
```

### 5. Mixed-language keywords fix

Three items in the `setup` section have hardcoded Kurdish text in their `keywords[]` arrays or as English fallback strings:

- `t('users', 'بەکارهێنەران')` → change fallback to `'Users'`; add `"users": "بەکارهێنەران"` to `ku.json` (already present)
- `keywords: ['help', 'docs', 'documentation', 'یارمەتی', 'دۆکیومێنت']` → split into `keywords` (English) and a separate `keywordsKu` field, or move Kurdish terms to `ku.json` under a `nav.keywords_docs_hub` key
- `keywords: ['layout', 'theme', 'ui', 'shell', 'ڕووکار', 'گاڵەری']` → same treatment

The cleanest approach without changing the `NavLeaf` interface is to add a `keywordsKu?: string[]` field to `NavLeaf` and have the command palette merge `keywords` + `keywordsKu` based on the active language.

---

## Data Models

### NavLeaf (extended)

```typescript
export interface NavLeaf {
  key: string;
  label: string;
  description?: string;
  keywords?: string[];
  keywordsKu?: string[];   // NEW: Kurdish-only search keywords
  favoriteEligible?: boolean;
}
```

### SectionDef (Settings.tsx — no change needed)

The existing `SectionDef` interface is sufficient. Help content is stored in locale files and referenced by key, not embedded in the definition object.

### Help content locale key convention

```
settings.help.<sectionKey>.what    — one-sentence description
settings.help.<sectionKey>.why     — one-sentence rationale
settings.help.<sectionKey>.step_1  — first step
settings.help.<sectionKey>.step_2  — second step
...
settings.help.<sectionKey>.step_N  — Nth step (max 7)
```

Example for the `fiscal` section:
```json
"settings.help.fiscal.what": "Fiscal years define the accounting periods for your organization.",
"settings.help.fiscal.why": "You need at least one fiscal year before creating budgets or closing books.",
"settings.help.fiscal.step_1": "Click 'New Fiscal Year' and enter a name (e.g. FY 2025).",
"settings.help.fiscal.step_2": "Set the start and end dates to match your financial year.",
"settings.help.fiscal.step_3": "Save — the year is now available for budgets and reports."
```

### Translation keys to add

**Missing nav section labels (both `en.json` and `ku.json`):**

| Key | English value | Kurdish value |
|---|---|---|
| `nav.ext_ops` | `Quality & Maintenance` | `کوالیتی و چاکردنەوە` |
| `nav.ext_ops_blurb` | `Quality control, maintenance, PLM, and repairs` | `کۆنترۆڵی کوالیتی، چاکردنەوە، PLM، و ڕیپێر` |
| `nav.ext_platform` | `Platform & AI` | `پلاتفۆرم و AI` |
| `nav.ext_platform_blurb` | `Studio (no-code), AI, mobile, IoT, and rental` | `ستۆدیۆ، AI، مۆبایل، IoT، و کرێ` |
| `nav.ext_vertical` | `Industry Apps` | `ئەپەکانی پیشەسازی` |
| `nav.ext_vertical_blurb` | `Industry-specific vertical applications` | `ئەپلیکەیشنە تایبەتەکانی پیشەسازی` |
| `nav.admin_config` | `Admin & Config` | `بەڕێوەبردن و ڕێکخستن` |
| `nav.admin_config_blurb` | `Settings, automation, studio, and system control` | `ڕێکخستنەکان، ئۆتۆماتیک، ستۆدیۆ، و کۆنترۆڵی سیستەم` |
| `nav.zone_core_commerce` | `Core Commerce` | `بازرگانی سەرەکی` |
| `nav.zone_core_commerce_blurb` | `Customer flow, revenue, and procurement` | `جووڵەی کڕیار، داهات، و کڕین` |
| `nav.zone_operations` | `Operations` | `کارکردنەکان` |
| `nav.zone_operations_blurb` | `Stock, production, fulfillment, and field actions` | `ستۆک، بەرهەمهێنان، جێبەجێکردن، و کردارە مەیدانییەکان` |
| `nav.zone_people` | `People` | `خەڵک` |
| `nav.zone_people_blurb` | `Teams, work, payroll, and customer relationships` | `تیمەکان، کار، موچە، و پەیوەندی کڕیار` |
| `nav.zone_finance_control` | `Finance & Control` | `دارایی و کۆنترۆڵ` |
| `nav.zone_finance_control_blurb` | `Accounting, compliance, governance, and setup` | `ژمێریاری، پابەندبوون، بەڕێوەبردن، و دامەزراندن` |
| `nav.setup_blurb` | `Roles, schema, settings, and platform controls` | `ڕۆڵەکان، سکیما، ڕێکخستنەکان، و کۆنترۆڵی پلاتفۆرم` |

**Missing nav item labels (both locale files):**

| Key | English | Kurdish |
|---|---|---|
| `mod_quality` | `Quality` | `کوالیتی` |
| `mod_maintenance` | `Maintenance` | `چاکردنەوە` |
| `mod_plm` | `PLM` | `PLM` |
| `mod_studio` | `Studio` | `ستۆدیۆ` |
| `mod_rental` | `Rental` | `کرێ` |
| `mod_ai` | `AI` | `AI` |
| `mod_mobile` | `Mobile API` | `مۆبایل API` |
| `mod_iot` | `IoT` | `IoT` |
| `mod_helpdesk_ext` | `Helpdesk` | `یارمەتیدەر` |
| `mod_fs_ext` | `Field Service` | `خزمەتگوزاری مەیدانی` |
| `mod_docs_ext` | `Documents` | `بەڵگەنامەکان` |
| `mod_kb_ext` | `Knowledge` | `زانیاری` |
| `mod_hr_ext` | `Recruitment` | `کارمەندگیری` |
| `mod_hotel` | `Hotel` | `هۆتێل` |
| `mod_restaurant` | `Restaurant` | `چێشتخانە` |
| `mod_construction` | `Construction` | `بنیاتنان` |
| `mod_real_estate` | `Real Estate` | `موڵک` |
| `mod_education` | `Education` | `پەروەردە` |
| `mod_logistics` | `Logistics` | `لۆجستی` |
| `mod_agriculture` | `Agriculture` | `کشتوکاڵ` |
| `mod_ngo` | `NGO` | `ڕێکخراو ناحکومی` |
| `mod_government` | `Government` | `حکومی` |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: No duplicate route paths in flattened navigation

*For any* call to `buildNavSections(t)` followed by `flattenRoutes(sections)`, the resulting array of `FlattenedNavLeaf` objects SHALL contain no two entries with the same `key` (route path).

**Validates: Requirements 1.1, 1.10**

### Property 2: Deduplication preserves all unique routes

*For any* set of NavSections, the set of unique route paths after deduplication SHALL be equal to the set of unique route paths before deduplication — no route is silently dropped.

**Validates: Requirements 1.9**

### Property 3: No English fallback rendered in Kurdish UI

*For any* section or leaf in `buildNavSections(t_ku)` where `t_ku` resolves keys from `ku.json`, no rendered label SHALL equal the English fallback string passed as the second argument to `t()`.

**Validates: Requirements 3.1, 3.2, 8.1**

### Property 4: Empty Select always renders exactly one Add_Option

*For any* `<Select>` component in Settings whose `options` prop is an empty array, the rendered options list SHALL contain exactly one item, and that item's value SHALL be `'__add__'`.

**Validates: Requirements 5.1, 5.5**

### Property 5: Add_Option label matches the required pattern

*For any* entity name string passed to `buildAddOption()`, the resulting option's label text SHALL match the pattern `"＋ Add [entity name]"` in English and `"＋ زیادکردنی [entity name]"` in Kurdish.

**Validates: Requirements 5.2**

### Property 6: Every settings section renders non-empty content

*For any* valid `SectionKey` in the `sections` array of `Settings.tsx`, rendering the Settings page with `active = sectionKey` SHALL produce a content area that contains at least one child element.

**Validates: Requirements 6.1**

### Property 7: Every settings section has a help icon

*For any* settings section rendered in `Settings.tsx`, the rendered output SHALL contain an element with `aria-label` equal to `t('help')` (i.e., `"Help"` in English or `"یارمەتی"` in Kurdish).

**Validates: Requirements 7.1, 7.5**

---

## Error Handling

### Navigation deduplication

- If a future developer accidentally re-introduces a duplicate route, the `flattenRoutes()` function should emit a `console.warn('[nav] duplicate route: <path>')` in development mode. This is a dev-time guard, not a runtime error.
- The deduplication is done statically in the source file — there is no runtime deduplication logic that could fail.

### Empty Select / Add_Option

- If the `navigate` function is unavailable (e.g., used outside a Router context), the Add_Option click handler falls back to `window.location.href = route` rather than throwing.
- If the API call to fetch options fails, the Select renders the Add_Option (since `options` will be empty after the failed fetch). This is the correct behavior — the user can still navigate to create the missing entity.

### Help Popover

- If a `settings.help.<sectionKey>.what` key is missing from `ku.json`, the popover falls back to the English content (Requirement 7.3). This is implemented by using `i18next`'s `fallbackLng: 'en'` configuration, which is already set in the project.
- If all help keys for a section are missing from both locale files, the help icon is still rendered but the popover shows a generic "No help available for this section" message rather than crashing.

### Translation missing-key behavior

- Requirement 8.8 specifies that missing Kurdish translations should show `[missing: key_name]` rather than falling back to English. This is implemented by configuring `i18next` with `missingKeyHandler` in development mode only. In production, the existing `fallbackLng: 'en'` behavior is preserved to avoid showing broken UI to end users.

---

## Testing Strategy

This feature involves data structure transformations (navigation deduplication), UI component behavior (empty Select, help popovers), and locale file completeness. Property-based testing applies to the pure data transformation and component behavior layers.

### Unit tests

- Assert that specific duplicate section pairs no longer coexist after the fix (Requirements 1.2–1.8)
- Assert that specific items are in the correct sections after consolidation (Requirement 4)
- Assert that the `users` item in `setup` has an English fallback string (Requirement 8.5)
- Assert that no `keywords[]` array contains Kurdish characters (Requirement 8.6–8.7)
- Assert that `active === 'fiscal'` appears exactly once in the Settings render block (Requirement 6.7)
- Assert that all required translation keys exist in both `en.json` and `ku.json` (Requirements 3.3–3.7, 6)
- Assert that selecting the Add_Option calls `navigate` with the correct route (Requirement 5.3)

### Property-based tests

Using **fast-check** (already available in the project's test ecosystem via Vitest).

Each property test runs a minimum of **100 iterations**.

Tag format: `// Feature: nav-settings-cleanup, Property N: <property text>`

**Property 1 test** — No duplicate routes:
```typescript
// Feature: nav-settings-cleanup, Property 1: No duplicate route paths in flattened navigation
it('flattenRoutes returns no duplicate keys', () => {
  const sections = buildNavSections(mockT);
  const leaves = flattenRoutes(sections);
  const keys = leaves.map(l => l.key);
  expect(new Set(keys).size).toBe(keys.length);
});
```
(This is deterministic, so 1 iteration suffices — but it validates the property universally.)

**Property 2 test** — Deduplication preserves routes:
```typescript
// Feature: nav-settings-cleanup, Property 2: Deduplication preserves all unique routes
fc.assert(fc.property(
  fc.array(arbitraryNavSection(), { minLength: 1, maxLength: 20 }),
  (sections) => {
    const before = new Set(sections.flatMap(s => s.items.map(i => i.key)));
    const after = new Set(deduplicateSections(sections).flatMap(s => s.items.map(i => i.key)));
    return [...before].every(k => after.has(k));
  }
), { numRuns: 100 });
```

**Property 3 test** — No English fallback in Kurdish UI:
```typescript
// Feature: nav-settings-cleanup, Property 3: No English fallback rendered in Kurdish UI
it('all nav labels resolve to Kurdish when language is ku', () => {
  const sections = buildNavSections(kuT);
  const allLabels = [
    ...sections.map(s => s.label),
    ...sections.flatMap(s => s.items.map(i => i.label)),
  ];
  const englishFallbacks = getEnglishFallbacks(); // extracted from source
  allLabels.forEach(label => {
    expect(englishFallbacks).not.toContain(label);
  });
});
```

**Property 4 test** — Empty Select renders Add_Option:
```typescript
// Feature: nav-settings-cleanup, Property 4: Empty Select always renders exactly one Add_Option
fc.assert(fc.property(
  fc.string({ minLength: 1 }), // entity name
  fc.string({ minLength: 1 }), // route
  (entityName, route) => {
    const options = buildEffectiveOptions([], entityName, route, mockNavigate);
    return options.length === 1 && options[0].value === '__add__';
  }
), { numRuns: 100 });
```

**Property 5 test** — Add_Option label pattern:
```typescript
// Feature: nav-settings-cleanup, Property 5: Add_Option label matches required pattern
fc.assert(fc.property(
  fc.string({ minLength: 1, maxLength: 50 }),
  (entityName) => {
    const option = buildAddOption(entityName, '/test', mockNavigate, 'en');
    const labelText = extractText(option.label);
    return labelText === `＋ Add ${entityName}`;
  }
), { numRuns: 100 });
```

**Property 6 test** — Every section renders non-empty content:
```typescript
// Feature: nav-settings-cleanup, Property 6: Every settings section renders non-empty content
it('all section keys render non-empty content', () => {
  const sectionKeys = getAllSectionKeys(); // from SectionDef array
  sectionKeys.forEach(key => {
    const { container } = render(<Settings initialActive={key} />);
    const content = container.querySelector('.st-content');
    expect(content?.children.length).toBeGreaterThan(0);
  });
});
```

**Property 7 test** — Every section has a help icon:
```typescript
// Feature: nav-settings-cleanup, Property 7: Every settings section has a help icon
it('all sections render a help icon', () => {
  const sectionKeys = getAllSectionKeys();
  sectionKeys.forEach(key => {
    const { getByLabelText } = render(<Settings initialActive={key} />);
    expect(getByLabelText(/help|یارمەتی/i)).toBeInTheDocument();
  });
});
```

### Integration tests

- Render the full Settings page and verify the sidebar nav renders without errors
- Verify that clicking the Add_Option in the Budgets fiscal year Select navigates to `/settings?s=fiscal`
- Verify that the help popover opens and closes correctly on click and Escape key

### Snapshot tests

- Snapshot the rendered sidebar section labels to catch unintended styling regressions
- Snapshot the Add_Option rendered markup to catch label format regressions
