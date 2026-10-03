import React from 'react';
import { Text, View } from 'react-native';
import type { CycleComparisonPayload } from '@/lib/api';
import { tx } from '@/i18n/locale';
import { HomeSectionTitle } from '@/components/home/HomeSectionTitle';
import {
  comparisonA11y,
  comparisonLine,
  comparisonRows,
  comparisonStartLabel,
  comparisonUsualHint,
} from '@/lib/cycleComparisonCopy';
import { cycleHexAlpha, useCycleColors } from '@/theme/cycle';

/**
 * „ბოლო ციკლები“ (W3-4, brief §9 „მერე“ item 7; Clue's „enhanced Cycle View“): the last ≤ 6 completed,
 * not hidden cycles as horizontal bars on one scale — logged period days in rose, the rest neutral, the
 * length at the end — newest on top, and one factual line against her own usual. No verdict colours.
 * Same cycles as „ჩემი ციკლი“ (stats card, Home bars): the server builds both from one list.
 */
export function CycleComparisonCard({ comparison }: { comparison: CycleComparisonPayload | null | undefined }) {
  const c = useCycleColors();
  const rows = comparisonRows(comparison);
  if (!rows.length) return null;
  const line = comparisonLine(comparison);
  const title = tx('ბოლო ციკლები', 'Recent cycles');
  const rest = cycleHexAlpha(c.mutedSoft, 0.3);

  return (
    <View style={{ paddingHorizontal: 20, marginBottom: 28 }}>
      <HomeSectionTitle title={title} />
      <View
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`${title}. ${comparisonA11y(rows)}${line ? `. ${line}` : ''}`}
        style={{ backgroundColor: c.card, borderRadius: 22, padding: 16, marginTop: 12 }}
      >
        <View style={{ gap: 10 }}>
          {rows.map((row) => (
            <View key={row.start} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text
                numberOfLines={1}
                style={{
                  width: 50,
                  color: row.latest ? c.ink : c.muted,
                  fontSize: 12,
                  lineHeight: 16,
                  fontFamily: row.latest ? 'NotoSansGeorgian_600SemiBold' : 'NotoSansGeorgian_500Medium',
                  fontVariant: ['tabular-nums'],
                }}
              >
                {comparisonStartLabel(row.start)}
              </Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: `${Math.round(row.widthRatio * 84)}%`,
                    height: 12,
                    borderRadius: 6,
                    overflow: 'hidden',
                    flexDirection: 'row',
                    backgroundColor: rest,
                  }}
                >
                  <View style={{ width: `${Math.round(row.periodRatio * 100)}%`, backgroundColor: c.period }} />
                </View>
                <Text
                  style={{
                    marginLeft: 8,
                    color: row.latest ? c.ink : c.muted,
                    fontSize: 13,
                    lineHeight: 18,
                    fontFamily: row.latest ? 'NotoSansGeorgian_700Bold' : 'NotoSansGeorgian_500Medium',
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {row.length}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 }}>
          <Legend color={c.period} label={tx('მენსტრუაცია', 'Period')} />
          <Legend color={rest} label={tx('ციკლის დანარჩენი დღეები', 'Rest of the cycle')} />
        </View>

        {line ? (
          <Text style={{ color: c.ink, fontSize: 14, lineHeight: 21, fontFamily: 'NotoSansGeorgian_500Medium', marginTop: 12 }}>
            {line}
          </Text>
        ) : null}
        {comparison?.usualDays != null ? (
          <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 17, marginTop: 4 }}>{comparisonUsualHint()}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const c = useCycleColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
      <Text numberOfLines={1} style={{ color: c.muted, fontSize: 11, lineHeight: 15, fontFamily: 'NotoSansGeorgian_500Medium', flexShrink: 1 }}>
        {label}
      </Text>
    </View>
  );
}
