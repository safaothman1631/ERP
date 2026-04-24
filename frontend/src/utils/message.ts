/**
 * Global message utility — wraps Ant Design's App.useApp() message API so it
 * consumes ConfigProvider context (theme, dark mode, RTL, etc.) instead of
 * the deprecated static `message` from 'antd'.
 *
 * Usage:
 *   import { message } from '../utils/message';
 *   message.success('Saved!');
 *
 * The instance is registered once from AppInitializer in App.tsx.
 */
import type { MessageInstance } from 'antd/es/message/interface';
import { errorTracker } from './errorTracker';

let _msg: MessageInstance | null = null;

export function setMessageInstance(instance: MessageInstance): void {
  _msg = instance;
}

export const message = {
  success: (...args: Parameters<MessageInstance['success']>): void => {
    _msg?.success(...args);
  },
  error: (...args: Parameters<MessageInstance['error']>): void => {
    _msg?.error(...args);
    // feed support widget
    const first = args[0];
    const text = typeof first === 'string' ? first : (first as { content?: string })?.content || 'error';
    errorTracker.report(String(text));
  },
  warning: (...args: Parameters<MessageInstance['warning']>): void => {
    _msg?.warning(...args);
  },
  info: (...args: Parameters<MessageInstance['info']>): void => {
    _msg?.info(...args);
  },
  loading: (...args: Parameters<MessageInstance['loading']>): void => {
    _msg?.loading(...args);
  },
};
