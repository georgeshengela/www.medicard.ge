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
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, type LucideIcon } from 'lucide-react-native';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import { CyclePageSkeleton } from '@/components/ui/Skeleton';
import { useIsDark } from '@/theme/colors';
import { cycleHexAlpha, cycleShadow, useCycleColors, type CyclePalette } from '@/theme/cycle';

/** Cycle canvas — Figma 9001:283189 blush wash on light, navy on dark. */
export function CycleAtmosphere({ children }: { children: React.ReactNode }) {
  const c = useCycleColors();
  const dark = useIsDark();
  return (
    <View style={{ flex: 1, backgroundColor: c.cream }}>
      {dark ? null : (
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(244,63,94,0.16)', 'rgba(255,247,248,0)']}
          locations={[0, 0.58]}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 440 }}
        />
      )}
      {children}
    </View>
  );
}

export function CycleLoading() {
  return (
    <CycleAtmosphere>
      <CyclePageSkeleton />
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
          borderRadius: 16,
          padding: padded ? 16 : 0,
          overflow: 'hidden',
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
          <HomeSectionTitle title={title} style={{ marginBottom: subtitle ? 4 : 0 }} />
          {subtitle ? (
            <Text
              style={{
                color: c.muted,
                fontSize: 12,
                lineHeight: 16,
                fontFamily: 'NotoSansGeorgian_500Medium',
              }}
            >
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
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  accent: string;
  compact?: boolean;
}) {
  return (
    <CycleOptionTile label={label} selected={active} accent={accent} onPress={onPress} />
  );
}

/** Symmetric centered tile — selected = solid fill, unselected = soft card. */
function CycleOptionTile({
  label,
  selected,
  accent,
  onPress,
}: {
  label: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
}) {
  const c = useCycleColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="active:opacity-90"
      style={{
        minHeight: 58,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 10,
        paddingVertical: 14,
        backgroundColor: selected ? accent : c.cardSoft,
        borderWidth: selected ? 0 : 1,
        borderColor: c.border,
        ...(selected ? cycleShadow.soft : {}),
      }}
    >
      <Text
        style={{
          textAlign: 'center',
          color: selected ? '#fff' : c.ink,
          fontFamily: selected ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
          fontSize: 14,
          lineHeight: 18,
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function CycleTileGrid({
  options,
  isSelected,
  onChange,
  accent,
  limit,
  expanded,
  onToggleExpand,
}: {
  options: { id: string; label: string }[];
  isSelected: (id: string) => boolean;
  onChange: (id: string) => void;
  accent: string;
  limit?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const c = useCycleColors();
  const showAll = !limit || expanded || options.length <= limit;
  const visible = showAll ? options : options.slice(0, limit);
  const hidden = limit ? Math.max(0, options.length - limit) : 0;
  const lastAlone = visible.length % 2 === 1;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginTop: -6 }}>
      {visible.map((opt, idx) => {
        const alone = lastAlone && idx === visible.length - 1;
        return (
          <View
            key={opt.id}
            style={{
              width: alone ? '100%' : '50%',
              paddingHorizontal: 6,
              paddingVertical: 6,
              alignItems: alone ? 'center' : 'stretch',
            }}
          >
            <View style={{ width: alone ? '50%' : '100%' }}>
              <CycleOptionTile
                label={opt.label}
                selected={isSelected(opt.id)}
                accent={accent}
                onPress={() => onChange(opt.id)}
              />
            </View>
          </View>
        );
      })}
      {hidden > 0 && onToggleExpand ? (
        <View style={{ width: '100%', paddingHorizontal: 6, paddingVertical: 6 }}>
          <Pressable
            onPress={onToggleExpand}
            style={{
              minHeight: 52,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.cardSoft,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
              {expanded ? 'ნაკლები' : `+${hidden} მეტი`}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Symmetric tile picker — 2-column grid, equal sizes, clear selected state. */
export function CycleOptionPicker({
  options,
  value,
  values,
  onChange,
  mode,
  accent,
  limit,
  expanded,
  onToggleExpand,
}: {
  options: { id: string; label: string }[];
  value?: string | null;
  values?: string[];
  onChange: (id: string) => void;
  mode: 'single' | 'multi';
  layout?: 'list' | 'grid';
  accent: string;
  limit?: number;
  expanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const isSelected = (id: string) =>
    mode === 'multi' ? Boolean(values?.includes(id)) : value === id;

  return (
    <CycleTileGrid
      options={options}
      isSelected={isSelected}
      onChange={onChange}
      accent={accent}
      limit={limit}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
  );
}

/** Yes / No — two equal symmetric tiles. */
export function CycleBinaryPicker({
  value,
  onChange,
  yesLabel,
  noLabel,
  accent,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  yesLabel: string;
  noLabel: string;
  accent: string;
}) {
  return (
    <View style={{ flexDirection: 'row', marginHorizontal: -6 }}>
      {[
        { val: false, label: noLabel },
        { val: true, label: yesLabel },
      ].map((opt) => (
        <View key={String(opt.val)} style={{ flex: 1, marginHorizontal: 6 }}>
          <CycleOptionTile
            label={opt.label}
            selected={value === opt.val}
            accent={accent}
            onPress={() => onChange(opt.val)}
          />
        </View>
      ))}
    </View>
  );
}

/** 1–5 scale — equal symmetric pills. */
export function CycleScalePicker({
  value,
  onChange,
  accent,
  min = 1,
  max = 5,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  accent: string;
  min?: number;
  max?: number;
}) {
  const c = useCycleColors();
  const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <View>
      <View style={{ flexDirection: 'row', marginHorizontal: -4 }}>
        {nums.map((n) => {
          const on = value === n;
          return (
            <View key={n} style={{ flex: 1, marginHorizontal: 4 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  onChange(on ? null : n);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                className="active:opacity-90"
                style={{
                  height: 56,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? accent : c.cardSoft,
                  borderWidth: on ? 0 : 1,
                  borderColor: c.border,
                  ...(on ? cycleShadow.soft : {}),
                }}
              >
                <Text
                  style={{
                    color: on ? '#fff' : c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 18,
                  }}
                >
                  {n}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginTop: 10,
          paddingHorizontal: 6,
        }}
      >
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>დაბალი</Text>
        <Text style={{ color: c.muted, fontSize: 11, fontWeight: '600' }}>მაღალი</Text>
      </View>
    </View>
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
  return (
    <CycleOptionPicker
      options={options}
      value={active}
      values={activeList}
      onChange={onPick}
      mode={multi ? 'multi' : 'single'}
      accent={accent}
      limit={limit}
      expanded={expanded}
      onToggleExpand={onToggleExpand}
    />
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
      className={blocked ? undefined : 'active:opacity-90'}
      style={{
        width: '100%',
        opacity: blocked ? 0.5 : 1,
        borderRadius: 16,
        overflow: 'hidden',
        ...cycleShadow.soft,
      }}
    >
      <View
        style={{
          minHeight: 56,
          borderRadius: 16,
          paddingVertical: 16,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.cta,
        }}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', maxWidth: '100%', flexShrink: 1 }}>
            {Icon ? (
              <View style={{ marginRight: 8 }}>
                <Icon size={18} color="#fff" strokeWidth={2.4} />
              </View>
            ) : null}
            <Text
              style={{
                color: '#fff',
                fontFamily: 'NotoSansGeorgian_700Bold',
                fontSize: 16,
                includeFontPadding: false,
                flexShrink: 1,
                textAlign: 'center',
              }}
            >
              {label}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

/** Legacy name — the strip is full-width; FAB no longer reserves a column. */
export const CYCLE_FAB_GUTTER = 72;

export function CycleFab({
  onPress,
  label,
}: {
  onPress: () => void;
  label?: string;
  onWidth?: (width: number) => void;
  compact?: boolean;
}) {
  const c = useCycleColors();
  const text = label || 'აღრიცხვა';
  return (
    <View style={{ alignSelf: 'flex-start' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: -5,
          right: -5,
          top: -5,
          bottom: -5,
          borderRadius: 27,
          backgroundColor: cycleHexAlpha(c.cta, 0.16),
        }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={text}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
          onPress();
        }}
        className="active:opacity-90"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 44,
          paddingLeft: 7,
          paddingRight: 12,
          borderRadius: 22,
          backgroundColor: c.cta,
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.28)',
          gap: 7,
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: 'rgba(255,255,255,0.2)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus size={15} color="#FFFFFF" strokeWidth={2.7} />
        </View>
        <Text
          numberOfLines={1}
          style={{
            color: '#FFFFFF',
            fontFamily: 'NotoSansGeorgian_700Bold',
            fontSize: 12,
            letterSpacing: 0.15,
            includeFontPadding: false,
          }}
        >
          {text}
        </Text>
      </Pressable>
    </View>
  );
}

export function CycleActionPanel({ children }: { children: React.ReactNode }) {
  const c = useCycleColors();
  return (
    <View
      style={{
        backgroundColor: c.card,
        borderRadius: 16,
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
        className="active:opacity-90"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 72,
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: c.border,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: withAlpha(color, 0.14),
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={20} color={color} strokeWidth={2.15} />
        </View>

        <View style={{ marginLeft: 12, flex: 1, flexShrink: 1, minWidth: 0, paddingRight: 8 }}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={{
              color: c.ink,
              fontWeight: '700',
              fontSize: 15,
              lineHeight: 20,
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
              marginTop: 3,
              lineHeight: 16,
              includeFontPadding: false,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: c.cardSoft,
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <View
            style={{
              width: 7,
              height: 7,
              borderTopWidth: 2,
              borderRightWidth: 2,
              borderColor: c.muted,
              transform: [{ rotate: '45deg' }],
              marginLeft: -1,
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

export { formatCycleDateKa } from '@/lib/cycleCivilDateKa';

export function cycleNavHeader(c: CyclePalette, title: string) {
  return {
    title,
    headerStyle: { backgroundColor: c.cream },
    headerShadowVisible: false,
    headerTintColor: c.brand,
    headerTitleStyle: {
      color: c.ink,
      fontFamily: 'NotoSansGeorgian_700Bold',
      fontSize: 17,
    },
  };
}

export type { CyclePalette };
