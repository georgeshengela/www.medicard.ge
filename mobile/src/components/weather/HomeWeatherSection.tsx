import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight, Clock3, CloudRain, Wind } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { WeatherEmblem } from '@/components/weather/WeatherEmblem';
import { airQualityIconFor } from '@/components/weather/weatherIcons';
import { airBandColor, weatherMood } from '@/components/weather/weatherMood';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { useWeather } from '@/hooks/useWeather';
import { ka } from '@/i18n/ka';
import { WEATHER_UI, logWeatherEvent, weatherConditionLabel, weatherCopyText } from '@/lib/weather';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ui = WEATHER_UI.ka;

function windowLine(rec: NonNullable<ReturnType<typeof useWeather>['recommendation']>): string | null {
  const win = rec.bestOutdoorWindow;
  if (!win) return null;
  const range = `${win.start}–${win.end}`;
  if (win.day === 'tomorrow') return `${ui.tomorrowWindow} ${range}`;
  return range;
}

export function HomeWeatherSection() {
  const router = useRouter();
  const colors = useThemeColors();
  const { snapshot, recommendation, loading, unavailable, stale, fromCache } = useWeather();
  const viewed = useRef(false);

  useEffect(() => {
    if (!snapshot || !recommendation || viewed.current) return;
    viewed.current = true;
    logWeatherEvent('weather_card_viewed', recommendation.category);
    logWeatherEvent('weather_recommendation_shown', recommendation.category);
  }, [snapshot, recommendation]);

  const waiting = loading || (!snapshot && !unavailable);
  if (!snapshot && !loading && !unavailable) return null;

  return (
    <View style={{ paddingVertical: 4, gap: 8, marginTop: S.sectionTop }}>
      <HomeSectionTitle title={ka.home.weatherTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      {snapshot && recommendation ? (
        <WeatherHomeCard
          snapshot={snapshot}
          recommendation={recommendation}
          stale={stale || fromCache || recommendation.adviceKind === 'cached'}
          onPress={() => {
            logWeatherEvent('weather_detail_opened', recommendation.category);
            router.push('/weather' as never);
          }}
        />
      ) : waiting ? (
        <View style={{ marginHorizontal: 16 }}>
          <WeatherCardSkeleton />
        </View>
      ) : (
        <View
          style={{
            marginHorizontal: 16,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.bg300,
            borderRadius: 24,
            paddingHorizontal: 16,
            paddingVertical: 14,
            minHeight: 72,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }}>
            {ui.unavailable}
          </Text>
        </View>
      )}
    </View>
  );
}

function WeatherHomeCard({
  snapshot,
  recommendation,
  stale,
  onPress,
}: {
  snapshot: NonNullable<ReturnType<typeof useWeather>['snapshot']>;
  recommendation: NonNullable<ReturnType<typeof useWeather>['recommendation']>;
  stale: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const mood = weatherMood(recommendation.icon, snapshot.current.isDay);
  const title = weatherCopyText(recommendation.titleKey, 'ka');
  const city = snapshot.location.city;
  const rain = snapshot.today.precipitationProbability;
  const window = windowLine(recommendation);
  const condition = weatherConditionLabel(snapshot.current.condition, 'ka');
  const air = snapshot.airQuality;
  const AirIcon = air ? airQualityIconFor(air.band) : null;
  const airTint = air ? airBandColor(air.band, isDark) : colors.text300;
  const place = [condition, city].filter(Boolean).join(' · ');
  const a11y = [city, `${Math.round(snapshot.current.temperatureC)}°`, condition, title, air ? ui.air(air.band) : null, window]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        backgroundColor: isDark ? colors.surface : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? mood.chipDark : colors.bg300,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        overflow: 'hidden',
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          right: -28,
          top: -36,
          width: 120,
          height: 120,
          borderRadius: 60,
          backgroundColor: isDark ? mood.washDark : mood.wash,
        }}
      />

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <WeatherEmblem
          icon={recommendation.icon}
          isDay={snapshot.current.isDay}
          accent={mood.accent}
          track={isDark ? '#374151' : '#D1D5DB'}
          fill={isDark ? '#1F2937' : mood.wash}
          score={recommendation.bestOutdoorWindow?.score ?? (snapshot.current.isDay ? 40 : 12)}
          size={48}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 26,
                lineHeight: 30,
                letterSpacing: -0.6,
                color: colors.text100,
              }}
            >
              {Math.round(snapshot.current.temperatureC)}°
            </Text>
            <Text
              numberOfLines={1}
              style={{ flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}
            >
              {place}
            </Text>
          </View>
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: colors.text100, marginTop: 2 }}>
            {title}
          </Text>
        </View>
        <ChevronRight size={18} color={mood.accent} strokeWidth={2.3} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
        {window ? (
          <MetaChip
            icon={Clock3}
            label={window}
            color={isDark ? '#99F6E4' : '#0F766E'}
            bg={isDark ? mood.chipDark : mood.chip}
          />
        ) : null}
        {air && AirIcon ? (
          <MetaChip icon={AirIcon} label={ui.air(air.band)} color={airTint} bg={isDark ? '#1F2937' : mood.wash} />
        ) : null}
        {rain != null ? (
          <MetaChip
            icon={CloudRain}
            label={`${Math.round(rain)}%`}
            color={colors.text300}
            bg={isDark ? '#1F2937' : '#F3F4F6'}
          />
        ) : (
          <MetaChip
            icon={Wind}
            label={`${Math.round(snapshot.current.windKmh)}`}
            color={colors.text300}
            bg={isDark ? '#1F2937' : '#F3F4F6'}
          />
        )}
      </View>
      {stale ? (
        <Text style={{ marginTop: 6, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, color: colors.text300 }}>
          {ui.updated}
        </Text>
      ) : null}
    </Pressable>
  );
}

function MetaChip({
  icon: Icon,
  label,
  color,
  bg,
}: {
  icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: bg,
        borderRadius: 999,
        paddingHorizontal: 8,
        paddingVertical: 4,
        maxWidth: '48%',
      }}
    >
      <Icon size={12} color={color} strokeWidth={2.3} />
      <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color }}>
        {label}
      </Text>
    </View>
  );
}

function WeatherCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={ui.loading}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        minHeight: 96,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Bone width={48} height={48} radius={24} />
        <View style={{ flex: 1, gap: 7 }}>
          <Bone width={64} height={20} radius={8} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text200 }}>
            {ui.loading}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 10 }}>
        <Bone width={88} height={22} radius={11} />
        <Bone width={72} height={22} radius={11} />
      </View>
    </View>
  );
}
