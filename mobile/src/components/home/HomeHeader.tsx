import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudSun, Flame } from 'lucide-react-native';
import { Meteocon, meteoconSlugFor } from '@/components/weather/Meteocon';
import { AVATAR_SOURCES, isAvatarId } from '@/constants/avatarAssets';
import { useWeather } from '@/hooks/useWeather';
import { greeting } from '@/lib/format';
import { useIsDark, useThemeColors } from '@/theme/colors';

type Props = {
  firstName: string;
  initial: string;
  avatarId: string | null;
  streak: number;
  dateLabel: string;
};

/**
 * Greeting row. Everything glanceable that used to need its own card
 * (weather, streak) now lives as a small pill beside the date.
 */
export function HomeHeader({ firstName, initial, avatarId, streak, dateLabel }: Props) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const { snapshot, loading } = useWeather();

  return (
    <View style={s.wrap}>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={s.meta}>
          <Text numberOfLines={1} style={[s.date, { color: c.text200 }]}>
            {dateLabel}
          </Text>
          {snapshot || loading ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                snapshot
                  ? `ამინდი: ${Math.round(snapshot.current.temperatureC)} გრადუსი, ${snapshot.location.city}`
                  : 'ამინდი'
              }
              onPress={() => router.push('/weather' as never)}
              style={[s.pill, { backgroundColor: dark ? '#152638' : '#EDF5FB' }]}
            >
              {snapshot ? (
                <View style={s.weatherIcon}>
                  <Meteocon
                    slug={meteoconSlugFor(snapshot.current.condition, snapshot.current.isDay)}
                    size={26}
                  />
                </View>
              ) : (
                <CloudSun size={15} color={dark ? '#A7D5F1' : '#397C9E'} />
              )}
              <Text style={[s.pillText, { color: dark ? '#DCEBF7' : '#23465C' }]}>
                {snapshot ? `${Math.round(snapshot.current.temperatureC)}°` : '…'}
              </Text>
            </Pressable>
          ) : null}
          {streak > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${streak} დღიანი სერია`}
              onPress={() => router.push('/profile/streak' as never)}
              style={[s.pill, { backgroundColor: dark ? '#3B2A0A' : '#FDF1DC' }]}
            >
              <Flame size={15} color={dark ? '#FBBF24' : '#B45309'} fill={dark ? '#FBBF24' : '#B45309'} strokeWidth={0} />
              <Text style={[s.pillText, { color: dark ? '#FDE68A' : '#92400E' }]}>{streak}</Text>
            </Pressable>
          ) : null}
        </View>
        <Text accessibilityRole="header" numberOfLines={2} style={[s.title, { color: c.text100 }]}>
          {greeting()}
          {firstName ? `, ${firstName}` : ''}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ჩემი პროფილი"
        onPress={() => router.push('/(tabs)/profile' as never)}
        style={[s.avatar, { backgroundColor: c.accent100 }]}
      >
        {isAvatarId(avatarId) ? (
          <Image source={AVATAR_SOURCES[avatarId]} style={{ width: 48, height: 48, borderRadius: 24 }} />
        ) : (
          <Text style={[s.avatarText, { color: c.primary100 }]}>{initial}</Text>
        )}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  date: {
    fontFamily: 'NotoSansGeorgian_500Medium',
    fontSize: 12,
    lineHeight: 18,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    minHeight: 28,
    paddingLeft: 5,
    paddingRight: 9,
    borderRadius: 14,
  },
  weatherIcon: {
    width: 26,
    height: 26,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarText: {
    fontFamily: 'NotoSansGeorgian_700Bold',
    fontSize: 18,
  },
});
