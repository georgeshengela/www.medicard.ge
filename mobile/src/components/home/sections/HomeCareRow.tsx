import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import type { HubTile } from '@/components/home/HubTiles';
import { tx } from '@/i18n/locale';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB } from '@/theme/hub';

/**
 * The AI check-ups as one row of round shortcuts (women's Home): symptoms, skin, lab, imaging in a
 * single card instead of four big tiles, so the page stays about her cycle and her day. The tiles
 * are the same ones the standard Home shows (already filtered by the admin switches).
 */
/** Four across leaves ~80 pt per label: the long tile titles get a short everyday word here. */
const SHORT_LABEL: Record<string, string> = {
  lab: tx('ანალიზები', 'Lab'),
};

export function HomeCareRow({ title, tiles }: { title: string; tiles: HubTile[] }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  if (!tiles.length) return null;
  return (
    <View style={s.section}>
      <HomeSectionHeading title={title} />
      <View style={[s.card, { backgroundColor: c.surface }]}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.key}
            accessibilityRole="button"
            accessibilityLabel={`${tile.title}. ${tile.detail}`}
            onPress={() => router.push(tile.href as never)}
            style={s.item}
          >
            <View style={[s.icon, { backgroundColor: accent.soft }]}>
              <tile.icon size={23} color={accent.ink} strokeWidth={1.8} />
            </View>
            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={[s.label, { color: c.text100 }]}>
              {SHORT_LABEL[tile.key] ?? tile.title}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, paddingVertical: 16, paddingHorizontal: 6, flexDirection: 'row' },
  item: { flex: 1, minWidth: 0, alignItems: 'center', gap: 8 },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 11, lineHeight: 15, letterSpacing: -0.2, textAlign: 'center' },
});
