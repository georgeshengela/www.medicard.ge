/**
 * Phase 9 — Journal presentation of prediction-to-log difference.
 * Does not change forecast math, snapshot identity, or recompute aggregates.
 */

export const PREDICTION_HISTORY_VISIBLE_LIMIT = 6;
export const AGGREGATE_MIN_COMPLETED = 3;

const MONTHS_KA = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];

export function formatHistoryDateKa(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd || '';
  const [, m, d] = ymd.split('-');
  return `${Number(d)} ${MONTHS_KA[Number(m) - 1]}`;
}

export function formatHistoryMonthKa(ymd) {
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const month = MONTHS_KA[Number(ymd.slice(5, 7)) - 1];
  return month || '';
}

/** Compact row: actual vs final prediction. Never show +2 / -1. */
export function differenceTone(days) {
  if (!Number.isFinite(days)) return null;
  if (days === 0) return 'same_day';
  return days > 0 ? 'later' : 'earlier';
}

export function differenceAbsDays(days) {
  if (!Number.isFinite(days)) return null;
  return Math.abs(days);
}

/**
 * Expanded estimate-vs-log phrasing.
 * errorDays = actual − predicted.
 * +2 → estimate was 2 days earlier than the logged start.
 */
export function estimateOffsetTone(days) {
  if (!Number.isFinite(days)) return null;
  if (days === 0) return 'matched';
  return days > 0 ? 'estimate_earlier' : 'estimate_later';
}

export function revisionCount(prePeriodSnapshotCount) {
  const n = Number(prePeriodSnapshotCount);
  if (!Number.isFinite(n) || n < 1) return 0;
  return Math.max(n - 1, 0);
}

export function isUserVisibleEpisode(episode) {
  if (!episode || episode.status !== 'completed') return false;
  if (episode.exclusionReason) return false;
  return Boolean(episode.actualStart && episode.lastPredictedStart);
}

export function completedEpisodesNewestFirst(episodes = []) {
  return (episodes || [])
    .filter(isUserVisibleEpisode)
    .sort((a, b) => String(b.actualStart).localeCompare(String(a.actualStart)));
}

export function visibleCompletedEpisodes(episodes = [], { limit = PREDICTION_HISTORY_VISIBLE_LIMIT, showAll = false } = {}) {
  const all = completedEpisodesNewestFirst(episodes);
  if (showAll) return all;
  return all.slice(0, limit);
}

export function openSeriesEpisodes(episodes = []) {
  return (episodes || []).filter(
    (e) => e?.status === 'open' && e.lastPredictedStart && !e.actualStart && !e.exclusionReason,
  );
}

export function shouldShowAggregate(history) {
  const completed = Number(history?.completedCount) || 0;
  return Boolean(
    history?.aggregateEligible &&
      history.aggregate &&
      Number.isFinite(history.aggregate.typicalAbsErrorDays) &&
      completed >= AGGREGATE_MIN_COMPLETED &&
      history.aggregate.basis === 'median_absolute_error',
  );
}

export function aggregateTypicalDays(history) {
  if (!shouldShowAggregate(history)) return null;
  return history.aggregate.typicalAbsErrorDays;
}

export function hideTechnicalExclusion(episode) {
  if (!episode) return true;
  if (episode.status === 'excluded') return true;
  return episode.exclusionReason === 'INVALID_CYCLE_GAP' ||
    episode.exclusionReason === 'NO_PRE_PERIOD_SNAPSHOT';
}

export function firstAndFinalDistinct(episode) {
  if (!episode?.firstPredictedStart || !episode?.lastPredictedStart) return false;
  return episode.firstPredictedStart !== episode.lastPredictedStart;
}

export function snapshotConfidenceLevel(value) {
  return value === 'high' || value === 'medium' ? value : 'low';
}

export function historySectionState(history, { failed = false, loading = false } = {}) {
  if (failed) return 'hidden';
  if (loading && !history) return 'loading';
  const completed = completedEpisodesNewestFirst(history?.episodes);
  const open = openSeriesEpisodes(history?.episodes);
  if (!completed.length && !open.length) return 'empty';
  if (!completed.length && open.length) return 'open_only';
  if (completed.length < AGGREGATE_MIN_COMPLETED) return 'episodes_only';
  return 'aggregate_ready';
}

export function episodeA11yLabel(episode, copy) {
  if (!isUserVisibleEpisode(episode)) return '';
  const month = formatHistoryMonthKa(episode.actualStart);
  const finalDate = formatHistoryDateKa(episode.lastPredictedStart);
  const actualDate = formatHistoryDateKa(episode.actualStart);
  const tone = differenceTone(episode.lastErrorDays);
  const abs = differenceAbsDays(episode.lastErrorDays);
  let delta = '';
  if (tone === 'same_day') delta = copy.sameDay;
  else if (tone === 'later') delta = copy.later(abs);
  else if (tone === 'earlier') delta = copy.earlier(abs);
  return copy.row(month, finalDate, actualDate, delta);
}
