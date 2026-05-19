import React, { useMemo } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';
import { useSettingsStore } from '../store/settingsStore';
import { useUiStore } from '../stores/uiStore';
import { buildAntTokens, buildAntComponents, type Density } from './tokens';

interface Props {
  children: React.ReactNode;
  /** Override density — if omitted, reads from useUiStore (persisted preference). */
  density?: Density;
}

/**
 * AppConfigProvider — تەنها سەرچاوەی AntD theme لە سیستەم.
 * tokens لە theme/tokens.ts دێن — هیچ شوێنێکی تر color/spacing inline ناداتە.
 *
 * Reads theme from useAuthStore (persisted under localStorage key "theme"),
 * density from useUiStore (persisted under localStorage key "ui.density"),
 * and direction from i18n language.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.5, 1.7, 1.9
 */
export const AppConfigProvider: React.FC<Props> = ({ children, density: densityProp }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar' || i18n.language === 'ku';
  const appTheme = useAuthStore((s) => s.theme);
  const brandColor = useSettingsStore((s) => s.config.branding.primary_color);
  const storeDensity = useUiStore((s) => s.density);
  const isDark = appTheme === 'dark';

  // Prop overrides store value (for storybook / testing); store value is the
  // persisted user preference (localStorage key "ui.density").
  const density: Density = densityProp ?? storeDensity;

  const themeConfig = useMemo(() => {
    const baseTokens = buildAntTokens(isDark ? 'dark' : 'light', density, isRTL);
    return {
      algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
      token: brandColor ? { ...baseTokens, colorPrimary: brandColor } : baseTokens,
      components: buildAntComponents(isDark ? 'dark' : 'light'),
      hashed: true,
    };
  }, [isDark, density, isRTL, brandColor]);

  return (
    <ConfigProvider direction={isRTL ? 'rtl' : 'ltr'} theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
};

export default AppConfigProvider;
