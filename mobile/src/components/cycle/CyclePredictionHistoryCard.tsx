import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CycleSection } from '@/components/cycle/CycleUI';
import { ka } from '@/i18n/ka';
import { api, type CyclePredictionHistory, type CyclePredictionHistoryEpisode } from '@/lib/api';
import {
  aggregateTypicalDays,
  differenceAbsDays,
  differenceTone,
  episodeA11yLabel,
  estimateOffsetTone,
  firstAndFinalDistinct,
  formatHistoryDateKa,
  historySectionState,
  openSeriesEpisodes,
  revisionCount,
  shouldShowAggregate,
  snapshotConfidenceLevel,
  visibleCompletedEpisodes,
} from '@/lib/cyclePredictionHistoryUi';
import { nextPeriodConfidenceCopy } from '@/lib/cycleHonesty';
import { useCycleColors } from '@/theme/cycle';

function toneLabel(days: number | null) {
  const tone = differenceTone(days);
  const abs = differenceAbsDays(days);
  if (tone === 'same_day') return ka.cycle.predictionHistorySameDay;
  if (tone === 'later' && abs != null) return ka.cycle.predictionHistoryDaysLater(abs);
  if (tone === 'earlier' && abs != null) return ka.cycle.predictionHistoryDaysEarlier(abs);
  return null;
}

function estimateSentence(days: number | null, which: 'first' | 'last') {
  const tone = estimateOffsetTone(days);
  const abs = differenceAbsDays(days);
  if (tone === 'matched') {
    return which === 'first'
      ? ka.cycle.predictionHistoryFirstMatched
      : ka.cycle.predictionHistoryLastMatched;
  }
  if (tone === 'estimate_earlier' && abs != null) {
    return which === 'first'
      ? ka.cycle.predictionHistoryFirstEarlier(abs)
      : ka.cycle.predictionHistoryLastEarlier(abs);
  }
  if (tone === 'estimate_later' && abs != null) {
    return which === 'first'
      ? ka.cycle.predictionHistoryFirstLater(abs)
      : ka.cycle.predictionHistoryLastLater(abs);
  }
  return null;
}

function snapshotConfidenceCopy(value: string | null) {
  return nextPeriodConfidenceCopy({
    confidence: snapshotConfidenceLevel(value),
    irregular: false,
    pcos: false,
    cautious: snapshotConfidenceLevel(value) === 'low',
    conditions: [],
  });
}

function EpisodeRow({ episode }: { episode: CyclePredictionHistoryEpisode }) {
  const c = useCycleColors();
  const [open, setOpen] = useState(false);
  const delta = toneLabel(episode.lastErrorDays);
  const updates = revisionCount(episode.prePeriodSnapshotCount);
  const revised = firstAndFinalDistinct(episode);
  const a11y = episodeA11yLabel(episode, {
    sameDay: ka.cycle.predictionHistorySameDay,
    later: ka.cycle.predictionHistoryDaysLater,
    earlier: ka.cycle.predictionHistoryDaysEarlier,
    row: ka.cycle.predictionHistoryA11yRow,
  });

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.border }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a11y}
        onPress={() => setOpen((v) => !v)}
        style={{ paddingVertical: 12 }}
      >
        <Text
          style={{
            color: c.mutedSoft,
            fontSize: 11,
            fontFamily: 'NotoSansGeorgian_500Medium',
          }}
        >
          {formatHistoryDateKa(episode.actualStart || '')}
        </Text>
        <View style={{ marginTop: 4 }}>
          <Text style={{ color: c.ink, fontFamily: 'NotoSansGeorgian_600SemiBold', fontSize: 13, lineHeight: 20 }}>
            {ka.cycle.predictionHistoryLatest}: {formatHistoryDateKa(episode.lastPredictedStart || '')}
          </Text>
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20, marginTop: 2 }}>
            {ka.cycle.predictionHistoryActual}: {formatHistoryDateKa(episode.actualStart || '')}
            {delta ? ` · ${delta}` : ''}
          </Text>
          {revised ? (
            <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18, marginTop: 2 }}>
              {ka.cycle.predictionHistoryUpdated}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {open ? (
        <View style={{ paddingBottom: 12, gap: 6 }}>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
            {ka.cycle.predictionHistoryFirst}: {formatHistoryDateKa(episode.firstPredictedStart || '')}
          </Text>
          <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
            {ka.cycle.predictionHistoryLatest}: {formatHistoryDateKa(episode.lastPredictedStart || '')}
          </Text>
          <Text style={{ color: c.ink, fontSize: 12, lineHeight: 18 }}>
            {ka.cycle.predictionHistoryActual}: {formatHistoryDateKa(episode.actualStart || '')}
          </Text>
          {updates > 0 ? (
            <Text style={{ color: c.mutedSoft, fontSize: 12, lineHeight: 18 }}>
              {ka.cycle.predictionHistoryRevisions(updates)}
            </Text>
          ) : null}
          {estimateSentence(episode.firstErrorDays, 'first') ? (
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {estimateSentence(episode.firstErrorDays, 'first')}
            </Text>
          ) : null}
          {estimateSentence(episode.lastErrorDays, 'last') ? (
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              {estimateSentence(episode.lastErrorDays, 'last')}
            </Text>
          ) : null}
          {episode.confidenceAtFirst ? (
            <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16 }}>
              {ka.cycle.predictionHistoryConfidenceFirst}: {snapshotConfidenceCopy(episode.confidenceAtFirst)}
            </Text>
          ) : null}
          {episode.confidenceAtLast ? (
            <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16 }}>
              {ka.cycle.predictionHistoryConfidenceLast}: {snapshotConfidenceCopy(episode.confidenceAtLast)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export function CyclePredictionHistoryCard({ refreshKey = '' }: { refreshKey?: string }) {
  const c = useCycleColors();
  const [history, setHistory] = useState<CyclePredictionHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFailed(false);
    api.cycle
      .predictionHistory()
      .then((res) => {
        if (!alive) return;
        setHistory(res);
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setHistory(null);
        setFailed(true);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const state = historySectionState(history, { failed, loading });
  if (state === 'hidden') return null;

  const completed = visibleCompletedEpisodes(history?.episodes, { showAll });
  const allCompleted = visibleCompletedEpisodes(history?.episodes, { showAll: true });
  const open = openSeriesEpisodes(history?.episodes);
  const showAggregate = shouldShowAggregate(history);
  const typicalDays = aggregateTypicalDays(history);

  return (
    <CycleSection title={ka.cycle.predictionHistory} subtitle={ka.cycle.predictionHistoryLead} delay={20}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.card,
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        {state === 'loading' ? (
          <View style={{ gap: 8 }}>
            <View style={{ height: 10, borderRadius: 6, backgroundColor: c.cardSoft, width: '78%' }} />
            <View style={{ height: 10, borderRadius: 6, backgroundColor: c.cardSoft, width: '52%' }} />
          </View>
        ) : null}

        {state === 'empty' ? (
          <Text style={{ color: c.muted, fontSize: 13, lineHeight: 20 }}>
            {ka.cycle.predictionHistoryEmpty}
          </Text>
        ) : null}

        {state !== 'loading' && state !== 'empty' ? (
          <>
            {showAggregate && typicalDays != null && history?.aggregate ? (
              <Text
                style={{
                  color: c.ink,
                  fontFamily: 'NotoSansGeorgian_600SemiBold',
                  fontSize: 13,
                  lineHeight: 20,
                  marginBottom: 10,
                }}
              >
                {ka.cycle.predictionHistoryAggregate(history.aggregate.completedCount, typicalDays)}
              </Text>
            ) : null}

            {open[0] ? (
              <View style={{ paddingBottom: 10, marginBottom: completed.length ? 2 : 0 }}>
                <Text style={{ color: c.mutedSoft, fontSize: 11, fontFamily: 'NotoSansGeorgian_500Medium' }}>
                  {ka.cycle.predictionHistoryOpen}
                </Text>
                <Text style={{ color: c.ink, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
                  {formatHistoryDateKa(open[0].lastPredictedStart || '')}
                </Text>
              </View>
            ) : null}

            {completed.map((episode) => (
              <EpisodeRow key={episode.cycleAnchorDate} episode={episode} />
            ))}

            {allCompleted.length > completed.length ? (
              <Pressable onPress={() => setShowAll(true)} style={{ paddingVertical: 10 }}>
                <Text style={{ color: c.brand, fontSize: 13, fontFamily: 'NotoSansGeorgian_600SemiBold' }}>
                  {ka.cycle.predictionHistoryShowMore}
                </Text>
              </Pressable>
            ) : null}

            <Text style={{ color: c.mutedSoft, fontSize: 11, lineHeight: 16, marginTop: completed.length || open.length ? 10 : 0 }}>
              {ka.cycle.predictionHistoryFootnote}
            </Text>
          </>
        ) : null}
      </View>
    </CycleSection>
  );
}
