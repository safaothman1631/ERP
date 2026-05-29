/**
 * CalendarToggle — Gregorian / Hijri / Both selector (growth-to-100 § R4.11).
 */
import React, { useCallback } from 'react';
import { Radio, Space, Typography } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  type CalendarPreference,
  useCalendarPreference,
} from '../contexts/CalendarPreferenceContext';
import { formatHijri } from '../utils/hijri-date';
import { formatDate } from '../utils/formatDate';
import { useLanguage } from '../hooks/useLanguage';

const { Text } = Typography;

export const CalendarToggle: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const { language } = useLanguage();
  const { preference, setPreference, showHijri, showGregorian } = useCalendarPreference();

  const onChange = useCallback(
    (e: RadioChangeEvent) => {
      setPreference(e.target.value as CalendarPreference);
    },
    [setPreference],
  );

  const today = new Date();
  const previewLocale = language === 'en' ? 'en' : language === 'ar' ? 'ar' : 'ku';

  return (
    <Space direction="vertical" size="middle">
      <Text strong>
        {t('settings:calendar.title', { defaultValue: 'Calendar' })}
      </Text>
      <Radio.Group value={preference} onChange={onChange} optionType="button" buttonStyle="solid">
        <Radio.Button value="gregorian">
          {t('settings:calendar.gregorian', { defaultValue: 'Gregorian' })}
        </Radio.Button>
        <Radio.Button value="hijri">
          {t('settings:calendar.hijri', { defaultValue: 'Hijri' })}
        </Radio.Button>
        <Radio.Button value="both">
          {t('settings:calendar.both', { defaultValue: 'Both' })}
        </Radio.Button>
      </Radio.Group>
      <Text type="secondary">
        {t('settings:calendar.preview', { defaultValue: 'Preview' })}:{' '}
        <Text strong>
          {showGregorian && formatDate(today, language)}
          {showGregorian && showHijri && '  ·  '}
          {showHijri && formatHijri(today, previewLocale, 'medium')}
        </Text>
      </Text>
    </Space>
  );
});

CalendarToggle.displayName = 'CalendarToggle';

export default CalendarToggle;
