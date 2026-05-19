import React from 'react';
import { message as antdMessage, notification, Button, Space } from 'antd';
import { useTranslation } from 'react-i18next';

/**
 * Toast wrapper — Sprint 6 — single API around AntD message + notification with optional Undo.
 * Replaces ad-hoc message.success calls with consistent semantics + i18n + a11y.
 */
export interface ToastOptions {
  description?: string;
  duration?: number;     // seconds
  onUndo?: () => void;
  undoLabel?: string;
  /** Optional key for de-dupe. */
  key?: string;
}

let api: ReturnType<typeof notification.useNotification>[0] | null = null;
let messageApi: ReturnType<typeof antdMessage.useMessage>[0] | null = null;

/**
 * Mount once at app root. Returns a context holder that must be rendered.
 * Includes an aria-live region for screen reader announcements (Requirement 17.1).
 */
export function useToastBridge() {
  const [notifApi, notifHolder] = notification.useNotification();
  const [msgApi, msgHolder] = antdMessage.useMessage();
  React.useEffect(() => { api = notifApi; messageApi = msgApi; }, [notifApi, msgApi]);
  return (
    <>
      {notifHolder}
      {msgHolder}
      {/* aria-live region for toast announcements — Requirement 17.1 */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        id="toast-announcer"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
    </>
  );
}

function emit(type: 'success' | 'info' | 'warning' | 'error', text: string, opts: ToastOptions = {}) {
  // Announce to aria-live region for screen readers — Requirement 17.1
  const announcer = document.getElementById('toast-announcer');
  if (announcer) {
    announcer.textContent = '';
    // Use setTimeout to ensure the DOM update triggers a new announcement
    setTimeout(() => { announcer.textContent = text; }, 50);
  }

  if (opts.onUndo && api) {
    api[type]({
      message: text,
      description: opts.description,
      duration: opts.duration ?? 5,
      key: opts.key,
      btn: (
        <Space>
          <Button size="small" type="primary" onClick={() => { opts.onUndo?.(); api?.destroy(opts.key); }}>
            {opts.undoLabel ?? 'Undo'}
          </Button>
        </Space>
      ),
    });
    return;
  }
  if (messageApi) {
    messageApi.open({ type, content: text, duration: opts.duration ?? 3, key: opts.key });
  } else {
    // Fallback when bridge not mounted yet
    antdMessage[type](text);
  }
}

export const toast = {
  success: (text: string, opts?: ToastOptions) => emit('success', text, opts),
  info:    (text: string, opts?: ToastOptions) => emit('info', text, opts),
  warning: (text: string, opts?: ToastOptions) => emit('warning', text, opts),
  error:   (text: string, opts?: ToastOptions) => emit('error', text, opts),
  /** Convenience helper for "saved" with i18n. */
  saved: (t: ReturnType<typeof useTranslation>['t']) => emit('success', t('toast.saved', 'Saved')),
  deleted: (t: ReturnType<typeof useTranslation>['t'], onUndo?: () => void) =>
    emit('success', t('toast.deleted', 'Deleted'), onUndo ? { onUndo, undoLabel: t('toast.undo', 'Undo') } : undefined),
};

export default toast;
