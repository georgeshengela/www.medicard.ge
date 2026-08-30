import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { PHYSICAL_SYMPTOMS, MOOD_OPTIONS } from '@/constants/cycle';
import { CycleCard } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

function labelOf(id: string) {
  const all = [...PHYSICAL_SYMPTOMS, ...MOOD_OPTIONS];
  return all.find((x) => x.id === id)?.label ?? id;
}

type Props = {
  bundle: CycleBundle;
  compact?: boolean;
};

export function CyclePmsHeatmap({ bundle, compact }: Props) {
  const c = useCycleColors();
  const rows = bundle.trends?.pmsByDay ?? [];
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);

  const peak = useMemo(() => {
    if (rows.length < 2) return null;
    const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 2);
    return top.map((r) => r.cycleDay).join('–');
  }, [rows]);

  if (rows.length < 2) {
    if (compact) return null;
    return (
      <CycleCard>
        <Text style={{ color: c.muted, fontSize: 13 }}>{ka.cycle.trendsEmpty}</Text>
      </CycleCard>
    );
  }

  return (
    <CycleCard>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>{ka.cycle.pmsPattern}</Text>
      {!compact ? (
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, marginBottom: 12 }}>
          {ka.cycle.pmsPatternHint}
        </Text>
      ) : null}
      {peak ? (
        <Text style={{ color: c.rose, fontWeight: '700', fontSize: 12, marginBottom: 10 }}>
          {ka.cycle.pmsPeak(peak)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: compact ? 48 : 72 }}>
        {rows.map((row) => {
          const barH = Math.max(8, Math.round((row.count / max) * (compact ? 36 : 56)));
          return (
          <View key={row.cycleDay} style={{ flex: 1, alignItems: 'center' }}>
            <View
              style={{
                width: '100%',
                maxWidth: 28,
                height: barH,
                borderRadius: 6,
                backgroundColor: c.rose,
                opacity: 0.35 + (row.count / max) * 0.65,
              }}
            />
            <Text style={{ color: c.mutedSoft, fontSize: 9, marginTop: 4, fontWeight: '700' }}>
              {row.cycleDay}
            </Text>
          </View>
          );
        })}
      </View>
      {!compact && rows[0]?.topSymptoms?.length ? (
        <Text style={{ color: c.muted, fontSize: 11, marginTop: 10 }}>
          {rows
            .flatMap((r) => r.topSymptoms)
            .slice(0, 3)
            .map((s) => labelOf(s.key))
            .join(' · ')}
        </Text>
      ) : null}
    </CycleCard>
  );
}
