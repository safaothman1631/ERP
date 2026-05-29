/**
 * DigitPreferenceToggle — settings UI for the Arabic-Indic vs Latin digits
 * tenant-level choice (growth-to-100 § R4.8).
 */
import React, { useCallback } from 'react';
import { Radio, Space, Typography } from 'antd';
import type { RadioChangeEvent } from 'antd';
import { useTranslation } from 'react-i18next';

import {
  type DigitPreference,
  useDigitPreference,
} from '../../contexts/DigitPreferenceContext';
import { toArabicIndic } from '../../utils/arabic-digits';

const { Text } = Typography;

const PREVIEW_NUMBER = 1_234_567;

export const DigitPreferenceToggle: React.FC = React.memo(() => {
  const { t } = useTranslation(['settings', 'common']);
  const { preference, setPreference, useArabicIndic } = useDigitPreference();

  const onChange = useCallback(
    (e: RadioChangeEvent) => {
      setPreference(e.target.value as DigitPreference);
    },
    [setPreference],
  );

  return (
    <Space direction="vertical" size="middle">
      <Text strong>
        {t('settings:digits.title', { defaultValue: 'Number digits' })}
      </Text>
      <Radio.Group value={preference} onChange={onChange} optionType="button" buttonStyle="solid">
        <Radio.Button value="auto">
          {t('settings:digits.auto', { defaultValue: 'Auto (by language)' })}
        </Radio.Button>
        <Radio.Button value="latin">
          {t('settings:digits.latin', { defaultValue: 'Latin (0–9)' })}
        </Radio.Button>
        <Radio.Button value="indic">
          {t('settings:digits.indic', { defaultValue: 'Arabic-Indic (٠–٩)' })}
        </Radio.Button>
      </Radio.Group>
      <Text type="secondary">
        {t('settings:digits.preview', { defaultValue: 'Preview' })}:{' '}
        <Text strong>
          {useArabicIndic
            ? toArabicIndic(PREVIEW_NUMBER.toLocaleString('en-US'))
            : PREVIEW_NUMBER.toLocaleString('en-US')}
        </Text>
      </Text>
    </Space>
  );
});

DigitPreferenceToggle.displayName = 'DigitPreferenceToggle';

export default DigitPreferenceToggle;
