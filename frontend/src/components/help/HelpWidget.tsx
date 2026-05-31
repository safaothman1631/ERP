/**
 * HelpWidget — floating help button (G2 / R2.6).
 *
 * Renders a "?" floating action button at the bottom-end corner of the
 * viewport (RTL-aware via `insetInlineEnd`). Clicking opens the
 * `HelpPanel` drawer.
 *
 * The widget is intentionally tiny — it defers loading of the panel
 * (drawer + markdown loader) until first open via `React.lazy`.
 */
import React, { Suspense, useState } from 'react';
import { FloatButton } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const HelpPanel = React.lazy(() => import('./HelpPanel'));

export interface HelpWidgetProps {
  /** Current route, used for contextual article suggestions. */
  route?: string;
  /** Show only on these routes; pass empty to always show. */
  onlyOn?: string[];
}

export const HelpWidget: React.FC<HelpWidgetProps> = ({ route, onlyOn }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const currentRoute =
    route ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  if (onlyOn && onlyOn.length > 0) {
    if (!onlyOn.some((r) => currentRoute.startsWith(r))) return null;
  }

  return (
    <>
      <FloatButton
        type="primary"
        icon={<QuestionCircleOutlined />}
        tooltip={t('help.openHelp', 'Help & support')}
        onClick={() => setOpen(true)}
        aria-label={t('help.openHelp', 'Help & support')}
        style={{ insetInlineEnd: 24, bottom: 24 }}
        data-testid="help-widget-toggle"
      />
      {open && (
        <Suspense fallback={null}>
          <HelpPanel
            open={open}
            route={currentRoute}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      )}
    </>
  );
};

HelpWidget.displayName = 'HelpWidget';

export default HelpWidget;
