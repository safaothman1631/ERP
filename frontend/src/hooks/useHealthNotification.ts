/**
 * useHealthNotification — Post-login health check notification hook.
 *
 * Fires once per login session for admin/owner users. Silently calls
 * GET /api/system/health/full and shows an Ant Design notification based
 * on the overall_status:
 *
 *   - "healthy"   → success notification, auto-dismisses after 4 seconds
 *   - "degraded"  → warning notification, persistent, with "View Details" link
 *   - "unhealthy" → error notification, persistent, with "View Details" link
 *
 * API failures are silently swallowed — this hook must never block the login
 * flow.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
import React, { useEffect, useRef } from 'react';
import { App as AntApp } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { usePermission } from './usePermission';

/** Path to the system health dashboard page. */
const HEALTH_DASHBOARD_PATH = '/settings/system-health';

/** Duration (seconds) for the healthy auto-dismiss notification (Requirement 3.2). */
const HEALTHY_DURATION_SECONDS = 4;

/**
 * Custom hook that fires a one-shot health check notification after login.
 *
 * Call this hook from the post-login layout (e.g. AppShell) so it runs once
 * per authenticated session. The `hasRun` ref ensures the API is called at
 * most once even if the component re-renders.
 *
 * Requirement 3.5 — Only fires for admin/owner roles.
 * Requirement 3.4 — API failures are silently suppressed.
 */
export function useHealthNotification(): void {
  const { notification } = AntApp.useApp();
  const navigate = useNavigate();
  const { isAdmin, isOwner } = usePermission();

  // One-shot flag: ensures the check runs at most once per mount (login session).
  const hasRun = useRef(false);

  useEffect(() => {
    // Requirement 3.5 — Skip for non-admin/non-owner users.
    if (!isAdmin && !isOwner) return;

    // One-shot guard — do not re-run on re-renders.
    if (hasRun.current) return;
    hasRun.current = true;

    // Fire-and-forget: silently call the health endpoint.
    (async () => {
      try {
        const res = await api.get<{
          overall_status: 'healthy' | 'degraded' | 'unhealthy';
        }>('/api/system/health/full');

        const { overall_status } = res.data;

        if (overall_status === 'healthy') {
          // Requirement 3.2 — Green success notification, auto-dismisses after 4s.
          notification.success({
            message: 'System Health',
            description: 'All systems are operating normally.',
            duration: HEALTHY_DURATION_SECONDS,
          });
        } else if (overall_status === 'degraded') {
          // Requirement 3.3 — Persistent warning notification with "View Details" link.
          notification.warning({
            message: 'System Health Warning',
            description: 'One or more system components are degraded.',
            duration: 0, // persistent — no auto-dismiss
            btn: React.createElement(
              'a',
              {
                role: 'button',
                style: { cursor: 'pointer', textDecoration: 'underline' },
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  // Requirement 3.3 — Navigate only on explicit click, never automatically.
                  navigate(HEALTH_DASHBOARD_PATH);
                },
              },
              'View Details'
            ),
          });
        } else if (overall_status === 'unhealthy') {
          // Requirement 3.3 — Persistent error notification with "View Details" link.
          // Requirement 3.3 — Do NOT auto-navigate; only navigate on explicit click.
          notification.error({
            message: 'System Health Critical',
            description: 'One or more system components are unhealthy.',
            duration: 0, // persistent — no auto-dismiss
            btn: React.createElement(
              'a',
              {
                role: 'button',
                style: { cursor: 'pointer', textDecoration: 'underline' },
                onClick: (e: React.MouseEvent) => {
                  e.preventDefault();
                  // Requirement 3.3 — Navigate only on explicit click, never automatically.
                  navigate(HEALTH_DASHBOARD_PATH);
                },
              },
              'View Details'
            ),
          });
        }
      } catch {
        // Requirement 3.4 — Silently suppress API errors; never block login flow.
      }
    })();
  }, [isAdmin, isOwner, navigate, notification]);
}
