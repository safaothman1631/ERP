/**
 * Vertex Design System — Ant Design v6 theme ("Slate & Signal").
 *
 * Ported from `frontend/src/design-system/Vertex Design System/handoff/vertex-theme.ts`
 * into the production theme layer and extended for this app:
 *   • density-aware `controlHeight`,
 *   • RTL font stack (Vazirmatn for ku/ar instead of Inter), and
 *   • an explicit-accent builder so the live *role* accent drives `colorPrimary`.
 *
 * This module is the source of truth for Vertex **colors, radius and fonts**.
 * The broader token surface (status, glass, dataViz, elevation, …) still lives in
 * `theme/tokens.ts`, whose core color / radius / font values are migrated onto
 * this palette so Ant Design and custom components resolve from one place.
 *
 * Usage (the single root ConfigProvider lives in `App.tsx`):
 *   <ConfigProvider theme={buildVertexTheme({ dark, accent, isRTL, controlHeight })}>…</ConfigProvider>
 *
 * Also inject `vertexCssVars(accent)` once at startup so custom (non-AntD)
 * components resolve from the same tokens. Dark mode is the `dark` flag plus a
 * `data-theme="dark"` attribute on <html> (set in App.tsx).
 */
import { theme as antdTheme, type ThemeConfig } from 'antd';
import { fontFamily } from './tokens';

/* ----------------------------- Brand palette ----------------------------- */
export const PALETTE = {
  accent: '#7B61FF', // electric violet — primary
  accentRamp: {
    50: '#F1EEFF', 100: '#E4DEFF', 200: '#C9BCFF', 300: '#AC97FF', 400: '#9275FF',
    500: '#7B61FF', 600: '#6A4DF0', 700: '#5638D6', 800: '#432AA8', 900: '#2C1B73',
  },
  success: '#1FAE63', warning: '#E0900B', danger: '#E23D5C', info: '#2E8FE0',
  // Slate neutrals
  slate: {
    25: '#FAFBFC', 50: '#F4F6F8', 100: '#ECEFF3', 200: '#DEE3EA', 300: '#C4CCD6',
    400: '#97A1B0', 500: '#6B7585', 600: '#4C5564', 700: '#353D4A', 800: '#222934',
    900: '#141922', 950: '#0B0E14',
  },
  ink: { 900: '#11161F', 700: '#353D4A', 500: '#6B7585', 300: '#97A1B0' },
} as const;

/* ------------------------------ Role accents ----------------------------- */
/** Each role recolors the whole app via colorPrimary. Red stays reserved for errors. */
export const ROLE_ACCENTS: Record<string, string> = {
  owner: '#7B61FF',       // violet  — full access
  accountant: '#1FAE63',  // emerald
  sales: '#2E8FE0',       // blue
  inventory: '#06B6D4',   // cyan
  cashier: '#F59E0B',     // amber
  hr: '#C026D3',          // magenta
};

/* ------------------------------ Type & radius ---------------------------- */
export const FONT_UI = "'Inter', 'Segoe UI', system-ui, sans-serif";
export const FONT_DISPLAY = "'Inter Tight', 'Inter', system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', Menlo, Consolas, monospace";

/** RGBA helper for shadows/tints from a hex. */
export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export interface VertexThemeOpts {
  /** Dark algorithm + dark surfaces. */
  dark: boolean;
  /** Hex accent that becomes `colorPrimary` (the live role accent). */
  accent: string;
  /** RTL (ku/ar) → use the Vazirmatn font stack instead of Inter. */
  isRTL?: boolean;
  /** Density control height (compact 32 / comfortable 36 / spacious 44). */
  controlHeight?: number;
}

/**
 * The production Vertex theme builder. Same shape as the handoff `vertexTheme()`
 * but parameterized by the live role accent, RTL language and density so the
 * single root ConfigProvider can stay in sync with app state.
 */
export function buildVertexTheme({
  dark,
  accent,
  isRTL = false,
  controlHeight = 36,
}: VertexThemeOpts): ThemeConfig {
  const primary = accent || PALETTE.accent;
  const family = isRTL ? fontFamily.rtl : FONT_UI;
  return {
    algorithm: dark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorSuccess: PALETTE.success,
      colorWarning: PALETTE.warning,
      colorError: PALETTE.danger,
      colorInfo: PALETTE.info,
      colorTextBase: dark ? '#ECEEF2' : PALETTE.ink[900],
      colorBgBase: dark ? '#0B0E14' : '#FFFFFF',
      colorBgLayout: dark ? '#0B0E14' : PALETTE.slate[50],
      colorBgContainer: dark ? '#11151F' : '#FFFFFF',
      colorBgElevated: dark ? '#161B27' : '#FFFFFF',
      // Borders are DARK in dark mode (the user's repeated "no white frames")
      colorBorder: dark ? 'rgba(0,0,0,0.55)' : '#E2E6EC',
      colorBorderSecondary: dark ? 'rgba(0,0,0,0.40)' : '#ECEFF3',
      borderRadius: 8,          // controls (inputs, buttons)
      borderRadiusLG: 12,       // cards, modals
      borderRadiusSM: 6,
      fontFamily: family,
      fontSize: 14,             // dense ERP baseline
      controlHeight,
      wireframe: false,
    },
    components: {
      Layout: {
        headerBg: dark ? 'rgba(17,21,31,0.72)' : 'rgba(255,255,255,0.72)',
        siderBg: dark ? '#11151F' : '#FFFFFF',
        headerHeight: 56,
      },
      Card: { borderRadiusLG: 12, paddingLG: 20 },
      Button: { fontWeight: 600, primaryShadow: `0 8px 30px ${hexA(primary, 0.4)}`, defaultShadow: 'none' },
      Table: {
        headerBg: dark ? '#161B27' : '#FAFBFC',
        borderColor: dark ? 'rgba(0,0,0,0.55)' : '#E2E6EC',
        cellPaddingBlock: 12,
        headerColor: PALETTE.ink[500],
      },
      Menu: { itemBorderRadius: 8, itemSelectedBg: hexA(primary, 0.16), itemSelectedColor: primary, itemHeight: 36 },
      Input: { borderRadius: 8, controlHeight: controlHeight + 2, activeShadow: `0 0 0 3px ${hexA(primary, 0.16)}` },
      Select: { borderRadius: 8, controlHeight: controlHeight + 2 },
      DatePicker: { borderRadius: 8 },
      Tag: { borderRadiusSM: 6, defaultBg: dark ? '#161B27' : '#ECEFF3' },
      Modal: { borderRadiusLG: 16 },
      Tabs: { inkBarColor: primary, itemSelectedColor: primary },
      Segmented: { itemSelectedBg: hexA(primary, 0.16), itemSelectedColor: primary },
    },
  };
}

/**
 * Back-compatible handoff API: `vertexTheme(dark, role)`. Resolves the role to
 * its accent via ROLE_ACCENTS and delegates to {@link buildVertexTheme}.
 */
export function vertexTheme(dark = true, role = 'owner'): ThemeConfig {
  return buildVertexTheme({ dark, accent: ROLE_ACCENTS[role] ?? PALETTE.accent });
}

/**
 * Injects the full token set as CSS variables on :root (+ a dark override on
 * [data-theme="dark"]). Call once at app start so custom components and the
 * accent ramp resolve from the same source as Ant Design.
 *
 * Accepts either a known role key (`owner`, `accountant`, …) or a raw hex accent
 * (e.g. the resolved live role accent) — anything starting with `#` is used as-is.
 */
export function vertexCssVars(roleOrAccent = 'owner'): string {
  const a = roleOrAccent.startsWith('#')
    ? roleOrAccent
    : (ROLE_ACCENTS[roleOrAccent] ?? PALETTE.accent);
  const mixW = (p: number) => `color-mix(in srgb, ${a} ${p}%, #fff)`;
  const mixB = (p: number) => `color-mix(in srgb, ${a} ${p}%, #000)`;
  return `
:root{
  --accent-500:${a};--accent-400:${mixW(80)};--accent-300:${mixW(58)};--accent-600:${mixB(82)};--accent-700:${mixB(62)};
  --accent-soft:color-mix(in srgb, ${a} 16%, transparent);--accent-glow:0 8px 30px color-mix(in srgb, ${a} 45%, transparent);
  --success-500:${PALETTE.success};--warning-500:${PALETTE.warning};--danger-500:${PALETTE.danger};--info-500:${PALETTE.info};
  --bg:${PALETTE.slate[50]};--surface:#fff;--surface-2:${PALETTE.slate[25]};--border:#E2E6EC;
  --ink-900:${PALETTE.ink[900]};--ink-700:${PALETTE.ink[700]};--ink-500:${PALETTE.ink[500]};--ink-300:${PALETTE.ink[300]};
  --font-ui:${FONT_UI};--font-display:${FONT_DISPLAY};--font-mono:${FONT_MONO};
  --radius-md:8px;--radius-lg:12px;--radius-sm:6px;
}
html[data-theme="dark"]{
  --bg:#0B0E14;--surface:#11151F;--surface-2:#161B27;--border:rgba(0,0,0,0.55);
  --ink-900:#ECEEF2;--ink-700:#C2C8D2;--ink-500:#8A93A3;--ink-300:#5C6473;
}`;
}
