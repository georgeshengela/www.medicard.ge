import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/AuthContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { connectQuestSocket, disconnectQuestSocket, markQuestCelebration, onQuestSocketCompleted } from '@/lib/quest/socket';
import { syncQuestBridges } from '@/lib/quest/sync';
import { readQuestCache, requestQuestRefresh, subscribeQuestLevelUp, type QuestLevelUpShow } from '@/lib/quest/cache';
import { QuestLevelUpSheet } from '@/components/quest/QuestLevelUpSheet';
import { q } from '@/lib/quest/copy';
import { useThemeColors } from '@/theme/colors';

const STALE_MS = 2 * 60 * 1000;

export function QuestHost() {
  const { user } = useAuth();
  const reduce = usePrefersReducedMotion();
  const router = useRouter();
  const segments = useSegments();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<string | null>(null);
  const [levelUp, setLevelUp] = useState<QuestLevelUpShow | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onHubRef = useRef(segments[0] === 'medi-quest');
  onHubRef.current = segments[0] === 'medi-quest';

  useEffect(() => {
    if (!user) {
      disconnectQuestSocket();
      return;
    }
    void syncQuestBridges('start');
    void connectQuestSocket();
    const offCompleted = onQuestSocketCompleted((payload) => {
      if (!markQuestCelebration('completed', payload.questId, payload.completedAt || '')) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      if (onHubRef.current) return;
      setToast(q('ka').toastDone);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), reduce ? 900 : 1800);
    });
    const offLevel = subscribeQuestLevelUp((payload) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setLevelUp(payload);
    });
    const app = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      void (async () => {
        await syncQuestBridges('foreground');
        const cached = await readQuestCache();
        if (!cached || Date.now() - cached.savedAt > STALE_MS) requestQuestRefresh();
      })();
    });
    return () => {
      offCompleted();
      offLevel();
      app.remove();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [user, reduce]);

  return (
    <>
      {toast ? (
        <View className="absolute left-4 right-4 z-50 items-center" style={{ top: insets.top + 10 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${toast}. ${q('ka').view}`}
            onPress={() => {
              setToast(null);
              router.push('/medi-quest' as never);
            }}
            className="flex-row items-center rounded-2xl bg-surface px-4 py-2.5"
            style={{ borderWidth: 1, borderColor: colors.bg300, gap: 12 }}
          >
            <Text className="font-sans-semibold text-sm text-text-100">{toast}</Text>
            <Text className="font-sans-semibold text-sm text-primary-200">{q('ka').view}</Text>
          </Pressable>
        </View>
      ) : null}
      <QuestLevelUpSheet
        visible={Boolean(levelUp)}
        level={levelUp?.level || 1}
        previousLevel={levelUp?.previousLevel}
        rankKey={levelUp?.rankKey}
        coins={levelUp?.coins}
        xp={levelUp?.xp}
        onClose={() => setLevelUp(null)}
      />
    </>
  );
}
