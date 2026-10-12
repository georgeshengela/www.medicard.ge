/**
 * MEDIFAMILY kit — the hub language (flat `surface` cards, radius 22, titles outside cards, 20 px gutter) in
 * the module's coral (ModuleToneProvider tone="family" makes `primary100` the ink). One spotlight per page:
 * the child hero (FamilyHero). Everything here stays quiet.
 */
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, X, type LucideIcon } from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { useKeyboardPad } from '@/components/ui/KeyboardFormShell';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { HUB, hubText } from '@/theme/hub';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { tx } from '@/i18n/locale';
import type { Tone } from '@/lib/family/familyApi';

export const FONT = {
  regular: 'NotoSansGeorgian_400Regular',
  medium: 'NotoSansGeorgian_500Medium',
  semi: 'NotoSansGeorgian_600SemiBold',
  bold: 'NotoSansGeorgian_700Bold',
} as const;

/** The module ink (coral) for text and fills; white-on-ink uses the light ink in both themes (AA). */
export function useFamilyInk() {
  const c = useThemeColors();
  const dark = useIsDark();
  return { ink: c.primary100, tint: c.accent100, fill: MODULE_BRANDS.family.ink.light, onFill: '#FFFFFF', dark, c };
}

/** Tone colours: ok green, info sky, watch amber, alert red — colour means a fact, never decoration. */
export function toneColors(tone: Tone | 'neutral', dark: boolean) {
  const map = {
    ok: dark ? ['#86EFAC', '#0F2A1B'] : ['#15803D', '#DCFCE7'],
    info: dark ? ['#7DD3FC', '#0C2A3D'] : ['#0369A1', '#E0F2FE'],
    watch: dark ? ['#FCD34D', '#2E2209'] : ['#B45309', '#FEF3C7'],
    alert: dark ? ['#FCA5A5', '#3A1414'] : ['#B91C1C', '#FEE2E2'],
    neutral: dark ? ['#D1D5DB', '#1F2937'] : ['#374151', '#F3F4F6'],
  } as const;
  const [ink, bg] = map[tone];
  return { ink, bg };
}

export function FText({ children, size = 14, weight = 'regular', color, muted, center, lines, style }: {
  children: React.ReactNode; size?: number; weight?: keyof typeof FONT; color?: string; muted?: boolean; center?: boolean; lines?: number; style?: StyleProp<any>;
}) {
  const c = useThemeColors();
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: FONT[weight], fontSize: size, lineHeight: Math.round(size * 1.5), color: color ?? (muted ? c.text200 : c.text100), textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

/** Section: title outside its card (hub rule), optional right link in the module ink. */
export function FamilySection({ title, link, onLink, children, style }: { title: string; link?: string; onLink?: () => void; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { ink, c } = useFamilyInk();
  return (
    <View style={[{ gap: HUB.headingGap }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 28 }}>
        <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>{title}</Text>
        {link && onLink ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`${title} — ${link}`} onPress={onLink} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32 }}>
            <Text style={[hubText.link, { color: ink }]}>{link}</Text>
            <ChevronRight size={15} color={ink} />
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export function FamilyCard({ children, onPress, style, label }: { children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  const c = useThemeColors();
  const box: StyleProp<ViewStyle> = [{ backgroundColor: c.surface, borderRadius: HUB.cardRadius, padding: HUB.cardPad }, style];
  if (!onPress) return <View style={box}>{children}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={box}>{children}</Pressable>;
}

export function FamilyButton({ label, onPress, icon: Icon, variant = 'primary', busy, disabled, size = 'md', style }: {
  label: string; onPress: () => void; icon?: LucideIcon; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean; disabled?: boolean; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle>;
}) {
  const { fill, tint, ink, c, dark } = useFamilyInk();
  const danger = toneColors('alert', dark);
  const bg = variant === 'primary' ? fill : variant === 'secondary' ? tint : variant === 'danger' ? danger.bg : 'transparent';
  const fg = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? danger.ink : variant === 'ghost' ? c.text200 : ink;
  const height = size === 'sm' ? 40 : 52;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[{ height, borderRadius: size === 'sm' ? 14 : 18, paddingHorizontal: size === 'sm' ? 14 : 20, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: disabled ? 0.45 : 1 }, style]}
    >
      {busy ? <ActivityIndicator color={fg} /> : Icon ? <Icon size={size === 'sm' ? 16 : 18} color={fg} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: FONT.semi, fontSize: size === 'sm' ? 13 : 15, lineHeight: 20, color: fg }}>{label}</Text>
    </Pressable>
  );
}

export function TonePill({ tone, label, style }: { tone: Tone | 'neutral'; label: string; style?: StyleProp<ViewStyle> }) {
  const dark = useIsDark();
  const t = toneColors(tone, dark);
  return (
    <View style={[{ alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: t.bg }, style]}>
      <Text numberOfLines={1} style={{ fontFamily: FONT.semi, fontSize: 12, lineHeight: 17, color: t.ink }}>{label}</Text>
    </View>
  );
}

/** Icon tile + title + one line + optional right value — the rows inside a list card. */
export function FamilyRow({ icon: Icon, ink, title, body, right, onPress, last }: {
  icon?: LucideIcon; ink?: string; title: string; body?: string | null; right?: React.ReactNode; onPress?: () => void; last?: boolean;
}) {
  const { c, dark, ink: moduleInk } = useFamilyInk();
  const color = ink ?? moduleInk;
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: c.bg200 }}>
      {Icon ? (
        <View style={{ width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, backgroundColor: `${color}${dark ? '26' : '14'}`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <FText weight="semi" size={15}>{title}</FText>
        {body ? <FText size={13} muted>{body}</FText> : null}
      </View>
      {right}
      {onPress && !right ? <ChevronRight size={17} color={c.text300} /> : null}
    </View>
  );
  if (!onPress) return content;
  return <Pressable accessibilityRole="button" accessibilityLabel={body ? `${title}, ${body}` : title} onPress={onPress}>{content}</Pressable>;
}

const AVATAR_COLORS: Record<string, [string, string]> = {
  coral: ['#EA580C', '#FFEDD5'],
  sky: ['#0284C7', '#E0F2FE'],
  mint: ['#059669', '#D1FAE5'],
  lilac: ['#7C3AED', '#EDE9FE'],
  sun: ['#CA8A04', '#FEF9C3'],
  rose: ['#DB2777', '#FCE7F3'],
};
export const AVATAR_KEYS = Object.keys(AVATAR_COLORS);

export function avatarColor(key: string | null | undefined): [string, string] {
  return AVATAR_COLORS[key || 'coral'] || AVATAR_COLORS.coral;
}

/** The child's disc: first letter on their own colour. */
export function ChildAvatar({ name, color, size = 40, ring }: { name: string; color?: string | null; size?: number; ring?: string }) {
  const [ink, bg] = avatarColor(color);
  const letter = (name || '').trim().charAt(0).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', borderWidth: ring ? 2 : 0, borderColor: ring }}>
      <Text style={{ fontFamily: FONT.bold, fontSize: size * 0.42, lineHeight: size * 0.6, color: ink }}>{letter}</Text>
    </View>
  );
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const { c, fill } = useFamilyInk();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.bg200, borderRadius: 16, padding: 4, gap: 4 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={o.label} onPress={() => onChange(o.value)}
            style={{ flex: 1, minHeight: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? c.surface : 'transparent', paddingHorizontal: 6 }}>
            <Text numberOfLines={1} style={{ fontFamily: on ? FONT.semi : FONT.medium, fontSize: 13, lineHeight: 18, color: on ? fill : c.text200 }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress, icon: Icon }: { label: string; on: boolean; onPress: () => void; icon?: LucideIcon }) {
  const { c, fill, tint } = useFamilyInk();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={label} onPress={onPress}
      style={{ minHeight: 40, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: on ? tint : c.surface, borderWidth: 1.5, borderColor: on ? fill : c.bg200 }}>
      {Icon ? <Icon size={16} color={on ? fill : c.text200} /> : null}
      <Text numberOfLines={1} style={{ fontFamily: on ? FONT.semi : FONT.medium, fontSize: 14, lineHeight: 20, color: on ? fill : c.text100 }}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, error, style, ...input }: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const { c, fill, dark } = useFamilyInk();
  const [focused, setFocused] = useState(false);
  const alert = toneColors('alert', dark).ink;
  return (
    <View style={{ gap: 6 }}>
      <FText weight="semi" size={13} muted>{label}</FText>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.text300}
        {...input}
        onFocus={(e) => { setFocused(true); input.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); input.onBlur?.(e); }}
        style={[{ minHeight: 52, borderRadius: 16, paddingHorizontal: 16, backgroundColor: c.surface, borderWidth: 1.5, borderColor: error ? alert : focused ? fill : c.bg200, color: c.text100, fontFamily: FONT.regular, fontSize: 16 }, style]}
      />
      {error ? <FText size={12} color={alert}>{error}</FText> : hint ? <FText size={12} muted>{hint}</FText> : null}
    </View>
  );
}

/**
 * Bottom sheet over a fading scrim (APP_MODAL_PROPS — never slide). Its footer follows the keyboard with the
 * sign-in pattern (useKeyboardPad). Never open another Modal from inside it; draw inner pickers inline.
 */
export function FamilySheet({ visible, title, subtitle, onClose, children, footer }: {
  visible: boolean; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode;
}) {
  const c = useThemeColors();
  const insets = useSafeAreaInsets();
  const { frameRef, onLayout, pad } = useKeyboardPad(Math.max(insets.bottom, 16));
  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: APP_MODAL_OVERLAY }} />
        <View ref={frameRef} onLayout={onLayout} collapsable={false} style={{ maxHeight: '92%', backgroundColor: c.bg100, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10 }}>
          <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: c.bg300, marginBottom: 8 }} />
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingBottom: 8, gap: 12 }}>
            <View style={{ flex: 1, gap: 2 }}>
              <FText weight="bold" size={18}>{title}</FText>
              {subtitle ? <FText size={13} muted>{subtitle}</FText> : null}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={tx('დახურვა', 'Close')} onPress={onClose} hitSlop={8}
              style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} color={c.text100} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: footer ? 8 : 24, gap: 14 }}>
            {children}
          </ScrollView>
          <AnimatedFooter pad={pad}>{footer ?? null}</AnimatedFooter>
        </View>
      </View>
    </Modal>
  );
}

function AnimatedFooter({ pad, children }: { pad: SharedValue<number>; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => ({ paddingBottom: pad.value }));
  return <Animated.View style={[{ paddingHorizontal: 20, paddingTop: children ? 10 : 0, gap: 10 }, style]}>{children}</Animated.View>;
}

const MONTHS = tx(['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'], ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']);
const WEEKDAYS = tx(['ორ', 'სა', 'ოთ', 'ხუ', 'პა', 'შა', 'კვ'], ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Inline calendar (no nested Modal): month arrows, a year jump row, days in the module ink. */
export function DatePickerInline({ value, onChange, min, max }: { value: string | null; onChange: (ymd: string) => void; min?: string; max?: string }) {
  const { c, fill } = useFamilyInk();
  const initial = value || max || todayYmd();
  const [cursor, setCursor] = useState(() => ({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 }));
  const cells = useMemo(() => {
    const first = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7;
    const count = new Date(cursor.y, cursor.m + 1, 0).getDate();
    return Array.from({ length: first + count }, (_, i) => (i < first ? null : i - first + 1));
  }, [cursor]);
  const ymdOf = (d: number) => `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const move = (delta: number) => setCursor((p) => { const t = new Date(p.y, p.m + delta, 1); return { y: t.getFullYear(), m: t.getMonth() }; });
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 20, padding: 12, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('წინა თვე', 'Previous month')} onPress={() => move(-1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronLeft size={20} color={c.text100} /></Pressable>
        <FText weight="semi" center style={{ flex: 1 }}>{`${MONTHS[cursor.m]} ${cursor.y}`}</FText>
        <Pressable accessibilityRole="button" accessibilityLabel={tx('შემდეგი თვე', 'Next month')} onPress={() => move(1)} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}><ChevronRight size={20} color={c.text100} /></Pressable>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
        {[-12, -1, 1, 12].map((d) => (
          <Pressable key={d} accessibilityRole="button" accessibilityLabel={d === -12 ? tx('ერთი წლით უკან', 'One year back') : d === 12 ? tx('ერთი წლით წინ', 'One year forward') : d < 0 ? tx('წინა თვე', 'Previous month') : tx('შემდეგი თვე', 'Next month')}
            onPress={() => move(d)} style={{ paddingHorizontal: 10, minHeight: 30, borderRadius: 10, backgroundColor: c.bg200, justifyContent: 'center' }}>
            <FText size={12} weight="medium">{d === -12 ? tx('− წელი', '− year') : d === 12 ? tx('+ წელი', '+ year') : d < 0 ? tx('− თვე', '− month') : tx('+ თვე', '+ month')}</FText>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w) => <View key={w} style={{ width: '14.2857%', alignItems: 'center', paddingVertical: 4 }}><FText size={11} muted>{w}</FText></View>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (d == null) return <View key={`e${i}`} style={{ width: '14.2857%', height: 42 }} />;
          const ymd = ymdOf(d);
          const disabled = (min && ymd < min) || (max && ymd > max);
          const on = ymd === value;
          return (
            <Pressable key={ymd} accessibilityRole="button" accessibilityLabel={`${d} ${MONTHS[cursor.m]} ${cursor.y}`} accessibilityState={{ selected: on, disabled: Boolean(disabled) }} disabled={Boolean(disabled)} onPress={() => onChange(ymd)}
              style={{ width: '14.2857%', height: 42, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? fill : 'transparent', opacity: disabled ? 0.28 : 1 }}>
                <Text style={{ fontFamily: on ? FONT.bold : FONT.regular, fontSize: 15, color: on ? '#FFFFFF' : c.text100 }}>{d}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** „12 ოქტ 2026“ / „12 Oct 2026“ — dates are civil strings, never shifted by time zones. */
const SHORT_KA = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function formatYmd(ymd: string | null | undefined, withYear = true): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-').map(Number);
  const mon = tx(SHORT_KA, SHORT_EN)[m - 1];
  return tx(withYear ? `${d} ${mon} ${y}` : `${d} ${mon}`, withYear ? `${d} ${mon} ${y}` : `${d} ${mon}`);
}

export function daysBetweenYmd(a: string, b: string): number {
  return Math.round((Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10)) - Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10))) / 86400000);
}

/** „დღეს“, „ხვალ“, „5 დღეში“, „3 დღის წინ“. */
export function relativeDays(days: number): string {
  if (days === 0) return tx('დღეს', 'today');
  if (days === 1) return tx('ხვალ', 'tomorrow');
  if (days === -1) return tx('გუშინ', 'yesterday');
  if (days > 1) {
    if (days < 60) return tx(`${days} დღეში`, `in ${days} days`);
    if (days < 730) return tx(`${Math.round(days / 30.4)} თვეში`, `in ${Math.round(days / 30.4)} months`);
    return tx(`${Math.round(days / 365.25)} წელში`, `in ${Math.round(days / 365.25)} years`);
  }
  const n = -days;
  return n < 60 ? tx(`${n} დღის წინ`, `${n} days ago`) : tx(`${Math.round(n / 30)} თვის წინ`, `${Math.round(n / 30)} months ago`);
}

export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return tx('ახლახან', 'just now');
  if (minutes < 60) return tx(`${minutes} წთ წინ`, `${minutes} min ago`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return tx(`${hours} სთ წინ`, `${hours} h ago`);
  return tx(`${Math.round(hours / 24)} დღის წინ`, `${Math.round(hours / 24)} d ago`);
}

export function clockOf(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function errorText(error: unknown): string {
  const message = (error as { message?: string })?.message;
  return message && message.length < 200 ? message : tx('ვერ შევინახე — სცადე თავიდან.', 'Could not save — try again.');
}
