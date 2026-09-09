import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Notifications } from '@/lib/expoNotifications';
import { QuotaReadySheet } from '@/components/QuotaReadySheet';
import { QUOTA_RESET_ROUTE, quotaResetKey, shouldAnnounceQuotaReady, tbilisiYmd } from '@/lib/quotaReset';
import {
  markQuotaResetShown,
  syncQuotaResetNotification,
  wasQuotaResetShown,
} from '@/lib/quotaResetNotification';
import { onUsageReset } from '@/lib/quest/socket';
import { useAuth } from '@/store/AuthContext';
import type { Usage } from '@/lib/api';

export function QuotaReadyHost() {
  const { user, usage, refresh } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const root = segments[0];
  const prevRef = useRef<Usage | null>(null);
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = usage;
    void syncQuotaResetNotification(usage);
    if (!user || !usage || root === '(auth)') return;

    const refillKey = usage.refilled && usage.refilledKey ? usage.refilledKey : null;
    const announce = shouldAnnounceQuotaReady(prev, usage);
    const resetKey = refillKey || (announce ? (prev?.resetAt ? quotaResetKey(prev) : `stale:${tbilisiYmd()}`) : null);
    if (!resetKey) return;
    void (async () => {
      if (await wasQuotaResetShown(resetKey)) return;
      await markQuotaResetShown(resetKey);
      setKey(resetKey);
      setOpen(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    })();
  }, [usage, user, root]);

  useEffect(() => {
    if (!user) return;
    const offSocket = onUsageReset(() => {
      void refresh();
    });
    const received = Notifications.addNotificationReceivedListener((notification) => {
      const data = (notification.request.content.data ?? {}) as Record<string, unknown>;
      if (data.type !== 'quota_reset' && data.family !== 'quotaReset') return;
      void refresh();
    });
    return () => {
      offSocket();
      received.remove();
    };
  }, [user, refresh]);

  const remaining = usage?.remaining ?? usage?.limit ?? 0;
  const limit = usage?.limit ?? 0;

  return (
    <QuotaReadySheet
      visible={open}
      remaining={Math.max(0, remaining)}
      limit={Math.max(0, limit)}
      onClose={() => {
        if (key) void markQuotaResetShown(key);
        setOpen(false);
      }}
      onAskMedi={() => {
        if (key) void markQuotaResetShown(key);
        setOpen(false);
        router.push(QUOTA_RESET_ROUTE as never);
      }}
    />
  );
}
