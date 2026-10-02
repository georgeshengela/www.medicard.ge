import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, LayoutDashboard, Undo2 } from 'lucide-react-native';
import { GOAL_ART } from '@/constants/appArt';
import { HOME_LAYOUT_NAMES, type HomeLayoutId } from '@/lib/home/homeLayout';
import { tx } from '@/i18n/locale';
import { homeAccentFor, useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';
import { useIsDark, useThemeColors } from '@/theme/colors';

/** Pull-to-refresh can drag the page this far down; the wash continues above so no seam shows. */
const OVERSCROLL = 800;

/**
 * The layout's static wash behind the header and the first card (none on standard). It scrolls
 * with the content and fades into the canvas, so cards keep sitting on the page colour.
 */
export function HomeWash({ topInset }: { topInset: number }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  if (!accent.wash) return null;
  const height = OVERSCROLL + topInset + 440;
  const solidUntil = (OVERSCROLL + topInset + 90) / height;
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[accent.wash, accent.wash, c.bg100]}
      locations={[0, solidUntil, 1]}
      style={[s.wash, { top: -OVERSCROLL, height }]}
    />
  );
}

/** „მთავარი გვერდის მორგება · ახლა: …“ — the last row of every layout, opens the picker. */
export function HomeCustomizeRow({ layout, onPress }: { layout: HomeLayoutId; onPress: () => void }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const title = tx('მთავარი გვერდის მორგება', 'Customise Home');
  const detail = tx(`ახლა: ${HOME_LAYOUT_NAMES[layout]}`, `Now: ${HOME_LAYOUT_NAMES[layout]}`);
  return (
    <View style={s.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${detail}`}
        onPress={onPress}
        style={[s.row, { backgroundColor: c.surface }]}
      >
        <View style={[s.rowTile, { backgroundColor: accent.tint }]}>
          <LayoutDashboard size={19} color={accent.ink} strokeWidth={1.9} />
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={[s.rowTitle, { color: c.text100 }]}>{title}</Text>
          <Text numberOfLines={1} style={[hubText.caption, { color: c.text200 }]}>{detail}</Text>
        </View>
        <ChevronRight size={17} color={c.text300} />
      </Pressable>
    </View>
  );
}

/**
 * One-time card for women who had MEDICARD before the layouts (new accounts choose during
 * sign-up). Inline, never a modal — Home already has check-in and permission hosts.
 * After „ვცდი“ the same slot shows a short confirmation with an undo.
 */
export function HomeLayoutOfferCard({
  confirmed,
  onTry,
  onDismiss,
  onBrowse,
  onUndo,
}: {
  confirmed: boolean;
  onTry: () => void;
  onDismiss: () => void;
  onBrowse: () => void;
  onUndo: () => void;
}) {
  const c = useThemeColors();
  const dark = useIsDark();
  const women = homeAccentFor('women', dark, c);

  if (confirmed) {
    return (
      <View style={s.section}>
        <View accessibilityLiveRegion="polite" style={[s.confirm, { backgroundColor: dark ? c.surfaceRaised : c.text100 }]}>
          <Text style={[hubText.body, { flex: 1, color: '#FFFFFF' }]}>
            {tx('ახლა ქალის ჯანმრთელობის გვერდი გაქვს', 'You now have the women’s health Home')}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('დაბრუნება სტანდარტულ გვერდზე', 'Go back to the standard Home')}
            hitSlop={8}
            onPress={onUndo}
            style={s.undo}
          >
            <Undo2 size={15} color="#F9A8D4" strokeWidth={2.2} />
            <Text style={[hubText.link, { color: '#F9A8D4' }]}>{tx('დაბრუნება', 'Undo')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={s.section}>
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <View style={s.head}>
          <Image source={GOAL_ART.cycle} style={s.art} resizeMode="contain" accessibilityIgnoresInvertColors />
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text style={[hubText.cardTitle, { color: c.text100, fontSize: 16, lineHeight: 23 }]}>
              {tx('ახალი: ქალის ჯანმრთელობის გვერდი', 'New: a women’s health Home')}
            </Text>
            <Text style={[hubText.body, { color: c.text200 }]}>
              {tx(
                'ციკლი, დღის რჩევები და შენი დღე ერთ, მშვიდ გვერდზე. სცადე — დაბრუნება ერთი შეხებითაა.',
                'Your cycle, daily tips and your day on one calm page. Try it — going back is one tap.',
              )}
            </Text>
          </View>
        </View>
        <View style={s.actions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('ქალის ჯანმრთელობის გვერდის ცდა', 'Try the women’s health Home')}
            onPress={onTry}
            style={[s.primary, { backgroundColor: women.cta }]}
          >
            <Text style={[hubText.link, { color: women.onCta, fontSize: 14 }]}>{tx('ვცდი', 'Try it')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tx('არა, მადლობა', 'No thanks')}
            onPress={onDismiss}
            style={[s.secondary, { backgroundColor: women.soft }]}
          >
            <Text style={[hubText.link, { color: women.ink, fontSize: 14 }]}>{tx('არა, მადლობა', 'No thanks')}</Text>
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={onBrowse} hitSlop={6} style={s.browse}>
          <Text style={[hubText.link, { color: c.text200 }]}>{tx('ყველა სტილის ნახვა', 'See all layouts')}</Text>
          <ChevronRight size={15} color={c.text200} />
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wash: { position: 'absolute', left: 0, right: 0 },
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: HUB.cardRadius, paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  rowTile: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { ...hubText.cardTitle, fontSize: 14, lineHeight: 20 },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  art: { width: 56, height: 56, borderRadius: 14 },
  actions: { flexDirection: 'row', gap: 10 },
  primary: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  secondary: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  browse: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 32, marginTop: -4 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  undo: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
});
