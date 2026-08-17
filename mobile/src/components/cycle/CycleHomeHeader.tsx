import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useColorScheme } from 'nativewind';
import * as Haptics from 'expo-haptics';
import { CalendarDays, ChevronLeft, Settings2, type LucideIcon } from 'lucide-react-native';
import { ka } from '@/i18n/ka';
import { cycleShadow, useCycleColors, type CyclePalette } from '@/theme/cycle';

type Props = {
  monthLabel: string;
  subtitle: string;
  topInset: number;
  onBack: () => void;
  onCalendar: () => void;
  onSettings: () => void;
};

const BTN = 52;
const ICON = 22;
const GAP = 12;

function hapticTap(fn: () => void, light = false) {
  if (light) {
    Haptics.selectionAsync().catch(() => undefined);
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  }
  fn();
}

function GlassIconButton({
  onPress,
  icon: Icon,
  label,
  size = BTN,
  c,
  dark,
  lightHaptic = false,
}: {
  onPress: () => void;
  icon: LucideIcon;
  label: string;
  size?: number;
  c: CyclePalette;
  dark: boolean;
  lightHaptic?: boolean;
}) {
  const [pressed, setPressed] = useState(false);
  const radius = Math.round(size * 0.32);
  const baseBg = dark ? 'rgba(36, 18, 28, 0.88)' : 'rgba(255, 255, 255, 0.92)';
  const rim = dark ? 'rgba(255, 255, 255, 0.24)' : 'rgba(255, 255, 255, 0.95)';
  const pressGlow = dark ? 'rgba(255, 64, 129, 0.28)' : 'rgba(233, 30, 99, 0.14)';

  return (
    <Pressable
      onPress={() => hapticTap(onPress, lightHaptic)}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={8}
      accessibilityLabel={label}
      accessibilityRole="button"
      style={{
        width: size,
        height: size,
        transform: [{ scale: pressed ? 0.93 : 1 }],
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          backgroundColor: baseBg,
          alignItems: 'center',
          justifyContent: 'center',
          ...cycleShadow.soft,
        }}
      >
        {Platform.OS !== 'web' ? (
          <BlurView
            intensity={dark ? 55 : 72}
            tint={dark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFillObject}
          />
        ) : (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              ...(Platform.OS === 'web'
                ? ({ backdropFilter: 'saturate(160%) blur(18px)' } as ViewStyle)
                : null),
            }}
          />
        )}

        <LinearGradient
          pointerEvents="none"
          colors={
            dark
              ? ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'transparent']
              : ['rgba(255,255,255,0.85)', 'rgba(255,255,255,0.2)', 'transparent']
          }
          locations={[0, 0.4, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />

        {pressed ? (
          <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: pressGlow }]} />
        ) : null}

        <Icon size={ICON} color={c.rose} strokeWidth={2.4} />

        <View
          pointerEvents="none"
          style={{
            ...StyleSheet.absoluteFillObject,
            borderRadius: radius,
            borderWidth: 1.5,
            borderColor: rim,
          }}
        />
      </View>
    </Pressable>
  );
}

export function CycleHomeHeader({
  monthLabel,
  subtitle,
  topInset,
  onBack,
  onCalendar,
  onSettings,
}: Props) {
  const c = useCycleColors();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  return (
    <View
      style={{
        paddingTop: topInset + 8,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: c.cream,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flexShrink: 0 }}>
          <GlassIconButton
            onPress={onBack}
            icon={ChevronLeft}
            label={ka.common.back}
            size={46}
            c={c}
            dark={dark}
            lightHaptic
          />
        </View>

        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 4 }}>
          <Text
            numberOfLines={1}
            style={{
              color: c.ink,
              fontSize: 18,
              fontWeight: '800',
              letterSpacing: -0.35,
            }}
          >
            {monthLabel}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: c.muted,
              fontSize: 11,
              fontWeight: '600',
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <View style={{ flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: GAP }}>
          <GlassIconButton
            onPress={onCalendar}
            icon={CalendarDays}
            label={ka.cycle.openFullCalendar}
            c={c}
            dark={dark}
          />
          <GlassIconButton
            onPress={onSettings}
            icon={Settings2}
            label={ka.cycle.settings}
            c={c}
            dark={dark}
          />
        </View>
      </View>
    </View>
  );
}
