import React, { useState } from 'react';
import { Pressable, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { ChevronRight, Search, X, type LucideIcon } from 'lucide-react-native';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { ka } from '@/i18n/ka';
import { tx } from '@/i18n/locale';
import type { LabFlag } from '@/types/lab';
import { HUB, hubInk, hubText, hubTint } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { moduleInk } from '@/theme/moduleBrand';

/**
 * MEDILAB's page kit (owner 2026-10-04): the hub language — flat `surface` cards, titles outside,
 * 20 px gutter — with the module's indigo on actions and selection. A value outside its range is amber
 * (look here, not an alarm), a value inside it green; red stays for deleting.
 */
export function useMedilab() {
  const c = useThemeColors();
  const dark = useIsDark();
  const ink = moduleInk('lab', dark);
  const attention = hubInk('amber', dark);
  const normal = hubInk('green', dark);
  return {
    dark,
    c,
    ink,
    inkSoft: hubTint(ink, dark),
    /** Text on a filled indigo button. */
    onInk: dark ? '#1E1B4B' : '#FFFFFF',
    attention,
    attentionSoft: hubTint(attention, dark),
    normal,
    normalSoft: hubTint(normal, dark),
  };
}

export function flagIsOff(flag: LabFlag): boolean {
  return flag === 'H' || flag === 'L';
}

/** Small status word: „დაბალი“ / „მაღალი“ in amber, „ნორმა“ in green, „უცნობი“ quiet. */
export function FlagPill({ flag }: { flag: LabFlag }) {
  const M = useMedilab();
  const tone = flag === 'H' || flag === 'L'
    ? { fg: M.attention, bg: M.attentionSoft, label: flag === 'H' ? ka.lab.above : ka.lab.below }
    : flag === 'N'
      ? { fg: M.normal, bg: M.normalSoft, label: ka.lab.normal }
      : { fg: M.c.text300, bg: M.c.bg200, label: ka.lab.unknown };
  return (
    <View style={{ borderRadius: 9, paddingHorizontal: 8, paddingVertical: 2, backgroundColor: tone.bg }}>
      <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 11.5, lineHeight: 17, color: tone.fg }}>{tone.label}</Text>
    </View>
  );
}

/** The normal range fills the middle half of the bar; the dot stays on the bar even far outside it. */
export function rangePosition(value: number, low: number, high: number): number {
  const at = 0.25 + ((value - low) / (high - low)) * 0.5;
  return Math.min(0.97, Math.max(0.03, at));
}

export function hasRange(p: { value: number; refLow: number | null; refHigh: number | null }): boolean {
  return Number.isFinite(p.value) && p.refLow != null && p.refHigh != null && p.refHigh > p.refLow;
}

/** Reference-range bar on a light card: soft band = normal range, dot = the value. */
export function RangeBar({ value, low, high, flag, height = 6 }: { value: number; low: number; high: number; flag: LabFlag; height?: number }) {
  const M = useMedilab();
  const off = flagIsOff(flag);
  const at = rangePosition(value, low, high);
  const dot = height + 6;
  return (
    <View style={{ height: dot, justifyContent: 'center' }}>
      <View style={{ height, borderRadius: height / 2, backgroundColor: M.c.bg200 }}>
        <View style={{ position: 'absolute', left: '25%', width: '50%', top: 0, bottom: 0, borderRadius: height / 2, backgroundColor: M.normalSoft }} />
      </View>
      <View
        style={{
          position: 'absolute',
          left: `${at * 100}%`,
          marginLeft: -dot / 2,
          width: dot,
          height: dot,
          borderRadius: dot / 2,
          backgroundColor: off ? M.attention : M.normal,
          borderWidth: 2,
          borderColor: M.c.surface,
        }}
      />
    </View>
  );
}

/** iOS segmented control in the module's ink: the thumb slides, counts sit beside the labels. */
export function MedilabSegmented<T extends string>({ value, onChange, options, style }: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; count?: number }[];
  style?: StyleProp<ViewStyle>;
}) {
  const M = useMedilab();
  const reduceMotion = usePrefersReducedMotion();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((option) => option.value === value));
  const segmentWidth = width ? (width - 6) / options.length : 0;
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: reduceMotion ? index * segmentWidth : withTiming(index * segmentWidth, { duration: 220 }) }],
  }), [index, segmentWidth, reduceMotion]);

  return (
    <View
      accessibilityRole="tablist"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[{ flexDirection: 'row', borderRadius: 14, padding: 3, height: 44, backgroundColor: M.c.surface }, style]}
    >
      {segmentWidth ? (
        <Animated.View style={[{ position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: 11, width: segmentWidth, backgroundColor: M.inkSoft }, thumb]} />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={option.count != null ? `${option.label}, ${option.count}` : option.label}
            onPress={() => onChange(option.value)}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <Text numberOfLines={1} style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 14, lineHeight: 20, color: selected ? M.ink : M.c.text200 }}>
              {option.label}
            </Text>
            {option.count != null ? (
              <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 18, color: selected ? M.ink : M.c.text300 }}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Small filter chips (only the ones that apply); selected = filled indigo. */
export function MedilabChips<T extends string>({ value, onChange, options }: {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string; count?: number }[];
}) {
  const M = useMedilab();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={{
              minHeight: 34,
              paddingHorizontal: 14,
              borderRadius: 17,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              backgroundColor: selected ? M.ink : M.c.surface,
            }}
          >
            <Text style={[hubText.link, { color: selected ? M.onInk : M.c.text200 }]}>{option.label}</Text>
            {option.count != null ? (
              <Text style={[hubText.link, { color: selected ? M.onInk : M.c.text300, opacity: selected ? 0.8 : 1 }]}>{option.count}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact search field on `surface`. */
export function MedilabSearch({ value, onChange, placeholder = ka.lab.searchPlaceholder }: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const M = useMedilab();
  return (
    <View style={{ minHeight: 44, borderRadius: 14, backgroundColor: M.c.surface, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 8 }}>
      <Search size={18} color={M.c.text300} strokeWidth={2.2} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={M.c.text300}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1, fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 15, lineHeight: 20, color: M.c.text100, paddingVertical: 10 }}
      />
      {value ? (
        <Pressable onPress={() => onChange('')} hitSlop={10} accessibilityRole="button" accessibilityLabel={tx('გასუფთავება', 'Clear')}>
          <X size={18} color={M.c.text300} strokeWidth={2.2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** One action row in a flat card: tinted icon tile · title + one line · chevron. */
export function MedilabActionRow({ icon: Icon, title, body, onPress, ink }: {
  icon: LucideIcon;
  title: string;
  body?: string;
  onPress: () => void;
  /** Icon ink; defaults to the module indigo. */
  ink?: string;
}) {
  const M = useMedilab();
  const color = ink ?? M.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={body ? `${title}. ${body}` : title}
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: HUB.cardRadius, backgroundColor: M.c.surface }}
    >
      <View style={{ width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center', backgroundColor: hubTint(color, M.dark) }}>
        <Icon size={19} color={color} strokeWidth={1.9} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={1} style={[hubText.cardTitle, { color: M.c.text100 }]}>{title}</Text>
        {body ? <Text numberOfLines={2} style={[hubText.caption, { color: M.c.text200 }]}>{body}</Text> : null}
      </View>
      <ChevronRight size={18} color={M.c.text300} strokeWidth={2.2} />
    </Pressable>
  );
}

/** Filled indigo button (the page's primary action). */
export function MedilabButton({ label, icon: Icon, onPress, busy, disabled }: {
  label: string;
  icon?: LucideIcon;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const M = useMedilab();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={{
        minHeight: 48,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 16,
        backgroundColor: M.ink,
        opacity: disabled || busy ? 0.6 : 1,
      }}
    >
      {Icon ? <Icon size={18} color={M.onInk} strokeWidth={2.2} /> : null}
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: M.onInk }}>{label}</Text>
    </Pressable>
  );
}

/** Group heading above a card (small, muted — like the records list). */
export function MedilabGroupLabel({ children, right }: { children: string; right?: string }) {
  const M = useMedilab();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, marginHorizontal: 4 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 18, color: M.c.text300 }}>{children}</Text>
      {right ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 18, color: M.c.text300 }}>{right}</Text> : null}
    </View>
  );
}
