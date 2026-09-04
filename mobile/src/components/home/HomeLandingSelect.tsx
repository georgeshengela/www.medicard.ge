import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarHeart, House, Info } from 'lucide-react-native';
import { useFigmaAuth } from '@/constants/figmaAuthLayout';
import { ka } from '@/i18n/ka';
import { getHomeLanding, setCyclePromptSeen, setHomeLanding, type HomeLanding } from '@/lib/homeScreenPrefs';
import { useThemeColors } from '@/theme/colors';
import { useAuth } from '@/store/AuthContext';

const OPTIONS: { value: HomeLanding; label: string; hint: string; Icon: typeof House }[] = [
  { value: 'hub', label: ka.profile.homeLandingHub, hint: ka.profile.homeLandingHubHint, Icon: House },
  {
    value: 'cycle',
    label: ka.profile.homeLandingCycle,
    hint: ka.profile.homeLandingCycleHint,
    Icon: CalendarHeart,
  },
];

export function HomeLandingSelect() {
  const { user } = useAuth();
  const colors = useThemeColors();
  const auth = useFigmaAuth();
  const [landing, setLanding] = useState<HomeLanding>('hub');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getHomeLanding().then((value) => {
      setLanding(value);
      setReady(true);
    });
  }, []);

  const onChange = useCallback(async (value: HomeLanding) => {
    setLanding(value);
    await setHomeLanding(value);
    await setCyclePromptSeen(true);
  }, []);

  if (user?.gender !== 'FEMALE') return null;
  if (!ready) return null;

  const selected = OPTIONS.find((option) => option.value === landing) ?? OPTIONS[0];

  return (
    <View className="w-full" style={{ gap: 10 }}>
      <View className="flex-row items-start" style={{ gap: 8 }}>
        <View
          className="items-center justify-center rounded-full bg-accent-100"
          style={{ width: 22, height: 22, marginTop: 1 }}
        >
          <Info size={12} color={colors.primary200} strokeWidth={2.4} />
        </View>
        <Text
          style={{ flex: 1, fontSize: 12, lineHeight: 17, color: colors.text200 }}
        >
          {ka.profile.homeLandingExplain}
        </Text>
      </View>

      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={ka.profile.homeLandingTitle}
        className="flex-row rounded-full border border-bg-300 bg-bg-200"
        style={{ borderRadius: 999, padding: 3, gap: 2 }}
      >
        {OPTIONS.map((option) => {
          const isOn = landing === option.value;
          const accent = option.value === 'cycle' ? '#D4738A' : auth.primaryBg;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected: isOn }}
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
              onPress={() => onChange(option.value)}
              className="flex-1 flex-row items-center justify-center active:opacity-70"
              style={[
                { borderRadius: 999, minHeight: 36, gap: 6, paddingHorizontal: 8 },
                isOn ? { backgroundColor: accent } : undefined,
              ]}
            >
              <option.Icon
                size={14}
                color={isOn ? colors.onPrimary : colors.text200}
                strokeWidth={2.2}
              />
              <Text
                numberOfLines={1}
                style={{ fontSize: 12, lineHeight: 16 }}
                className={`font-semibold ${isOn ? 'text-white' : 'text-text-200'}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={{ fontSize: 12, lineHeight: 16, color: colors.text300 }}>
        {selected.hint}
      </Text>
    </View>
  );
}
