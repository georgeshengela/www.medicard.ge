import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { cycleShadow, useCycleColors, type CyclePalette } from '@/theme/cycle';

/** Soft atmospheric blobs behind cycle screens. */
export function CycleAtmosphere({ children }: { children: React.ReactNode }) {
  const c = useCycleColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.cream }}>
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      >
        <View
          style={{
            position: 'absolute',
            top: -80,
            right: -60,
            width: 260,
            height: 260,
            borderRadius: 130,
            backgroundColor: c.blush,
            opacity: 0.45,
          }}
        />
        <View
          style={{
            position: 'absolute',
            top: 120,
            left: -90,
            width: 220,
            height: 220,
            borderRadius: 110,
            backgroundColor: c.lavenderSoft,
            opacity: 0.7,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: 80,
            right: -40,
            width: 180,
            height: 180,
            borderRadius: 90,
            backgroundColor: c.peach,
            opacity: 0.35,
          }}
        />
      </View>
      {children}
    </View>
  );
}

export function CycleLoading() {
  const c = useCycleColors();
  return (
    <CycleAtmosphere>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.rose} size="large" />
      </View>
    </CycleAtmosphere>
  );
}

export function CycleCard({
  children,
  style,
  padded = true,
  delay = 0,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  delay?: number;
}) {
  const c = useCycleColors();
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(420)}
      style={[
        {
          backgroundColor: c.card,
          borderRadius: 24,
          padding: padded ? 18 : 0,
          borderWidth: 1,
          borderColor: c.border,
          ...cycleShadow.card,
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function CycleSection({
  title,
  subtitle,
  children,
  delay = 0,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  delay?: number;
  action?: React.ReactNode;
}) {
  const c = useCycleColors();
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(380)} style={{ marginBottom: 20 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingHorizontal: 2,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ color: c.ink, fontWeight: '800', fontSize: 16, letterSpacing: -0.2 }}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 3, lineHeight: 16 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </Animated.View>
  );
}

export function CycleChip({
  label,
  active,
  onPress,
  accent,
  compact,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent: string;
  compact?: boolean;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: compact ? 12 : 14,
        paddingVertical: compact ? 8 : 10,
        borderRadius: 999,
        backgroundColor: active ? accent : c.card,
        borderWidth: active ? 0 : 1,
        borderColor: c.border,
        opacity: pressed ? 0.88 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      <Text
        style={{
          color: active ? c.white : c.ink,
          fontWeight: active ? '700' : '600',
          fontSize: compact ? 12 : 13,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CycleChipGrid({
  options,
  active,
  activeList,
  onPick,
  multi,
  accent,
  limit,
  expanded,
  onToggleExpand,
}: {
  options: { id: string; label: string }[];
  active?: string | null;
  activeList?: string[];
  onPick: (id: string) => void;
  multi: boolean;
  accent: string;
  limit?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const c = useCycleColors();
  const showAll = !limit || expanded || options.length <= limit;
  const visible = showAll ? options : options.slice(0, limit);
  const hidden = limit ? Math.max(0, options.length - limit) : 0;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {visible.map((opt) => {
        const on = multi ? Boolean(activeList?.includes(opt.id)) : active === opt.id;
        return (
          <CycleChip
            key={opt.id}
            label={opt.label}
            active={on}
            accent={accent}
            onPress={() => onPick(opt.id)}
          />
        );
      })}
      {hidden > 0 && onToggleExpand ? (
        <Pressable
          onPress={onToggleExpand}
          style={{
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: 999,
            backgroundColor: c.roseSoft,
          }}
        >
          <Text style={{ color: c.rose, fontWeight: '700', fontSize: 13 }}>
            {expanded ? 'ნაკლები' : `+${hidden} მეტი`}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CyclePrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon: Icon,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  const c = useCycleColors();
  const blocked = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        opacity: blocked ? 0.5 : pressed ? 0.92 : 1,
        transform: [{ scale: pressed && !blocked ? 0.985 : 1 }],
        borderRadius: 18,
        overflow: 'hidden',
        minHeight: 56,
        ...cycleShadow.soft,
      })}
    >
      <LinearGradient
        colors={[c.blushDeep, c.rose]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          minHeight: 56,
          paddingVertical: 15,
          paddingHorizontal: 18,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%' }}>
            {Icon ? (
              <View style={{ marginRight: 8 }}>
                <Icon size={18} color="#fff" strokeWidth={2.4} />
              </View>
            ) : null}
            <Text
              numberOfLines={1}
              style={{
                color: '#fff',
                fontWeight: '700',
                fontSize: 16,
                includeFontPadding: false,
              }}
            >
              {label}
            </Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function CycleFab({ onPress }: { onPress: () => void }) {
  const c = useCycleColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="დამატება"
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
        onPress();
      }}
      style={({ pressed }) => ({
        width: 60,
        height: 60,
        borderRadius: 30,
        overflow: 'hidden',
        transform: [{ scale: pressed ? 0.94 : 1 }],
        ...cycleShadow.fab,
      })}
    >
      <LinearGradient
        colors={[c.blushDeep, c.rose]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={{
              position: 'absolute',
              width: 20,
              height: 3,
              borderRadius: 2,
              backgroundColor: '#fff',
            }}
          />
          <View
            style={{
              position: 'absolute',
              width: 3,
              height: 20,
              borderRadius: 2,
              backgroundColor: '#fff',
            }}
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

export function CycleActionPanel({ children }: { children: React.ReactNode }) {
  const c = useCycleColors();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: c.border,
        overflow: 'hidden',
        ...cycleShadow.card,
      }}
    >
      {children}
    </View>
  );
}

export function CycleActionRow({
  icon: Icon,
  title,
  subtitle,
  color,
  onPress,
  delay = 0,
  last = false,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  color: string;
  onPress: () => void;
  delay?: number;
  last?: boolean;
}) {
  const c = useCycleColors();
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(360)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 74,
          paddingVertical: 14,
          paddingHorizontal: 14,
          opacity: pressed ? 0.88 : 1,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        })}
      >
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 15,
            backgroundColor: withAlpha(color, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={21} color={color} strokeWidth={2.15} />
        </View>

        <View style={{ marginLeft: 12, flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 10 }}>
          <Text
            numberOfLines={2}
            style={{
              color: c.ink,
              fontWeight: '700',
              fontSize: 15,
              lineHeight: 21,
              includeFontPadding: false,
            }}
          >
            {title}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: c.muted,
              fontSize: 12,
              marginTop: 4,
              lineHeight: 16,
              includeFontPadding: false,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: c.roseSoft,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <View
            style={{
              width: 8,
              height: 8,
              borderTopWidth: 2,
              borderRightWidth: 2,
              borderColor: c.rose,
              transform: [{ rotate: '45deg' }],
              marginLeft: -2,
            }}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** Convert #RRGGBB + alpha 0-1 → rgba() for reliable RN colors. */
function withAlpha(hex: string, alpha: number) {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function formatCycleDateKa(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split('-');
  const months = [
    'იან',
    'თებ',
    'მარ',
    'აპრ',
    'მაი',
    'ივნ',
    'ივლ',
    'აგვ',
    'სექ',
    'ოქტ',
    'ნოე',
    'დეკ',
  ];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

export function cycleNavHeader(c: CyclePalette, title: string) {
  return {
    title,
    headerStyle: { backgroundColor: c.cream },
    headerShadowVisible: false,
    headerTintColor: c.rose,
    headerTitleStyle: { color: c.ink, fontWeight: '700' as const, fontSize: 17 },
  };
}

export type { CyclePalette };
