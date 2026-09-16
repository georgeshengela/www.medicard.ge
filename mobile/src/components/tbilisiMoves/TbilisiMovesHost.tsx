import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/store/AuthContext';
import { subscribeTbilisiMovesLive } from '@/lib/tbilisiMoves/live';
import { getCompetitionSyncState, runCompetitionSync } from '@/lib/tbilisiMoves/sync';
import { schedulePostLoginWork } from '@/lib/safeStartup';

export function TbilisiMovesHost() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    const kick = (reason: 'foreground' | 'refresh' | 'live', force = false) => {
      void runCompetitionSync({ userId: user.id, reason, force });
    };
    schedulePostLoginWork('tbilisi-moves', () => kick('foreground'));
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') kick('foreground');
    });
    const interval = setInterval(() => {
      if ((getCompetitionSyncState().credited ?? 0) <= 0) kick('refresh', true);
    }, 15_000);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const offLive = subscribeTbilisiMovesLive(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => kick('live', true), 250);
    });
    return () => {
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      offLive();
      sub.remove();
    };
  }, [user?.id]);

  return null;
}
