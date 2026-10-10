import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, FlaskConical } from 'lucide-react-native';
import { LabSummaryCard } from '@/components/lab/LabOverview';
import { tx } from '@/i18n/locale';
import { flagTone, groupLabBySystem, labPlainName, labStatusWord } from '@/lib/labBody';
import { formatLabDateKa, isTodayYmd } from '@/lib/labExtract';
import { labFlagCounts } from '@/lib/labFilter';
import { labRowName } from '@/lib/labNames';
import type { LabPanel } from '@/types/lab';
import { MODULE_BRANDS } from '@/theme/moduleBrand';
import { HUB } from '@/theme/hub';

const BRAND = MODULE_BRANDS.lab;
const AMBER = '#FCD34D';
const MAX_ROWS = 3;

/**
 * MEDILAB's one spotlight (owner 2026-10-10: the test page was hard to find). The latest lab test in
 * the same words as its page — how many values need a look, the quiet share bar — then the values
 * outside their range by plain name, and one button that opens that test. Without a test yet it
 * invites the first upload instead.
 */
export function MedilabHero({ panels, onOpenTest, onUpload }: {
  panels: LabPanel[];
  onOpenTest: (date: string) => void;
  /** Omitted when lab reading is paused from admin. */
  onUpload?: () => void;
}) {
  const latest = useMemo(() => latestDate(panels), [panels]);
  const params = useMemo(
    () => (latest ? panels.filter((p) => p.date === latest).flatMap((p) => p.parameters) : []),
    [panels, latest],
  );
  const counts = useMemo(() => labFlagCounts(params), [params]);
  // Outside the range, in the order the test page lists them (by body system).
  const flagged = useMemo(() => groupLabBySystem(params).flatMap((g) => g.rows).filter((r) => flagTone(r.flag) === 'warn'), [params]);

  if (!latest) {
    if (!onUpload) return null;
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={tx('ატვირთე პირველი ანალიზი', 'Upload your first lab test')} onPress={onUpload} style={s.wrap}>
        <LinearGradient colors={BRAND.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.empty}>
          <View pointerEvents="none" style={[s.glow, { backgroundColor: BRAND.glow }]} />
          <View style={s.flask}>
            <FlaskConical size={22} color="#FFFFFF" strokeWidth={1.9} />
          </View>
          <Text style={s.emptyTitle}>{tx('ატვირთე პირველი ანალიზი', 'Upload your first lab test')}</Text>
          <Text style={[s.emptyBody, { color: BRAND.onHero }]}>
            {tx('გადაუღე ფურცელს — Medi წაიკითხავს და თითოეულ მაჩვენებელს უბრალო ენით აგიხსნის.', 'Take a photo of the sheet — Medi reads it and explains every value in plain words.')}
          </Text>
          <View style={s.button}>
            <Text style={s.buttonText}>{tx('ატვირთვა', 'Upload')}</Text>
            <ChevronRight size={17} color={BRAND.gradient[0]} strokeWidth={2.4} />
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  const when = isTodayYmd(latest) ? tx('დღეს', 'today') : formatLabDateKa(latest);
  const shown = flagged.slice(0, MAX_ROWS);
  const more = flagged.length - shown.length;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tx(
        `ბოლო ანალიზი, ${when}: ${counts.all} მაჩვენებელი, ${counts.watch} ნორმის გარეთ. გახსნა`,
        `Latest lab test, ${when}: ${counts.all} values, ${counts.watch} outside the range. Open`,
      )}
      onPress={() => onOpenTest(latest)}
      style={s.wrap}
    >
      <LabSummaryCard
        dateLabel={when}
        kicker={tx(`ბოლო ანალიზი · ${when}`, `Latest test · ${when}`)}
        total={counts.all}
        inRange={counts.N}
        off={counts.watch}
      >
        {shown.length ? (
          <View style={s.list}>
            {shown.map((row) => (
              <View key={row.key} style={s.item}>
                <View style={s.dot} />
                <Text numberOfLines={1} style={s.itemName}>{labPlainName(row.key) ?? labRowName(row)}</Text>
                <Text style={s.itemWord}>{labStatusWord(row)}</Text>
              </View>
            ))}
            {more > 0 ? <Text style={[s.more, { color: BRAND.onHero }]}>{tx(`და კიდევ ${more}`, `and ${more} more`)}</Text> : null}
          </View>
        ) : null}
        <View style={s.button} accessible={false}>
          <Text style={s.buttonText}>{tx('ანალიზის ნახვა', 'Open the test')}</Text>
          <ChevronRight size={17} color={BRAND.gradient[0]} strokeWidth={2.4} />
        </View>
      </LabSummaryCard>
    </Pressable>
  );
}

function latestDate(panels: LabPanel[]): string | null {
  const dates = panels.filter((p) => p.parameters?.length && p.date).map((p) => p.date);
  return dates.length ? dates.sort().pop()! : null;
}

const s = StyleSheet.create({
  wrap: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  list: { marginTop: 14, paddingTop: 12, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(199,210,254,0.28)' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: AMBER },
  itemName: { flex: 1, fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 14, lineHeight: 20, color: '#FFFFFF' },
  itemWord: { fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 12.5, lineHeight: 18, color: AMBER },
  more: { fontFamily: 'NotoSansGeorgian_500Medium', fontSize: 12.5, lineHeight: 18, marginLeft: 16 },
  button: {
    marginTop: 16,
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  buttonText: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21, color: BRAND.gradient[0] },
  empty: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 18, overflow: 'hidden' },
  glow: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -70, top: -90 },
  flask: {
    width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(30,27,75,0.35)', borderWidth: 1, borderColor: 'rgba(199,210,254,0.25)',
  },
  emptyTitle: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 20, lineHeight: 28, color: '#FFFFFF', marginTop: 14 },
  emptyBody: { fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 14, lineHeight: 21, marginTop: 4 },
});
