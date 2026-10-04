import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  CalendarCheck,
  ChevronRight,
  Droplet,
  Droplets,
  Dumbbell,
  FlaskConical,
  Footprints,
  LayoutDashboard,
  LayoutGrid,
  PawPrint,
  Pill,
  Scale,
  ScanLine,
  Stethoscope,
  Store,
  Trophy,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { APP_MODAL_OVERLAY, APP_MODAL_PROPS, Modal } from '@/components/ui/appModal';
import { ModuleWordmark } from '@/components/brand/ModuleWordmark';
import { MediOrb } from '@/components/medi/MediOrb';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { isHrefAvailable, useFeatureState } from '@/lib/featureFlags';
import { mediRoute } from '@/lib/mediModes';
import { useAuth } from '@/store/AuthContext';
import { tx } from '@/i18n/locale';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';
import { MODULE_BRANDS, moduleInk, type ModuleBrandId } from '@/theme/moduleBrand';

type ModuleTile = { id: ModuleBrandId; href: string; line: string; icon: LucideIcon; female?: boolean };
type UtilityLink = { href: string; label: string; icon: LucideIcon };

/** Fixed order (owner 2026-10-04): the everyday health modules first, then the play/extra ones. */
const MODULES: ModuleTile[] = [
  { id: 'pill', href: '/(tabs)/medications', line: tx('წამლები და დოზები', 'Medications and doses'), icon: Pill },
  { id: 'lab', href: '/(tabs)/records', line: tx('ანალიზის შედეგები', 'Lab results'), icon: FlaskConical },
  { id: 'scan', href: '/scan', line: tx('ფოტოს წაკითხვა AI-ით', 'Read a photo with AI'), icon: ScanLine },
  { id: 'food', href: '/nutrition', line: tx('კვება და კალორიები', 'Food and calories'), icon: Utensils },
  { id: 'cycle', href: '/cycle', line: tx('ციკლი და პროგნოზი', 'Cycle and forecast'), icon: Droplet, female: true },
  { id: 'run', href: '/run', line: tx('გაანათე ქალაქი', 'Light up the city'), icon: Footprints },
  { id: 'quest', href: '/medi-quest', line: tx('მისიები და ჯილდოები', 'Missions and rewards'), icon: Trophy },
  { id: 'vet', href: '/pets', line: tx('ჩემი ცხოველები', 'My pets'), icon: PawPrint },
  { id: 'coach', href: '/trainer', line: tx('ტრენერი და ვარჯიში', 'Trainer and workouts'), icon: Dumbbell },
];

const UTILITIES: UtilityLink[] = [
  { href: '/visits', label: tx('ვიზიტები', 'Visits'), icon: CalendarCheck },
  { href: '/health-metrics/hydration', label: tx('წყალი', 'Water'), icon: Droplets },
  { href: '/health-metrics/steps', label: tx('ნაბიჯები', 'Steps'), icon: Footprints },
  { href: '/health-metrics/weight', label: tx('წონა', 'Weight'), icon: Scale },
  { href: '/symptoms', label: tx('სიმპტომები', 'Symptoms'), icon: Stethoscope },
  { href: '/pharmacy', label: tx('აფთიაქი', 'Pharmacy'), icon: Store },
];

/** `#RRGGBB` + alpha 0–1 → `#RRGGBBAA`. */
function alpha(hex: string, a: number): string {
  return `${hex}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
}

/**
 * Quick navigation (owner 2026-10-04): the Home header's grid button opens every MEDI module in one
 * sheet. Reverse of the module hero cards — a whisper of tint, the module colour only in lines: a hairline
 * border, the hero's concentric rings drawn as strokes in the corner, an outlined icon ring and the
 * wordmark. Paused modules (admin „მოდულები“) are left out; MEDICYCLE only for women.
 */
export function ModulesSheet({ visible, onClose, onCustomize }: {
  visible: boolean;
  onClose: () => void;
  /** Home layout picker, offered as the last row (Home only). */
  onCustomize?: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const reduceMotion = usePrefersReducedMotion();
  const features = useFeatureState();
  const { user } = useAuth();
  const female = user?.gender === 'FEMALE';

  const mediOn = isHrefAvailable(mediRoute(), features);
  const modules = MODULES.filter((m) => (!m.female || female) && isHrefAvailable(m.href, features));
  const utilities = UTILITIES.filter((u) => isHrefAvailable(u.href, features));

  const go = (href: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onClose();
    // Tabs are switched like the tab bar does it; everything else is pushed on top of Home.
    if (href.startsWith('/(tabs)/')) router.replace(href as never);
    else router.push(href as never);
  };
  const enter = (index: number) => (reduceMotion ? undefined : FadeInDown.duration(260).delay(40 + index * 28));

  return (
    <Modal visible={visible} {...APP_MODAL_PROPS} onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('დახურვა', 'Close')}
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: APP_MODAL_OVERLAY }]}
        />
        <View
          accessibilityViewIsModal
          style={[s.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 16, maxHeight: height * 0.9 }]}
        >
          <View style={[s.handle, { backgroundColor: c.bg300 }]} />
          <View style={s.head}>
            <Text accessibilityRole="header" style={[hubText.sectionTitle, { color: c.text100, flex: 1 }]}>
              {tx('სად გადავიდეთ?', 'Where to?')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tx('დახურვა', 'Close')}
              hitSlop={6}
              onPress={onClose}
              style={[s.close, { backgroundColor: c.bg100 }]}
            >
              <X size={17} color={c.text200} strokeWidth={2.2} />
            </Pressable>
          </View>

          <ScrollView style={{ flexShrink: 1 }} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
            {mediOn ? (
              <Animated.View entering={enter(0)}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={tx('Medi — ჰკითხე ნებისმიერი რამ', 'Medi — ask anything')}
                  onPress={() => go(mediRoute())}
                  style={[s.medi, { backgroundColor: alpha(moduleInk('medi', dark), dark ? 0.07 : 0.04), borderColor: alpha(moduleInk('medi', dark), dark ? 0.42 : 0.3) }]}
                >
                  <Rings ink={moduleInk('medi', dark)} dark={dark} size={110} />
                  <MediOrb size={34} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ModuleWordmark module="medi" size={17} />
                    <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>
                      {tx('ჰკითხე ნებისმიერი რამ', 'Ask anything')}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={c.text300} />
                </Pressable>
              </Animated.View>
            ) : null}

            <View style={s.grid}>
              {modules.map((m, index) => {
                const ink = moduleInk(m.id, dark);
                const Icon = m.icon;
                // Symmetry (owner 2026-10-04): with an odd count (MEDICYCLE for women, a paused module) the
                // last module closes the grid as one full-width row instead of a lone half tile.
                const wide = modules.length % 2 === 1 && index === modules.length - 1;
                return (
                  <Animated.View key={m.id} entering={enter(index + 1)} style={wide ? s.cellWide : s.cell}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${MODULE_BRANDS[m.id].name} — ${m.line}`}
                      onPress={() => go(m.href)}
                      style={[wide ? s.row : s.tile, { backgroundColor: alpha(ink, dark ? 0.07 : 0.04), borderColor: alpha(ink, dark ? 0.42 : 0.3) }]}
                    >
                      <Rings ink={ink} dark={dark} size={wide ? 96 : 84} />
                      <View style={[s.iconRing, { borderColor: alpha(ink, dark ? 0.7 : 0.55) }]}>
                        <Icon size={15} color={ink} strokeWidth={2} />
                      </View>
                      <View style={{ gap: 1, flex: wide ? 1 : undefined, minWidth: 0 }}>
                        <ModuleWordmark module={m.id} size={15} />
                        <Text numberOfLines={1} style={[hubText.small, { color: c.text200 }]}>{m.line}</Text>
                      </View>
                      {wide ? <ChevronRight size={16} color={c.text300} /> : null}
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>

            {utilities.length ? (
              <Animated.View entering={enter(modules.length + 1)} style={{ gap: 8, marginTop: 6 }}>
                <Text style={[hubText.caption, { color: c.text300 }]}>{tx('სხვა', 'More')}</Text>
                <View style={s.chips}>
                  {utilities.map((u) => {
                    const Icon = u.icon;
                    return (
                      <Pressable
                        key={u.href}
                        accessibilityRole="button"
                        accessibilityLabel={u.label}
                        onPress={() => go(u.href)}
                        style={[s.chip, { borderColor: c.bg300 }]}
                      >
                        <Icon size={15} color={c.text200} strokeWidth={2} />
                        <Text numberOfLines={1} style={[hubText.caption, { color: c.text100 }]}>{u.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Animated.View>
            ) : null}

            <View style={[s.links, { borderColor: c.bg300 }]}>
              <LinkRow icon={LayoutGrid} label={tx('ყველა ფუნქცია', 'All features')} onPress={() => go('/explore')} />
              {onCustomize ? (
                <LinkRow
                  icon={LayoutDashboard}
                  label={tx('მთავარი გვერდის მორგება', 'Customize Home')}
                  onPress={() => {
                    onClose();
                    onCustomize();
                  }}
                />
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** The hero card's concentric rings, drawn as thin strokes from the tile's top-right corner. */
function Rings({ ink, dark, size }: { ink: string; dark: boolean; size: number }) {
  const o = dark ? 1.25 : 1;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size} cy={0} r={size * 0.32} stroke={ink} strokeOpacity={0.22 * o} strokeWidth={1.2} fill="none" />
        <Circle cx={size} cy={0} r={size * 0.56} stroke={ink} strokeOpacity={0.14 * o} strokeWidth={1.2} fill="none" />
        <Circle cx={size} cy={0} r={size * 0.8} stroke={ink} strokeOpacity={0.08 * o} strokeWidth={1.2} fill="none" />
      </Svg>
    </View>
  );
}

function LinkRow({ icon: Icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  const c = useThemeColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={s.linkRow}>
      <Icon size={17} color={c.text200} strokeWidth={2} />
      <Text numberOfLines={1} style={[hubText.link, { color: c.text100, flex: 1 }]}>{label}</Text>
      <ChevronRight size={16} color={c.text300} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingHorizontal: HUB.gutter,
    gap: 14,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  medi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 66,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8 },
  cell: { width: '48.5%' },
  cellWide: { width: '100%' },
  tile: {
    minHeight: 96,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  iconRing: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
  },
  links: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
});
