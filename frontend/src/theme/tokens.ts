/**
 * Zoho ERP — Design Tokens
 * یەک سەرچاوەی هەڵنابڕاو بۆ هەموو Color / Spacing / Typography / Motion.
 * هیچ inline color/spacing لە کۆد قبوڵ نییە — تەنها ئەم tokens.
 */

// ───────────────────────────── Brand Palette ─────────────────────────────
export const palette = {
  // Primary — Zoho-inspired modern blue
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

  // Semantic
  success: '#16A34A',
  successBg: '#DCFCE7',
  warning: '#F59E0B',
  warningBg: '#FEF3C7',
  danger:  '#DC2626',
  dangerBg: '#FEE2E2',
  info:    '#0EA5E9',
  infoBg:  '#E0F2FE',

  // Neutrals — Light
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
export const fontFamily = {
  // RTL stack: Vazirmatn supports Arabic + Kurdish-Sorani well; falls back to Noto Sans Arabic.
  rtl: "'Vazirmatn', 'Noto Sans Arabic', 'Segoe UI', system-ui, sans-serif",
  ltr: "'Inter', 'Segoe UI', system-ui, sans-serif",
  mono:"'JetBrains Mono', 'Menlo', monospace",
} as const;

export const fontSize = {
  xs:   12,
  sm:   13,
  base: 14,
  md:   15,
  lg:   16,
  xl:   18,
  h4:   20,
  h3:   24,
  h2:   30,
  h1:   36,
} as const;

// ───────────────────────────── Control sizing (density) ─────────────────────────────
export const controlHeight = {
  compact: 32,
  default: 36,
  comfort: 44,
} as const;

// ───────────────────────────── Motion ─────────────────────────────
export const motion = {
  durFast:    120,
  durBase:    200,
  durSlow:    320,
  easeStandard:'cubic-bezier(0.2, 0, 0, 1)',
  easeEmph:   'cubic-bezier(0.3, 0, 0, 1)',
} as const;

// ───────────────────────────── Shadow ─────────────────────────────
export const shadow = {
  sm: '0 1px 2px rgba(15,23,42,0.06)',
  md: '0 4px 12px rgba(15,23,42,0.08)',
  lg: '0 12px 32px rgba(15,23,42,0.12)',
  primary: '0 6px 16px rgba(31,111,235,0.28)',
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

// ───────────────────────────── AntD Token Bundles ─────────────────────────────
export type Density = 'compact' | 'default' | 'comfort';

export const buildAntTokens = (mode: 'light' | 'dark', density: Density, isRTL: boolean) => {
  const ch = controlHeight[density];
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
