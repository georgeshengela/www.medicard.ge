import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ChevronRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Moon,
  Plus,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { useHomeOutdoor } from '@/hooks/useHomeActive';
import type { useHydration } from '@/hooks/useHydration';
import { tx } from '@/i18n/locale';
import { isFeatureOn, useFeatureState } from '@/lib/featureFlags';
import { outdoorCopy, type OutdoorView } from '@/lib/home/activeHome';
import type { WeatherCondition } from '@/lib/weather/types';
import { HYDRATION_DROP_ML } from '@/types/hydration';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';

const liters = (ml: number) => (Math.max(0, ml) / 1000).toFixed(1);

type Props = {
  /** Home root's `useHydration()` — never a second instance here. */
  hydration: ReturnType<typeof useHydration>;
  /** The root's +250 ml (already haptic). */
  onAddWater: () => void;
  first?: boolean;
};

/**
 * „წყალი და გარეთ“ — a glass in one tap and the weather module's best time to be outside.
 * Water keeps its semantic blue. Without weather (module paused, no location, no fresh snapshot)
 * the water tile takes the whole row; both paused → nothing.
 */
export function HomeWaterOutdoor({ hydration, onAddWater, first = false }: Props) {
  const c = useThemeColors();
  const router = useRouter();
  const features = useFeatureState();
  const waterOn = isFeatureOn('hydration', features);
  const weatherOn = isFeatureOn('weather', features);
  const outdoor = useHomeOutdoor(weatherOn);
  // While the first cache read of the session settles, keep the two-up layout (no jump for the
  // common case); a tile that turns out empty then gives its place to water.
  const showOutdoor = weatherOn && (Boolean(outdoor.view) || outdoor.pending);
  if (!waterOn && !showOutdoor) return null;
  const wide = !(waterOn && showOutdoor);

  return (
    <View style={[s.section, { marginTop: first ? 22 : HUB.sectionGap }]}>
      <HomeSectionHeading title={tx('წყალი და გარეთ', 'Water and outdoors')} />
      <View style={s.row}>
        {waterOn ? (
          <WaterTile hydration={hydration} onAddWater={onAddWater} wide={wide} onOpen={() => router.push('/health-metrics/hydration' as never)} />
        ) : null}
        {showOutdoor ? (
          outdoor.view ? (
            <OutdoorTile view={outdoor.view} wide={wide} onOpen={() => router.push('/weather' as never)} />
          ) : (
            <View style={[s.tile, { backgroundColor: c.surface }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
          )
        ) : null}
      </View>
    </View>
  );
}

function WaterTile({
  hydration,
  onAddWater,
  wide,
  onOpen,
}: {
  hydration: Props['hydration'];
  onAddWater: () => void;
  wide: boolean;
  onOpen: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = dark ? '#60A5FA' : '#2563EB';
  const barColor = dark ? '#60A5FA' : '#3B82F6';
  const loading = hydration.loading;
  const value = loading ? '…' : `${liters(hydration.todayMl)} ${tx('ლ', 'L')}`;
  const caption = loading
    ? ' '
    : hydration.remainingMl > 0
      ? tx(`${liters(hydration.goalMl)} ლ-დან · დარჩა ${liters(hydration.remainingMl)}`, `of ${liters(hydration.goalMl)} L · ${liters(hydration.remainingMl)} to go`)
      : tx(`${liters(hydration.goalMl)} ლ-დან · მიზანი შესრულდა`, `of ${liters(hydration.goalMl)} L · goal reached`);
  const label = tx(
    `წყალი: ${liters(hydration.todayMl)} ლიტრი ${liters(hydration.goalMl)}-დან`,
    `Water: ${liters(hydration.todayMl)} of ${liters(hydration.goalMl)} litres`,
  );

  const plus = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx(`წყლის დამატება, ${HYDRATION_DROP_ML} მლ`, `Add water, ${HYDRATION_DROP_ML} ml`)}
      hitSlop={6}
      onPress={onAddWater}
      style={[s.plus, { backgroundColor: dark ? '#1E3A5F' : '#DBEAFE' }]}
    >
      <Plus size={17} color={ink} strokeWidth={2.4} />
    </Pressable>
  );
  const icon = (
    <View style={[s.icon, { backgroundColor: hubTint(ink, dark) }]}>
      <Droplets size={21} color={ink} strokeWidth={1.8} />
    </View>
  );
  const texts = (
    <View>
      <Text numberOfLines={1} style={[s.value, { color: c.text100 }]}>{value}</Text>
      <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{caption}</Text>
    </View>
  );
  const bar = <Bar progress={hydration.progress} color={barColor} track={c.bg200} />;

  if (wide) {
    return (
      <View style={[s.tile, s.wideTile, { backgroundColor: c.surface }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onOpen} style={s.wideMain}>
          {icon}
          <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
            {texts}
            {bar}
          </View>
        </Pressable>
        {plus}
      </View>
    );
  }

  return (
    <View style={[s.tile, { backgroundColor: c.surface }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onOpen} style={s.tileMain}>
        {icon}
        {texts}
        {bar}
      </Pressable>
      <View style={s.plusCorner}>{plus}</View>
    </View>
  );
}

function OutdoorTile({ view, wide, onOpen }: { view: OutdoorView; wide: boolean; onOpen: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = hubInk('amber', dark);
  const copy = outdoorCopy(view);
  const Icon = conditionIcon(view.condition, view.isDay);
  const icon = (
    <View style={[s.icon, { backgroundColor: hubTint(ink, dark) }]}>
      <Icon size={21} color={ink} strokeWidth={1.8} />
    </View>
  );
  const texts = (
    <View style={{ gap: 2 }}>
      <View>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.value, { color: c.text100 }]}>
          {copy.value}
        </Text>
        <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>{copy.caption}</Text>
      </View>
      <Text numberOfLines={2} style={[hubText.small, { color: c.text200 }]}>{copy.detail}</Text>
    </View>
  );
  const label = `${copy.caption}: ${copy.value}. ${copy.detail}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={tx('ამინდის გვერდი', 'Opens the weather')}
      onPress={onOpen}
      style={[s.tile, wide ? s.wideTile : s.tileMain, { backgroundColor: c.surface }]}
    >
      {icon}
      {wide ? <View style={{ flex: 1, minWidth: 0 }}>{texts}</View> : texts}
      {wide ? <ChevronRight size={18} color={c.text300} /> : null}
    </Pressable>
  );
}

function conditionIcon(condition: WeatherCondition, isDay: boolean): LucideIcon {
  switch (condition) {
    case 'clear':
    case 'mostly_clear':
      return isDay ? Sun : Moon;
    case 'partly_cloudy':
      return isDay ? CloudSun : CloudMoon;
    case 'cloudy':
      return Cloud;
    case 'fog':
      return CloudFog;
    case 'drizzle':
      return CloudDrizzle;
    case 'rain':
    case 'heavy_rain':
      return CloudRain;
    case 'snow':
    case 'heavy_snow':
      return CloudSnow;
    case 'storm':
      return CloudLightning;
    default:
      return CloudSun;
  }
}

function Bar({ progress, color, track }: { progress: number; color: string; track: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <View style={[s.track, { backgroundColor: track }]}>
      <View style={[s.fill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter },
  row: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, minWidth: 0, minHeight: 156, borderRadius: HUB.cardRadius, padding: 16 },
  tileMain: { gap: 10 },
  wideTile: { minHeight: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  wideMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14 },
  icon: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  value: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 19, lineHeight: 24 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  plus: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  plusCorner: { position: 'absolute', top: 16, right: 16 },
});
