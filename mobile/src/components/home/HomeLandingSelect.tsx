import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarHeart, House } from 'lucide-react-native';
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

  return (
    <View className="w-full">
      <Text className="mb-1.5 text-sm font-semibold text-text-200">{ka.profile.homeLandingTitle}</Text>

      <View
        accessibilityRole="radiogroup"
        className="flex-row rounded-full border border-bg-300 bg-bg-200 p-1"
        style={{ borderRadius: 999 }}
      >
        {OPTIONS.map((option) => {
          const selected = landing === option.value;
          const accent = option.value === 'cycle' ? '#D4738A' : auth.primaryBg;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              onPress={() => onChange(option.value)}
              className="flex-1 items-center py-2.5 active:opacity-70"
              style={[{ borderRadius: 999 }, selected ? { backgroundColor: accent } : undefined]}
            >
              <option.Icon
                size={16}
                color={selected ? colors.onPrimary : colors.text200}
                strokeWidth={2.2}
              />
              <Text
                style={{ fontSize: 13, lineHeight: 18 }}
                className={`mt-1 font-semibold ${selected ? 'text-white' : 'text-text-200'}`}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="mt-1.5 text-sm text-text-300">
        {landing === 'cycle' ? ka.profile.homeLandingCycleHint : ka.profile.homeLandingHubHint}
      </Text>
    </View>
  );
}
