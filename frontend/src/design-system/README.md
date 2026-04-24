# Design System

شوێنی هەموو reusable UI primitives. هیچ business logic لێرە نییە.

ناوەڕۆک:
- `PageHeader` — title + subtitle + breadcrumb + actions
- `KpiCard` — متریکی داشبۆرد
- `StatusTag` — tag یەکگرتوو بۆ status (paid / draft / overdue / ...)
- `EmptyState` — illustration + title + CTA
- `DataTable` — wrapper بۆ AntD Table + density + selection + bulk actions
- `MoneyInput` — InputNumber + currency suffix
- `EntitySelect` — async-loading select (contacts, items, accounts ...)
- `FilterBar` — search + filters + saved-views
- `ConfirmDialog` — تەنها modal بۆ destructive actions

هەموو component لە token (theme/tokens.ts) دەگرێت — هیچ inline color.
