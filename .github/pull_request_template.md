# Summary

<!-- One short paragraph: what does this PR change and why. -->

## Type of change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation / chore / refactor (no runtime behavior change)

## How was this tested

<!-- Commands run, screenshots, links to CI runs, etc. -->

## Quality gate checklist

The following CI checks gate every merge. Confirm they are green before requesting review.

- [ ] **Navigation registry — `nav:audit`**: Every static destination on the seven authenticated nav surfaces (`side_nav_leaf`, `quick_create_item`, `top_bar_menu_item`, `command_palette_command`, `in_page_link`, `breadcrumb_segment`, `module_hub_tile`) is matched by a registered route in `frontend/src/App.routes.tsx`. If you added a navigation control, you also added its destination to `frontend/src/layouts/navDestinations.ts`. Layer 1 (legacy `nav-audit.mjs` structural side-nav check) and Layer 2 (router-semantic match via `matchRoutes`) both exit 0. (Requirements 2.6, 2.7, 3.6)
- [ ] **Navigation runtime — `nav:sweep`**: `npm run nav:sweep` (Playwright) walks every surface and asserts no destination renders the `NotFound` page. The negative-control test still asserts `NotFound` IS rendered for genuinely unknown URLs. (Requirements 2.1–2.5, 3.1)
- [ ] **Type check / build**: `npm run build` and `tsc --noEmit` pass.
- [ ] **Lint**: `npm run lint` passes (or warnings are accepted).
- [ ] **Tests**: All E2E, a11y, and Lighthouse jobs in `Quality` workflow are green.

## Risk and rollout

<!-- Any feature flags, migrations, or staged rollout considerations. -->

## Linked issues / specs

<!-- e.g. Closes #123 or .kiro/specs/<spec>/ -->
