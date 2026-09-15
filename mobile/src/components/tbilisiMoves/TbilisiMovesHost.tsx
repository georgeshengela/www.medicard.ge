import Constants from 'expo-constants';
import React, { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/store/AuthContext';
import { runCompetitionSync } from '@/lib/tbilisiMoves/sync';

export function TbilisiMovesHost() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    if (Constants.appOwnership === 'expo') return;
    void runCompetitionSync({ userId: user.id, reason: 'foreground' });
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void runCompetitionSync({ userId: user.id, reason: 'foreground' });
      }
    });
    return () => sub.remove();
  }, [user?.id]);

  return null;
}
