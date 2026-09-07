import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { APP_MODAL_PROPS } from '@/components/ui/appModal';
import { presentAchievementUnlock, presentQuestLevelUp } from '@/lib/quest/cache';
import {
  QUEST_DEV_LABELS,
  QUEST_DEV_SCENARIOS,
  isQuestDevEnabled,
  setQuestDevScenario,
} from '@/lib/quest/devFixture';
import {
  DEV_WEATHER_SCENARIOS,
  clearDevWeatherScenario,
  getDevWeatherScenario,
  setDevWeatherScenario,
} from '@/lib/weather/devFixture';
import { useThemeColors } from '@/theme/colors';

/** __DEV__ only — inject Quest UI states for visual QA. Hidden in production. */
export function QuestDevLauncher({ variant = 'fab' }: { variant?: 'fab' | 'chip' }) {
  const colors = useThemeColors();
  const [open, setOpen] = useState(false);

  if (!isQuestDevEnabled()) return null;

  const pick = (key: string) => {
    setQuestDevScenario(key);
    setOpen(false);
    if (key === 'LEVEL_UP') {
      presentQuestLevelUp({
        level: 8,
        previousLevel: 7,
        rankKey: 'LEVEL_5_9',
        coins: 80,
        xp: 120,
      });
    }
  };

  return (
    <>
      {variant === 'chip' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="DEV Quest states"
          onPress={() => setOpen(true)}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 24,
            zIndex: 30,
            minHeight: 44,
            paddingHorizontal: 12,
            borderRadius: 14,
            backgroundColor: '#F59E0B',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: '#FFFFFF' }}>DEV Quest</Text>
        </Pressable>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="DEV Quest states"
          onPress={() => setOpen(true)}
          style={{
            position: 'absolute',
            right: 16,
            bottom: 212,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: '#0D9488',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <Sparkles size={20} color="#FFFFFF" strokeWidth={2.2} />
        </Pressable>
      )}

      <Modal visible={open} {...APP_MODAL_PROPS} onRequestClose={() => setOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={() => setOpen(false)}>
          <View
            style={{
              marginTop: 'auto',
              maxHeight: '80%',
              backgroundColor: colors.surface,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: 20,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
              Quest QA
            </Text>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_400Regular',
                fontSize: 13,
                color: colors.text300,
                marginBottom: 12,
                marginTop: 4,
              }}
            >
              DEV only. LIVE uses the real API. Other states are UI fixtures.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {QUEST_DEV_SCENARIOS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => pick(key)}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: colors.bg200,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#14B8A6' }}>
                    {(QUEST_DEV_LABELS as Record<string, string>)[key]}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  setOpen(false);
                  presentAchievementUnlock({
                    achievementId: 'dev-ach-toast',
                    key: 'STREAK_7',
                    rarity: 'UNCOMMON',
                    rewardCoins: 50,
                    rewardXp: 100,
                  });
                }}
                style={{
                  minHeight: 44,
                  justifyContent: 'center',
                  borderBottomWidth: 1,
                  borderBottomColor: colors.bg200,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#7C3AED' }}>
                  Achievement unlock toast
                </Text>
              </Pressable>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 14,
                  color: colors.text100,
                  marginTop: 16,
                  marginBottom: 4,
                }}
              >
                DEV Weather (Quest Smart)
              </Text>
              <Text
                style={{
                  fontFamily: 'NotoSansGeorgian_400Regular',
                  fontSize: 12,
                  color: colors.text300,
                  marginBottom: 8,
                }}
              >
                Override only — never writes LIVE cache. Current: {getDevWeatherScenario() || 'off'}
              </Text>
              {DEV_WEATHER_SCENARIOS.map((key) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setDevWeatherScenario(key as 'GOOD_WINDOW' | 'RAIN' | 'HIGH_UV' | 'WIND' | 'SEVERE' | 'UNAVAILABLE');
                    setOpen(false);
                    void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) =>
                      requestEngageRefresh(),
                    );
                  }}
                  style={{
                    minHeight: 44,
                    justifyContent: 'center',
                    borderBottomWidth: 1,
                    borderBottomColor: colors.bg200,
                  }}
                >
                  <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: '#0EA5E9' }}>
                    Weather: {key}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => {
                  clearDevWeatherScenario();
                  setOpen(false);
                  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) =>
                    requestEngageRefresh(),
                  );
                }}
                style={{ minHeight: 44, justifyContent: 'center' }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text300 }}>
                  Weather: clear override
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
