import React from 'react';
import { Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight } from 'lucide-react-native';
import { useFonts } from 'expo-font';
import { HUB, hubText } from '@/theme/hub';
import { useThemeColors } from '@/theme/colors';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { StarrySky } from './StarrySky';

/** Brass ink on the night (the module is always a night space). */
export const HORO_INK = MODULE_BRANDS.horo.ink.dark;
export const HORO_ON_HERO = MODULE_BRANDS.horo.onHero;
/** Night glass card: lets the stars show through a little. */
export const GLASS = 'rgba(19,27,64,0.72)';
export const GLASS_LINE = 'rgba(233,199,126,0.14)';
export const SERIF = 'NotoSerifGeorgian_500Medium';

/** Loads the module's serif (headlines only) — vendored OFL font, loaded with the module, not at app start. */
export function useHoroFonts(): boolean {
  const [loaded] = useFonts({ [SERIF]: require('../../../assets/fonts/noto-serif-georgian-500.ttf') });
  return loaded;
}

const FONT = {
  regular: 'NotoSansGeorgian_400Regular',
  medium: 'NotoSansGeorgian_500Medium',
  semibold: 'NotoSansGeorgian_600SemiBold',
  bold: 'NotoSansGeorgian_700Bold',
  serif: SERIF,
} as const;

export function HText({ children, size = 14, weight = 'regular', color, muted, center, lines, style, lineHeight }: {
  children: React.ReactNode; size?: number; weight?: keyof typeof FONT; color?: string; muted?: boolean; center?: boolean; lines?: number; style?: StyleProp<TextStyle>; lineHeight?: number;
}) {
  const c = useThemeColors();
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: FONT[weight], fontSize: size, lineHeight: lineHeight ?? Math.round(size * (weight === 'serif' ? 1.36 : 1.55)), color: color ?? (muted ? c.text200 : c.text100), textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

/** The module page: fixed starry sky behind a scroll view that starts under the status bar. */
export function HoroPage({ children, header, bottom = 40, stars = true }: { children: React.ReactNode; header?: React.ReactNode; bottom?: number; stars?: boolean }) {
  const insets = useSafeAreaInsets();
  const c = useThemeColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg100 }}>
      {stars ? <StarrySky /> : null}
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: HUB.gutter, paddingBottom: insets.bottom + bottom, gap: HUB.sectionGap }} showsVerticalScrollIndicator={false}>
        {header}
        {children}
      </ScrollView>
    </View>
  );
}

/** Section: title outside its card (hub rule), optional right link in brass. */
export function HoroSection({ title, link, onLink, children, style }: { title: string; link?: string; onLink?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useThemeColors();
  return (
    <View style={[{ gap: HUB.headingGap }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 28 }}>
        <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>{title}</Text>
        {link && onLink ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${title} — ${link}`} onPress={onLink} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}>
            <Text style={[hubText.link, { color: HORO_INK }]}>{link}</Text>
            <ChevronRight size={15} color={HORO_INK} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/** Night glass card — the module's flat card (radius 22). */
export function HoroCard({ children, onPress, style, label }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  const base: ViewStyle = { backgroundColor: GLASS, borderRadius: HUB.cardRadius, padding: HUB.cardPad, borderWidth: 1, borderColor: GLASS_LINE };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[base, style] as never}>
      {children}
    </Pressable>
  );
}

/** Five dots (1–5). */
export function Dots({ value, size = 7, on = HORO_INK, off = 'rgba(255,255,255,0.18)' }: { value: number; size?: number; on?: string; off?: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 4 }} accessibilityLabel={`${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => <View key={i} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: i <= value ? on : off }} />)}
    </View>
  );
}

/** Segment control (periods, chart tabs). */
export function HoroSegment<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void }) {
  const c = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', backgroundColor: GLASS, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: GLASS_LINE }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.key)}
            style={{ flex: 1, minHeight: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? HORO_INK : 'transparent' }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? FONT.semibold : FONT.medium, fontSize: 13, color: on ? '#141B3F' : c.text200 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A row inside a card: icon tile · title + line · chevron. */
export function HoroRow({ icon, title, line, onPress, right, first }: { icon?: React.ReactNode; title: string; line?: string | null; onPress?: () => void; right?: React.ReactNode; first?: boolean }) {
  const c = useThemeColors();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: GLASS_LINE }}>
      {icon ? <View style={{ width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, backgroundColor: 'rgba(233,199,126,0.12)', alignItems: 'center', justifyContent: 'center' }}>{icon}</View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <HText size={14} weight="semibold">{title}</HText>
        {line ? <HText size={13} muted lineHeight={19}>{line}</HText> : null}
      </View>
      {right ?? (onPress ? <ChevronRight size={18} color={c.text300} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress}>{body}</Pressable>;
}

/** Brass button (filled) or quiet (outlined). */
export function HoroButton({ label, onPress, quiet, disabled, icon }: { label: string; onPress: () => void; quiet?: boolean; disabled?: boolean; icon?: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={{ minHeight: 48, borderRadius: 16, paddingHorizontal: 18, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.5 : 1, backgroundColor: quiet ? 'transparent' : HORO_INK, borderWidth: quiet ? 1 : 0, borderColor: 'rgba(233,199,126,0.45)' }}>
      {icon}
      <Text style={{ fontFamily: FONT.semibold, fontSize: 15, color: quiet ? HORO_INK : '#141B3F' }}>{label}</Text>
    </Pressable>
  );
}

/** The entertainment note at the end of every page. */
export function HoroNote({ text }: { text: string }) {
  return <HText size={12} muted center style={{ opacity: 0.8, paddingHorizontal: 8 }}>{text}</HText>;
}
