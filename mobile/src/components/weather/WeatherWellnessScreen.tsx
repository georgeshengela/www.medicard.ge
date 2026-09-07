import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Sparkles } from 'lucide-react-native';
import { Meteocon, airMeteoconSlug, meteoconSlugFor, type MeteoconSlug } from '@/components/weather/Meteocon';
import { airBandColor, weatherMood } from '@/components/weather/weatherMood';
import { useWeather } from '@/hooks/useWeather';
import { ka } from '@/i18n/ka';
import {
  WEATHER_UI,
  logWeatherEvent,
  weatherConditionLabel,
  weatherCopyText,
  weekdayShort,
  zonedParts,
  type AirQualitySnapshot,
} from '@/lib/weather';
import { localHourFromIso as hourOf } from '@/lib/weather/time';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ui = WEATHER_UI.ka;

export function WeatherWellnessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const isDark = useIsDark();
  const { snapshot, recommendation, stale, fromCache, loading } = useWeather();
  const fromPush = (Array.isArray(params.from) ? params.from[0] : params.from) === 'push';
  const pushLogged = useRef(false);
  useEffect(() => {
    if (!fromPush || !recommendation || pushLogged.current) return;
    pushLogged.current = true;
    logWeatherEvent('weather_push_opened', recommendation.category);
  }, [fromPush, recommendation]);

  const hours = useMemo(() => {
    if (!snapshot) return [];
    const parts = zonedParts(new Date(), snapshot.location.timezone || 'UTC');
    return snapshot.hourly
      .filter((row) => {
        const ymd = row.time.slice(0, 10);
        const h = hourOf(row.time);
        if (ymd === parts.ymd) return (h ?? 0) >= parts.hour;
        return ymd > parts.ymd;
      })
      .slice(0, 12);
  }, [snapshot]);

  const days = snapshot?.daily.slice(0, 7) ?? [];
  const mood = snapshot && recommendation ? weatherMood(recommendation.icon, snapshot.current.isDay) : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100 }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 36 }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={
            isDark
              ? [mood?.washDark ?? '#042F2E', colors.bg100]
              : [mood?.wash ?? '#CCFBF1', colors.bg100]
          }
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ paddingTop: insets.top, paddingBottom: 8 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 52 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={ka.common.back}
              onPress={() => router.back()}
              hitSlop={12}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
            >
              <ChevronLeft size={24} color={colors.text100} strokeWidth={2.2} />
            </Pressable>
            <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
              {ka.home.weatherTitle}
            </Text>
            <View style={{ width: 44 }} />
          </View>

          {snapshot && recommendation && mood ? (
            <Hero snapshot={snapshot} />
          ) : (
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300, textAlign: 'center', paddingVertical: 40 }}>
              {loading ? ka.common.loading : ui.unavailable}
            </Text>
          )}
        </LinearGradient>

        {snapshot && recommendation && mood ? (
          <View style={{ paddingHorizontal: 16, gap: 14, marginTop: 4 }}>
            <View
              style={{
                backgroundColor: isDark ? '#042F2E' : colors.accent100,
                borderRadius: 24,
                padding: 16,
                gap: 8,
                borderWidth: 1,
                borderColor: isDark ? '#115E59' : '#99F6E4',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color={isDark ? '#5EEAD4' : colors.primary100} strokeWidth={2.3} />
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, color: isDark ? '#99F6E4' : colors.primary100 }}>
                  {ui.recommendation}
                </Text>
              </View>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: colors.text100 }}>
                {weatherCopyText(recommendation.titleKey, 'ka')}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14.5, lineHeight: 21, color: colors.text200 }}>
                {weatherCopyText(recommendation.bodyKey, 'ka')}
              </Text>
              {recommendation.bestOutdoorWindow ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 4,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: isDark ? '#115E59' : '#FFFFFF',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                  }}
                >
                  <Meteocon slug="time-morning" size={22} />
                  <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: isDark ? '#99F6E4' : colors.primary100 }}>
                    {recommendation.bestOutdoorWindow.day === 'tomorrow' ? ui.tomorrowWindow : recommendation.bestOutdoorWindow.label === 'best' ? ui.bestTime : ui.goodTime}
                    {': '}
                    {recommendation.bestOutdoorWindow.start}–{recommendation.bestOutdoorWindow.end}
                  </Text>
                </View>
              ) : (
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13.5, color: colors.text300 }}>{ui.noWindow}</Text>
              )}
              {stale || fromCache || recommendation.adviceKind === 'cached' ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>{ui.updated}</Text>
              ) : null}
            </View>

            {snapshot.airQuality ? <AirQualityBlock air={snapshot.airQuality} /> : null}

            <StatsGrid snapshot={snapshot} />

            {hours.length ? (
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>{ui.nextHours}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {hours.map((row) => (
                    <View
                      key={row.time}
                      style={{
                        width: 76,
                        borderRadius: 20,
                        borderWidth: 1,
                        borderColor: colors.bg300,
                        backgroundColor: colors.surface,
                        paddingVertical: 12,
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                        {String(hourOf(row.time) ?? '').padStart(2, '0')}:00
                      </Text>
                      <Meteocon slug={meteoconSlugFor(row.condition, (hourOf(row.time) ?? 12) >= 7 && (hourOf(row.time) ?? 12) < 19)} size={40} />
                      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100 }}>
                        {Math.round(row.temperatureC)}°
                      </Text>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>
                        {row.precipitationProbability != null ? `${Math.round(row.precipitationProbability)}%` : '—'}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {days.length ? (
              <View
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: 24,
                  borderWidth: 1,
                  borderColor: colors.bg300,
                  paddingHorizontal: 14,
                  paddingTop: 14,
                  paddingBottom: 6,
                  gap: 2,
                }}
              >
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100, marginBottom: 6 }}>
                  {ui.nextDays}
                </Text>
                {days.map((day, i) => (
                  <View
                    key={day.date}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      minHeight: 52,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: isDark ? '#1F2937' : '#F3F4F6',
                    }}
                  >
                    <Text style={{ width: 52, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13.5, color: colors.text100 }}>
                      {weekdayShort(day.date, 'ka')}
                    </Text>
                    <Meteocon slug={meteoconSlugFor(day.condition, true)} size={36} />
                    <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }} numberOfLines={1}>
                      {weatherConditionLabel(day.condition, 'ka')}
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>
                      {Math.round(day.maxC)}°
                    </Text>
                    <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }}>
                      {Math.round(day.minC)}°
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Hero({ snapshot }: { snapshot: NonNullable<ReturnType<typeof useWeather>['snapshot']> }) {
  const colors = useThemeColors();
  const slug = meteoconSlugFor(snapshot.current.condition, snapshot.current.isDay);
  return (
    <View style={{ alignItems: 'center', paddingHorizontal: 20, paddingTop: 4, paddingBottom: 18 }}>
      {snapshot.location.city ? (
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 15, color: colors.text200 }}>
          {snapshot.location.city}
        </Text>
      ) : null}
      <Meteocon slug={slug} size={132} />
      <Text
        style={{
          marginTop: -6,
          fontFamily: 'NotoSansGeorgian_700Bold',
          fontSize: 64,
          lineHeight: 70,
          letterSpacing: -2,
          color: colors.text100,
        }}
      >
        {Math.round(snapshot.current.temperatureC)}°
      </Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, color: colors.text200, textAlign: 'center' }}>
        {weatherConditionLabel(snapshot.current.condition, 'ka')}
        {'  ·  '}
        {ui.feelsLike(snapshot.current.feelsLikeC)}
      </Text>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
        <MiniChip slug="thermometer-warmer" label={`${ui.high} ${Math.round(snapshot.today.maxC)}°`} />
        <MiniChip slug="thermometer-colder" label={`${ui.low} ${Math.round(snapshot.today.minC)}°`} />
      </View>
    </View>
  );
}

function MiniChip({ slug, label }: { slug: MeteoconSlug; label: string }) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 999,
        backgroundColor: isDark ? 'rgba(17,24,39,0.72)' : 'rgba(255,255,255,0.88)',
      }}
    >
      <Meteocon slug={slug} size={22} />
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, color: colors.text100 }}>{label}</Text>
    </View>
  );
}

function formatUg(value: number | null): string {
  if (value == null) return '—';
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

function AirQualityBlock({ air }: { air: AirQualitySnapshot }) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const tint = airBandColor(air.band, isDark);
  const pollutants = [
    { label: ui.pm25, value: formatUg(air.pm25) },
    { label: ui.pm10, value: formatUg(air.pm10) },
    { label: ui.o3, value: formatUg(air.o3) },
    { label: ui.no2, value: formatUg(air.no2) },
  ];
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.bg300,
        borderRadius: 24,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>{ui.airQuality}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: isDark ? '#042F2E' : '#F0FDFA',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Meteocon slug={airMeteoconSlug(air.band)} size={44} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, color: tint }}>{air.europeanAqi}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: tint }}>{ui.air(air.band)}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18, color: colors.text300 }}>
            {ui.airHint(air.band)}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {pollutants.map((item) => (
          <View
            key={item.label}
            style={{
              minWidth: 72,
              flexGrow: 1,
              borderRadius: 14,
              backgroundColor: isDark ? '#1F2937' : '#F5F7F7',
              paddingHorizontal: 10,
              paddingVertical: 8,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>{item.label}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100, marginTop: 2 }}>
              {item.value}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function StatsGrid({ snapshot }: { snapshot: NonNullable<ReturnType<typeof useWeather>['snapshot']> }) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const sunsetH = hourOf(snapshot.today.sunset);
  const items: { slug: MeteoconSlug; label: string; value: string }[] = [
    { slug: 'rain', label: ui.rain(0).split(' ')[0], value: `${Math.round(snapshot.today.precipitationProbability ?? 0)}%` },
    { slug: 'wind', label: ui.wind(0).split(' ')[0], value: `${Math.round(snapshot.current.windKmh)}` },
    ...(snapshot.today.uvMax != null ? [{ slug: 'uv-index' as const, label: 'UV', value: `${Math.round(snapshot.today.uvMax)}` }] : []),
    ...(sunsetH != null ? [{ slug: 'sunset' as const, label: ui.sunset, value: `${String(sunsetH).padStart(2, '0')}:00` }] : []),
  ];
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, color: colors.text100 }}>{ui.today}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              width: '48%',
              flexGrow: 1,
              borderRadius: 20,
              borderWidth: 1,
              borderColor: colors.bg300,
              backgroundColor: colors.surface,
              paddingHorizontal: 14,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                backgroundColor: isDark ? '#042F2E' : '#F0FDFA',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Meteocon slug={item.slug} size={34} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>{item.label}</Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100, marginTop: 1 }}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
