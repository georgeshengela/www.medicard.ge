import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { CycleCard, formatCycleDateKa } from '@/components/cycle/CycleUI';
import { MUCUS_OPTIONS } from '@/constants/cycle';
import { ka } from '@/i18n/ka';
import type { CycleTtcPayload } from '@/lib/api';
import { bbtSeriesWithGaps } from '@/lib/cycleFertility';
import { ttcEmptyCopyAllowed, ttcQueryPending } from '@/lib/cycleTtcQuery';
import { useCycleColors } from '@/theme/cycle';

type Props = {
  ttc: CycleTtcPayload | null;
  status?: string;
  errorKind?: string | null;
  onLog: () => void;
  onRetry?: () => void;
};

function mucusLabel(value: string) {
  return MUCUS_OPTIONS.find((opt) => opt.id === value)?.label ?? value;
}

function itemLine(item: CycleTtcPayload['timeline'][number]['items'][number]) {
  if (item.kind === 'opk') return `${ka.cycle.ovulationTest} — ${ka.cycle.testResult[item.result ?? 'unclear']}`;
  if (item.kind === 'bbt') return `${ka.cycle.bbt} — ${item.temperature} °C`;
  if (item.kind === 'mucus') return `${ka.cycle.mucus} — ${mucusLabel(item.value || '')}`;
  if (item.kind === 'pregnancyTest') {
    return `${ka.cycle.pregnancyTest} — ${ka.cycle.testResult[item.result ?? 'unclear']}`;
  }
  return '';
}

function BbtHistoryChart({
  points,
  c,
}: {
  points: { date: string; temperature: number }[];
  c: ReturnType<typeof useCycleColors>;
}) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0].date;
  const last = sorted[sorted.length - 1].date;
  const span = Math.max(
    1,
    Math.round((Date.parse(`${last}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86_400_000),
  );
  const min = Math.min(...sorted.map((p) => p.temperature));
  const max = Math.max(...sorted.map((p) => p.temperature));
  const range = Math.max(max - min, 0.4);
  const xAt = (date: string) => {
    const days = Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${first}T00:00:00`)) / 86_400_000);
    return 10 + (days / span) * 260;
  };
  const yAt = (value: number) => 100 - ((value - min) / range) * 80;
  const runs = bbtSeriesWithGaps(sorted.map((p) => ({ date: p.date, bbt: p.temperature })));

  return (
    <Svg width="100%" height={132} viewBox="0 0 280 132" accessibilityLabel={ka.cycle.bbtHistoryTitle}>
      <Line x1={0} y1={110} x2={280} y2={110} stroke={c.border} />
      {runs.map((run) =>
        run.length > 1 ? (
          <Polyline
            key={`${run[0].date}-${run[run.length - 1].date}`}
            points={run.map((p) => `${xAt(p.date)},${yAt(p.bbt)}`).join(' ')}
            fill="none"
            stroke={c.ink}
            strokeWidth={2}
          />
        ) : null,
      )}
      {sorted.map((p) => (
        <Circle key={p.date} cx={xAt(p.date)} cy={yAt(p.temperature)} r={3} fill={c.ink} />
      ))}
    </Svg>
  );
}

export function CycleTtcJournalSection({ ttc, status = 'idle', errorKind, onLog, onRetry }: Props) {
  const c = useCycleColors();
  const bbt = [...(ttc?.bbtHistory ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  const empty = ttcEmptyCopyAllowed(status) && (ttc?.timeline.length ?? 0) === 0;
  const pending = ttcQueryPending(status);
  const showHistory = Boolean(ttc && ttc.timeline.length > 0);

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
        {ka.cycle.ttcHistoryTitle}
      </Text>
      <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>{ka.cycle.ttcHonestyLine}</Text>

      {pending ? (
        <CycleCard>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 }}>
            <ActivityIndicator size="small" color={c.brand} />
            <Text style={{ color: c.muted, fontSize: 13 }}>{ka.cycle.ttcLoading}</Text>
          </View>
        </CycleCard>
      ) : status === 'error' && !showHistory ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
            {errorKind === 'network' ? ka.common.networkError : ka.cycle.ttcLoadError}
          </Text>
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={ka.common.retry}
            style={{
              minHeight: 44,
              borderRadius: 12,
              backgroundColor: c.cardSoft,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>
              {ka.common.retry}
            </Text>
          </Pressable>
        </CycleCard>
      ) : empty ? (
        <CycleCard>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
            {ka.cycle.ttcHistoryEmpty}
          </Text>
          <Pressable
            onPress={onLog}
            accessibilityRole="button"
            accessibilityLabel={ka.cycle.ttcLogOpk}
            style={{
              minHeight: 44,
              borderRadius: 12,
              backgroundColor: c.cardSoft,
              borderWidth: 1,
              borderColor: c.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold' }}>
              {ka.cycle.ttcEmptyCta}
            </Text>
          </Pressable>
        </CycleCard>
      ) : (
        <CycleCard>
          {status === 'error' ? (
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              accessibilityLabel={ka.common.retry}
              style={{ marginBottom: 12, minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: c.muted, fontSize: 13, lineHeight: 18 }}>
                {errorKind === 'network' ? ka.common.networkError : ka.cycle.ttcLoadError}
              </Text>
              <Text style={{ color: c.brand, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 12, marginTop: 4 }}>
                {ka.common.retry}
              </Text>
            </Pressable>
          ) : null}
          {(ttc?.timeline ?? []).slice(0, 14).map((row) => (
            <View key={row.date} style={{ marginBottom: 12 }}>
              <Text
                style={{
                  color: c.muted,
                  fontFamily: 'NotoSansGeorgian_700Bold',
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                {formatCycleDateKa(row.date)}
              </Text>
              {row.items.map((item, i) => (
                <Text
                  key={`${row.date}-${item.kind}-${i}`}
                  style={{ color: c.ink, fontSize: 13, lineHeight: 20 }}
                  accessibilityLabel={`${ka.cycle.logged}: ${itemLine(item)}`}
                >
                  {itemLine(item)}
                </Text>
              ))}
            </View>
          ))}
        </CycleCard>
      )}

      {pending || (status === 'error' && bbt.length === 0) ? null : (
      <CycleCard>
        <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', marginBottom: 8 }}>
          {ka.cycle.bbtHistoryTitle}
        </Text>
        <Text style={{ color: c.muted, fontSize: 12, lineHeight: 17, marginBottom: 10 }}>
          {ka.cycle.bbtHistoryHint}
        </Text>
        {bbt.length === 0 ? (
          <Text style={{ color: c.muted, fontSize: 13 }}>{ka.cycle.ttcEmptyBbt}</Text>
        ) : bbt.length < 3 ? (
          bbt.map((row) => (
            <Text key={row.date} style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginBottom: 4 }}>
              {formatCycleDateKa(row.date)} — {row.temperature} °C
            </Text>
          ))
        ) : (
          <BbtHistoryChart points={bbt} c={c} />
        )}
      </CycleCard>
      )}
    </View>
  );
}
