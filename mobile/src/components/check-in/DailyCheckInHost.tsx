import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/store/AuthContext';

/**
 * Shows the streak screen when `/api/auth/me` awards today's 5-point bonus.
 * Relogin is not required — a normal app open hydrates and claims.
 */
export function DailyCheckInHost() {
  const { user, pendingDailyBonus, consumeDailyBonus, refresh } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const root = segments[0];
  const shownThisAward = useRef(false);

  useEffect(() => {
    shownThisAward.current = false;
  }, [pendingDailyBonus]);

  useEffect(() => {
    if (!user || !pendingDailyBonus) return;
    if (!root || root === '(auth)') return;
    if (shownThisAward.current) return;
    shownThisAward.current = true;

    const timer = setTimeout(() => {
      consumeDailyBonus();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      router.push('/profile/streak?bonus=1' as never);
    }, 700);

    return () => clearTimeout(timer);
  }, [user, pendingDailyBonus, root, consumeDailyBonus, router]);

  useEffect(() => {
    if (!user) return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void refresh();
    });
    return () => sub.remove();
  }, [user, refresh]);

  return null;
}
