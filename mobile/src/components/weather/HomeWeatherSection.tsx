import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { WeatherEmblem } from '@/components/weather/WeatherEmblem';
import { weatherMood } from '@/components/weather/weatherMood';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { useWeather } from '@/hooks/useWeather';
import { ka } from '@/i18n/ka';
import { WEATHER_UI, logWeatherEvent, weatherConditionLabel, weatherCopyText } from '@/lib/weather';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ui = WEATHER_UI.ka;

function windowLine(rec: NonNullable<ReturnType<typeof useWeather>['recommendation']>): string | null {
  const win = rec.bestOutdoorWindow;
  if (!win) {
    return rec.category === 'mixed' || rec.category === 'heavy_rain' || rec.category === 'storm' ? ui.noWindow : null;
  }
  const range = `${win.start}–${win.end}`;
  if (win.day === 'tomorrow') return `${ui.tomorrowWindow}: ${range}`;
  return `${win.label === 'best' ? ui.bestTime : ui.goodTime}: ${range}`;
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

  if (!snapshot && !loading && !unavailable) return null;

  return (
    <View style={{ paddingVertical: 4, gap: 8, marginTop: S.sectionTop }}>
      <HomeSectionTitle title={ka.home.weatherTitle} style={{ marginHorizontal: 16, marginBottom: 0 }} />
      {loading && !snapshot ? (
        <View style={{ marginHorizontal: 16 }}>
          <WeatherCardSkeleton />
        </View>
      ) : unavailable && !snapshot ? (
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
      ) : snapshot && recommendation ? (
        <WeatherHomeCard
          snapshot={snapshot}
          recommendation={recommendation}
          stale={stale || fromCache || recommendation.adviceKind === 'cached'}
          onPress={() => {
            logWeatherEvent('weather_detail_opened', recommendation.category);
            router.push('/weather' as never);
          }}
        />
      ) : null}
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
  const meta = [rain != null ? ui.rain(rain) : null, ui.wind(snapshot.current.windKmh)].filter(Boolean).join(' · ');
  const a11y = [city, `${Math.round(snapshot.current.temperatureC)}°`, condition, title, window, meta]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        backgroundColor: isDark ? mood.washDark : mood.wash,
        borderWidth: 1,
        borderColor: isDark ? mood.chipDark : colors.bg300,
        borderRadius: 24,
        paddingHorizontal: 14,
        paddingVertical: 12,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <WeatherEmblem
          icon={recommendation.icon}
          isDay={snapshot.current.isDay}
          accent={mood.accent}
          track={isDark ? '#374151' : '#D1D5DB'}
          fill={isDark ? colors.surface : '#FFFFFF'}
          score={recommendation.bestOutdoorWindow?.score ?? (snapshot.current.isDay ? 40 : 12)}
          size={52}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 28,
                lineHeight: 32,
                letterSpacing: -0.6,
                color: colors.text100,
              }}
            >
              {Math.round(snapshot.current.temperatureC)}°
            </Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 13,
                lineHeight: 20,
                color: colors.text300,
                paddingBottom: 2,
              }}
            >
              {city || condition}
            </Text>
          </View>
          <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text200 }}>
            {condition}
          </Text>
        </View>
        <ChevronRight size={18} color={mood.accent} strokeWidth={2.3} />
      </View>

      <Text
        numberOfLines={2}
        style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: colors.text100 }}
      >
        {title}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {window ? (
          <View
            style={{
              backgroundColor: isDark ? mood.chipDark : mood.chip,
              borderRadius: 999,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11, color: isDark ? '#99F6E4' : '#0F766E' }}>
              {window}
            </Text>
          </View>
        ) : null}
        <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>
          {meta}
          {stale ? ` · ${ui.updated}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

function WeatherCardSkeleton() {
  const colors = useThemeColors();
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={ka.common.loading}
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        borderRadius: 24,
        padding: 14,
        minHeight: 108,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Bone width={52} height={52} radius={26} />
        <View style={{ flex: 1, gap: 8 }}>
          <Bone width={72} height={22} radius={8} />
          <Bone width="48%" height={12} />
        </View>
      </View>
      <Bone width="88%" height={14} style={{ marginTop: 12 }} />
    </View>
  );
}
