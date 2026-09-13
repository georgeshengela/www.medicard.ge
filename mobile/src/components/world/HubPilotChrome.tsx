import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Info } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { WORLD_FONT_BODY, WORLD_FONT_MED, WORLD_FONT_TITLE, useWorldLocale } from '@/components/world/WorldChrome';
import { MEDI_WORLD_ART } from '@/lib/mediWorld/art';
import { useIsDark, useThemeColors } from '@/theme/colors';

export { useWorldLocale };

export const HUB_FONT_TITLE = WORLD_FONT_TITLE;
export const HUB_FONT_MED = WORLD_FONT_MED;
export const HUB_FONT_BODY = WORLD_FONT_BODY;

/** Compact language track — same family as ThemeSelect / UnitSegment, not two loose text buttons. */
export function HubLangToggle({
  kaLabel = 'ქარ',
  enLabel = 'EN',
}: {
  kaLabel?: string;
  enLabel?: string;
}) {
  const colors = useThemeColors();
  const { locale, setLocale } = useWorldLocale();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel="Language"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.bg200,
        borderRadius: 999,
        padding: 3,
        minHeight: 44,
      }}
    >
      {([
        { id: 'ka' as const, label: kaLabel },
        { id: 'en' as const, label: enLabel },
      ]).map((item) => {
        const selected = locale === item.id;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => setLocale(item.id)}
            className="active:opacity-80"
            style={{
              minHeight: 38,
              minWidth: 44,
              paddingHorizontal: 12,
              borderRadius: 999,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? colors.surface : 'transparent',
            }}
          >
            <Text style={{ ...HUB_FONT_MED, fontSize: 14, color: selected ? colors.text100 : colors.text300 }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function HubNav({
  backLabel,
  kaLabel,
  enLabel,
  onHelp,
  helpLabel,
}: {
  backLabel: string;
  kaLabel?: string;
  enLabel?: string;
  onHelp: () => void;
  helpLabel: string;
}) {
  const router = useRouter();
  const colors = useThemeColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={() => {
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/home' as never);
        }}
        hitSlop={8}
        className="active:opacity-75"
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
      >
        <ArrowLeft size={22} color={colors.text100} strokeWidth={2.2} />
      </Pressable>
      <HubLangToggle kaLabel={kaLabel} enLabel={enLabel} />
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={helpLabel}
        onPress={onHelp}
        hitSlop={8}
        className="active:opacity-75"
        style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }}
      >
        <Info size={20} color={colors.primary200} strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

/**
 * Compact World-level ring. Geometry from Figma 9001:283189 (track, round-cap arc, knob, inner disc)
 * remapped to Medicard teal. Number is World level — not a health score.
 */
export function HubLevelRing({
  level,
  progressPct,
  label,
  size = 84,
}: {
  level: number;
  progressPct: number;
  label: string;
  size?: number;
}) {
  const colors = useThemeColors();
  const dark = useIsDark();
  const stroke = size >= 96 ? 10 : 8;
  const r = (size - stroke) / 2 - 3;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, progressPct)) / 100;
  const dash = Math.max(0.01, pct) * c;
  const brand = dark ? '#2DD4BF' : '#0F766E';
  const track = dark ? '#1F2937' : '#CCFBF1';
  const knobAngle = -Math.PI / 2 + pct * 2 * Math.PI;
  const knobX = cx + r * Math.cos(knobAngle);
  const knobY = cy + r * Math.sin(knobAngle);
  const inner = size - stroke * 2 - 10;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} ${level}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={cx} cy={cy} r={r + 4} stroke={dark ? '#1F293755' : '#99F6E466'} strokeWidth={1} fill="none" />
        <Circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={brand}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${c}`}
          strokeLinecap="round"
          rotation="-90"
          origin={`${cx}, ${cy}`}
        />
        <Circle cx={knobX} cy={knobY} r={6} fill={colors.surface} stroke={brand} strokeWidth={3} />
      </Svg>
      <View
        pointerEvents="none"
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            ...HUB_FONT_TITLE,
            fontSize: size >= 96 ? 28 : 22,
            lineHeight: size >= 96 ? 32 : 26,
            color: colors.text100,
            letterSpacing: -0.4,
          }}
        >
          {level}
        </Text>
      </View>
    </View>
  );
}

export function HubPrimaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        minHeight: 48,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#0F766E',
      }}
    >
      <Text style={{ ...HUB_FONT_TITLE, fontSize: 16, lineHeight: 22, textAlign: 'center', color: colors.onPrimary }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function HubMedi({ size = 220, accessibilityLabel = 'მედი' }: { size?: number; accessibilityLabel?: string }) {
  const height = size;
  const width = Math.round(size * (845 / 1238));
  return (
    <Image
      source={MEDI_WORLD_ART.mediCutout}
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={{ width, height }}
    />
  );
}
