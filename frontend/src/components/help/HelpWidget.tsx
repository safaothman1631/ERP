/**
 * HelpWidget — host for the Help & Support panel (HelpPanel).
 *
 * The trigger now lives in the TopBar (the Vertex kit puts Help in the top bar,
 * not a floating action button). This component is therefore HEADLESS: it
 * renders nothing visible and simply opens the HelpPanel drawer when the
 * `open-help-panel` window event fires (dispatched by the TopBar Help icon).
 * The panel itself (drawer + markdown loader) is still lazy-loaded on first open.
 */
import React, { Suspense, useEffect, useState } from 'react';

const HelpPanel = React.lazy(() => import('./HelpPanel'));

export interface HelpWidgetProps {
  /** Current route, used for contextual article suggestions. */
  route?: string;
  /** Host only on these routes; pass empty to always host. */
  onlyOn?: string[];
}

/** Window event the TopBar dispatches to open the Help & Support panel. */
export const OPEN_HELP_EVENT = 'open-help-panel';

export const HelpWidget: React.FC<HelpWidgetProps> = ({ route, onlyOn }) => {
  const [open, setOpen] = useState(false);

  const currentRoute =
    route ?? (typeof window !== 'undefined' ? window.location.pathname : '');

  // Open the panel when the TopBar Help icon (or anything else) dispatches the event.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(OPEN_HELP_EVENT, handler);
    return () => window.removeEventListener(OPEN_HELP_EVENT, handler);
  }, []);

  if (onlyOn && onlyOn.length > 0) {
    if (!onlyOn.some((r) => currentRoute.startsWith(r))) return null;
  }

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <HelpPanel
        open={open}
        route={currentRoute}
        onClose={() => setOpen(false)}
      />
    </Suspense>
  );
};

HelpWidget.displayName = 'HelpWidget';

export default HelpWidget;
