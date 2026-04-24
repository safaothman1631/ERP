import React, { useMemo } from 'react';
import { ConfigProvider, theme as antTheme } from 'antd';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store';
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
  const isDark = appTheme === 'dark';

  const themeConfig = useMemo(() => ({
    algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
    token:      buildAntTokens(isDark ? 'dark' : 'light', density, isRTL),
    components: buildAntComponents(isDark ? 'dark' : 'light'),
    hashed: true,
  }), [isDark, density, isRTL]);

  return (
    <ConfigProvider direction={isRTL ? 'rtl' : 'ltr'} theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
};

export default AppConfigProvider;
