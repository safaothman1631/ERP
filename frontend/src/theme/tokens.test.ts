/**
 * tokens.test.ts
 *
 * Unit tests for the theme/design-token system.
 *
 * Runner: Vitest (jsdom environment)
 *
 * Feature: settings-documentation
 * Requirements: 3.4, 3.5, 3.6
 *
 * Sub-tasks covered:
 *  - Test token accessibility and consistency
 *  - Test theme persistence and switching (via buildAntTokens)
 *  - Test RTL language support (font stacks for Kurdish/Arabic)
 */
import { describe, it, expect } from 'vitest';
import { palette, space, spacing, fontFamily, fontSize, fontWeight, duration, shadow, zIndex, a11y, buildAntTokens, buildAntComponents, status, elevation, typography, dataViz, controlHeight } from './tokens';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a hex colour string (#RRGGBB or #RGB) into [r, g, b] 0-255 values.
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return [r, g, b];
}

/**
 * Relative luminance per WCAG 2.1 formula.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * WCAG contrast ratio between two hex colours.
 */
function contrastRatio(hex1: string, hex2: string): number {
  const [r1, g1, b1] = hexToRgb(hex1);
  const [r2, g2, b2] = hexToRgb(hex2);
  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// 1. Token accessibility and consistency
// Requirements: 3.4
// ---------------------------------------------------------------------------
describe('Token accessibility and consistency', () => {
  // ── Colour palette completeness ──────────────────────────────────────────
  describe('palette completeness', () => {
    it('defines all primary shades (50–900)', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (const shade of shades) {
        const key = `primary${shade}` as keyof typeof palette;
        expect(palette[key], `primary${shade} should be defined`).toBeDefined();
        expect(typeof palette[key]).toBe('string');
      }
    });

    it('defines all success shades (50–900)', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (const shade of shades) {
        const key = `success${shade}` as keyof typeof palette;
        expect(palette[key], `success${shade} should be defined`).toBeDefined();
      }
    });

    it('defines all warning shades (50–900)', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (const shade of shades) {
        const key = `warning${shade}` as keyof typeof palette;
        expect(palette[key], `warning${shade} should be defined`).toBeDefined();
      }
    });

    it('defines all error shades (50–900)', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (const shade of shades) {
        const key = `error${shade}` as keyof typeof palette;
        expect(palette[key], `error${shade} should be defined`).toBeDefined();
      }
    });

    it('defines all info shades (50–900)', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (const shade of shades) {
        const key = `info${shade}` as keyof typeof palette;
        expect(palette[key], `info${shade} should be defined`).toBeDefined();
      }
    });

    it('defines all neutral gray shades (50–900)', () => {
      const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
      for (const shade of shades) {
        const key = `gray${shade}` as keyof typeof palette;
        expect(palette[key], `gray${shade} should be defined`).toBeDefined();
      }
    });

    it('defines semantic aliases for light mode (ink, bg, surface, border)', () => {
      expect(palette.ink900).toBeDefined();
      expect(palette.ink700).toBeDefined();
      expect(palette.ink500).toBeDefined();
      expect(palette.ink300).toBeDefined();
      expect(palette.ink100).toBeDefined();
      expect(palette.bg).toBeDefined();
      expect(palette.surface).toBeDefined();
      expect(palette.border).toBeDefined();
    });

    it('defines dark mode surface tokens', () => {
      expect(palette.darkBg).toBeDefined();
      expect(palette.darkSurface).toBeDefined();
      expect(palette.darkElevated).toBeDefined();
      expect(palette.darkBorder).toBeDefined();
      expect(palette.darkInk).toBeDefined();
      expect(palette.darkInkMuted).toBeDefined();
    });
  });

  // ── WCAG colour contrast ─────────────────────────────────────────────────
  describe('WCAG colour contrast (Requirements: 3.4)', () => {
    it('primary500 on white surface meets WCAG AA (≥4.5:1) for normal text', () => {
      const ratio = contrastRatio(palette.primary500, palette.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('ink900 on white surface meets WCAG AAA (≥7:1)', () => {
      const ratio = contrastRatio(palette.ink900, palette.surface);
      expect(ratio).toBeGreaterThanOrEqual(7);
    });

    it('ink900 on bg meets WCAG AA (≥4.5:1)', () => {
      const ratio = contrastRatio(palette.ink900, palette.bg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('darkInk on darkBg meets WCAG AA (≥4.5:1)', () => {
      const ratio = contrastRatio(palette.darkInk, palette.darkBg);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('success600 (darker green) on white meets WCAG AA (≥4.5:1)', () => {
      // palette.success (#16A34A) is ~3.3:1 — suitable for large text / icons.
      // The darker success600 (#15803D) is used for body text and meets AA.
      const ratio = contrastRatio(palette.success600, palette.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('success base on white meets WCAG AA for large text (≥3:1)', () => {
      // Green (#16A34A) on white is ~3.3:1 — passes for large text / UI components.
      const ratio = contrastRatio(palette.success, palette.surface);
      expect(ratio).toBeGreaterThanOrEqual(3);
    });

    it('danger base on white meets WCAG AA (≥4.5:1)', () => {
      const ratio = contrastRatio(palette.danger, palette.surface);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  // ── Spacing scale consistency ────────────────────────────────────────────
  describe('spacing scale consistency', () => {
    it('all spacing values are non-negative integers', () => {
      for (const [key, val] of Object.entries(spacing)) {
        expect(Number.isInteger(val), `spacing[${key}] should be integer`).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('spacing scale follows 4px base unit', () => {
      for (const [key, val] of Object.entries(spacing)) {
        expect(val % 4, `spacing[${key}]=${val} should be divisible by 4`).toBe(0);
      }
    });

    it('named space aliases are positive integers', () => {
      for (const [key, val] of Object.entries(space)) {
        expect(Number.isInteger(val), `space.${key} should be integer`).toBe(true);
        expect(val).toBeGreaterThan(0);
      }
    });
  });

  // ── Typography completeness ──────────────────────────────────────────────
  describe('typography token completeness', () => {
    it('defines all required font sizes (xs through 5xl)', () => {
      const required = ['xs', 'sm', 'base', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl'] as const;
      for (const key of required) {
        expect(fontSize[key], `fontSize.${key} should be defined`).toBeDefined();
        expect(fontSize[key]).toBeGreaterThan(0);
      }
    });

    it('defines all font weights (light through extrabold)', () => {
      const required = ['light', 'regular', 'medium', 'semibold', 'bold', 'extrabold'] as const;
      for (const key of required) {
        expect(fontWeight[key], `fontWeight.${key} should be defined`).toBeDefined();
      }
    });

    it('font sizes are in ascending order (xs < sm < base < lg)', () => {
      expect(fontSize.xs).toBeLessThan(fontSize.sm);
      expect(fontSize.sm).toBeLessThan(fontSize.base);
      expect(fontSize.base).toBeLessThan(fontSize.lg);
      expect(fontSize.lg).toBeLessThan(fontSize.xl);
    });

    it('font weights are in ascending order (light < regular < bold)', () => {
      expect(fontWeight.light).toBeLessThan(fontWeight.regular);
      expect(fontWeight.regular).toBeLessThan(fontWeight.medium);
      expect(fontWeight.medium).toBeLessThan(fontWeight.semibold);
      expect(fontWeight.semibold).toBeLessThan(fontWeight.bold);
    });

    it('typography ramp defines all semantic levels', () => {
      const levels = ['display', 'h1', 'h2', 'h3', 'bodyLg', 'body', 'bodySm', 'caption', 'overline'] as const;
      for (const level of levels) {
        expect(typography[level], `typography.${level} should be defined`).toBeDefined();
        expect(typography[level].size).toBeGreaterThan(0);
        expect(typography[level].lh).toBeGreaterThan(0);
        expect(typography[level].weight).toBeGreaterThan(0);
      }
    });
  });

  // ── Motion / duration tokens ─────────────────────────────────────────────
  describe('motion and duration tokens (Requirements: 3.4)', () => {
    it('defines instant, fast, normal, slow, verySlow durations', () => {
      expect(duration.instant).toBe(0);
      expect(duration.fast).toBeGreaterThan(0);
      expect(duration.normal).toBeGreaterThan(duration.fast);
      expect(duration.slow).toBeGreaterThan(duration.normal);
      expect(duration.verySlow).toBeGreaterThan(duration.slow);
    });

    it('all duration values are non-negative numbers', () => {
      for (const [_key, val] of Object.entries(duration)) {
        expect(typeof val).toBe('number');
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ── Shadow tokens ────────────────────────────────────────────────────────
  describe('shadow tokens', () => {
    it('defines sm, md, lg, xl shadow levels', () => {
      expect(shadow.sm).toBeDefined();
      expect(shadow.md).toBeDefined();
      expect(shadow.lg).toBeDefined();
      expect(shadow.xl).toBeDefined();
    });

    it('shadow.none is "none"', () => {
      expect(shadow.none).toBe('none');
    });

    it('defines dark mode shadow variants', () => {
      expect(shadow.dark.sm).toBeDefined();
      expect(shadow.dark.md).toBeDefined();
      expect(shadow.dark.lg).toBeDefined();
      expect(shadow.dark.xl).toBeDefined();
    });
  });

  // ── Z-index scale ────────────────────────────────────────────────────────
  describe('z-index scale', () => {
    it('defines all required z-index levels', () => {
      const levels = ['base', 'dropdown', 'sticky', 'drawer', 'modal', 'popover', 'toast', 'tooltip'] as const;
      for (const level of levels) {
        expect(zIndex[level], `zIndex.${level} should be defined`).toBeDefined();
      }
    });

    it('z-index levels are in ascending order', () => {
      expect(zIndex.base).toBeLessThan(zIndex.dropdown);
      expect(zIndex.dropdown).toBeLessThan(zIndex.sticky);
      expect(zIndex.sticky).toBeLessThan(zIndex.drawer);
      expect(zIndex.drawer).toBeLessThan(zIndex.modal);
      expect(zIndex.modal).toBeLessThan(zIndex.popover);
      expect(zIndex.popover).toBeLessThan(zIndex.toast);
      expect(zIndex.toast).toBeLessThan(zIndex.tooltip);
    });
  });

  // ── Accessibility tokens ─────────────────────────────────────────────────
  describe('accessibility tokens (Requirements: 3.4)', () => {
    it('minTouchTarget meets WCAG 2.1 AA (44px)', () => {
      expect(a11y.minTouchTarget).toBeGreaterThanOrEqual(44);
    });

    it('focusRingWidth is at least 2px', () => {
      expect(a11y.focusRingWidth).toBeGreaterThanOrEqual(2);
    });

    it('focusRingOffset is at least 2px', () => {
      expect(a11y.focusRingOffset).toBeGreaterThanOrEqual(2);
    });

    it('focusRingColor is defined and is a valid hex colour', () => {
      expect(a11y.focusRingColor).toMatch(/^#[0-9A-Fa-f]{3,6}$/);
    });

    it('focusRingColorDark is defined and is a valid hex colour', () => {
      expect(a11y.focusRingColorDark).toMatch(/^#[0-9A-Fa-f]{3,6}$/);
    });
  });

  // ── Status tokens ────────────────────────────────────────────────────────
  describe('status tokens', () => {
    const statusKeys = ['success', 'warning', 'danger', 'info', 'neutral'] as const;

    it.each(statusKeys)('status.%s defines fg, bg, border, hover', (key) => {
      expect(status[key].fg).toBeDefined();
      expect(status[key].bg).toBeDefined();
      expect(status[key].border).toBeDefined();
      expect(status[key].hover).toBeDefined();
    });
  });

  // ── Elevation tokens ─────────────────────────────────────────────────────
  describe('elevation tokens', () => {
    it('defines flat, raised, floating, overlay, popover levels', () => {
      expect(elevation.flat).toBeDefined();
      expect(elevation.raised).toBeDefined();
      expect(elevation.floating).toBeDefined();
      expect(elevation.overlay).toBeDefined();
      expect(elevation.popover).toBeDefined();
    });

    it('defines dark mode elevation variants', () => {
      expect(elevation.dark.flat).toBeDefined();
      expect(elevation.dark.raised).toBeDefined();
      expect(elevation.dark.floating).toBeDefined();
      expect(elevation.dark.overlay).toBeDefined();
      expect(elevation.dark.popover).toBeDefined();
    });
  });

  // ── Data visualisation palette ───────────────────────────────────────────
  describe('data visualisation palette', () => {
    it('categorical palette has at least 6 distinct colours', () => {
      expect(dataViz.categorical.length).toBeGreaterThanOrEqual(6);
      const unique = new Set(dataViz.categorical);
      expect(unique.size).toBe(dataViz.categorical.length);
    });

    it('sequential palette has at least 6 entries', () => {
      expect(dataViz.sequential.length).toBeGreaterThanOrEqual(6);
    });

    it('diverging palette has at least 5 entries', () => {
      expect(dataViz.diverging.length).toBeGreaterThanOrEqual(5);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Theme persistence and switching (via buildAntTokens)
// Requirements: 3.4, 3.6
// ---------------------------------------------------------------------------
describe('Theme switching — buildAntTokens', () => {
  it('returns light-mode background tokens for mode="light"', () => {
    const tokens = buildAntTokens('light', 'default', false);
    expect(tokens.colorBgBase).toBe(palette.surface);
    expect(tokens.colorBgLayout).toBe(palette.bg);
    expect(tokens.colorBgContainer).toBe(palette.surface);
  });

  it('returns dark-mode background tokens for mode="dark"', () => {
    const tokens = buildAntTokens('dark', 'default', false);
    expect(tokens.colorBgBase).toBe(palette.darkBg);
    expect(tokens.colorBgLayout).toBe(palette.darkBg);
    expect(tokens.colorBgContainer).toBe(palette.darkSurface);
  });

  it('light and dark token sets differ in background colours', () => {
    const light = buildAntTokens('light', 'default', false);
    const dark  = buildAntTokens('dark',  'default', false);
    expect(light.colorBgBase).not.toBe(dark.colorBgBase);
    expect(light.colorBgContainer).not.toBe(dark.colorBgContainer);
  });

  it('light mode uses dark text (ink900)', () => {
    const tokens = buildAntTokens('light', 'default', false);
    expect(tokens.colorText).toBe(palette.ink900);
  });

  it('dark mode uses light text (darkInk)', () => {
    const tokens = buildAntTokens('dark', 'default', false);
    expect(tokens.colorText).toBe(palette.darkInk);
  });

  it('primary colour is the same in both themes', () => {
    const light = buildAntTokens('light', 'default', false);
    const dark  = buildAntTokens('dark',  'default', false);
    expect(light.colorPrimary).toBe(palette.primary500);
    expect(dark.colorPrimary).toBe(palette.primary500);
  });

  describe('density variants', () => {
    it('compact density uses controlHeight.compact', () => {
      const tokens = buildAntTokens('light', 'compact', false);
      expect(tokens.controlHeight).toBe(controlHeight.compact);
    });

    it('default density uses controlHeight.default', () => {
      const tokens = buildAntTokens('light', 'default', false);
      expect(tokens.controlHeight).toBe(controlHeight.default);
    });

    it('comfort density uses controlHeight.comfort', () => {
      const tokens = buildAntTokens('light', 'comfort', false);
      expect(tokens.controlHeight).toBe(controlHeight.comfort);
    });

    it('controlHeightLG is 8px larger than controlHeight', () => {
      const tokens = buildAntTokens('light', 'default', false);
      expect(tokens.controlHeightLG).toBe(tokens.controlHeight + 8);
    });

    it('controlHeightSM is 4px smaller than controlHeight', () => {
      const tokens = buildAntTokens('light', 'default', false);
      expect(tokens.controlHeightSM).toBe(tokens.controlHeight - 4);
    });
  });

  describe('buildAntComponents', () => {
    it('returns component overrides for light mode', () => {
      const components = buildAntComponents('light');
      expect(components.Card).toBeDefined();
      expect(components.Table).toBeDefined();
      expect(components.Button).toBeDefined();
      expect(components.Modal).toBeDefined();
    });

    it('returns component overrides for dark mode', () => {
      const components = buildAntComponents('dark');
      expect(components.Card).toBeDefined();
      expect(components.Layout).toBeDefined();
    });

    it('Table headerBg differs between light and dark', () => {
      const light = buildAntComponents('light');
      const dark  = buildAntComponents('dark');
      expect(light.Table.headerBg).not.toBe(dark.Table.headerBg);
    });

    it('Modal contentBg differs between light and dark', () => {
      const light = buildAntComponents('light');
      const dark  = buildAntComponents('dark');
      expect(light.Modal.contentBg).not.toBe(dark.Modal.contentBg);
    });
  });
});

// ---------------------------------------------------------------------------
// 3. RTL language support — font stacks for Kurdish/Arabic
// Requirements: 3.5
// ---------------------------------------------------------------------------
describe('RTL language support (Requirements: 3.5)', () => {
  describe('fontFamily tokens', () => {
    it('defines an RTL font stack', () => {
      expect(fontFamily.rtl).toBeDefined();
      expect(typeof fontFamily.rtl).toBe('string');
    });

    it('defines an LTR font stack', () => {
      expect(fontFamily.ltr).toBeDefined();
      expect(typeof fontFamily.ltr).toBe('string');
    });

    it('RTL font stack includes Vazirmatn (Kurdish/Arabic support)', () => {
      expect(fontFamily.rtl).toContain('Vazirmatn');
    });

    it('RTL font stack includes Noto Sans Arabic as fallback', () => {
      expect(fontFamily.rtl).toContain('Noto Sans Arabic');
    });

    it('LTR font stack includes Inter', () => {
      expect(fontFamily.ltr).toContain('Inter');
    });

    it('RTL and LTR font stacks are different', () => {
      expect(fontFamily.rtl).not.toBe(fontFamily.ltr);
    });
  });

  describe('buildAntTokens RTL mode', () => {
    it('uses RTL font family when isRTL=true', () => {
      const tokens = buildAntTokens('light', 'default', true);
      expect(tokens.fontFamily).toBe(fontFamily.rtl);
    });

    it('uses LTR font family when isRTL=false', () => {
      const tokens = buildAntTokens('light', 'default', false);
      expect(tokens.fontFamily).toBe(fontFamily.ltr);
    });

    it('RTL and LTR token sets differ only in fontFamily', () => {
      const rtl = buildAntTokens('light', 'default', true);
      const ltr = buildAntTokens('light', 'default', false);
      expect(rtl.fontFamily).not.toBe(ltr.fontFamily);
      // All other tokens should be identical
      expect(rtl.colorPrimary).toBe(ltr.colorPrimary);
      expect(rtl.colorBgBase).toBe(ltr.colorBgBase);
      expect(rtl.controlHeight).toBe(ltr.controlHeight);
    });

    it('dark RTL mode uses RTL font family', () => {
      const tokens = buildAntTokens('dark', 'default', true);
      expect(tokens.fontFamily).toBe(fontFamily.rtl);
    });

    it('compact RTL mode uses RTL font family', () => {
      const tokens = buildAntTokens('light', 'compact', true);
      expect(tokens.fontFamily).toBe(fontFamily.rtl);
    });
  });
});
