import React, { useEffect, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Sparkles } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { Bone } from '@/components/ui/Skeleton';
import { Meteocon, airMeteoconSlug, type MeteoconSlug } from '@/components/weather/Meteocon';
import { WeatherEmblem } from '@/components/weather/WeatherEmblem';
import { weatherMood } from '@/components/weather/weatherMood';
import { HOME_SPACE as S } from '@/constants/homeSpacing';
import { useWeather } from '@/hooks/useWeather';
import { ka } from '@/i18n/ka';
import { WEATHER_UI, logWeatherEvent, weatherConditionLabel, weatherCopyText } from '@/lib/weather';
import { useIsDark, useThemeColors } from '@/theme/colors';

const ui = WEATHER_UI.ka;

const LABELS = {
  best: 'საუკეთესო დრო',
  tomorrow: 'ხვალის ფანჯარა',
  air: 'ჰაერი',
  rain: 'წვიმა',
  feels: 'იგრძნობა',
  wind: 'ქარი',
} as const;

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

type StatItem = {
  slug: MeteoconSlug;
  value: string;
  label: string;
};

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
  const condition = weatherConditionLabel(snapshot.current.condition, 'ka');
  const place = [condition, city].filter(Boolean).join(' · ');
  const accent = isDark ? '#5EEAD4' : mood.accent;

  const win = recommendation.bestOutdoorWindow;
  const air = snapshot.airQuality;
  const rain = snapshot.today.precipitationProbability;

  const stats: StatItem[] = [];
  if (win) {
    stats.push({
      slug: 'time-morning',
      value: `${win.start}–${win.end}`,
      label: win.day === 'tomorrow' ? LABELS.tomorrow : LABELS.best,
    });
  }
  if (air) {
    stats.push({
      slug: airMeteoconSlug(air.band),
      value: ui.air(air.band).replace(/^ჰაერი\s*/, ''),
      label: LABELS.air,
    });
  }
  if (rain != null) {
    stats.push({ slug: 'rain', value: `${Math.round(rain)}%`, label: LABELS.rain });
  }
  stats.push({
    slug: 'thermometer-celsius',
    value: `${Math.round(snapshot.current.feelsLikeC)}°`,
    label: LABELS.feels,
  });
  stats.push({
    slug: 'wind',
    value: `${Math.round(snapshot.current.windKmh)} კმ/სთ`,
    label: LABELS.wind,
  });
  const tiles = stats.slice(0, 3);

  const a11y = [
    city,
    `${Math.round(snapshot.current.temperatureC)}°`,
    condition,
    title,
    ...tiles.map((t) => `${t.label} ${t.value}`),
  ]
    .filter(Boolean)
    .join('. ');

  const hairline = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(17,24,39,0.06)';
  const tileBg = isDark ? 'rgba(31,41,55,0.72)' : 'rgba(255,255,255,0.85)';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      style={{
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: isDark ? mood.chipDark : colors.bg300,
        borderRadius: 24,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={isDark ? [colors.surface, mood.washDark] : ['#FFFFFF', mood.wash]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1.1, y: 1.2 }}
        style={{ paddingHorizontal: 14, paddingVertical: 14 }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            right: -36,
            top: -48,
            width: 150,
            height: 150,
            borderRadius: 75,
            opacity: isDark ? 0.45 : 0.7,
            backgroundColor: isDark ? mood.washDark : mood.wash,
          }}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <Text
              style={{
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 34,
                lineHeight: 38,
                letterSpacing: -1,
                color: colors.text100,
              }}
            >
              {Math.round(snapshot.current.temperatureC)}°
            </Text>
            <Text
              numberOfLines={1}
              style={{
                fontFamily: 'NotoSansGeorgian_500Medium',
                fontSize: 12.5,
                lineHeight: 17,
                color: colors.text300,
                marginTop: 2,
              }}
            >
              {place}
            </Text>
          </View>
          <WeatherEmblem
            icon={recommendation.icon}
            isDay={snapshot.current.isDay}
            accent={mood.accent}
            track={isDark ? '#374151' : '#D1D5DB'}
            fill={isDark ? '#1F2937' : mood.wash}
            score={recommendation.bestOutdoorWindow?.score ?? (snapshot.current.isDay ? 40 : 12)}
            size={72}
          />
        </View>

        <View style={{ height: 1, backgroundColor: hairline, marginTop: 12 }} />

        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 7, marginTop: 10 }}>
          <Sparkles size={14} color={accent} strokeWidth={2.3} style={{ marginTop: 2 }} />
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              fontFamily: 'NotoSansGeorgian_600SemiBold',
              fontSize: 13.5,
              lineHeight: 19,
              color: colors.text100,
            }}
          >
            {title}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
          {tiles.map((t) => (
            <StatTile key={t.label} stat={t} bg={tileBg} valueColor={colors.text100} labelColor={colors.text300} />
          ))}
        </View>

        {stale ? (
          <Text
            style={{
              marginTop: 8,
              textAlign: 'center',
              fontFamily: 'NotoSansGeorgian_500Medium',
              fontSize: 10,
              color: colors.text300,
            }}
          >
            {ui.updated}
          </Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

function StatTile({
  stat,
  bg,
  valueColor,
  labelColor,
}: {
  stat: StatItem;
  bg: string;
  valueColor: string;
  labelColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: 16,
        paddingVertical: 9,
        paddingHorizontal: 6,
        gap: 2,
      }}
    >
      <Meteocon slug={stat.slug} size={26} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13, lineHeight: 18, color: valueColor }}
      >
        {stat.value}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 10, lineHeight: 13, color: labelColor }}
      >
        {stat.label}
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
        paddingVertical: 14,
        minHeight: 168,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, gap: 7 }}>
          <Bone width={84} height={30} radius={10} />
          <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, color: colors.text200 }}>
            {ui.loading}
          </Text>
        </View>
        <Bone width={72} height={72} radius={36} />
      </View>
      <View style={{ marginTop: 14, gap: 12 }}>
        <Bone width={200} height={14} radius={7} />
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <View style={{ flex: 1 }}>
            <Bone width="100%" height={58} radius={16} />
          </View>
          <View style={{ flex: 1 }}>
            <Bone width="100%" height={58} radius={16} />
          </View>
          <View style={{ flex: 1 }}>
            <Bone width="100%" height={58} radius={16} />
          </View>
        </View>
      </View>
    </View>
  );
}
