# Requirements Document

## Introduction

This feature cleans up and improves two interconnected areas of the ERP frontend:

1. **Navigation Sidebar** (`navigation.tsx`) — removes duplicate/overlapping sections, enforces clean title-only section labels (no underlines or decorations), and ensures all section and item labels are fully translated in both English and Kurdish (Sorani) with no language mixing.

2. **Settings Page** (`Settings.tsx`) — fixes all `<Select>` components that can render with zero options by adding an "Add …" escape-hatch option that navigates the user to the relevant creation screen; ensures every section is functional; and adds contextual help (tooltip/popover) to every settings section explaining what it is, why it exists, and how to use it step by step.

The codebase is React + TypeScript + Ant Design. Translations live in `src/locales/en.json` and `src/locales/ku.json`. Navigation structure is defined in `src/layouts/navigation.tsx`. The Settings page is `src/pages/Settings.tsx`.

---

## Glossary

- **Nav_Sidebar**: The left-side navigation component rendered from `buildNavSections()` in `navigation.tsx`.
- **NavSection**: A single collapsible group in the Nav_Sidebar, identified by a unique `key`, containing a `label`, `icon`, `zone`, and `items[]`.
- **NavLeaf**: A single route link inside a NavSection (`key` = route path, `label` = display text).
- **Duplicate_Section**: Two or more NavSections whose `items[]` contain overlapping route paths, causing the same destination to appear multiple times in the sidebar.
- **Section_Label**: The heading text rendered for a NavSection in the sidebar.
- **Translation_Key**: An i18n key passed to `t()` whose resolved value must exist in both `en.json` and `ku.json`.
- **Fallback_String**: The second argument to `t(key, fallback)` — used when a Translation_Key is absent from a locale file, resulting in English text appearing in Kurdish UI.
- **Settings_Page**: The page at `/settings` rendered by `src/pages/Settings.tsx`, composed of a vertical sidebar nav and a main content area.
- **SectionDef**: A settings section definition object with `key`, `label`, `icon`, `group`, and optional `badge`/`link` fields.
- **Empty_Select**: An Ant Design `<Select>` component whose `options` array is empty or resolves to zero items at runtime (e.g., because the backing API returns no records).
- **Add_Option**: A special option rendered inside an Empty_Select with label "＋ Add [Entity]" that navigates the user to the creation screen for that entity.
- **Help_Popover**: An Ant Design `<Popover>` or `<Tooltip>` triggered by an info icon (ⓘ) placed next to a settings section title, containing: (1) what the section is, (2) why it is used, and (3) step-by-step usage instructions.
- **Kurdish_UI**: The application UI when the active language is `ku` (Sorani Kurdish, RTL).
- **English_UI**: The application UI when the active language is `en`.

---

## Requirements

---

### Requirement 1: Remove Duplicate Navigation Sections

**User Story:** As a user, I want each destination to appear exactly once in the sidebar, so that I do not see the same page listed under multiple sections and the sidebar is not confusing.

#### Acceptance Criteria

1. THE Nav_Sidebar SHALL contain no two NavSections whose `items[]` share the same route path.
2. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both the `quality` section (standalone) and the `ext-ops` ("Quality & Maintenance") section simultaneously — the standalone `quality` section SHALL be merged into `ext-ops` or removed.
3. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both the `ai-assist` section and the `ext-platform` ("Platform & AI") section simultaneously — the standalone `ai-assist` section SHALL be merged into `ext-platform` or removed.
4. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both the `admin-config` section and the `setup` section simultaneously — the `/settings` route SHALL appear in exactly one NavSection.
5. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both `/helpdesk` (in `ext-engagement`) and `/wave-a/helpdesk` (also in `ext-engagement`) — one of the two SHALL be removed from `ext-engagement`.
6. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both `/wave-a/field-service` (in `ext-engagement`) and the standalone `field-service` section — the duplicate route SHALL be removed from `ext-engagement`.
7. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both `/ext/hotel` (in `ext-vertical`) and the standalone `hotel` section — the duplicate route SHALL be removed from `ext-vertical`.
8. WHEN the Nav_Sidebar is rendered, THE Nav_Sidebar SHALL NOT display both `/ext/restaurant` (in `ext-vertical`) and the standalone `restaurant` section — the duplicate route SHALL be removed from `ext-vertical`.
9. AFTER deduplication, THE Nav_Sidebar SHALL preserve all unique route paths that existed before deduplication — no destination SHALL be silently dropped.
10. THE `flattenRoutes()` function SHALL return each route path at most once across all NavSections.

---

### Requirement 2: Clean Section Label Styling

**User Story:** As a user, I want section headings in the sidebar to be plain titles with no underlines or extra decorations, so that the sidebar looks clean and professional.

#### Acceptance Criteria

1. THE Nav_Sidebar SHALL render each Section_Label as plain text with no underline, border-bottom, text-decoration, or other visual decoration applied to the label element itself.
2. WHEN a NavSection is collapsed or expanded, THE Section_Label SHALL maintain the same plain-text appearance with no decoration change. WHERE other sidebar contexts require visual differentiation (e.g., active item highlights, hover backgrounds, icons), THE Nav_Sidebar MAY use those decorations on non-label elements — underlines as differentiators are permitted in other sidebar contexts but SHALL NOT be applied to Section_Label elements.
3. THE Nav_Sidebar SHALL apply a consistent typographic style (font-weight, font-size, color) to all Section_Labels without using underlines as a visual differentiator. Non-underline decorations such as background highlights, icons, and hover effects are permitted on Section_Label elements.
4. IF a CSS rule currently applies `text-decoration: underline` or `border-bottom` to any Section_Label element, THEN THE Nav_Sidebar SHALL override or remove that rule so the label renders without decoration.

---

### Requirement 3: Complete Kurdish Translation of Navigation Labels

**User Story:** As a Kurdish-speaking user, I want every label in the sidebar to appear in Kurdish when the UI language is set to Kurdish, so that I never see mixed English/Kurdish text.

#### Acceptance Criteria

1. WHEN the active language is `ku`, THE Nav_Sidebar SHALL render every Section_Label using its Kurdish translation from `ku.json` — no Section_Label SHALL fall back to an English Fallback_String.
2. WHEN the active language is `ku`, THE Nav_Sidebar SHALL render every NavLeaf label using its Kurdish translation from `ku.json` — no NavLeaf label SHALL fall back to an English Fallback_String.
3. THE `ku.json` locale file SHALL contain Translation_Keys for all nav section labels currently missing, including but not limited to: `nav.ext_ops`, `nav.ext_platform`, `nav.ext_vertical`, `nav.admin_config`, `nav.zone_core_commerce`, `nav.zone_operations`, `nav.zone_people`, `nav.zone_finance_control`, and their corresponding `_blurb` variants.
4. THE `ku.json` locale file SHALL contain Translation_Keys for all nav item labels that currently rely on English Fallback_Strings (e.g., `mod_quality`, `mod_maintenance`, `mod_plm`, `mod_studio`, `mod_rental`, `mod_ai`, `mod_mobile`, `mod_iot`, `mod_hotel`, `mod_restaurant`, `mod_construction`, `mod_real_estate`, `mod_education`, `mod_logistics`, `mod_agriculture`, `mod_ngo`, `mod_government`).
5. WHEN the active language is `en`, THE Nav_Sidebar SHALL render every Section_Label and NavLeaf label in English — no Kurdish text SHALL appear.
6. THE `en.json` locale file SHALL contain Translation_Keys for all nav section labels currently missing, including but not limited to: `nav.ext_ops`, `nav.ext_vertical`, `nav.admin_config`, and their `_blurb` variants.
7. IF a Translation_Key is added to `ku.json`, THEN the same Translation_Key SHALL also be present in `en.json` with an English value.

---

### Requirement 4: Logically Correct Section-to-Subsection Mapping

**User Story:** As a user, I want each sidebar section to contain only the items that logically belong to it, so that I can find features in the expected place without confusion.

#### Acceptance Criteria

1. THE Nav_Sidebar SHALL group NavLeafs under the NavSection whose domain they belong to — items SHALL NOT appear under a section whose label does not describe them.
2. THE `ext-engagement` NavSection SHALL contain only items related to engagement, helpdesk, subscriptions, documents, knowledge, live chat, social, communications, and e-learning — field service items SHALL be removed from it. IF the `ext-engagement` NavSection contains items outside this allowed domain list, THEN THE Nav_Sidebar SHALL treat the section as invalid and the build process SHALL emit a validation warning.
3. THE `ext-ops` NavSection SHALL contain quality, maintenance, and PLM items — it SHALL NOT contain items that belong to other sections.
4. THE `ext-platform` NavSection SHALL contain studio, AI, mobile API, IoT, and rental items — it SHALL NOT duplicate items already present in the standalone `ai-assist` or `admin-config` sections after those are merged.
5. THE `ext-vertical` NavSection SHALL contain only industry-specific vertical items (healthcare, hospital, pharmacy, hotel, restaurant, construction, real-estate, education, logistics, agriculture, NGO, government) — it SHALL NOT duplicate items already present in the standalone `hotel` or `restaurant` sections after those are merged.
6. THE `setup` NavSection and the `admin-config` NavSection SHALL be consolidated into a single NavSection — the consolidated section SHALL contain all unique items from both original sections.
7. WHEN a NavLeaf is moved from one NavSection to another during consolidation, THE NavLeaf's route path, label, description, and keywords SHALL be preserved unchanged.

---

### Requirement 5: Empty Select Components Must Offer an "Add" Escape-Hatch

**User Story:** As a user, when I open a settings section and a dropdown has no options because no records have been created yet, I want to see an "Add [Entity]" option that takes me directly to where I can create that record, so that I am never stuck with an unusable empty dropdown.

#### Acceptance Criteria

1. WHEN a `<Select>` component in the Settings_Page resolves to zero options at runtime, THE Settings_Page SHALL render an Add_Option as the sole option in that Select.
2. THE Add_Option label SHALL follow the pattern "＋ Add [Entity Name]" in English and "＋ زیادکردنی [ناوی بڕگە]" in Kurdish.
3. WHEN a user selects the Add_Option, THE Settings_Page SHALL navigate to the creation route for that entity (e.g., selecting "＋ Add Currency" navigates to `/settings?s=currencies`; selecting "＋ Add Fiscal Year" navigates to `/settings?s=fiscal`).
4. THE following Select components SHALL implement the Add_Option behavior: the fiscal year selector inside the Budgets section (when `fiscalYears` is empty), and any other Select whose `options` array is derived from an API response that may return zero items.
5. WHEN the API response returns one or more items, THE Select SHALL render those items normally without the Add_Option.
6. THE Add_Option SHALL be visually distinct from regular options — it SHALL use a `＋` prefix and a muted/secondary color to indicate it is a navigation action, not a data value.
7. IF a user selects the Add_Option and navigates away, THEN upon returning to the original settings section, THE Select SHALL re-fetch its options and display them if records now exist.

---

### Requirement 6: All Settings Sections Must Be Functional

**User Story:** As a user, I want every section in the Settings page to work correctly — loading data, saving changes, and displaying meaningful content — so that I can configure the system without encountering broken or empty screens.

#### Acceptance Criteria

1. WHEN a user navigates to any SectionDef in the Settings_Page, THE Settings_Page SHALL render a non-empty content area for that section.
2. WHEN a settings section loads data from an API, THE Settings_Page SHALL display a loading indicator while the request is in flight and SHALL display the data upon success. WHILE the loading indicator is shown, THE Settings_Page SHALL maintain the section's structural layout (title, help icon, card skeleton) so that no blank white screen is presented to the user.
3. IF an API request for a settings section fails, THEN THE Settings_Page SHALL display an error message that describes the failure and offers a retry action. THE error message and retry action SHALL be displayed for all API failure cases — no failure SHALL result in a silent empty state.
4. WHEN a user submits a form in any settings section, THE Settings_Page SHALL validate all required fields before sending the request and SHALL display inline validation errors for any missing or invalid fields.
5. WHEN a settings form is saved successfully, THE Settings_Page SHALL display a success notification.
6. WHEN a settings section is marked with `badge: 'soon'`, THE Settings_Page SHALL render a placeholder content area that explains the section is coming soon — it SHALL NOT render a blank white screen.
7. THE Settings_Page SHALL NOT render duplicate `{active === 'currencies' && <Currencies />}` conditional blocks — each SectionKey SHALL appear in exactly one render conditional.

---

### Requirement 7: Contextual Help for Every Settings Section

**User Story:** As a user, I want a help icon next to every settings section title that I can click to read an explanation of what the section does, why I would use it, and how to use it step by step, so that I can configure the system confidently without needing external documentation.

#### Acceptance Criteria

1. THE Settings_Page SHALL render a Help_Popover trigger (ⓘ icon) adjacent to the title of every settings section content area.
2. WHEN a user clicks or hovers the ⓘ icon, THE Settings_Page SHALL display a Help_Popover containing: (a) a one-sentence description of what the section is, (b) a one-sentence explanation of why it is used, and (c) a numbered list of step-by-step usage instructions (minimum 2 steps, maximum 7 steps).
3. THE Help_Popover content SHALL be translated — WHEN the active language is `ku`, THE Help_Popover SHALL display Kurdish text; WHEN the active language is `en`, THE Help_Popover SHALL display English text. IF a Kurdish translation for a Help_Popover section is missing from `ku.json`, THEN THE Help_Popover SHALL fall back to displaying the English content rather than hiding the help entirely.
4. THE Help_Popover SHALL be implemented using the Ant Design `<Popover>` component with `trigger="click"` for touch-friendly access.
5. THE ⓘ icon SHALL have an `aria-label` attribute set to the translated string "Help" / "یارمەتی" for screen reader accessibility.
6. THE Help_Popover SHALL be dismissible by clicking outside it or pressing Escape.
7. THE Help_Popover content for each section SHALL be stored as Translation_Keys in both `en.json` and `ku.json` — hardcoded strings SHALL NOT be used.

---

### Requirement 8: No Mixed-Language Text in Either UI Language

**User Story:** As a user, I want the entire UI — navigation and settings — to be consistently in one language at a time, so that I never see a mix of Kurdish and English labels on the same screen.

#### Acceptance Criteria

1. WHEN the active language is `ku`, THE Nav_Sidebar SHALL render all visible text (section labels, item labels, zone labels, blurbs) exclusively in Kurdish — no English words SHALL appear in any label.
2. WHEN the active language is `en`, THE Nav_Sidebar SHALL render all visible text exclusively in English — no Kurdish words SHALL appear in any label.
3. WHEN the active language is `ku`, THE Settings_Page SHALL render all visible text (group labels, section labels, badges, help content, button labels, form labels, placeholder text) exclusively in Kurdish.
4. WHEN the active language is `en`, THE Settings_Page SHALL render all visible text exclusively in English.
5. THE `setup` NavSection item with label `t('users', 'بەکارهێنەران')` SHALL be corrected — the Fallback_String `'بەکارهێنەران'` (Kurdish) SHALL be replaced with the English fallback `'Users'`, and the Kurdish translation SHALL be provided via `ku.json` instead.
6. THE `setup` NavSection item with label `t('docs_hub', 'Help Center')` and keywords containing `'یارمەتی'` and `'دۆکیومێنت'` SHALL have those Kurdish keywords moved to a separate Kurdish-only keywords array or handled via i18n — they SHALL NOT be hardcoded in the shared `keywords[]` array that is used for English search.
7. THE `setup` NavSection item with label `t('ui_gallery', 'Layout Gallery')` and keywords containing `'ڕووکار'` and `'گاڵەری'` SHALL have those Kurdish keywords handled via i18n — they SHALL NOT be hardcoded in the shared `keywords[]` array.
8. IF a Translation_Key resolves to an empty string in `ku.json`, THEN THE Nav_Sidebar and Settings_Page SHALL NOT fall back to the English Fallback_String — instead, THE system SHALL log a missing-translation warning and use a clearly marked placeholder (e.g., `[missing: key_name]`) so the gap is visible during QA.
