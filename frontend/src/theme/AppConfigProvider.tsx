import React, { useMemo } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';
import { useSettingsStore } from '../store/settingsStore';
import { buildAntTokens, buildAntComponents, type Density } from './tokens';

interface Props {
  children: React.ReactNode;
  density?: Density;
}

/**
 * AppConfigProvider — تەنها سەرچاوەی AntD theme لە سیستەم.
 * tokens لە theme/tokens.ts دێن — هیچ شوێنێکی تر color/spacing inline ناداتە.
 */
export const AppConfigProvider: React.FC<Props> = ({ children, density = 'default' }) => {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'ar' || i18n.language === 'ku';
  const appTheme = useAuthStore((s) => s.theme);
  const brandColor = useSettingsStore((s) => s.config.branding.primary_color);
  const isDark = appTheme === 'dark';

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
