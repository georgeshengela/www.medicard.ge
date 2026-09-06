import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { airQualityIconFor, weatherAccent, weatherIconFor } from '@/components/weather/weatherIcons';
import { airBandColor } from '@/components/weather/weatherMood';
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg100, paddingTop: insets.top }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 56 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={ka.common.back} onPress={() => router.back()} hitSlop={12} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          <ChevronLeft size={24} color={colors.text100} strokeWidth={2.2} />
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, color: colors.text100 }}>
          {ui.detailTitle}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 16 }} showsVerticalScrollIndicator={false}>
        {snapshot && recommendation ? (
          <>
            <CurrentBlock snapshot={snapshot} />
            <View
              style={{
                backgroundColor: isDark ? '#111827' : '#F9FAFB',
                borderWidth: 1,
                borderColor: isDark ? '#374151' : '#E5E7EB',
                borderRadius: 24,
                padding: 16,
                gap: 8,
              }}
            >
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                {ui.recommendation}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 18, lineHeight: 26, color: colors.text100 }}>
                {weatherCopyText(recommendation.titleKey, 'ka')}
              </Text>
              <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 15, lineHeight: 22, color: colors.text200 }}>
                {weatherCopyText(recommendation.bodyKey, 'ka')}
              </Text>
              {recommendation.bestOutdoorWindow ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, color: colors.primary200, marginTop: 4 }}>
                  {recommendation.bestOutdoorWindow.day === 'tomorrow' ? ui.tomorrowWindow : recommendation.bestOutdoorWindow.label === 'best' ? ui.bestTime : ui.goodTime}
                  {': '}
                  {recommendation.bestOutdoorWindow.start}–{recommendation.bestOutdoorWindow.end}
                </Text>
              ) : (
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>
                  {ui.noWindow}
                </Text>
              )}
              {stale || fromCache || recommendation.adviceKind === 'cached' ? (
                <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                  {ui.updated}
                </Text>
              ) : null}
            </View>

            {snapshot.airQuality ? <AirQualityBlock air={snapshot.airQuality} /> : null}

            <StatsRow snapshot={snapshot} />

            {hours.length ? (
              <View style={{ gap: 10 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{ui.nextHours}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {hours.map((row) => {
                    const Icon = weatherIconFor(row.condition, true);
                    return (
                      <View
                        key={row.time}
                        style={{
                          width: 72,
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: isDark ? '#374151' : '#E5E7EB',
                          backgroundColor: isDark ? '#111827' : '#FFFFFF',
                          paddingVertical: 10,
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                          {String(hourOf(row.time) ?? '').padStart(2, '0')}:00
                        </Text>
                        <Icon size={18} color={weatherAccent(row.condition)} strokeWidth={2.1} />
                        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>
                          {Math.round(row.temperatureC)}°
                        </Text>
                        <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>
                          {row.precipitationProbability != null ? `${Math.round(row.precipitationProbability)}%` : '—'}
                        </Text>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            {days.length ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{ui.nextDays}</Text>
                {days.map((day) => {
                  const Icon = weatherIconFor(day.condition, true);
                  return (
                    <View
                      key={day.date}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 12,
                        minHeight: 44,
                        paddingVertical: 8,
                        borderBottomWidth: 1,
                        borderBottomColor: isDark ? '#1F2937' : '#F3F4F6',
                      }}
                    >
                      <Text style={{ width: 52, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, color: colors.text100 }}>
                        {weekdayShort(day.date, 'ka')}
                      </Text>
                      <Icon size={18} color={weatherAccent(day.condition)} strokeWidth={2.1} />
                      <Text style={{ flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text300 }} numberOfLines={1}>
                        {weatherConditionLabel(day.condition, 'ka')}
                      </Text>
                      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, color: colors.text200 }}>
                        {Math.round(day.minC)}° / {Math.round(day.maxC)}°
                      </Text>
                      <Text style={{ width: 40, textAlign: 'right', fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, color: colors.text300 }}>
                        {day.precipitationProbability != null ? `${Math.round(day.precipitationProbability)}%` : ''}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ) : null}

          </>
        ) : (
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300, marginTop: 24 }}>
            {loading ? ka.common.loading : ui.unavailable}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

function CurrentBlock({ snapshot }: { snapshot: NonNullable<ReturnType<typeof useWeather>['snapshot']> }) {
  const colors = useThemeColors();
  const Icon = weatherIconFor(snapshot.current.condition, snapshot.current.isDay);
  const accent = weatherAccent(snapshot.current.condition);
  return (
    <View style={{ alignItems: 'center', gap: 8, paddingTop: 8 }}>
      {snapshot.location.city ? (
        <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 16, color: colors.text100 }}>
          {snapshot.location.city}
        </Text>
      ) : null}
      <Icon size={36} color={accent} strokeWidth={2} />
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 48, lineHeight: 56, color: colors.text100 }}>
        {Math.round(snapshot.current.temperatureC)}°
      </Text>
      <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, color: colors.text300 }}>
        {ui.feelsLike(snapshot.current.feelsLikeC)} · {weatherConditionLabel(snapshot.current.condition, 'ka')}
      </Text>
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
  const AirIcon = airQualityIconFor(air.band);
  const pollutants = [
    { label: ui.pm25, value: formatUg(air.pm25) },
    { label: ui.pm10, value: formatUg(air.pm10) },
    { label: ui.o3, value: formatUg(air.o3) },
    { label: ui.no2, value: formatUg(air.no2) },
  ];
  return (
    <View
      style={{
        backgroundColor: isDark ? '#111827' : '#FFFFFF',
        borderWidth: 1,
        borderColor: isDark ? '#374151' : '#E5E7EB',
        borderRadius: 24,
        padding: 16,
        gap: 12,
      }}
    >
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{ui.airQuality}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: isDark ? '#042F2E' : '#F0FDFA',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AirIcon size={18} color={tint} strokeWidth={2.2} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, color: tint, marginTop: 2 }}>{air.europeanAqi}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: tint }}>{ui.air(air.band)}</Text>
          <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 19, color: colors.text200 }}>
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
              backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
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

function StatsRow({ snapshot }: { snapshot: NonNullable<ReturnType<typeof useWeather>['snapshot']> }) {
  const colors = useThemeColors();
  const isDark = useIsDark();
  const sunsetH = hourOf(snapshot.today.sunset);
  const items = [
    { label: ui.high, value: `${Math.round(snapshot.today.maxC)}°` },
    { label: ui.low, value: `${Math.round(snapshot.today.minC)}°` },
    { label: ui.rain(snapshot.today.precipitationProbability ?? 0).split(' ')[0], value: `${Math.round(snapshot.today.precipitationProbability ?? 0)}%` },
    { label: ui.wind(0).split(' ')[0], value: `${Math.round(snapshot.current.windKmh)}` },
    ...(snapshot.today.uvMax != null ? [{ label: 'UV', value: `${Math.round(snapshot.today.uvMax)}` }] : []),
    ...(sunsetH != null ? [{ label: ui.sunset, value: `${String(sunsetH).padStart(2, '0')}:00` }] : []),
  ];
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14, color: colors.text100 }}>{ui.today}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => (
          <View
            key={item.label}
            style={{
              minWidth: 96,
              flexGrow: 1,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: isDark ? '#374151' : '#E5E7EB',
              backgroundColor: isDark ? '#111827' : '#FFFFFF',
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, color: colors.text300 }}>{item.label}</Text>
            <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, color: colors.text100, marginTop: 4 }}>{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
