import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PenLine, PersonStanding } from 'lucide-react-native';
import { HomeSectionHeading } from '@/components/home/HomeSectionHeading';
import { bodyPartById } from '@/constants/symptomCatalog';
import { tx } from '@/i18n/locale';
import type { BodyPartId } from '@/types/symptoms';
import { useThemeColors } from '@/theme/colors';
import { useHomeAccent } from '@/theme/homeAccent';
import { HUB, hubText } from '@/theme/hub';

/** The places people point at most, in body order — each opens the body map with that place picked. */
const QUICK_PARTS: BodyPartId[] = ['head', 'neck', 'chest', 'abs', 'back', 'shoulder', 'upper-leg', 'hand'];

/**
 * „სიმპტომები“ on Home (owner 2026-10-04: the plain link row became a real start). „სად გაწუხებს?“
 * with the body's common places as chips — one tap opens the body map with that place already
 * picked and its symptoms showing — plus „აღწერე სიტყვებით“ for the typed path. Nothing about her
 * travels in the route: only the body-part id, which is the same for everyone.
 */
export function HomeSymptomsCard({ first = false }: { first?: boolean }) {
  const c = useThemeColors();
  const accent = useHomeAccent();
  const router = useRouter();
  const open = (path: string) => router.push(path as never);

  return (
    <View style={{ marginTop: first ? 0 : HUB.sectionGap }}>
      <HomeSectionHeading title={tx('სიმპტომები', 'Symptoms')} linkLabel={tx('ისტორია', 'History')} onLink={() => open('/symptoms/history')} />
      <View style={[s.card, { backgroundColor: c.surface }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('სიმპტომების შემოწმება — სხეულის რუკა', 'Check symptoms — body map')}
          onPress={() => open('/symptoms/body?start=1')}
          style={s.top}
        >
          <View style={[s.tile, { backgroundColor: accent.tint }]}>
            <PersonStanding size={22} color={accent.ink} strokeWidth={1.9} />
          </View>
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[hubText.cardTitle, { color: c.text100 }]}>{tx('სად გაწუხებს?', 'Where does it bother you?')}</Text>
            <Text numberOfLines={2} style={[hubText.caption, { color: c.text200 }]}>
              {tx('შეეხე ადგილს — Medi შესაძლო მიზეზებს გაჩვენებს', 'Tap the place — Medi shows what it might be')}
            </Text>
          </View>
        </Pressable>
        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={s.chipsScroll}
          contentContainerStyle={s.chips}
        >
          {QUICK_PARTS.map((id) => {
            const label = bodyPartById(id)?.labelKa ?? id;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={tx(`სიმპტომები — ${label}`, `Symptoms — ${label}`)}
                onPress={() => open(`/symptoms/body?part=${id}`)}
                style={[s.chip, { backgroundColor: c.bg200 }]}
              >
                <Text numberOfLines={1} style={[s.chipText, { color: c.text100 }]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tx('სიმპტომების აღწერა სიტყვებით', 'Describe symptoms in words')}
          onPress={() => open('/symptoms/search?start=1')}
          style={[s.describe, { backgroundColor: accent.soft }]}
        >
          <PenLine size={16} color={accent.ink} strokeWidth={2.2} />
          <Text style={[hubText.link, { color: accent.ink }]}>{tx('აღწერე სიტყვებით', 'Describe in words')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, paddingVertical: 16, gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 },
  tile: { width: HUB.tile, height: HUB.tile, borderRadius: HUB.tileRadius, alignItems: 'center', justifyContent: 'center' },
  chipsScroll: { flexGrow: 0 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 13, lineHeight: 18 },
  describe: {
    marginHorizontal: 16,
    minHeight: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
});
