import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarRange, Info } from 'lucide-react-native';
import { CyclePressable } from './CyclePressable';
import { CycleExplainSheet } from './CycleExplainSheet';
import type { CycleDeviations } from '@/lib/api';
import { deviationCopy, deviationLines } from '@/lib/cycleDeviationCopy';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';
import { HUB, hubText } from '@/theme/hub';

/**
 * „შენს ციკლში ცვლილება შევნიშნეთ“ (brief §9 wave 2 item 14, Apple „Cycle Deviations“).
 * Only on /cycle, right under „ჩემი ციკლი“. Renders nothing unless the server sent at least one
 * finding — there is no „not enough data“ state. Calm hub card: lilac tile (a cycle colour, never
 * the danger tokens), one factual line per finding, the doctor sentence last; ⓘ explains the rules.
 */
export function CycleDeviationsCard({ deviations }: { deviations: CycleDeviations | null | undefined }) {
  const c = useCycleColors();
  const [explain, setExplain] = useState(false);
  const lines = deviationLines(deviations);
  if (!lines.length) return null;
  const title = deviationCopy.title();
  const doctor = deviationCopy.doctorLine();

  return (
    <View style={s.wrap}>
      <View
        accessibilityRole="summary"
        accessibilityLabel={[title, ...lines, doctor].join(' ')}
        style={[s.card, { backgroundColor: c.card }]}
      >
        <View style={s.head}>
          <View style={[s.tile, { backgroundColor: cycleHexAlpha(c.luteal, 0.14) }]}>
            <CalendarRange size={19} color={c.luteal} strokeWidth={2} />
          </View>
          <Text style={[hubText.cardTitle, s.title, { color: c.ink }]}>{title}</Text>
          <CyclePressable
            onPress={() => setExplain(true)}
            accessibilityRole="button"
            accessibilityLabel={deviationCopy.infoA11y()}
            hitSlop={8}
            style={[s.info, { backgroundColor: c.cardSoft }]}
          >
            <Info size={16} color={c.muted} strokeWidth={2} />
          </CyclePressable>
        </View>
        <View style={s.lines}>
          {lines.map((line) => (
            <View key={line} style={s.lineRow}>
              <View style={[s.dot, { backgroundColor: c.luteal }]} />
              <Text style={[hubText.body, s.lineText, { color: c.ink }]}>{line}</Text>
            </View>
          ))}
        </View>
        <Text style={[hubText.body, { color: c.muted }]}>{doctor}</Text>
      </View>

      <CycleExplainSheet
        visible={explain}
        title={deviationCopy.explainTitle()}
        body={deviationCopy.explainBody(deviations?.rulesOff ?? [])}
        accent={c.luteal}
        sourceIds={['abnormalBleeding', 'menstrualCycle']}
        onClose={() => setExplain(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { paddingHorizontal: 20, marginTop: -16, marginBottom: 28 },
  card: { borderRadius: HUB.cardRadius, padding: HUB.cardPad, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, minWidth: 0 },
  info: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  lines: { gap: 8 },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  lineText: { flex: 1, minWidth: 0 },
});
