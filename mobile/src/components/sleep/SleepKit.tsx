import React from 'react';
import { ActivityIndicator, Platform, Pressable, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Mask } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';

/**
 * MEDISLEEP building blocks. The module is a night space (NightProvider + `sleep` tone): flat cards on the
 * plum night, one warm moonlight accent for the primary action and the moon, orchid for the module's own ink.
 * Numbers are set in the system face at a light weight (tabular), words in Noto Sans Georgian.
 */
export const MOON = '#F4E3B5';
export const MOON_INK = '#1B1145';
export const ORCHID = '#D9A8FF';
export const DUSK = '#9A4FD6';
export const SLEEP_GUTTER = 20;

const NUM_FONT = Platform.select({ ios: undefined, android: 'sans-serif-light', default: undefined });

/** Section: title outside the card (Home rule), optional link on the right. */
export function SleepSection({ title, action, children, style }: {
  title: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  return (
    <View style={[{ gap: 10 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: c.text100 }}>
          {title}
        </Text>
        {action ? (
          <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={10}>
            <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 20, color: c.primary100 }}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function NightCard({ children, style, onPress, accessibilityLabel }: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const base: ViewStyle = { backgroundColor: c.surface, borderRadius: 22, padding: 18 };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[base, style]}>
      {children}
    </Pressable>
  );
}

/** The one primary action: a moonlight pill with night ink. */
export function MoonButton({ label, icon: Icon, onPress, disabled, loading, style }: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={[{
        height: 54, borderRadius: 27, backgroundColor: MOON, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'center', gap: 10, paddingHorizontal: 22, opacity: disabled ? 0.45 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator color={MOON_INK} /> : Icon ? <Icon size={20} color={MOON_INK} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 22, color: MOON_INK }}>{label}</Text>
    </Pressable>
  );
}

/** Secondary action on night surfaces: a soft glass pill. */
export function GhostButton({ label, icon: Icon, onPress, style, compact }: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[{
        height: compact ? 40 : 54, borderRadius: compact ? 20 : 27, backgroundColor: 'rgba(255,255,255,0.12)',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: compact ? 14 : 20,
      }, style]}
    >
      {Icon ? <Icon size={compact ? 16 : 20} color="#FFFFFF" /> : null}
      <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: compact ? 13 : 15, lineHeight: 20, color: '#FFFFFF' }}>{label}</Text>
    </Pressable>
  );
}

export function SleepChip({ label, selected, onPress, icon: Icon }: { label: string; selected?: boolean; onPress: () => void; icon?: LucideIcon }) {
  const c = useThemeColors();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        minHeight: 40, borderRadius: 20, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 7,
        backgroundColor: selected ? c.primary200 : c.surfaceRaised,
      }}
    >
      {Icon ? <Icon size={16} color={selected ? '#FFFFFF' : c.text200} /> : null}
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 19, color: selected ? '#FFFFFF' : c.text200 }}>{label}</Text>
    </Pressable>
  );
}

/**
 * A moon in one of five phases — the morning rating („როგორ გეძინა?“): 1 a thin crescent … 5 the full moon.
 * The phase is the meaning, so it reads the same in any tint.
 */
export function QualityMoon({ level, size = 28, color = MOON, dim = 'rgba(255,255,255,0.10)' }: { level: number; size?: number; color?: string; dim?: string }) {
  const r = size / 2 - 1;
  const cx = size / 2;
  const id = `moon-${level}-${size}`;
  // The shadow disc slides left as the moon fills: 1 → mostly covered, 5 → gone.
  const shift = level >= 5 ? size * 2 : r * (0.3 + (level - 1) * 0.42);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <Mask id={id}>
          <Circle cx={cx} cy={cx} r={r} fill="#FFFFFF" />
          <Circle cx={cx - shift} cy={cx} r={r} fill="#000000" />
        </Mask>
      </Defs>
      <Circle cx={cx} cy={cx} r={r} fill={dim} />
      <Circle cx={cx} cy={cx} r={r} fill={color} mask={`url(#${id})`} />
    </Svg>
  );
}

/** „7 სთ 40 წთ“ with light numerals and small units. */
export function SleepDuration({ minutes, size = 40, color, unitColor }: { minutes: number | null | undefined; size?: number; color?: string; unitColor?: string }) {
  const c = useThemeColors();
  const ink = color ?? c.text100;
  const unit = unitColor ?? c.text200;
  if (minutes == null || !Number.isFinite(minutes)) {
    return <Text style={{ fontFamily: NUM_FONT, fontWeight: '200', fontSize: size, color: ink }}>—</Text>;
  }
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  const num = { fontFamily: NUM_FONT, fontWeight: '200' as const, fontSize: size, lineHeight: Math.round(size * 1.15), color: ink, fontVariant: ['tabular-nums' as const], letterSpacing: -0.5 };
  const u = { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: Math.max(12, Math.round(size * 0.34)), lineHeight: Math.round(size * 0.5), color: unit };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }} accessible accessibilityLabel={tx(`${h} საათი ${m} წუთი`, `${h} hours ${m} minutes`)}>
      <Text style={num}>{h}</Text>
      <Text style={[u, { marginRight: 6 }]}>{tx('სთ', 'h')}</Text>
      {m > 0 || h === 0 ? (
        <>
          <Text style={num}>{m}</Text>
          <Text style={u}>{tx('წთ', 'min')}</Text>
        </>
      ) : null}
    </View>
  );
}

/** A clock time in light numerals („23:00“). */
export function ClockText({ value, size = 22, color }: { value: string; size?: number; color?: string }) {
  const c = useThemeColors();
  return (
    <Text style={{ fontFamily: NUM_FONT, fontWeight: '300', fontSize: size, lineHeight: Math.round(size * 1.2), color: color ?? c.text100, fontVariant: ['tabular-nums'] }}>
      {value}
    </Text>
  );
}

export function SleepStat({ value, label, tone }: { value: string; label: string; tone?: string }) {
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: NUM_FONT, fontWeight: '300', fontSize: 22, lineHeight: 28, color: tone ?? c.text100, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text numberOfLines={2} style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17, color: c.text300 }}>{label}</Text>
    </View>
  );
}

const STAGE_COLORS = { deep: '#6D5BD0', core: '#9A86F0', rem: '#E2A6F2', awake: '#F4E3B5' } as const;

/** Health stages as one bar: deep · light · REM · awake, with minutes. */
export function StageBar({ stages }: { stages: { deep: number; rem: number; core: number; awake: number } }) {
  const c = useThemeColors();
  const parts = [
    { key: 'deep' as const, label: tx('ღრმა', 'Deep'), minutes: stages.deep },
    { key: 'core' as const, label: tx('მსუბუქი', 'Light'), minutes: stages.core },
    { key: 'rem' as const, label: 'REM', minutes: stages.rem },
    { key: 'awake' as const, label: tx('ღვიძილი', 'Awake'), minutes: stages.awake },
  ].filter((p) => p.minutes > 0);
  const total = parts.reduce((a, p) => a + p.minutes, 0) || 1;
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 }}>
        {parts.map((p) => (
          <View key={p.key} style={{ flex: p.minutes / total, backgroundColor: STAGE_COLORS[p.key] }} />
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, rowGap: 6 }}>
        {parts.map((p) => (
          <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: STAGE_COLORS[p.key] }} />
            <Text style={{ fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12, lineHeight: 17, color: c.text200 }}>
              {p.label} {Math.floor(p.minutes / 60) > 0 ? `${Math.floor(p.minutes / 60)}:${String(p.minutes % 60).padStart(2, '0')}` : tx(`${p.minutes} წთ`, `${p.minutes} min`)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/** A button pinned to the bottom of a scrolling page, on a fade of the night so content never shows through. */
export function PinnedFooter({ children, bottom }: { children: React.ReactNode; bottom: number }) {
  const c = useThemeColors();
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      <LinearGradient pointerEvents="none" colors={[`${c.bg100}00`, c.bg100, c.bg100]} locations={[0, 0.35, 1]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: -28 }} />
      <View style={{ paddingHorizontal: 20, paddingBottom: bottom + 14, paddingTop: 8, gap: 8 }}>{children}</View>
    </View>
  );
}

/** Night switch: dusk track; on the web the thumb colour needs its own prop. */
export function NightSwitch({ value, onValueChange, accessibilityLabel }: { value: boolean; onValueChange: (v: boolean) => void; accessibilityLabel?: string }) {
  const c = useThemeColors();
  const web = Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF', activeTrackColor: DUSK } as object) : {};
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ true: DUSK, false: c.bg300 }}
      thumbColor="#FFFFFF"
      ios_backgroundColor={c.bg300}
      accessibilityLabel={accessibilityLabel}
      {...web}
    />
  );
}

export function SleepBody({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  const c = useThemeColors();
  return <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 13, lineHeight: 20, color: muted ? c.text300 : c.text200 }}>{children}</Text>;
}
