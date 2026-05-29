# Glass UI Components

Tenant app glass surfaces share tokens from `frontend/src/theme/tokens.ts` and role accents via `--role-accent` CSS variables set by `RoleAccentProvider`.

## Components

| Component | Path | Use for |
|-----------|------|---------|
| `GlassCard` | `components/glass/GlassCard.tsx` | Dashboard hero, capability panels |
| `GlassDialog` | `components/glass/GlassDialog.tsx` | Standalone modals with role accent |
| `GlassDrawer` | `components/glass/GlassDrawer.tsx` | Welcome sheet, mobile sheets |
| `GlassPopover` | `components/glass/GlassPopover.tsx` | Role capability popover |
| `GlassConfirm` | `components/glass/GlassConfirm.tsx` | Delete / destructive confirms |
| `GlassDialogFooter` | `components/glass/GlassDialogFooter.tsx` | Consistent modal footers |

## Styles helper

```ts
import { getGlassStyle } from '../theme/glassStyles';
const style = getGlassStyle('dialog', true); // surface + role accent glow
```

Surfaces: `topbar`, `palette`, `login`, `modal`, `sidebar`, `card`, `dialog`, `drawer`, `popover`, `toast`.

Exceptions: entity forms using raw Ant Design `<Modal>` inherit global glass CSS in `global.css` — no per-file migration required when `npm run audit:glass-modals` passes.

## Fallback

When `backdrop-filter` is unsupported, components fall back to solid surface colors (`@supports` in `GlassCard` and `getGlassStyle`).

## Platform console

Vendor `/platform` uses separate `PlatformGlass` module — do not mix tenant role accents on platform chrome.
