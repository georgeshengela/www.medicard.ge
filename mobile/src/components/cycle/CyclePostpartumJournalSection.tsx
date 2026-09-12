import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatCycleDateKa } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CyclePostpartumPayload } from '@/lib/api';
import { cycleChipLabel } from '@/lib/cycleLabels';
import { energyLabel, formatPainEntry, sleepLabel } from '@/lib/cycleObservations';
import { postpartumEmptyCopyAllowed, postpartumQueryPending } from '@/lib/cyclePostpartumQuery';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  postpartum: CyclePostpartumPayload | null | undefined;
  status?: string;
  onAddLog?: () => void;
  onClassifyEpisode?: (date: string, classified: boolean) => void;
};

function rowBits(row: CyclePostpartumPayload['recentLogs'][number]): string[] {
  const bits: string[] = [];
  if (row.flow) bits.push(`${ka.cycle.postpartumBleeding} — ${cycleChipLabel(row.flow)}`);
  for (const entry of row.painEntries || []) bits.push(formatPainEntry(entry));
  for (const key of row.symptoms || []) bits.push(cycleChipLabel(key));
  for (const mood of row.moods || []) bits.push(cycleChipLabel(mood));
  if (row.sleepQuality) bits.push(`${ka.cycle.sleep}: ${sleepLabel(row.sleepQuality)}`);
  if (row.energy) bits.push(`${ka.cycle.energy}: ${energyLabel(row.energy)}`);
  return bits;
}

function clusterRows(postpartum: CyclePostpartumPayload) {
  const rows = postpartum.recentLogs ?? [];
  const episodes = postpartum.bleedEpisodes ?? [];
  const used = new Set<string>();
  const blocks: Array<{
    key: string;
    kind: 'bleed' | 'fact';
    classified: boolean;
    classifyDate: string | null;
    rows: CyclePostpartumPayload['recentLogs'];
  }> = [];

  for (const episode of episodes) {
    const group = rows
      .filter((row) => row.date >= episode.start && row.date <= episode.end)
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!group.length) continue;
    group.forEach((row) => used.add(row.date));
    blocks.push({
      key: `bleed-${episode.start}`,
      kind: 'bleed',
      classified: Boolean(episode.classified),
      classifyDate: episode.start,
      rows: group,
    });
  }

  for (const row of rows) {
    if (used.has(row.date)) continue;
    blocks.push({
      key: `fact-${row.date}`,
      kind: 'fact',
      classified: false,
      classifyDate: null,
      rows: [row],
    });
  }

  return blocks.sort((a, b) => (b.rows[0]?.date || '').localeCompare(a.rows[0]?.date || ''));
}

export function CyclePostpartumJournalSection({ postpartum, status, onAddLog, onClassifyEpisode }: Props) {
  const c = useCycleColors();
  const pending = postpartumQueryPending(status);
  const canEmpty = postpartumEmptyCopyAllowed(status);
  const rows = postpartum?.recentLogs ?? [];
  const blocks = postpartum && rows.length ? clusterRows(postpartum) : [];

  return (
    <View style={{ marginBottom: 20, gap: 12 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
        {ka.cycle.postpartumJournalTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>{ka.cycle.postpartumNotDiagnosis}</Text>
      {pending && !rows.length ? (
        <View
          accessibilityRole="summary"
          accessibilityLabel={ka.cycle.postpartumLoading}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            padding: 16,
            minHeight: 72,
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>{ka.cycle.postpartumLoading}</Text>
        </View>
      ) : rows.length === 0 ? (
        <View
          accessibilityRole="summary"
          accessibilityLabel={ka.cycle.postpartumJournalEmpty}
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            padding: 16,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            {canEmpty ? ka.cycle.postpartumJournalEmpty : ka.cycle.postpartumLoadError}
          </Text>
          {onAddLog && canEmpty ? (
            <Pressable
              onPress={onAddLog}
              accessibilityRole="button"
              accessibilityLabel={ka.cycle.postpartumAddLog}
              style={{
                minHeight: 44,
                borderRadius: 12,
                backgroundColor: c.cta,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 14,
              }}
            >
              <Text style={{ color: '#fff', fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 14 }}>
                {ka.cycle.postpartumAddLog}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        blocks.map((block) => (
          <View
            key={block.key}
            accessibilityRole="summary"
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              padding: 14,
            }}
          >
            {block.kind === 'bleed' && block.classified ? (
              <Text
                accessibilityLabel={ka.cycle.postpartumClassifiedA11y}
                style={{
                  color: c.brand,
                  fontSize: 12,
                  lineHeight: 18,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  marginBottom: 8,
                }}
              >
                {ka.cycle.postpartumClassifiedBadge}
              </Text>
            ) : null}
            {block.rows.map((row) => {
              const bits = rowBits(row);
              if (!bits.length) return null;
              return (
                <View key={row.date} style={{ marginBottom: 8 }}>
                  <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
                    {formatCycleDateKa(row.date)}
                  </Text>
                  {bits.map((bit) => (
                    <Text key={bit} style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginTop: 4 }}>
                      {bit}
                    </Text>
                  ))}
                </View>
              );
            })}
            {block.kind === 'bleed' && block.classifyDate && onClassifyEpisode ? (
              <Pressable
                onPress={() => onClassifyEpisode(block.classifyDate as string, block.classified)}
                accessibilityRole="button"
                accessibilityLabel={
                  block.classified ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyPeriod
                }
                style={{
                  minHeight: 44,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: c.border,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 4,
                }}
              >
                <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 13 }}>
                  {block.classified ? ka.cycle.postpartumUnclassify : ka.cycle.postpartumClassifyPeriod}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))
      )}
    </View>
  );
}
