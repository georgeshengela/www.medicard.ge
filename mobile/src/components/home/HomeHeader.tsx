import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CloudSun, Dumbbell, LayoutGrid } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTrainerSwitch } from '@/components/coach/CoachEntry';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
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
import { useHomeAccent } from '@/theme/homeAccent';

type Props = {
  firstName: string;
  initial: string;
  avatarId: string | null;
  streak: number;
  dateLabel: string;
  /** Opens the modules sheet (quick navigation; the Home layout picker is its last row). */
  onModules?: () => void;
};

/**
 * Greeting row. Everything glanceable that used to need its own card
 * (weather, streak) now lives as a small pill beside the date.
 */
export function HomeHeader({ firstName, initial, avatarId, streak, dateLabel, onModules }: Props) {
  const myPhoto = useMyAvatarUrl();
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const narrow = useWindowDimensions().width < 360;
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  const accent = useHomeAccent();
  // Paused from admin („მოდულები“): no pill, and no weather fetch behind it.
  const weatherOn = useFeature('weather');
  const trainer = useTrainerSwitch(useFeature('coach'));
  const reduceMotion = usePrefersReducedMotion();
  const flip = useSharedValue(0);
  const switching = useRef(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);
  const openCoach = () => {
    router.push('/coach' as never);
    // Back on Home later, the avatar shows her own face again.
    resetTimer.current = setTimeout(() => {
      flip.value = 0;
      switching.current = false;
    }, 700);
  };
  /** The avatar turns over to its MEDICOACH side, then the workspace opens. */
  const switchToCoach = () => {
    if (switching.current) return;
    switching.current = true;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (reduceMotion) {
      openCoach();
      return;
    }
    flip.value = withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }, (done) => {
      if (done) runOnJS(openCoach)();
    });
  };
  const front = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` }],
    opacity: flip.value < 0.5 ? 1 : 0,
  }));
  const back = useAnimatedStyle(() => ({
    transform: [{ perspective: 400 }, { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` }],
    opacity: flip.value < 0.5 ? 0 : 1,
  }));
  const coach = MODULE_BRANDS.coach;
  const coachLabel =
    trainer?.today
      ? tx(`ტრენერის რეჟიმზე გადასვლა · დღეს ${trainer.today} ვარჯიში`, `Switch to trainer mode · ${trainer.today} ${trainer.today === 1 ? 'session' : 'sessions'} today`)
      : tx('ტრენერის რეჟიმზე გადასვლა', 'Switch to trainer mode');

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

      {onModules ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('ყველა მოდული', 'All modules')}
          hitSlop={4}
          onPress={onModules}
          style={[s.customize, { backgroundColor: c.surface }]}
        >
          <LayoutGrid size={19} color={accent.ink} strokeWidth={2} />
        </Pressable>
      ) : null}
      <View style={s.avatarSlot}>
        <Animated.View style={[s.face, front]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('ჩემი პროფილი', 'My profile')}
            accessibilityHint={trainer ? tx('ხანგრძლივი შეხება — ტრენერის რეჟიმი', 'Long press for trainer mode') : undefined}
            onPress={() => router.push('/(tabs)/profile' as never)}
            onLongPress={trainer ? switchToCoach : undefined}
            style={[s.avatar, { backgroundColor: accent.soft }]}
          >
            {myPhoto && brokenPhoto !== myPhoto ? (
              <PrivateImage path={myPhoto} label={tx('ჩემი პროფილი', 'My profile')} style={{ width: 48, height: 48, borderRadius: 24 }} onFail={() => setBrokenPhoto(myPhoto)} />
            ) : isAvatarId(avatarId) ? (
              <Image source={AVATAR_SOURCES[avatarId]} style={{ width: 48, height: 48, borderRadius: 24 }} />
            ) : (
              <Text style={[s.avatarText, { color: accent.ink }]}>{initial}</Text>
            )}
          </Pressable>
        </Animated.View>
        {trainer ? (
          <>
            {/* The other side of the avatar: the trainer workspace, in MEDICOACH graphite. */}
            <Animated.View pointerEvents="none" style={[s.face, s.backFace, back]}>
              <LinearGradient colors={coach.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.backFill}>
                <Dumbbell size={22} color={coach.onHero} strokeWidth={2.2} />
              </LinearGradient>
            </Animated.View>
            {/* The coin tucked under the avatar, like a second account: tap = switch. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={coachLabel}
              hitSlop={10}
              onPress={switchToCoach}
              style={[s.coin, { borderColor: c.bg100 }]}
            >
              <LinearGradient colors={coach.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.coinFill}>
                {trainer.today ? (
                  <Text style={[s.coinCount, { color: coach.onHero }]}>{trainer.today > 9 ? '9+' : trainer.today}</Text>
                ) : (
                  <Dumbbell size={11} color={coach.onHero} strokeWidth={2.6} />
                )}
              </LinearGradient>
            </Pressable>
          </>
        ) : null}
      </View>
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
    gap: 10,
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
    fontFamily: 'NotoSansGeorgian_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  titleNarrow: { fontSize: 15, lineHeight: 21 },
  customize: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -4,
  },
  avatarSlot: { width: 48, height: 48 },
  face: { position: 'absolute', left: 0, top: 0, width: 48, height: 48, backfaceVisibility: 'hidden' },
  backFace: { borderRadius: 24, overflow: 'hidden' },
  backFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coin: {
    position: 'absolute',
    right: -5,
    bottom: -5,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
  },
  coinFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coinCount: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
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
