import React, { useEffect, useRef, useState } from 'react';
import { Button } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface Props {
  loading?: boolean;
  onClick: () => void;
  label?: string;
}

/** Save button with brief success morph after save completes (Phase G6). */
const GlassSaveButton: React.FC<Props> = ({ loading, onClick, label }) => {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(false);
  const wasLoading = useRef(false);

  useEffect(() => {
    if (wasLoading.current && !loading) {
      setSaved(true);
      const tmr = setTimeout(() => setSaved(false), 1800);
      return () => clearTimeout(tmr);
    }
    wasLoading.current = !!loading;
  }, [loading]);

  return (
    <Button
      type="primary"
      loading={loading}
      icon={saved && !loading ? <CheckOutlined /> : undefined}
      onClick={onClick}
      style={{
        background: saved && !loading ? '#16A34A' : 'var(--role-accent, #7B61FF)',
        borderColor: saved && !loading ? '#16A34A' : 'var(--role-accent, #7B61FF)',
        transition: 'background 0.25s ease, border-color 0.25s ease',
      }}
    >
      {saved && !loading ? t('saved', 'Saved') : (label ?? t('save_changes', 'Save changes'))}
    </Button>
  );
};

export default GlassSaveButton;
