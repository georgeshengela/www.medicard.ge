import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { StreakBonusChip, StreakFlameHero, StreakWeekRow } from '@/components/check-in/StreakVisuals';
import { useFigmaStreak } from '@/constants/figmaStreakLayout';
import { ka } from '@/i18n/ka';
import { api, type CheckInState } from '@/lib/api';
import { useAuth } from '@/store/AuthContext';

export default function StreakScreen() {
  const FIGMA = useFigmaStreak();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ bonus?: string }>();
  const showBonus = params.bonus === '1';

  const [state, setState] = useState<CheckInState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { checkIn } = await api.checkIn.get();
      setState(checkIn);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const weekStreak = state?.weekStreak ?? user?.currentStreak ?? 0;
  const longest = state?.longestStreak ?? user?.longestStreak ?? 0;
  const week = state?.week ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: FIGMA.pageBg }}>
      <View
        style={{
          paddingTop: insets.top + 4,
          paddingHorizontal: 16,
          minHeight: 56,
          justifyContent: 'center',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={ka.common.back}
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 44,
            height: 44,
            alignItems: 'flex-start',
            justifyContent: 'center',
            opacity: pressed ? 0.55 : 1,
          })}
        >
          <ChevronLeft size={24} color={FIGMA.textPrimary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {loading && !state ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={FIGMA.warning} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            paddingHorizontal: 16,
            paddingBottom: Math.max(insets.bottom, 24),
            gap: 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ gap: 10, alignItems: 'center' }}>
            <StreakFlameHero weekStreak={weekStreak} />
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_600SemiBold',
                fontSize: 24,
                lineHeight: 32,
                letterSpacing: -0.3,
                color: FIGMA.textPrimary,
                textAlign: 'center',
                width: '100%',
              }}
            >
              {ka.checkIn.weekStreakTitle}
            </Text>
            {showBonus ? <StreakBonusChip label={ka.checkIn.bonusChip(state?.pointsPerDay ?? 5)} /> : null}
          </View>

          <View
            style={{
              backgroundColor: FIGMA.cardBg,
              borderWidth: 1,
              borderColor: FIGMA.border,
              borderRadius: FIGMA.cardRadius,
              padding: 16,
              gap: 20,
              width: '100%',
            }}
          >
            {week.length === 7 ? <StreakWeekRow days={week} /> : null}

            <View style={{ height: 1, backgroundColor: FIGMA.border, width: '100%' }} />

            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 28,
                  lineHeight: 34,
                  letterSpacing: -0.4,
                  color: FIGMA.textPrimary,
                  textAlign: 'center',
                }}
              >
                {ka.checkIn.longestValue(longest)}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 16,
                  lineHeight: 22,
                  color: FIGMA.textPrimary,
                  textAlign: 'center',
                }}
              >
                {ka.checkIn.longestLabel}
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 14,
                  lineHeight: 22,
                  color: FIGMA.textSecondary,
                  textAlign: 'center',
                  paddingHorizontal: 8,
                }}
              >
                {ka.checkIn.longestBody}
              </Text>
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}
