import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { CyclePeriodHistory } from '@/components/cycle/CyclePeriodHistory';
import { CyclePredictionHistoryCard } from '@/components/cycle/CyclePredictionHistoryCard';
import { CycleTrendsCharts } from '@/components/cycle/CycleTrendsChart';
import { CycleActionRow, CycleActionPanel, CycleSection } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle } from '@/lib/api';
import { useCycleColors } from '@/theme/cycle';

/**
 * Journal pane — History + Trends merged (docs/CYCLE_DESIGN.md §9–10).
 * Stats band uses engine-derived values only (ranges, no fake precision).
 * Sections below thresholds render an honest explainer, never empty charts.
 */
export function CycleJournalPane({
  bundle,
  canonical,
  onChanged,
}: {
  bundle: CycleBundle;
  canonical: CycleBundle | null;
  onChanged: () => void;
}) {
  const c = useCycleColors();
  const router = useRouter();
  const s = bundle.summary;
  const hasCycles = Boolean(s?.cycleCount && s.cycleCount > 0);
  const hasAnyLog = (bundle.logs?.length ?? 0) > 0;

  const stats: { label: string; value: string }[] = [];
  if (hasCycles && s) {
    stats.push({ label: ka.cycle.avgCycle, value: `${s.avgCycleLength} ${ka.cycle.daysUnit}` });
    stats.push({ label: ka.cycle.avgPeriod, value: `~${s.avgPeriodLength} ${ka.cycle.daysUnit}` });
    if (s.shortestCycle != null && s.longestCycle != null) {
      stats.push({
        label: ka.cycle.journalRecentRange,
        value: `${s.shortestCycle}–${s.longestCycle} ${ka.cycle.daysUnit}`,
      });
    }
  }

  if (!hasAnyLog) {
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 20 }}>
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            padding: 20,
          }}
        >
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_700Bold', fontSize: 16 }}>
            {ka.cycle.journalEmptyTitle}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 8 }}>
            {ka.cycle.journalEmptyBody}
          </Text>
        </View>
        <CyclePredictionHistoryCard
          refreshKey={(bundle.inferred?.periodStarts || []).join('|')}
        />
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {/* Stats band — engine values, hidden below threshold (§9). */}
      {stats.length ? (
        <View style={{ marginBottom: 20 }}>
          <View
            style={{
              flexDirection: 'row',
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              paddingVertical: 14,
            }}
          >
            {stats.map((stat, i) => (
              <View
                key={stat.label}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  paddingHorizontal: 6,
                  borderLeftWidth: i > 0 ? 1 : 0,
                  borderLeftColor: c.border,
                }}
              >
                <Text
                  style={{
                    color: c.ink,
                    fontFamily: 'NotoSansGeorgian_700Bold',
                    fontSize: 16,
                    fontVariant: ['tabular-nums'],
                  }}
                >
                  {stat.value}
                </Text>
                <Text
                  numberOfLines={2}
                  style={{
                    color: c.muted,
                    fontSize: 10,
                    lineHeight: 13,
                    marginTop: 4,
                    textAlign: 'center',
                    fontFamily: 'NotoSansGeorgian_500Medium',
                  }}
                >
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
          {s?.cycleCount ? (
            <Text style={{ color: c.mutedSoft, fontSize: 11, marginTop: 8, paddingHorizontal: 4 }}>
              {ka.cycle.basedOnCycles(s.cycleCount)}
            </Text>
          ) : null}
        </View>
      ) : (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.card,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 19 }}>
            {ka.cycle.journalStatsLocked}
          </Text>
        </View>
      )}

      <CyclePredictionHistoryCard
        refreshKey={(bundle.inferred?.periodStarts || []).join('|')}
      />

      <CycleSection title={ka.cycle.periodHistory} delay={40}>
        <CyclePeriodHistory bundle={bundle} onChanged={onChanged} />
      </CycleSection>

      <CycleSection title={ka.cycle.trendsTitle} delay={80}>
        {canonical ? <CycleTrendsCharts bundle={canonical} /> : null}
        {canonical &&
        !canonical.analytics?.completedCycleCount &&
        !canonical.trends?.cycleLengths?.length &&
        !canonical.trends?.bbtPoints?.length ? (
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: c.border,
              backgroundColor: c.card,
              padding: 16,
            }}
          >
            <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
              {ka.cycle.trendsLogCycles}
            </Text>
          </View>
        ) : null}
      </CycleSection>

      <CycleSection title={ka.cycle.journalMore} delay={120}>
        <CycleActionPanel>
          <CycleActionRow
            icon={FileText}
            title={ka.cycle.summary}
            subtitle={ka.cycle.summaryHint}
            color={c.brand}
            onPress={() => router.push('/cycle/summary' as never)}
            last
          />
        </CycleActionPanel>
      </CycleSection>
    </View>
  );
}
