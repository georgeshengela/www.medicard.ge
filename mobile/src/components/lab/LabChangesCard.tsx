import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { tx } from '@/i18n/locale';
import { labChangeLine, labPlainName, type LabComparison } from '@/lib/labBody';
import { labRowName } from '@/lib/labNames';
import { HUB, hubText } from '@/theme/hub';
import { useMedilab } from './MedilabUI';

const FIRST = 4;

/**
 * „რა შეიცვალა“ on one lab test (owner 2026-10-10): against the test before it — how many values got
 * better, worse or stayed put, then the moves themselves (worse first). Better = into or toward the
 * range, so a falling number can be good news; green and amber carry that, never the arrow.
 */
export function LabChangesCard({ comparison, onOpen }: { comparison: LabComparison; onOpen: (key: string) => void }) {
  const M = useMedilab();
  const [all, setAll] = useState(false);
  const rows = all ? comparison.changes : comparison.changes.slice(0, FIRST);
  const hidden = comparison.changes.length - FIRST;

  return (
    <View style={[s.card, { backgroundColor: M.c.surface }]}>
      <View style={s.stats}>
        <Stat value={comparison.better} label={tx('გაუმჯობესდა', 'Better')} color={comparison.better ? M.normal : M.c.text100} />
        <View style={[s.rule, { backgroundColor: M.c.bg300 }]} />
        <Stat value={comparison.worse} label={tx('გაუარესდა', 'Worse')} color={comparison.worse ? M.attention : M.c.text100} />
        <View style={[s.rule, { backgroundColor: M.c.bg300 }]} />
        <Stat value={comparison.steady} label={tx('უცვლელია', 'Steady')} color={M.c.text100} />
      </View>

      {rows.map((change) => {
        const tone = change.better ? M.normal : M.attention;
        const Arrow = change.last.value >= change.prev ? ArrowUpRight : ArrowDownRight;
        const plain = labPlainName(change.key);
        const name = labRowName(change.last);
        const lastDisplay = change.last.display || String(change.last.value);
        return (
          <Pressable
            key={change.key}
            accessibilityRole="button"
            accessibilityLabel={`${plain ?? name}. ${labChangeLine(change.kind)}. ${change.prevDisplay} → ${lastDisplay} ${change.last.unit}`}
            onPress={() => onOpen(change.key)}
            style={[s.row, { borderTopColor: M.c.bg300 }]}
          >
            <View style={[s.tile, { backgroundColor: `${tone}${M.dark ? '2E' : '1A'}` }]}>
              <Arrow size={17} color={tone} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[hubText.cardTitle, { fontSize: 14.5, lineHeight: 20, color: M.c.text100 }]}>{plain ?? name}</Text>
              <Text style={[hubText.caption, { color: tone }]}>{labChangeLine(change.kind)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text numberOfLines={1} style={[s.now, { color: M.c.text100 }]}>
                {lastDisplay}
                {change.last.unit ? <Text style={{ fontFamily: 'NotoSansGeorgian_400Regular', fontSize: 11, color: M.c.text300 }}> {change.last.unit}</Text> : null}
              </Text>
              <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text300 }]}>{tx(`იყო ${change.prevDisplay}`, `was ${change.prevDisplay}`)}</Text>
            </View>
          </Pressable>
        );
      })}

      {!comparison.changes.length ? (
        <Text style={[hubText.body, s.calm, { color: M.c.text200, borderTopColor: M.c.bg300 }]}>
          {tx('მნიშვნელოვანი ცვლილება არ არის — ნორმაში მყოფი მაჩვენებლები ნორმაში დარჩა.', 'No real change — the values that were in range stayed there.')}
        </Text>
      ) : null}

      {hidden > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setAll((v) => !v)}
          style={[s.more, { borderTopColor: M.c.bg300 }]}
        >
          <Text style={[hubText.link, { color: M.ink }]}>
            {all ? tx('ნაკლების ჩვენება', 'Show less') : tx(`კიდევ ${hidden} ცვლილება`, `${hidden} more ${hidden === 1 ? 'change' : 'changes'}`)}
          </Text>
          {all ? <ChevronUp size={16} color={M.ink} /> : <ChevronDown size={16} color={M.ink} />}
        </Pressable>
      ) : null}
    </View>
  );
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  const M = useMedilab();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 1 }}>
      <Text style={{ fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 22, lineHeight: 28, color }}>{value}</Text>
      <Text numberOfLines={1} style={[hubText.caption, { color: M.c.text200 }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: HUB.cardRadius, overflow: 'hidden' },
  stats: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  rule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  tile: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  now: { fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15, lineHeight: 21 },
  calm: { paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: StyleSheet.hairlineWidth },
  more: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderTopWidth: StyleSheet.hairlineWidth },
});
