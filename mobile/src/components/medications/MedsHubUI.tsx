import { brandHex } from '@/theme/brandTone';
import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Check, Clock, X, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { useIsDark, useThemeColors, type Palette } from '@/theme/colors';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import type { DoseStatus } from '@/types/medications';

/**
 * Building blocks for every medication screen in the Home hub language:
 * flat `surface` cards, tinted icon tiles, one filled CTA, quiet tonal chips.
 * Nothing here draws a border or a shadow.
 */

/** Filled CTA colour — dark uses the deeper teal so white text keeps contrast. */
export function medsPrimaryFill(c: Palette, dark: boolean): string {
  return dark ? brandHex('#0D9488') : c.primary200;
}

/** Pill colour swatches offered in the add-medication form. */
export const PILL_COLORS = [
  '#14B8A6',
  '#1E3A8A',
  '#E5E7EB',
  '#F43F5E',
  '#F97316',
  '#22C55E',
  '#0EA5E9',
  '#6366F1',
  '#334155',
  '#111827',
] as const;

export const DAY_TILE = 40;

export function MedsCard({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const c = useThemeColors();
  return (
    <View style={[s.card, { backgroundColor: c.surface, padding: padded ? HUB.cardPad : 0 }, style]}>{children}</View>
  );
}

export function MedsIconTile({
  icon: Icon,
  ink = 'teal',
  size = HUB.tile,
  iconSize = 21,
  style,
}: {
  icon: LucideIcon;
  ink?: HubInk;
  size?: number;
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const dark = useIsDark();
  const inkHex = hubInk(ink, dark);
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size / 3),
          backgroundColor: hubTint(inkHex, dark),
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Icon size={iconSize} color={inkHex} strokeWidth={1.8} />
    </View>
  );
}

export type MedsButtonTone = 'primary' | 'tonal' | 'quiet' | 'danger';

export function MedsButton({
  label,
  onPress,
  tone = 'primary',
  icon: Icon,
  disabled,
  loading,
  compact,
  ink = 'teal',
  style,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  tone?: MedsButtonTone;
  icon?: LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
  ink?: HubInk;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const inkHex = hubInk(ink, dark);
  const palette = {
    primary: { bg: medsPrimaryFill(c, dark), fg: c.onPrimary },
    tonal: { bg: hubTint(inkHex, dark), fg: inkHex },
    quiet: { bg: c.bg200, fg: c.text100 },
    danger: { bg: c.dangerBg, fg: c.danger },
  }[tone];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!inactive }}
      disabled={inactive}
      onPress={onPress}
      style={[
        compact ? s.btnCompact : s.btn,
        { backgroundColor: palette.bg, opacity: inactive ? 0.6 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {Icon ? <Icon size={compact ? 16 : 19} color={palette.fg} strokeWidth={2.2} /> : null}
          <Text
            numberOfLines={1}
            style={[
              compact ? hubText.link : { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16, lineHeight: 22 },
              { color: palette.fg },
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Round icon-only action (pressable tile) for a row of secondary actions. */
export function MedsRoundAction({
  icon: Icon,
  onPress,
  accessibilityLabel,
  tone = 'quiet',
  size = 40,
  ink = 'teal',
}: {
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  tone?: MedsButtonTone;
  size?: number;
  ink?: HubInk;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const inkHex = hubInk(ink, dark);
  const palette = {
    primary: { bg: medsPrimaryFill(c, dark), fg: c.onPrimary },
    tonal: { bg: hubTint(inkHex, dark), fg: inkHex },
    quiet: { bg: c.bg200, fg: c.text100 },
    danger: { bg: c.dangerBg, fg: c.danger },
  }[tone];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: palette.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={Math.round(size * 0.45)} color={palette.fg} strokeWidth={2.2} />
    </Pressable>
  );
}

export function MedsChip({
  label,
  active,
  onPress,
  ink = 'teal',
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  ink?: HubInk;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const inkHex = hubInk(ink, dark);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      disabled={!onPress}
      style={[s.chip, { backgroundColor: active ? hubTint(inkHex, dark) : c.bg200 }, style]}
    >
      <Text style={[active ? hubText.link : hubText.caption, { color: active ? inkHex : c.text100 }]}>{label}</Text>
    </Pressable>
  );
}

export function doseStatusColor(status: DoseStatus | 'planned' | 'mixed', c: Palette): string {
  switch (status) {
    case 'taken':
      return c.success;
    case 'skipped':
      return c.danger;
    case 'mixed':
    case 'pending':
      return c.warning;
    default:
      return c.text300;
  }
}

/** Small tinted pill that names a dose's logged status. */
export function MedsStatusPill({ status, small }: { status: DoseStatus; small?: boolean }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const color = doseStatusColor(status, c);
  const Icon = status === 'taken' ? Check : status === 'skipped' ? X : Clock;
  const label =
    status === 'taken' ? ka.meds.statusTaken : status === 'skipped' ? ka.meds.statusSkipped : ka.meds.statusPending;
  return (
    <View
      accessibilityLabel={label}
      style={[
        s.statusPill,
        { backgroundColor: hubTint(color, dark), paddingVertical: small ? 3 : 5, paddingHorizontal: small ? 8 : 10 },
      ]}
    >
      <Icon size={small ? 12 : 14} color={color} strokeWidth={2.6} />
      <Text style={[small ? hubText.small : hubText.caption, { color, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>
        {label}
      </Text>
    </View>
  );
}

/** Progress ring; children sit in the middle. */
export function MedsRing({
  size = 64,
  stroke = 6,
  progress,
  color,
  track,
  children,
}: {
  size?: number;
  stroke?: number;
  progress: number;
  color: string;
  track: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        {pct > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${circumference * pct} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** Thin horizontal progress bar. */
export function MedsProgressBar({ progress, color, track, height = 6 }: { progress: number; color: string; track: string; height?: number }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
    </View>
  );
}

/** Label / value row for a details card (static, no chevron). */
export function MedsInfoRow({
  icon,
  ink = 'teal',
  label,
  value,
  isLast,
}: {
  icon: LucideIcon;
  ink?: HubInk;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const c = useThemeColors();
  return (
    <>
      <View style={s.infoRow} accessible accessibilityLabel={`${label}: ${value}`}>
        <MedsIconTile icon={icon} ink={ink} size={40} iconSize={19} />
        <Text numberOfLines={2} style={[hubText.cardTitle, { flex: 1, fontSize: 14, lineHeight: 20, color: c.text100 }]}>
          {label}
        </Text>
        <Text numberOfLines={2} style={[hubText.value, { fontSize: 14, maxWidth: '48%', textAlign: 'right', color: c.text100 }]}>
          {value}
        </Text>
      </View>
      {isLast ? null : <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: 68 }} />}
    </>
  );
}

export function MedsEmptyState({
  icon,
  ink = 'teal',
  art,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  ink?: HubInk;
  /** 3D artwork shown at 110px instead of the icon tile. */
  art?: ImageSourcePropType;
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  const c = useThemeColors();
  return (
    <View style={s.empty}>
      {art ? (
        <Image
          source={art}
          resizeMode="contain"
          accessible={false}
          accessibilityIgnoresInvertColors
          style={{ width: 110, height: 110 }}
        />
      ) : (
        <MedsIconTile icon={icon} ink={ink} size={84} iconSize={40} style={{ borderRadius: 26 }} />
      )}
      <View style={{ gap: 8, alignItems: 'center' }}>
        <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 29, color: c.text100, textAlign: 'center' }}>
          {title}
        </Text>
        {body ? (
          <Text style={[hubText.body, { fontSize: 15, lineHeight: 22, color: c.text200, textAlign: 'center' }]}>{body}</Text>
        ) : null}
      </View>
      {children ? <View style={{ width: '100%', gap: 10, marginTop: 8 }}>{children}</View> : null}
    </View>
  );
}

export function MedsHairline({ inset = 0, style }: { inset?: number; style?: StyleProp<ViewStyle> }) {
  const c = useThemeColors();
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: c.bg300, marginLeft: inset }, style]} />;
}

const s = StyleSheet.create({
  card: {
    borderRadius: HUB.cardRadius,
    overflow: 'hidden',
  },
  btn: {
    minHeight: 52,
    borderRadius: HUB.tileRadius,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnCompact: {
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  chip: {
    minHeight: 34,
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 58,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  empty: {
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: HUB.gutter,
    paddingVertical: 24,
  },
});
