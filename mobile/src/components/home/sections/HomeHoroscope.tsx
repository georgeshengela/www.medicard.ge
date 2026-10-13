import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { AstroGlyph } from '@/components/horoscope/AstroGlyph';
import { moonPath } from '@/components/horoscope/skyGeometry';
import { tx } from '@/i18n/locale';
import type { HomeCard } from '@/lib/horoscope/horoscopeApi';
import { signName } from '@/lib/horoscope/names';
import { HUB } from '@/theme/hub';
import { MODULE_BRANDS, moduleInk } from '@/theme/moduleBrand';
import { useIsDark, useThemeColors } from '@/theme/colors';

/**
 * MEDIHOROSCOPE on Home (one compact surface card, never a second spotlight): the sign on a small night tile,
 * today's headline and the Moon tonight. The card query is read in home.tsx (Home's one-subscriber rule);
 * the person can hide it in MEDIHOROSCOPE → birth details, the admin in its settings.
 */
export function HomeHoroscope({ card }: { card: HomeCard | undefined }) {
  const c = useThemeColors();
  const dark = useIsDark();
  const router = useRouter();
  if (!card?.show || !card.sign) return null;
  const ink = moduleInk('horo', dark);
  const g = MODULE_BRANDS.horo.gradient;
  const scores = card.scores;
  return (
    <View style={s.section}>
      <HomeSectionHeading title="MEDIHOROSCOPE" brand="horo" linkLabel={tx('ჰოროსკოპი', 'Horoscope')} onLink={() => router.push('/horoscope' as never)} />
      <Pressable accessibilityRole="button" accessibilityLabel={`MEDIHOROSCOPE. ${signName(card.sign)}. ${card.headline ?? ''}`} onPress={() => router.push('/horoscope' as never)}
        style={[s.card, { backgroundColor: c.surface }]}>
        <LinearGradient colors={[g[0], g[1]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
          <AstroGlyph name={card.sign} size={24} color={MODULE_BRANDS.horo.ink.dark} />
        </LinearGradient>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text numberOfLines={1} style={[s.kicker, { color: ink }]}>{signName(card.sign)}</Text>
          <Text numberOfLines={2} style={[s.title, { color: c.text100 }]}>{card.headline}</Text>
          {scores ? (
            <Text numberOfLines={1} style={[s.line, { color: c.text200 }]}>
              {tx(`სიყვარული ${scores.love}/5 · საქმე ${scores.money}/5 · განწყობა ${scores.mood}/5`, `Love ${scores.love}/5 · Work ${scores.money}/5 · Mood ${scores.mood}/5`)}
            </Text>
          ) : null}
        </View>
        {card.moon ? (
          <Svg width={30} height={30} viewBox="0 0 30 30">
            <Circle cx={15} cy={15} r={13} fill={dark ? '#1F2A55' : '#E6E9F4'} />
            <Path d={moonPath(15, 15, 13, card.moon.angle)} fill={dark ? '#E8EDF7' : '#C99A45'} />
          </Svg>
        ) : null}
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: HUB.gutter, marginTop: HUB.sectionGap },
  card: { borderRadius: HUB.cardRadius, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12, lineHeight: 16 },
  title: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  line: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 12, lineHeight: 17 },
});
