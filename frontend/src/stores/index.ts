/**
 * Barrel export for all Zustand stores.
 *
 * Persisted stores (localStorage):
 *   - useUiStore      — sidebarCollapsed, density, language
 *   - useNavStore     — favorites (max 10), recents (max 5)
 *   - useAuthStore    — user, token, theme, layoutMode
 *   - useOrgStore     — currentOrg, currentBranch
 *   - useDraftsStore  — form drafts by entity+id
 *
 * Session-only stores (no persist):
 *   - useNotificationsStore — notifications, unreadCount
 *   - useCommandStore       — command palette open/query
 */

export { useUiStore } from './uiStore';
export type { Density, Language } from './uiStore';

export { useNavStore } from './navStore';
export type { NavItem } from './navStore';

export { useAuthStore } from './authStore';
export type { AuthUser, ThemeMode, LayoutMode } from './authStore';

export { useOrgStore } from './orgStore';
export type { Org, Branch } from './orgStore';

export { useNotificationsStore } from './notificationsStore';
export type { Notification, NotificationSeverity } from './notificationsStore';

export { useCommandStore } from './commandStore';

export { useDraftsStore } from './draftsStore';
