import { useEffect } from 'react';
import { onReturnToForeground } from '@/lib/appForeground';
import { useAuth } from '@/store/AuthContext';

/**
 * Foreground upkeep for a signed-in session: re-read `/api/auth/me`, the notification
 * permission and the offline cycle queue whenever the app comes back.
 *
 * The daily full-screen app-open streak celebration is retired (owner 2026-10-08):
 * it rewarded opening the app, not health. The server still records the daily claim
 * for data integrity and older builds; nothing in the app shows it. The streak screen
 * stays routable only for links in notifications sent before.
 */
export function DailyCheckInHost() {
  const { user, refresh } = useAuth();

  useEffect(() => {
    if (!user) return;
    return onReturnToForeground(() => {
      {
        void refresh();
        void import('@/lib/notifications').then(async ({ getNotificationPermissionGranted }) => {
          const granted = await getNotificationPermissionGranted();
          const { syncNotificationPermission } = await import('@/lib/productObservability');
          await syncNotificationPermission(granted ? 'enabled' : 'disabled');
        });
        if (user.id) {
          void import('@/lib/cycleOffline').then(({ flushCycleQueue }) =>
            flushCycleQueue(user.id).catch(() => undefined),
          );
        }
      }
    });
  }, [user, refresh]);

  return null;
}
