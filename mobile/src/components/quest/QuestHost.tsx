import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Trophy } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/store/AuthContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { connectQuestSocket, disconnectQuestSocket, markQuestCelebration, onQuestSocketCompleted } from '@/lib/quest/socket';
import { syncQuestBridges } from '@/lib/quest/sync';
import {
  readQuestCache,
  requestQuestRefresh,
  subscribeAchievementUnlock,
  subscribeQuestLevelUp,
  type AchievementUnlockShow,
  type QuestLevelUpShow,
} from '@/lib/quest/cache';
import { QuestLevelUpSheet } from '@/components/quest/QuestLevelUpSheet';
import { MediJourneyUnlockToast } from '@/components/companion/MediJourneyUnlockToast';
import { subscribeJourneyUnlockCelebration } from '@/lib/companion/journeyCelebration';
import { rarityColors } from '@/components/quest/QuestAchievementBadge';
import { q } from '@/lib/quest/copy';
import { achievementCopy } from '@/i18n/quest/achievements.js';
import { QUEST } from '@/theme/questTokens';
import { useIsDark, useThemeColors } from '@/theme/colors';

const STALE_MS = 2 * 60 * 1000;

export function QuestHost() {
  const { user } = useAuth();
  const reduce = usePrefersReducedMotion();
  const router = useRouter();
  const segments = useSegments();
  const colors = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<string | null>(null);
  const [achievementToast, setAchievementToast] = useState<AchievementUnlockShow | null>(null);
  const [levelUp, setLevelUp] = useState<QuestLevelUpShow | null>(null);
  const [journeyUnlock, setJourneyUnlock] = useState<{ count: number; keys: string[] } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const achievementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const journeyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    const offAchievement = subscribeAchievementUnlock((payload) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setAchievementToast(payload);
      if (achievementTimer.current) clearTimeout(achievementTimer.current);
      achievementTimer.current = setTimeout(() => setAchievementToast(null), reduce ? 1200 : 3200);
    });
    const offJourney = subscribeJourneyUnlockCelebration((payload) => {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      setJourneyUnlock(payload);
      if (journeyTimer.current) clearTimeout(journeyTimer.current);
      journeyTimer.current = setTimeout(() => setJourneyUnlock(null), reduce ? 1600 : 4200);
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
      offAchievement();
      offJourney();
      app.remove();
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (achievementTimer.current) clearTimeout(achievementTimer.current);
      if (journeyTimer.current) clearTimeout(journeyTimer.current);
    };
  }, [user, reduce]);

  return (
    <>
      {toast ? (
        <Animated.View
          entering={reduce ? undefined : FadeInUp.duration(QUEST.motion.base).springify().damping(16)}
          exiting={reduce ? undefined : FadeOutUp.duration(QUEST.motion.fast)}
          style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 10, zIndex: 50, alignItems: 'center' }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${toast}. ${q('ka').view}`}
            onPress={() => {
              setToast(null);
              router.push('/medi-quest' as never);
            }}
            className="active:opacity-80"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingLeft: 10,
              paddingRight: 14,
              paddingVertical: 8,
              borderRadius: 999,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.bg300,
              shadowColor: '#000',
              shadowOpacity: 0.1,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
              elevation: 4,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.success,
              }}
            >
              <Check size={15} color="#FFFFFF" strokeWidth={3} />
            </View>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: colors.text100 }}>{toast}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, lineHeight: 20, color: colors.primary200 }}>
              {q('ka').view}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {achievementToast ? (
        <Animated.View
          entering={reduce ? undefined : FadeInUp.duration(QUEST.motion.base).springify().damping(16)}
          exiting={reduce ? undefined : FadeOutUp.duration(QUEST.motion.fast)}
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: insets.top + (toast ? 62 : 10),
            zIndex: 50,
            alignItems: 'center',
          }}
        >
          <AchievementToast
            payload={achievementToast}
            dark={dark}
            onPress={() => {
              setAchievementToast(null);
              router.push('/medi-quest/achievements' as never);
            }}
          />
        </Animated.View>
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
      <MediJourneyUnlockToast
        celebration={journeyUnlock}
        onDismiss={() => setJourneyUnlock(null)}
        locale="ka"
      />
    </>
  );
}

/** Phase 4 — rarity-tinted unlock toast. Tapping opens the Achievements screen. */
function AchievementToast({
  payload,
  dark,
  onPress,
}: {
  payload: AchievementUnlockShow;
  dark: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const copy = achievementCopy('ka');
  const rarity = rarityColors(payload.rarity, dark);
  const title = copy.title({
    key: payload.key,
    threshold: null,
    secret: Boolean(payload.secret),
    unlocked: true,
  });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${copy.unlockedToast}. ${title}`}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingLeft: 10,
        paddingRight: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
        maxWidth: '100%',
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 10,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: rarity.fill,
        }}
      >
        <Trophy size={15} color={rarity.ink} strokeWidth={2.4} />
      </View>
      <View style={{ flexShrink: 1, minWidth: 0 }}>
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: colors.text100 }}
        >
          {copy.unlockedToast}
        </Text>
        <Text
          numberOfLines={1}
          style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 16, color: rarity.ink }}
        >
          {title}
        </Text>
      </View>
    </Pressable>
  );
}
