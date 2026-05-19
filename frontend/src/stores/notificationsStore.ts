import { create } from 'zustand';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  title: string;
  message?: string;
  severity: NotificationSeverity;
  /** ISO timestamp */
  createdAt: string;
  read: boolean;
  /** Optional link to navigate to on click */
  href?: string;
}

interface NotificationsState {
  notifications: Notification[];
  /** Count of unread notifications */
  unreadCount: number;

  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

let _idCounter = 0;
function generateId(): string {
  return `notif-${Date.now()}-${++_idCounter}`;
}

export const useNotificationsStore = create<NotificationsState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (notification) => {
    const newNotif: Notification = {
      ...notification,
      id: generateId(),
      createdAt: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotif, ...get().notifications];
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  markAsRead: (id) => {
    const updated = get().notifications.map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  markAllAsRead: () => {
    const updated = get().notifications.map((n) => ({ ...n, read: true }));
    set({ notifications: updated, unreadCount: 0 });
  },

  removeNotification: (id) => {
    const updated = get().notifications.filter((n) => n.id !== id);
    set({
      notifications: updated,
      unreadCount: updated.filter((n) => !n.read).length,
    });
  },

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
