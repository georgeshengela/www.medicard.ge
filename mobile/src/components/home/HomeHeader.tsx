import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudSun } from 'lucide-react-native';
import { RUN_ICON } from '@/components/run/runArt';
import { Meteocon, meteoconSlugFor } from '@/components/weather/Meteocon';
import { AVATAR_SOURCES, isAvatarId } from '@/constants/avatarAssets';
import { PrivateImage } from '@/components/coach/CoachUI';
import { useMyAvatarUrl } from '@/lib/myAvatar';
import { useWeather } from '@/hooks/useWeather';
import { useFeature } from '@/lib/featureFlags';
import { greeting } from '@/lib/format';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

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
  const myPhoto = useMyAvatarUrl();
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const narrow = useWindowDimensions().width < 360;
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  // Paused from admin („მოდულები“): no pill, and no weather fetch behind it.
  const weatherOn = useFeature('weather');

  return (
    <View style={s.wrap}>
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        <View style={s.meta}>
          <Text numberOfLines={1} style={[s.date, { color: c.text200 }]}>
            {dateLabel}
          </Text>
          {weatherOn ? <WeatherPill /> : null}
          {streak > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx(`${streak}-დღიანი სერია`, `${streak}-day streak`)}
              onPress={() => router.push('/profile/streak' as never)}
              style={[s.pill, { backgroundColor: dark ? '#3B2A0A' : '#FDF1DC' }]}
            >
              <Image source={RUN_ICON.streak} resizeMode="contain" accessibilityIgnoresInvertColors accessible={false} style={{ width: 18, height: 18 }} />
              <Text style={[s.pillText, { color: dark ? '#FDE68A' : '#92400E' }]}>{streak}</Text>
            </Pressable>
          ) : null}
        </View>
        {/* One line: long greetings and names shrink to fit instead of wrapping. */}
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          style={[s.title, narrow && s.titleNarrow, { color: c.text100 }]}
        >
          {firstName ? `${greeting()}, ${firstName}` : greeting()}
        </Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={tx('ჩემი პროფილი', 'My profile')}
        onPress={() => router.push('/(tabs)/profile' as never)}
        style={[s.avatar, { backgroundColor: c.accent100 }]}
      >
        {myPhoto && brokenPhoto !== myPhoto ? (
          <PrivateImage path={myPhoto} label={tx('ჩემი პროფილი', 'My profile')} style={{ width: 48, height: 48, borderRadius: 24 }} onFail={() => setBrokenPhoto(myPhoto)} />
        ) : isAvatarId(avatarId) ? (
          <Image source={AVATAR_SOURCES[avatarId]} style={{ width: 48, height: 48, borderRadius: 24 }} />
        ) : (
          <Text style={[s.avatarText, { color: c.primary100 }]}>{initial}</Text>
        )}
      </Pressable>
    </View>
  );
}

function WeatherPill() {
  const dark = useIsDark();
  const router = useRouter();
  const { snapshot, loading } = useWeather();
  if (!snapshot && !loading) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        snapshot
          ? tx(`ამინდი: ${Math.round(snapshot.current.temperatureC)} გრადუსი, ${snapshot.location.city}`, `Weather: ${Math.round(snapshot.current.temperatureC)} degrees, ${snapshot.location.city}`)
          : tx('ამინდი', 'Weather')
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
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  titleNarrow: { fontSize: 18, lineHeight: 26 },
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
