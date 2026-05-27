/**
 * TodoPlaceholder — rendered for sections not yet migrated out of
 * `frontend/src/settings/sections/bodies.tsx` into per-section files.
 *
 * See `docs/settings/migration-plan.md` for the migration backlog.
 */

import React from 'react';
import { Alert, Space, Typography } from 'antd';
import { useTranslation } from 'react-i18next';

const TodoPlaceholder: React.FC = () => {
  const { t } = useTranslation(['settings', 'common']);
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Alert
        type="info"
        showIcon
        message={t('settings:migration.title', {
          defaultValue: 'Section pending migration',
        })}
        description={t('settings:migration.description', {
          defaultValue:
            'This section still lives in the legacy bodies.tsx monolith. It will be moved into its own file as part of the settings decomposition (R8.1).',
        })}
      />
      <Typography.Paragraph type="secondary" style={{ marginBlock: 0 }}>
        {t('settings:migration.handoff', {
          defaultValue:
            'See docs/settings/migration-plan.md for the per-section backlog and ownership.',
        })}
      </Typography.Paragraph>
    </Space>
  );
};

export default TodoPlaceholder;
