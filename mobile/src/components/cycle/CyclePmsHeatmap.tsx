import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { PHYSICAL_SYMPTOMS, MOOD_OPTIONS } from '@/constants/cycle';
import { CycleCard } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { hasPmsPattern, pmsHeatmapRows } from '@/lib/cycleAnalytics';
import { useCycleColors } from '@/theme/cycle';

function labelOf(id: string) {
  const all = [...PHYSICAL_SYMPTOMS, ...MOOD_OPTIONS];
  return all.find((x) => x.id === id)?.label ?? id;
}

const AXIS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

type Props = {
  bundle: CycleBundle;
  compact?: boolean;
};

export function CyclePmsHeatmap({ bundle, compact }: Props) {
  const c = useCycleColors();
  const rows = pmsHeatmapRows(bundle);
  const byDay = useMemo(() => Object.fromEntries(rows.map((r) => [r.daysBefore, r])), [rows]);
  const max = useMemo(() => Math.max(1, ...rows.map((r) => r.count)), [rows]);
  const show = hasPmsPattern(bundle);

  const peak = useMemo(() => {
    if (rows.length < 2) return null;
    const top = [...rows].sort((a, b) => b.count - a.count).slice(0, 2);
    return top.map((r) => r.daysBefore).sort((a, b) => b - a).join('–');
  }, [rows]);

  if (!show) {
    if (compact) return null;
    return (
      <CycleCard>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>
          {ka.cycle.pmsPattern}
        </Text>
        <Text style={{ color: c.muted, fontSize: 13, marginTop: 8, lineHeight: 20 }}>
          {ka.cycle.trendsNeedMoreCycles}
        </Text>
      </CycleCard>
    );
  }

  return (
    <CycleCard>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 15 }}>{ka.cycle.pmsPattern}</Text>
      {!compact ? (
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, marginBottom: 8, lineHeight: 18 }}>
          {ka.cycle.pmsPatternHint}
        </Text>
      ) : null}
      {peak ? (
        <Text style={{ color: c.rose, fontWeight: '700', fontSize: 12, marginBottom: 10 }}>
          {ka.cycle.pmsPeak(peak)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: compact ? 48 : 72 }}>
        {AXIS.map((day) => {
          const count = byDay[day]?.count ?? 0;
          const barH = count ? Math.max(8, Math.round((count / max) * (compact ? 36 : 56))) : 4;
          return (
            <View key={day} style={{ flex: 1, alignItems: 'center' }}>
              <View
                style={{
                  width: '100%',
                  maxWidth: 22,
                  height: barH,
                  borderRadius: 6,
                  backgroundColor: c.rose,
                  opacity: count ? 0.35 + (count / max) * 0.65 : 0.12,
                }}
              />
              <Text style={{ color: c.mutedSoft, fontSize: 8, marginTop: 4, fontWeight: '700' }}>{day}</Text>
            </View>
          );
        })}
      </View>
      <Text style={{ color: c.muted, fontSize: 11, marginTop: 8 }}>{ka.cycle.pmsAxisHint}</Text>
      {!compact && rows[0]?.topSymptoms?.length ? (
        <Text style={{ color: c.muted, fontSize: 11, marginTop: 8 }}>
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
