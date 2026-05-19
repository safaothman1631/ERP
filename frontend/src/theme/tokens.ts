/**
 * Zoho ERP — Design Tokens
 * یەک سەرچاوەی هەڵنابڕاو بۆ هەموو Color / Spacing / Typography / Motion.
 * هیچ inline color/spacing لە کۆد قبوڵ نییە — تەنها ئەم tokens.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */

// ───────────────────────────── Brand Palette ─────────────────────────────
export const palette = {
  // Primary — Zoho-inspired modern blue (shades 50–900)
  primary50:  '#EBF2FF',
  primary100: '#D6E4FF',
  primary200: '#ADC8FF',
  primary300: '#84A9FF',
  primary400: '#5B8DEF',
  primary500: '#1F6FEB', // brand
  primary600: '#1858BF',
  primary700: '#114393',
  primary800: '#0B2F66',
  primary900: '#061B3A',

  // Semantic — success (green scale)
  success50:  '#F0FDF4',
  success100: '#DCFCE7',
  success200: '#BBF7D0',
  success300: '#86EFAC',
  success400: '#4ADE80',
  success500: '#16A34A', // base
  success600: '#15803D',
  success700: '#166534',
  success800: '#14532D',
  success900: '#052E16',
  success:    '#16A34A',
  successBg:  '#DCFCE7',
  successDark:'#4ADE80',
  successDarkBg: 'rgba(74,222,128,0.12)',

  // Semantic — warning (amber scale)
  warning50:  '#FFFBEB',
  warning100: '#FEF3C7',
  warning200: '#FDE68A',
  warning300: '#FCD34D',
  warning400: '#FBBF24',
  warning500: '#F59E0B', // base
  warning600: '#D97706',
  warning700: '#B45309',
  warning800: '#92400E',
  warning900: '#451A03',
  warning:    '#F59E0B',
  warningBg:  '#FEF3C7',
  warningDark:'#FBBF24',
  warningDarkBg: 'rgba(251,191,36,0.12)',

  // Semantic — error/danger (red scale)
  error50:  '#FFF1F2',
  error100: '#FFE4E6',
  error200: '#FECDD3',
  error300: '#FDA4AF',
  error400: '#FB7185',
  error500: '#DC2626', // base
  error600: '#B91C1C',
  error700: '#991B1B',
  error800: '#7F1D1D',
  error900: '#450A0A',
  danger:   '#DC2626',
  dangerBg: '#FEE2E2',
  dangerDark:'#FB7185',
  dangerDarkBg: 'rgba(251,113,133,0.12)',

  // Semantic — info (sky scale)
  info50:  '#F0F9FF',
  info100: '#E0F2FE',
  info200: '#BAE6FD',
  info300: '#7DD3FC',
  info400: '#38BDF8',
  info500: '#0EA5E9', // base
  info600: '#0284C7',
  info700: '#0369A1',
  info800: '#075985',
  info900: '#0C4A6E',
  info:    '#0EA5E9',
  infoBg:  '#E0F2FE',
  infoDark:'#38BDF8',
  infoDarkBg: 'rgba(56,189,248,0.12)',

  // Neutrals — gray scale (50–900)
  gray50:  '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Neutrals — semantic aliases (Light)
  ink900: '#0F172A',
  ink700: '#334155',
  ink500: '#64748B',
  ink300: '#94A3B8',
  ink100: '#E2E8F0',
  bg:     '#F8FAFC',
  surface:'#FFFFFF',
  border: '#E5E7EB',

  // Neutrals — Dark
  darkBg:        '#0B1220',
  darkSurface:   '#111A2E',
  darkElevated:  '#172238',
  darkBorder:    'rgba(148, 163, 184, 0.16)',
  darkInk:       '#E2E8F0',
  darkInkMuted:  '#94A3B8',
} as const;

// ───────────────────────────── Spacing scale (4pt grid) ─────────────────────────────
/** Named semantic spacing aliases */
export const space = {
  xxs: 2,
  xs:  4,
  sm:  8,
  md:  12,
  lg:  16,
  xl:  24,
  xxl: 32,
  xxxl:48,
} as const;

/**
 * Numeric spacing scale — 4px base unit.
 * Usage: spacing[4] === 16px, spacing[6] === 24px, etc.
 * Requirements: 3.2
 */
export const spacing = {
  0:  0,
  1:  4,
  2:  8,
  3:  12,
  4:  16,
  5:  20,
  6:  24,
  7:  28,
  8:  32,
  9:  36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

// ───────────────────────────── Radius ─────────────────────────────
export const radius = {
  xs: 4,
  sm: 6,
  md: 10, // default controls
  lg: 14, // cards, modals
  xl: 18,
  pill: 999,
} as const;

// ───────────────────────────── Typography ─────────────────────────────
/**
 * Font families — Latin (LTR) and Arabic/Kurdish RTL stacks.
 * Requirements: 3.3, 3.5
 */
export const fontFamily = {
  // RTL stack: Vazirmatn supports Arabic + Kurdish-Sorani well; falls back to Noto Sans Arabic.
  rtl: "'Vazirmatn', 'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif",
  ltr: "'Inter', 'Segoe UI', system-ui, sans-serif",
  mono:"'JetBrains Mono', 'Menlo', monospace",
} as const;

/**
 * Font sizes — xs through 5xl.
 * Requirements: 3.3
 */
export const fontSize = {
  xs:   12,
  sm:   13,
  base: 14,
  md:   15,
  lg:   16,
  xl:   18,
  '2xl':20,
  '3xl':24,
  '4xl':30,
  '5xl':36,
  // Legacy aliases (kept for backward compatibility)
  h4:   20,
  h3:   24,
  h2:   30,
  h1:   36,
} as const;

/**
 * Font weights — light through bold.
 * Requirements: 3.3
 */
export const fontWeight = {
  light:    300,
  regular:  400,
  medium:   500,
  semibold: 600,
  bold:     700,
  extrabold:800,
} as const;

/**
 * Line heights — unitless multipliers.
 * Requirements: 3.3
 */
export const lineHeight = {
  none:    1,
  tight:   1.25,
  snug:    1.375,
  normal:  1.5,
  relaxed: 1.625,
  loose:   2,
  // Pixel values for specific sizes
  xs:  16,
  sm:  18,
  base:20,
  md:  22,
  lg:  24,
  xl:  28,
  '2xl':30,
  '3xl':32,
  '4xl':40,
  '5xl':44,
} as const;

// ───────────────────────────── Control sizing (density) ─────────────────────────────
export const controlHeight = {
  compact:     32,
  default:     36,
  comfortable: 36,
  comfort:     44,
  spacious:    44,
} as const;

// ───────────────────────────── Motion ─────────────────────────────
/**
 * Duration tokens — fast: 150ms, normal: 250ms, slow: 400ms.
 * Requirements: 3.4
 */
export const duration = {
  instant:  0,
  fast:     150,
  normal:   250,
  slow:     400,
  verySlow: 600,
} as const;

/** @deprecated Use `duration` instead. Kept for backward compatibility. */
export const motion = {
  durFast:    120,
  durBase:    200,
  durSlow:    320,
  easeStandard:'cubic-bezier(0.2, 0, 0, 1)',
  easeEmph:   'cubic-bezier(0.3, 0, 0, 1)',
} as const;

/** Easing functions */
export const easing = {
  standard: 'cubic-bezier(0.2, 0, 0, 1)',
  emphasized:'cubic-bezier(0.3, 0, 0, 1)',
  decelerate:'cubic-bezier(0, 0, 0.2, 1)',
  accelerate:'cubic-bezier(0.4, 0, 1, 1)',
  linear:    'linear',
} as const;

// ───────────────────────────── Shadow ─────────────────────────────
/**
 * Shadow tokens — sm, md, lg, xl.
 * Requirements: 3.2
 */
export const shadow = {
  none: 'none',
  sm:   '0 1px 2px rgba(15,23,42,0.06)',
  md:   '0 4px 12px rgba(15,23,42,0.08)',
  lg:   '0 12px 32px rgba(15,23,42,0.12)',
  xl:   '0 24px 48px rgba(15,23,42,0.18), 0 8px 16px rgba(15,23,42,0.08)',
  primary: '0 6px 16px rgba(31,111,235,0.28)',
  // Dark mode variants
  dark: {
    none: 'none',
    sm:   '0 1px 2px rgba(0,0,0,0.30)',
    md:   '0 4px 12px rgba(0,0,0,0.40)',
    lg:   '0 12px 32px rgba(0,0,0,0.50)',
    xl:   '0 24px 48px rgba(0,0,0,0.60), 0 8px 16px rgba(0,0,0,0.40)',
  },
} as const;

// ───────────────────────────── Status (semantic with bg/border/hover) ─────────────────────────────
/** Sprint 1 — semantic status surface tokens. */
export const status = {
  success: { fg: palette.success, bg: palette.successBg, border: '#86EFAC', hover: '#16A34A' },
  warning: { fg: palette.warning, bg: palette.warningBg, border: '#FCD34D', hover: '#D97706' },
  danger:  { fg: palette.danger,  bg: palette.dangerBg,  border: '#FCA5A5', hover: '#B91C1C' },
  info:    { fg: palette.info,    bg: palette.infoBg,    border: '#7DD3FC', hover: '#0284C7' },
  neutral: { fg: palette.ink700,  bg: palette.bg,        border: palette.border, hover: palette.ink900 },
} as const;
export type StatusKey = keyof typeof status;

// ───────────────────────────── Z-Index Scale ─────────────────────────────
export const zIndex = {
  base:     0,
  dropdown: 1000,
  sticky:   1100,
  drawer:   1200,
  modal:    1300,
  popover:  1400,
  toast:    1500,
  tooltip:  1600,
} as const;

// ───────────────────────────── Typography Ramp (semantic) ─────────────────────────────
export const typography = {
  display:  { size: 36, lh: 44, weight: 700 },
  h1:       { size: 28, lh: 36, weight: 700 },
  h2:       { size: 22, lh: 30, weight: 600 },
  h3:       { size: 18, lh: 26, weight: 600 },
  bodyLg:   { size: 15, lh: 22, weight: 400 },
  body:     { size: 14, lh: 20, weight: 400 },
  bodySm:   { size: 13, lh: 18, weight: 400 },
  caption:  { size: 12, lh: 16, weight: 500 },
  overline: { size: 11, lh: 14, weight: 600, letterSpacing: 0.5, uppercase: true },
} as const;

// ───────────────────────────── Data Viz Palette ─────────────────────────────
export const dataViz = {
  categorical: ['#1F6FEB', '#16A34A', '#F59E0B', '#DC2626', '#0EA5E9', '#8B5CF6', '#EC4899', '#14B8A6'],
  sequential:  ['#EBF2FF', '#D6E4FF', '#ADC8FF', '#84A9FF', '#5B8DEF', '#1F6FEB', '#1858BF', '#114393'],
  diverging:   ['#DC2626', '#F59E0B', '#FCD34D', '#E5E7EB', '#7DD3FC', '#0EA5E9', '#1F6FEB'],
} as const;

// ───────────────────────────── Elevation (depth scale) ─────────────────────────────
/** Sprint 1 v2 — elevation scale (light + dark variants). */
export const elevation = {
  flat:     'none',
  raised:   '0 1px 2px rgba(15,23,42,0.06), 0 1px 3px rgba(15,23,42,0.04)',
  floating: '0 4px 12px rgba(15,23,42,0.08), 0 2px 4px rgba(15,23,42,0.04)',
  overlay:  '0 12px 32px rgba(15,23,42,0.12), 0 4px 8px rgba(15,23,42,0.06)',
  popover:  '0 16px 48px rgba(15,23,42,0.18), 0 8px 16px rgba(15,23,42,0.08)',
  dark: {
    flat:     'none',
    raised:   '0 1px 2px rgba(0,0,0,0.30), 0 1px 3px rgba(0,0,0,0.20)',
    floating: '0 4px 12px rgba(0,0,0,0.40), 0 2px 4px rgba(0,0,0,0.20)',
    overlay:  '0 12px 32px rgba(0,0,0,0.50), 0 4px 8px rgba(0,0,0,0.30)',
    popover:  '0 16px 48px rgba(0,0,0,0.60), 0 8px 16px rgba(0,0,0,0.40)',
  },
} as const;

// ───────────────────────────── Transitions (semantic) ─────────────────────────────
export const transitions = {
  micro: `all ${motion.durFast}ms ${motion.easeStandard}`,
  base:  `all ${motion.durBase}ms ${motion.easeStandard}`,
  emph:  `all ${motion.durSlow}ms ${motion.easeEmph}`,
} as const;

// ───────────────────────────── Layout dimensions ─────────────────────────────
/** Sprint 1 v2 — fixed layout dimensions (px). */
export const layout = {
  topbarHeight:        60,
  topbarHeightCompact: 52,
  footerHeight:        32,
  sidebarWidth:        320,
  sidebarWidthCompact: 272,
  sidebarCollapsed:    72,
  pagePaddingX:        24,
  pagePaddingY:        24,
  contentMaxWidth:     1440,
  detailSplitMin:      260,
  detailSplitMax:      520,
  detailSplitDefault:  320,
} as const;

// ───────────────────────────── Accessibility ─────────────────────────────
export const a11y = {
  minTouchTarget: 44,           // WCAG 2.1 AA
  minTouchTargetCompact: 32,    // desktop only
  focusRingWidth: 2,
  focusRingOffset: 2,
  focusRingColor: palette.primary500,
  focusRingColorDark: palette.primary300,
} as const;

// ───────────────────────────── High-Contrast palette ─────────────────────────────
/** Sprint 1 v2 — High-contrast mode. */
export const hcLight = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  ink: '#000000',
  border: '#000000',
  primary: '#0033CC',
  danger: '#B00000',
  success: '#006400',
  focus: '#0033CC',
} as const;
export const hcDark = {
  bg: '#000000',
  surface: '#000000',
  ink: '#FFFFFF',
  border: '#FFFFFF',
  primary: '#66B0FF',
  danger: '#FF6B6B',
  success: '#7FFF7F',
  focus: '#FFFF00',
} as const;

// ───────────────────────────── Glass Morphism ─────────────────────────────
/**
 * Glass morphism tokens for Topbar, Command Palette, Login card, and Modals.
 * Requirements: 12.1–12.6
 */
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
} as const;

/**
 * Returns a GlassStyle object for use in inline styles or CSS-in-JS.
 * Uses the glass token map for consistent values across all surfaces.
 * Falls back to solid surface token when backdrop-filter is unsupported.
 * Requirements: 12.1–12.6
 */
export interface GlassStyle {
  backdropFilter: string;
  WebkitBackdropFilter: string;
  background: string;
  border: string;
  boxShadow: string;
  /** Solid fallback background for @supports not (backdrop-filter) */
  fallbackBackground: string;
}

/**
 * Surface keys that map to the glass token map.
 * Use 'topbar' for the sticky header, 'palette' for the command palette,
 * 'login' for the login page card, 'modal' for modals and drawers.
 */
export type GlassSurface = keyof typeof glass;

/**
 * Returns a GlassStyle object for a given surface and mode.
 * The blur parameter overrides the token blur when provided.
 *
 * @param mode    - 'light' | 'dark'
 * @param blur    - backdrop-filter blur radius in px (uses token value when 0)
 * @param surface - which glass token surface to use (default: 'modal')
 *
 * Requirements: 12.1–12.6
 */
export function getGlassStyle(
  mode: 'light' | 'dark',
  blur: number,
  surface: GlassSurface = 'modal',
): GlassStyle {
  const isDark = mode === 'dark';
  const tokens = glass[surface][isDark ? 'dark' : 'light'];

  // Use the provided blur if non-zero, otherwise extract from the token blur string
  const blurValue = blur > 0 ? blur : parseInt(tokens.blur.match(/blur\((\d+)px\)/)?.[1] ?? '20', 10);
  const backdropFilterValue = blur > 0
    ? `blur(${blurValue}px)`
    : tokens.blur;

  return {
    backdropFilter: backdropFilterValue,
    WebkitBackdropFilter: backdropFilterValue,
    background: tokens.bg,
    border: `1px solid ${tokens.border}`,
    boxShadow: isDark ? shadow.dark.lg : shadow.lg,
    fallbackBackground: isDark ? palette.darkSurface : palette.surface,
  };
}

// ───────────────────────────── AntD Token Bundles ─────────────────────────────
/**
 * Density type — three modes with concrete base spacing.
 * compact: 4px grid, 32px controlHeight, 16px page padding (ERP default)
 * comfortable: 6px grid, 36px controlHeight, 20px page padding
 * spacious: 8px grid, 44px controlHeight, 24px page padding
 * Requirements: 1.5
 */
export type Density = 'compact' | 'default' | 'comfortable' | 'comfort' | 'spacious';

/** Page padding per density mode */
export const densityPagePadding: Record<Density, number> = {
  compact:     16,
  default:     20,
  comfortable: 20,
  comfort:     24,
  spacious:    24,
} as const;

export const buildAntTokens = (mode: 'light' | 'dark', density: Density, isRTL: boolean) => {
  const ch = controlHeight[density] ?? controlHeight.default;
  const family = isRTL ? fontFamily.rtl : fontFamily.ltr;

  const base = {
    colorPrimary: palette.primary500,
    colorSuccess: palette.success,
    colorWarning: palette.warning,
    colorError:   palette.danger,
    colorInfo:    palette.info,
    borderRadius:    radius.md,
    borderRadiusLG:  radius.lg,
    borderRadiusSM:  radius.sm,
    borderRadiusXS:  radius.xs,
    controlHeight:   ch,
    controlHeightLG: ch + 8,
    controlHeightSM: ch - 4,
    fontFamily:      family,
    fontSize:        fontSize.base,
    fontSizeHeading1:fontSize.h1,
    fontSizeHeading2:fontSize.h2,
    fontSizeHeading3:fontSize.h3,
    fontSizeHeading4:fontSize.h4,
    motionDurationFast: `${motion.durFast}ms`,
    motionDurationMid:  `${motion.durBase}ms`,
    motionDurationSlow: `${motion.durSlow}ms`,
    motionEaseInOut:    motion.easeStandard,
    boxShadow:          shadow.md,
    boxShadowSecondary: shadow.sm,
    boxShadowTertiary:  shadow.sm,
  };

  if (mode === 'dark') {
    return {
      ...base,
      colorBgBase:      palette.darkBg,
      colorBgLayout:    palette.darkBg,
      colorBgContainer: palette.darkSurface,
      colorBgElevated:  palette.darkElevated,
      colorBorder:          palette.darkBorder,
      colorBorderSecondary: palette.darkBorder,
      colorText:          palette.darkInk,
      colorTextSecondary: palette.darkInkMuted,
      colorTextTertiary:  palette.ink500,
    };
  }

  return {
    ...base,
    colorBgBase:      palette.surface,
    colorBgLayout:    palette.bg,
    colorBgContainer: palette.surface,
    colorBgElevated:  palette.surface,
    colorBorder:          palette.border,
    colorBorderSecondary: palette.ink100,
    colorText:          palette.ink900,
    colorTextSecondary: palette.ink500,
    colorTextTertiary:  palette.ink300,
  };
};

export const buildAntComponents = (mode: 'light' | 'dark') => {
  const isDark = mode === 'dark';
  return {
    Card:   { borderRadiusLG: radius.lg, paddingLG: space.lg },
    Table:  {
      headerBg:        isDark ? palette.darkElevated : '#F8FAFC',
      headerColor:     isDark ? palette.darkInk : palette.ink700,
      rowHoverBg:      isDark ? 'rgba(31,111,235,0.08)' : palette.primary50,
      borderRadius:    radius.md,
      cellPaddingBlock:10,
    },
    Button: { borderRadius: radius.md, primaryShadow: shadow.primary, fontWeight: 500 },
    Modal:  { borderRadiusLG: radius.lg, contentBg: isDark ? palette.darkSurface : palette.surface },
    Menu:   {
      itemBorderRadius:    radius.sm,
      subMenuItemBg:       'transparent',
      darkItemBg:          'transparent',
      darkItemSelectedBg:  'rgba(31,111,235,0.18)',
      darkItemHoverBg:     'rgba(255,255,255,0.04)',
    },
    Input:  { borderRadius: radius.md },
    Select: { borderRadius: radius.md },
    Tag:    { borderRadiusSM: radius.sm, defaultBg: isDark ? palette.darkElevated : palette.bg },
    Tabs:   { itemSelectedColor: palette.primary500, inkBarColor: palette.primary500 },
    Drawer: { colorBgElevated: isDark ? palette.darkSurface : palette.surface },
    Layout: {
      headerBg: isDark ? palette.darkSurface : palette.surface,
      siderBg:  isDark ? palette.darkSurface : palette.surface,
      bodyBg:   isDark ? palette.darkBg : palette.bg,
    },
  };
};
