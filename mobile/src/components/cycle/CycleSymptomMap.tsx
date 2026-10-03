import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { CycleCard } from '@/components/cycle/CycleUI';
import type { CycleDoctorSummary } from '@/lib/api';
import {
  doctorSummaryCopy,
  doctorSymptomMapColumns,
  doctorSymptomMapOpacity,
  doctorSymptomMapRows,
} from '@/lib/cycleDoctorSummaryI18n';
import { useCycleColors } from '@/theme/cycle';

const CELL = 14;
const GAP = 2;
const ROW_H = 24;
const HEAD_H = 18;
const LABEL_W = 118;

type MapRow = { id: string; label: string; counts: number[]; sentence: string | null };

type Props = {
  summary: CycleDoctorSummary;
  locale: 'ka' | 'en' | 'fr' | 'ru';
};

/**
 * Doctor summary „სიმპტომები ციკლის დღეების მიხედვით“: rows = her most frequent pain places, symptoms and
 * moods, columns = cycle days, a square's darkness = in how many of the last cycles it was logged that day.
 * One ink with opacity steps (same formula as the PDF). Labels stay pinned; only the day grid scrolls
 * sideways, inside the card, so the page never scrolls horizontally on a phone. Each row is read out as
 * its sentence („სპაზმები — ყველაზე ხშირად 1–3 დღეებში (6-დან 5 ციკლში)“); the grid itself is hidden from
 * screen readers.
 */
export function CycleSymptomMap({ summary, locale }: Props) {
  const c = useCycleColors();
  const map = summary.symptomMap;
  const rows: MapRow[] = doctorSymptomMapRows(summary, locale);
  if (!map || !rows.length) return null;
  const copy = doctorSummaryCopy(locale);
  const cols: string[] = doctorSymptomMapColumns(map);
  const total = map.cycleCount;

  return (
    <CycleCard>
      <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
        {copy.symptomMapHint(total)}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: LABEL_W, paddingRight: 8 }}>
          <Text
            style={{ height: HEAD_H, color: c.mutedSoft, fontSize: 10, lineHeight: HEAD_H }}
            importantForAccessibility="no"
            accessibilityElementsHidden
          >
            {copy.symptomMapDay}
          </Text>
          {rows.map((row) => (
            <View
              key={row.id}
              accessible
              accessibilityRole="text"
              accessibilityLabel={row.sentence ?? row.label}
              style={{ height: ROW_H, justifyContent: 'center' }}
            >
              <Text numberOfLines={1} style={{ color: c.ink, fontSize: 12, fontWeight: '600' }}>
                {row.label}
              </Text>
            </View>
          ))}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          style={{ flex: 1 }}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View>
            <View style={{ flexDirection: 'row', height: HEAD_H, alignItems: 'center' }}>
              {cols.map((col) => (
                <Text
                  key={col}
                  style={{
                    width: col.includes('+') ? CELL + 10 : CELL,
                    marginRight: GAP,
                    textAlign: 'center',
                    color: c.mutedSoft,
                    fontSize: 9,
                    fontWeight: '600',
                  }}
                >
                  {col}
                </Text>
              ))}
            </View>
            {rows.map((row) => (
              <View key={row.id} style={{ flexDirection: 'row', height: ROW_H, alignItems: 'center' }}>
                {row.counts.map((n, i) => {
                  const op = doctorSymptomMapOpacity(n, total);
                  const wide = cols[i]?.includes('+');
                  return (
                    <View
                      key={i}
                      style={{
                        width: wide ? CELL + 10 : CELL,
                        height: CELL,
                        marginRight: GAP,
                        borderRadius: 3,
                        backgroundColor: c.gaugeTrack,
                        overflow: 'hidden',
                      }}
                    >
                      {op ? <View style={{ flex: 1, backgroundColor: c.ink, opacity: op }} /> : null}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View
        style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 12, gap: 4 }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text style={{ color: c.muted, fontSize: 11, marginRight: 4 }}>{copy.symptomMapLegend}</Text>
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <View key={n} style={{ alignItems: 'center' }}>
            <View
              style={{
                width: CELL,
                height: CELL,
                borderRadius: 3,
                backgroundColor: c.gaugeTrack,
                overflow: 'hidden',
              }}
            >
              <View style={{ flex: 1, backgroundColor: c.ink, opacity: doctorSymptomMapOpacity(n, total) }} />
            </View>
            <Text style={{ color: c.mutedSoft, fontSize: 9, marginTop: 2 }}>{n}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 12, gap: 6 }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {rows.map((row) =>
          row.sentence ? (
            <Text key={row.id} style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {row.sentence}
            </Text>
          ) : null,
        )}
      </View>
    </CycleCard>
  );
}
