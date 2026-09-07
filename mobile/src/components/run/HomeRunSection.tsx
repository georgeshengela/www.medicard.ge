import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { ChevronRight, Flame, MapPin, Route, Timer } from 'lucide-react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { formatClock, formatKm } from '@/lib/run/geo';
import { loadRunHistory, type RunSummary } from '@/lib/run/history';
import { useIsDark } from '@/theme/colors';

export function BetaPill({ compact = false }: { compact?: boolean }) {
  const dark = useIsDark();
  return (
    <View
      style={{
        paddingHorizontal: compact ? 6 : 8,
        paddingVertical: compact ? 1 : 2,
        borderRadius: 6,
        backgroundColor: dark ? '#422006' : '#FEF3C7',
        borderWidth: 1,
        borderColor: dark ? '#B45309' : '#FCD34D',
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: compact ? 9 : 10, letterSpacing: 0.8, color: dark ? '#FCD34D' : '#B45309' }}>
        {ka.run.beta}
      </Text>
    </View>
  );
}

function PulseDot({ color }: { color: string }) {
  const reduce = usePrefersReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    t.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [reduce, t]);
  const ring = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ scale: 1 + t.value * 2.2 }],
  }));
  return (
    <View style={{ width: 14, height: 14, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: color }, ring]} />
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, borderWidth: 1.5, borderColor: '#FFFFFF' }} />
    </View>
  );
}

export function HomeRunSection() {
  const router = useRouter();
  const dark = useIsDark();
  const [last, setLast] = useState<RunSummary | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void loadRunHistory().then((list) => {
        if (alive) setLast(list[0] ?? null);
      });
      return () => {
        alive = false;
      };
    }, []),
  );

  const open = () => router.push('/run' as never);

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8, marginTop: S.sectionTop }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <HomeSectionTitle title={ka.home.runTitle} style={{ marginBottom: 0 }} />
        <BetaPill compact />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${ka.run.title}. ${ka.run.homeTagline}`}
        onPress={open}
        style={{ borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: dark ? '#134E4A' : '#0F766E' }}
      >
        <LinearGradient
          colors={dark ? ['#0B1F2A', '#042F2E', '#111827'] : ['#0F766E', '#115E59', '#0B3B3A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16, minHeight: 148 }}
        >
          {/* decorative route */}
          <View pointerEvents="none" style={{ position: 'absolute', right: -6, top: 4, width: 190, height: 150, opacity: dark ? 0.9 : 0.85 }}>
            <Svg width={190} height={150} viewBox="0 0 190 150">
              <Circle cx={150} cy={40} r={70} fill="rgba(20,184,166,0.10)" />
              <Circle cx={150} cy={40} r={44} fill="rgba(20,184,166,0.10)" />
              <Path
                d="M18 128 C 48 118, 60 92, 84 84 S 120 76, 132 56 S 148 34, 158 30"
                stroke="rgba(94,234,212,0.85)"
                strokeWidth={3}
                strokeLinecap="round"
                strokeDasharray="6 7"
                fill="none"
              />
              <Path d="M18 128 C 40 122, 52 104, 66 96" stroke="#14B8A6" strokeWidth={4} strokeLinecap="round" fill="none" />
              <Circle cx={18} cy={128} r={6} fill="#14B8A6" stroke="#FFFFFF" strokeWidth={2.5} />
              <Circle cx={158} cy={30} r={11} fill="#F59E0B" stroke="#FFFFFF" strokeWidth={3} />
              <Circle cx={158} cy={30} r={3.5} fill="#FFFFFF" />
            </Svg>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PulseDot color="#5EEAD4" />
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, letterSpacing: 0.8, color: '#99F6E4' }}>
              MEDI RUN
            </Text>
          </View>
          <Text style={{ marginTop: 8, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 26, color: '#FFFFFF', maxWidth: '62%' }}>
            {ka.run.heroTitle.replace('\n', ' ')}
          </Text>
          <Text style={{ marginTop: 4, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 18, color: 'rgba(255,255,255,0.78)', maxWidth: '60%' }}>
            {ka.run.homeTagline}
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10 }}>
            {last ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{ka.run.homeLast}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Route size={12} color="#5EEAD4" strokeWidth={2.4} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#FFFFFF' }}>{formatKm(last.distanceM)} {ka.run.km}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Timer size={12} color="#5EEAD4" strokeWidth={2.4} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#FFFFFF' }}>{formatClock(last.movingMs)}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Flame size={12} color="#FBBF24" strokeWidth={2.4} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, color: '#FFFFFF' }}>{last.calories}</Text>
                </View>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                <MapPin size={13} color="#FBBF24" strokeWidth={2.4} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: 'rgba(255,255,255,0.8)' }}>{ka.run.homeNoRuns}</Text>
              </View>
            )}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 4,
                paddingLeft: 14,
                paddingRight: 10,
                paddingVertical: 9,
                borderRadius: 999,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: '#0F766E' }}>{ka.run.homeCta}</Text>
              <ChevronRight size={16} color="#0F766E" strokeWidth={2.6} />
            </View>
          </View>
        </LinearGradient>
      </Pressable>
    </View>
  );
}
