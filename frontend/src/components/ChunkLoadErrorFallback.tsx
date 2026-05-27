/**
 * ChunkLoadErrorFallback
 * ----------------------
 * Tiny, always-bundled component rendered when `lazyWithRetry` exhausts its
 * retry budget for a route-level chunk import. Lives in the app shell so the
 * surrounding layout never crashes (R3.5).
 *
 * Localization: uses the `common` i18n namespace which is shipped with the
 * shell on first paint, guaranteeing the error UI is readable even when the
 * route's own translation bundle is the thing that failed to load.
 *
 * Spec: world-class-performance — R3.4, R3.5, R1.5 (shell budget).
 */
import React from 'react';
import { Result, Button } from 'antd';
import { useTranslation } from 'react-i18next';

/**
 * Fullscreen, localized failure UI with a single "Reload" action.
 * Kept under 60 LOC and free of any non-shell imports.
 */
const ChunkLoadErrorFallback: React.FC = () => {
  const { t } = useTranslation('common');

  const handleReload = () => {
    // Hard reload — drops any stale chunk-hash mismatches that survived the
    // SPA navigation and forces the browser to re-resolve the current URL
    // against the freshly deployed `index.html`.
    window.location.reload();
  };

  return (
    <Result
      status="error"
      title={t('chunk.errorTitle', 'هەڵە لە بارکردنی پەڕە')}
      subTitle={t(
        'chunk.errorBody',
        'نەتوانرا ئەم بەشە بار بکرێت. تکایە دڵنیابە لە پەیوەندیی ئینتەرنێت و دواتر دووبارە هەوڵبدەرەوە.'
      )}
      extra={
        <Button type="primary" size="large" onClick={handleReload}>
          {t('chunk.reloadButton', 'پەڕە دووبارە بکەرەوە')}
        </Button>
      }
    />
  );
};

export default ChunkLoadErrorFallback;
