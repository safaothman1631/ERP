import { useAuthStore } from '../store';

/**
 * useIsDark — live dark-mode flag from the app theme store.
 *
 * Use this as the DEFAULT for a design-system component's `isDark` prop so the
 * component adapts to dark mode even when the consumer doesn't thread `isDark`
 * down (the common case across the app). Subscribing here guarantees the
 * component re-renders when the theme is toggled.
 *
 * Pattern (keeps the prop override + stays rules-of-hooks safe):
 *   const themeDark = useIsDark();
 *   const isDark = isDarkProp ?? themeDark;
 */
export function useIsDark(): boolean {
  return useAuthStore((s) => s.theme === 'dark');
}

export default useIsDark;
