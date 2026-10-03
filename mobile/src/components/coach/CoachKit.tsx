import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import type { LucideIcon } from 'lucide-react-native';
import { HUB, hubInk, hubText, hubTint, type HubInk } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { tx } from '@/i18n/locale';

/**
 * MEDICOACH building blocks (2026-09-28 redesign): progress ring, skeletons, segmented control,
 * KPI tiles, quick actions and haptics. They sit on the hub language (flat surface, radius 22,
 * tinted icon tiles) — no borders, no shadows, one spotlight per page.
 */

export const haptic = {
  tap: () => {
    if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
  },
  press: () => {
    if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  },
  success: () => {
    if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  },
};

/** Circular progress (0–1). Children sit in the middle. */
export function Ring({ value, size = 64, stroke = 6, color, track, children }: { value: number | null; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode }) {
  const c = useThemeColors();
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? c.bg200} strokeWidth={stroke} fill="none" />
        {v > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color ?? '#14B8A6'}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${len * v} ${len}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      {children}
    </View>
  );
}

/** Ring colour for a 0–100 adherence score. */
export function scoreColor(score: number | null | undefined, dark: boolean): string {
  if (score == null) return dark ? '#374151' : '#D1D5DB';
  if (score >= 75) return dark ? '#34D399' : '#059669';
  if (score >= 50) return dark ? '#FCD34D' : '#D97706';
  return dark ? '#F87171' : '#DC2626';
}

/** Placeholder block with a soft pulse (reserves the space the content will take). */
export function Skeleton({ height, width = '100%', radius = 12, style }: { height: number; width?: number | `${number}%`; radius?: number; style?: ViewStyle }) {
  const c = useThemeColors();
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: c.bg200, opacity: pulse }, style]} />;
}

/** A page-shaped skeleton: a hero card and a few rows. */
export function SkeletonPage({ rows = 3 }: { rows?: number }) {
  const c = useThemeColors();
  return (
    <View accessibilityLabel={tx('იტვირთება', 'Loading')} accessibilityRole="progressbar" style={{ gap: 12, marginTop: 16 }}>
      <View style={[kit.card, { backgroundColor: c.surface, gap: 12 }]}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton height={52} width={52} radius={26} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={14} width="60%" />
            <Skeleton height={12} width="40%" />
          </View>
        </View>
        <Skeleton height={44} radius={14} />
      </View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[kit.card, { backgroundColor: c.surface, flexDirection: 'row', gap: 12, alignItems: 'center' }]}>
          <Skeleton height={40} width={40} radius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <Skeleton height={13} width="70%" />
            <Skeleton height={11} width="45%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Segmented control: equal-width pills on a bg200 track; an optional count badge per option. */
export function Segmented<T extends string>({ options, value, onChange, style }: { options: { key: T; label: string; count?: number }[]; value: T; onChange: (key: T) => void; style?: ViewStyle }) {
  const c = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={[kit.segTrack, { backgroundColor: c.bg200 }, style]}>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.count ? `${o.label}, ${o.count}` : o.label}
            onPress={() => {
              if (active) return;
              haptic.tap();
              onChange(o.key);
            }}
            style={[kit.seg, active ? { backgroundColor: c.surface } : null]}
          >
            <Text numberOfLines={1} style={[hubText.link, { color: active ? c.text100 : c.text300 }]}>{o.label}</Text>
            {o.count ? (
              <View style={[kit.segCount, { backgroundColor: active ? '#0D9488' : c.bg300 }]}>
                <Text style={[kit.segCountText, { color: active ? '#FFFFFF' : c.text100 }]}>{o.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Metric tile: icon tile, big value, label. Two per row. */
export function KpiTile({ icon: Icon, ink, value, label, hint, onPress }: { icon: LucideIcon; ink: HubInk; value: string; label: string; hint?: string; onPress?: () => void }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const color = hubInk(ink, dark);
  const body = (
    <>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: hubTint(color, dark), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} strokeWidth={2} />
      </View>
      <Text style={[kit.kpiValue, { color: c.text100 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{label}</Text>
      {hint ? <Text numberOfLines={1} style={[hubText.small, { color: c.text300 }]}>{hint}</Text> : null}
    </>
  );
  const style = [kit.kpi, { backgroundColor: c.surface }];
  if (!onPress) return <View style={style} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ''}`}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} className="active:opacity-80" style={style}>
      {body}
    </Pressable>
  );
}

/** Round action with a label under it (quick actions row). */
export function QuickAction({ icon: Icon, label, onPress, primary, badge }: { icon: LucideIcon; label: string; onPress: () => void; primary?: boolean; badge?: number }) {
  const c = useThemeColors();
  const dark = useIsDark();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.press();
        onPress();
      }}
      className="active:opacity-75"
      style={{ flex: 1, alignItems: 'center', gap: 6, minHeight: 48 }}
    >
      <View style={[kit.qa, { backgroundColor: primary ? '#0D9488' : c.surface }]}>
        <Icon size={22} color={primary ? '#FFFFFF' : hubInk('teal', dark)} strokeWidth={2} />
        {badge ? (
          <View style={[kit.qaBadge, { borderColor: c.bg100 }]}>
            <Text style={kit.qaBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={1} style={[hubText.small, { color: c.text200, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
    </Pressable>
  );
}

/** Small status pill with a dot. */
export function StatusPill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'brand' | 'neutral' | 'live' }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const map = {
    ok: [c.successBg, c.success],
    warn: [c.warningBg, c.warning],
    bad: [c.dangerBg, c.danger],
    brand: [c.accent100, c.primary100],
    neutral: [c.bg200, c.text200],
    live: [dark ? '#064E3B' : '#D1FAE5', dark ? '#6EE7B7' : '#047857'],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[kit.pill, { backgroundColor: bg }]}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      <Text style={[hubText.small, { color: fg, fontFamily: 'NotoSansGeorgian_600SemiBold' }]}>{label}</Text>
    </View>
  );
}

/** Fades content in once when it first appears (skipped when the OS asks for reduced motion). */
export function FadeIn({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: ViewStyle }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!alive) return;
        if (reduced) v.setValue(1);
        else Animated.timing(v, { toValue: 1, duration: 260, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      });
    return () => {
      alive = false;
    };
  }, [v, delay]);
  return <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>{children}</Animated.View>;
}

/** "in 40 min" / "now" / "2 h ago" from an ISO start and a duration. */
export function sessionTiming(startsAt: string, durationMin: number, now = Date.now()): { phase: 'soon' | 'live' | 'past'; text: string } {
  const start = new Date(startsAt).getTime();
  const end = start + durationMin * 60000;
  if (now >= start && now < end) return { phase: 'live', text: tx(`მიმდინარეობს · ${Math.max(1, Math.round((end - now) / 60000))} წთ დარჩა`, `In progress · ${Math.max(1, Math.round((end - now) / 60000))} min left`) };
  if (now >= end) return { phase: 'past', text: tx('დასრულდა', 'Finished') };
  const min = Math.round((start - now) / 60000);
  if (min < 60) return { phase: 'soon', text: tx(`${Math.max(1, min)} წუთში`, `in ${Math.max(1, min)} min`) };
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { phase: 'soon', text: m && h < 5 ? tx(`${h} სთ ${m} წთ-ში`, `in ${h} h ${m} min`) : tx(`${h} საათში`, `in ${h} ${h === 1 ? 'hour' : 'hours'}`) };
}

export const kit = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad },
  segTrack: { flexDirection: 'row', borderRadius: 16, padding: 4, gap: 4 },
  seg: { flex: 1, minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6 },
  segCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  segCountText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 11 },
  kpi: { flex: 1, borderRadius: 20, padding: 14, gap: 2, minHeight: 116 },
  kpiValue: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 24, lineHeight: 32, marginTop: 8 },
  qa: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  qaBadge: { position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: '#EF4444', borderWidth: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  qaBadgeText: { color: '#FFFFFF', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 10 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
});
