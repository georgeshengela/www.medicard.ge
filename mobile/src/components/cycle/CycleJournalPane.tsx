import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FileText } from 'lucide-react-native';
import { CycleObservationTrends } from '@/components/cycle/CycleObservationTrends';
import { CyclePeriodHistory } from '@/components/cycle/CyclePeriodHistory';
import { CyclePredictionHistoryCard } from '@/components/cycle/CyclePredictionHistoryCard';
import { CycleTrendsCharts } from '@/components/cycle/CycleTrendsChart';
import { CycleTtcJournalSection } from '@/components/cycle/CycleTtcJournalSection';
import { CyclePregnancyJournalSection } from '@/components/cycle/CyclePregnancyJournalSection';
import { CycleActionRow, CycleActionPanel, CycleSection } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import type { CycleBundle, CyclePregnancyPayload, CyclePostpartumPayload, CycleTtcPayload } from '@/lib/api';
import { cycleHistoryPresentation } from '@/lib/cycleHistoryCopy';
import { cycleModeCapabilities } from '@/lib/cycleModes';
import { CyclePerimenopauseJournalSection } from '@/components/cycle/CyclePerimenopauseJournalSection';
import { CyclePostpartumJournalSection } from '@/components/cycle/CyclePostpartumJournalSection';
import { useCycleColors } from '@/theme/cycle';

/**
 * Journal pane — History + Trends merged (docs/CYCLE_DESIGN.md §9–10).
 * Stats band uses engine-derived values only (ranges, no fake precision).
 * Sections below thresholds render an honest explainer, never empty charts.
 */
export function CycleJournalPane({
  bundle,
  canonical,
  ttc,
  ttcStatus,
  ttcErrorKind,
  pregnancy,
  pregnancyStatus,
  pregnancyErrorKind,
  postpartum,
  postpartumStatus,
  onChanged,
  onLogFertility,
  onClassifyPostpartumBleed,
}: {
  bundle: CycleBundle;
  canonical: CycleBundle | null;
  ttc?: CycleTtcPayload | null;
  ttcStatus?: string;
  ttcErrorKind?: string | null;
  pregnancy?: CyclePregnancyPayload | null;
  pregnancyStatus?: string;
  pregnancyErrorKind?: string | null;
  postpartum?: CyclePostpartumPayload | null;
  postpartumStatus?: string;
  onChanged: () => void;
  onLogFertility?: () => void;
  onClassifyPostpartumBleed?: (date: string, classified: boolean) => void;
}) {
  const c = useCycleColors();
  const router = useRouter();
  const caps = cycleModeCapabilities(bundle.profile.mode);
  const history = cycleHistoryPresentation(bundle.profile.mode);
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
        {caps.showPregnancyOverview ? (
          <CyclePregnancyJournalSection
            pregnancy={pregnancy ?? null}
            status={pregnancyStatus}
            errorKind={pregnancyErrorKind}
          />
        ) : null}
        {caps.showPerimenopauseTracking ? (
          <CyclePerimenopauseJournalSection peri={bundle.perimenopause} />
        ) : null}
        {caps.showPostpartumTracking ? (
          <CyclePostpartumJournalSection
            postpartum={postpartum ?? null}
            status={postpartumStatus}
            onAddLog={onLogFertility}
            onClassifyEpisode={onClassifyPostpartumBleed}
          />
        ) : null}
        {history.showClassicJournalEmpty ? (
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
        ) : null}
        {history.showPredictionHistory ? (
          <CyclePredictionHistoryCard
            refreshKey={(bundle.inferred?.periodStarts || []).join('|')}
          />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      {caps.showPregnancyOverview ? (
        <CyclePregnancyJournalSection
          pregnancy={pregnancy ?? null}
          status={pregnancyStatus}
          errorKind={pregnancyErrorKind}
        />
      ) : null}
      {caps.showPerimenopauseTracking ? (
        <CyclePerimenopauseJournalSection peri={bundle.perimenopause} />
      ) : null}
      {caps.showPostpartumTracking ? (
        <CyclePostpartumJournalSection
          postpartum={postpartum ?? null}
          status={postpartumStatus}
          onAddLog={onLogFertility}
          onClassifyEpisode={onClassifyPostpartumBleed}
        />
      ) : null}

      {/* Stats band — engine values, hidden below threshold (§9). Hidden in peri: unclamped variability is above. */}
      {caps.showPerimenopauseTracking || caps.showPostpartumTracking ? null : stats.length ? (
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
      ) : caps.showPerimenopauseTracking || caps.showPostpartumTracking ? null : (
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

      {history.showPredictionHistory ? (
        <CyclePredictionHistoryCard
          refreshKey={(bundle.inferred?.periodStarts || []).join('|')}
        />
      ) : null}

      {history.showPeriodHistory ? (
      <CycleSection title={ka.cycle.periodHistory} delay={40}>
        <CyclePeriodHistory bundle={bundle} onChanged={onChanged} />
      </CycleSection>
      ) : null}

      <CycleSection title={ka.cycle.trendsTitle} delay={80}>
        <CycleObservationTrends
          refreshKey={(bundle.logs || [])
            .slice(-40)
            .map(
              (l) =>
                `${l.date}:${(l.symptoms || []).join(',')}:${l.energy || l.observations?.energy || ''}:${(l.painEntries || []).map((p) => p.type).join(',')}`,
            )
            .join('|')}
          excludePeriodAssociation={caps.showPregnancyOverview || caps.showPostpartumTracking}
          showEmpty={
            (canonical?.analytics?.completedCycleCount ?? 0) < 2 &&
            !(canonical?.trends?.cycleLengths && canonical.trends.cycleLengths.length >= 3)
          }
        />
        {canonical && !caps.showPostpartumTracking ? <CycleTrendsCharts bundle={canonical} /> : null}
        {caps.showTtcOverview ? (
          <View style={{ marginTop: 22 }}>
            <CycleTtcJournalSection
              ttc={ttc ?? null}
              status={ttcStatus}
              errorKind={ttcErrorKind}
              onLog={() => onLogFertility?.()}
              onRetry={onChanged}
            />
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
