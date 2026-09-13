import React, { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronDown, User } from 'lucide-react-native';
import { useSyncExternalStore } from 'react';
import Svg, { Circle } from 'react-native-svg';
import {
  getWorldLocale,
  registerWorldLocalePersist,
  setWorldLocale,
  subscribeWorldLocale,
} from '@/lib/mediWorld/worldLocale.js';
import { getPreference, setPreference } from '@/lib/storage';
import { useWorldStitch, WORLD_SHADOW } from '@/theme/worldStitch';

export const WORLD_FONT_TITLE = { fontFamily: 'NotoSansGeorgian_700Bold' as const };
export const WORLD_FONT_MED = { fontFamily: 'NotoSansGeorgian_500Medium' as const };
export const WORLD_FONT_BODY = { fontFamily: 'NotoSansGeorgian_400Regular' as const };
export const WORLD_LOCALE_KEY = 'medicard.mediWorld.locale';

export function worldPrimaryFill(_dark?: boolean) {
  return '#00B7A6';
}

export function useWorldLocale() {
  useEffect(() => {
    registerWorldLocalePersist({
      get: () => getPreference(WORLD_LOCALE_KEY),
      set: (value: string) => setPreference(WORLD_LOCALE_KEY, value),
    });
  }, []);
  const locale = useSyncExternalStore(subscribeWorldLocale, getWorldLocale, getWorldLocale);
  return {
    locale: locale === 'en' ? 'en' as const : 'ka' as const,
    setLocale: setWorldLocale,
  };
}

export function WorldLangToggle({
  kaLabel = 'ქარ',
  enLabel = 'EN',
  glass = false,
}: {
  kaLabel?: string;
  enLabel?: string;
  glass?: boolean;
}) {
  const t = useWorldStitch();
  const { locale, setLocale } = useWorldLocale();
  const label = locale === 'en' ? enLabel : kaLabel;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => setLocale(locale === 'ka' ? 'en' : 'ka')}
      className="active:opacity-80"
      style={{
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: glass ? 'rgba(255,255,255,0.94)' : t.surfaceHigh,
        borderWidth: glass ? 1 : 0,
        borderColor: 'rgba(241,245,249,0.95)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        ...(glass ? WORLD_SHADOW : null),
        shadowColor: t.shadow,
      }}
    >
      <Text style={{ ...WORLD_FONT_MED, fontSize: 12, lineHeight: 16, color: glass ? '#334155' : t.primary }}>{label}</Text>
      <ChevronDown size={14} color={glass ? '#64748B' : t.onVariant} strokeWidth={2.5} />
    </Pressable>
  );
}

export function WorldBackButton({
  label,
  onPress,
  filled = false,
  glass = false,
}: {
  label: string;
  onPress: () => void;
  filled?: boolean;
  glass?: boolean;
}) {
  const t = useWorldStitch();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="active:opacity-80"
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: filled ? (glass ? 'rgba(255,255,255,0.95)' : t.lowest) : 'transparent',
        borderWidth: glass ? 1 : 0,
        borderColor: 'rgba(241,245,249,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        ...(filled ? { ...WORLD_SHADOW, shadowColor: t.shadow } : null),
      }}
    >
      <ArrowLeft size={20} color={glass ? '#334155' : t.on} strokeWidth={2} />
    </Pressable>
  );
}

export function WorldAvatarButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const t = useWorldStitch();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      className="active:opacity-80"
      style={{
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: t.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <User size={18} color={t.onCta} strokeWidth={2.2} />
    </Pressable>
  );
}

export function WorldHeader({
  title,
  subtitle,
  backLabel = 'უკან',
  onBack,
  trailing,
  kaLabel,
  enLabel,
  navTitle,
  navSubtitle,
  hidePageTitle,
  fallbackHome,
  backFilled,
  overlay,
}: {
  title: string;
  subtitle?: string;
  backLabel?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  kaLabel?: string;
  enLabel?: string;
  navTitle?: string;
  navSubtitle?: string;
  hidePageTitle?: boolean;
  fallbackHome?: boolean;
  backFilled?: boolean;
  overlay?: boolean;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const t = useWorldStitch();
  const showPageTitle = !hidePageTitle && !navTitle;
  const glass = Boolean(overlay);
  return (
    <View
      pointerEvents="box-none"
      style={{
        paddingTop: insets.top + 4,
        paddingHorizontal: 20,
        backgroundColor: overlay ? 'transparent' : t.surface,
        ...(overlay ? { position: 'absolute' as const, top: 0, left: 0, right: 0, zIndex: 40 } : null),
      }}
    >
      <View style={{ minHeight: 44, justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 1 }}>
          <WorldBackButton
            label={backLabel}
            filled={backFilled || glass}
            glass={glass}
            onPress={
              onBack ||
              (() => {
                if (router.canGoBack()) router.back();
                else if (fallbackHome) router.replace('/(tabs)/home' as never);
                else router.back();
              })
            }
          />
          <WorldLangToggle kaLabel={kaLabel} enLabel={enLabel} glass={glass} />
          <View style={{ flex: 1 }} />
          {trailing ?? (
            <WorldAvatarButton label={title} onPress={() => router.push('/(tabs)/profile' as never)} />
          )}
        </View>
        {navTitle ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 96, right: 96, alignItems: 'center' }}>
            <Text
              numberOfLines={1}
              accessibilityRole="header"
              style={{ ...WORLD_FONT_TITLE, fontSize: 16, lineHeight: 22, color: overlay ? '#0F172A' : t.on, textAlign: 'center' }}
            >
              {navTitle}
            </Text>
            {navSubtitle ? (
              <Text numberOfLines={1} style={{ ...WORLD_FONT_BODY, fontSize: 10, lineHeight: 12, color: t.onVariant, textAlign: 'center' }}>
                {navSubtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
      {showPageTitle ? (
        <Text
          accessibilityRole="header"
          style={{ ...WORLD_FONT_TITLE, fontSize: 26, lineHeight: 32, color: t.on, marginTop: 16, letterSpacing: -0.2 }}
        >
          {title}
        </Text>
      ) : null}
      {subtitle && showPageTitle ? (
        <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, lineHeight: 16, color: t.onVariant, marginTop: 4 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function WorldShell({
  title,
  subtitle,
  backLabel,
  trailing,
  children,
  refreshControl,
}: {
  title: string;
  subtitle?: string;
  backLabel?: string;
  trailing?: ReactNode;
  children: ReactNode;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  const insets = useSafeAreaInsets();
  const t = useWorldStitch();
  return (
    <View style={{ flex: 1, backgroundColor: t.surface }}>
      <WorldHeader title={title} subtitle={subtitle} backLabel={backLabel} trailing={trailing} />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 32,
        }}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function WorldButton({
  label,
  onPress,
  disabled,
  danger,
  secondary,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  secondary?: boolean;
}) {
  const t = useWorldStitch();
  const fill = danger ? '#BA1A1A' : secondary || disabled ? t.secondaryContainer : t.cta;
  const ink = danger ? t.onCta : secondary || disabled ? t.onSecondaryContainer : t.onCta;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      className="active:opacity-80"
      style={{
        marginTop: 12,
        minHeight: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: fill,
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <Text
        style={{
          ...WORLD_FONT_TITLE,
          fontSize: 14,
          lineHeight: 20,
          textAlign: 'center',
          color: ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function WorldCard({
  children,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const t = useWorldStitch();
  const body = (
    <View
      style={{
        borderRadius: 16,
        backgroundColor: t.lowest,
        padding: 16,
        ...WORLD_SHADOW,
        shadowColor: t.shadow,
      }}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} className="active:opacity-80">
      {body}
    </Pressable>
  );
}

/** Compact World-level ring. Number = World level, not a health score. */
export function WorldLevelRing({
  level,
  progressPct,
  label,
  caption,
  size = 168,
}: {
  level: number;
  progressPct: number;
  label: string;
  caption?: string;
  size?: number;
}) {
  const t = useWorldStitch();
  const stroke = 14;
  const r = (size - stroke) / 2 - 10;
  const cx = size / 2;
  const cy = size / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, progressPct)) / 100;
  const dash = Math.max(0.01, pct) * c;
  const brand = t.cta;
  const track = t.surfaceHighest;
  const knobAngle = -Math.PI / 2 + pct * 2 * Math.PI;
  const knobX = cx + r * Math.cos(knobAngle);
  const knobY = cy + r * Math.sin(knobAngle);

  return (
    <View accessible accessibilityLabel={`${label} ${level}`}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
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
          <Circle cx={knobX} cy={knobY} r={9} fill={t.lowest} stroke={brand} strokeWidth={4} />
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size - 56,
            height: size - 56,
            borderRadius: (size - 56) / 2,
            backgroundColor: t.lowest,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ ...WORLD_FONT_TITLE, fontSize: 40, lineHeight: 46, color: t.on, letterSpacing: -0.4 }}>
            {level}
          </Text>
          <Text style={{ ...WORLD_FONT_BODY, fontSize: 12, lineHeight: 16, color: t.onVariant, marginTop: 2, textAlign: 'center' }}>
            {label}
          </Text>
        </View>
      </View>
      {caption ? (
        <Text style={{ ...WORLD_FONT_BODY, fontSize: 13, lineHeight: 18, color: t.onVariant, textAlign: 'center', marginTop: 8 }}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}
