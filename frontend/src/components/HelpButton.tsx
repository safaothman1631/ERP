import React, { useState } from 'react';
import { Button, Tooltip } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import PageHelp from './PageHelp';
import { getPageHelp } from '../data/page-help';

interface HelpButtonProps {
  pageKey: string;
  size?: 'small' | 'middle' | 'large';
}

/**
 * Self-contained help trigger. Drop `<HelpButton pageKey="contacts" />` in any
 * page header and the drawer/state is handled internally. Bilingual content is
 * resolved from the active i18n language.
 */
const HelpButton: React.FC<HelpButtonProps> = ({ pageKey, size = 'middle' }) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const content = getPageHelp(pageKey, i18n.language);

  return (
    <>
      <Tooltip title={t('help')}>
        <Button
          type="text"
          size={size}
          icon={<QuestionCircleOutlined style={{ color: '#7B61FF' }} />}
          onClick={() => setOpen(true)}
          aria-label={t('help')}
        />
      </Tooltip>
      <PageHelp open={open} onClose={() => setOpen(false)} content={content} />
    </>
  );
};

export default HelpButton;
