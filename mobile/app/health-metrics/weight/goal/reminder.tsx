import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeightPrimaryButton, WeightWizardBar } from '@/components/weight/WeightChrome';
import { WeightTimeDrum } from '@/components/weight/WeightTimeDrum';
import { useFigmaWeight } from '@/constants/figmaWeightLayout';
import { ka } from '@/i18n/ka';
import { useAuth } from '@/store/AuthContext';
import { WEEKDAY_LETTERS, createWeightDraft, loadWeightDraft, saveWeightDraft } from '@/lib/weightGoal';
import type { WeightGoalDraft } from '@/types/weightGoal';

export default function WeightReminderScreen() {
  const T = useFigmaWeight();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { healthProfile } = useAuth();
  const [draft, setDraft] = useState<WeightGoalDraft>(() => createWeightDraft(healthProfile?.weightKg ?? 70));

  useEffect(() => {
    void loadWeightDraft().then((saved) => {
      if (saved) setDraft((current) => ({ ...current, ...saved }));
    });
  }, []);

  const days = draft.reminderDays ?? [];
  const toggle = (day: number) => {
    const next = days.includes(day) ? days.filter((item) => item !== day) : [...days, day].sort((a, b) => a - b);
    const updated = { ...draft, reminderDays: next, reminderEnabled: next.length > 0 };
    setDraft(updated);
    void saveWeightDraft(updated);
  };

  return (
    <View style={{ flex: 1, backgroundColor: T.pageBg, paddingTop: insets.top }}>
      <WeightWizardBar progress={0.75} onBack={() => router.back()} />
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 32, gap: 12 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 30, lineHeight: 38, letterSpacing: -0.25, textAlign: 'center', color: T.textPrimary }}>
            {ka.weightGoal.reminderAsk}
          </Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 16, lineHeight: 26, textAlign: 'center', color: T.textSecondary }}>
            {ka.weightGoal.reminderSubtitle}
          </Text>
        </View>
        <Text style={{ paddingHorizontal: 16, paddingVertical: 8, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>
          {ka.weightGoal.days}
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 }}>
          {WEEKDAY_LETTERS.map((letter, index) => {
            const active = days.includes(index);
            return (
              <Pressable
                key={`${letter}-${index}`}
                onPress={() => toggle(index)}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: active ? T.brandSoft : T.surface,
                  borderWidth: 1,
                  borderColor: active ? T.brand : T.border,
                  ...T.shadowXs,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: active ? T.brand : T.textSecondary }}>
                  {letter}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={{ paddingHorizontal: 16, paddingVertical: 8, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: T.textPrimary }}>
          {ka.weightGoal.time}
        </Text>
        <WeightTimeDrum
          hour={draft.reminderHour ?? 12}
          minute={draft.reminderMinute ?? 0}
          onChange={(hour, minute) => {
            const updated = { ...draft, reminderHour: hour, reminderMinute: minute, reminderEnabled: true };
            setDraft(updated);
            void saveWeightDraft(updated);
          }}
        />
      </View>
      <View style={{ padding: 16, paddingBottom: Math.max(insets.bottom, 16) }}>
        <WeightPrimaryButton
          label={ka.weightGoal.continue}
          onPress={() => {
            void saveWeightDraft(draft).then(() => router.push('/health-metrics/weight/goal/confirm' as never));
          }}
        />
      </View>
    </View>
  );
}
