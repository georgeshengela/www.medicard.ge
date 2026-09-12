/**
 * Cycle presentation contract — Phase 5 (docs/CYCLE_DESIGN.md §24).
 *
 * One shared visual-honesty mapping used by the calendar, mini strip,
 * day details, gauge and legend. Pure presentation: NO cycle math here.
 *
 * Contract:
 *   LOGGED    → solid fill / filled glyph ●  / "აღრიცხული"
 *   DERIVED   → plain text, no fill          / "თქვენი ჩანაწერებით"
 *   PREDICTED → dash/dot/hollow ◌ + wash ≤10% / "სავარაუდო" (+ leading ~)
 *   AI        → attribution chip + evidence  / "Medi-ს დაკვირვება"
 *
 * Rule: fill = logged fact; outline/dash/dot = estimate; ring = position.
 */

export const CYCLE_PROVENANCE = Object.freeze({
  LOGGED: 'logged',
  DERIVED: 'derived',
  PREDICTED: 'predicted',
  AI: 'ai',
});

/** Flow ids that count as a logged bleed day (canonical values, frozen). */
const BLEED_FLOWS = new Set(['light', 'medium', 'heavy']);

export function isBleedFlowValue(flow) {
  return BLEED_FLOWS.has(String(flow || ''));
}

export function isSpottingFlowValue(flow) {
  return String(flow || '') === 'spotting';
}

/**
 * Copy display-log flow onto calendar marks.
 *
 * Engine calendar overlay uses engine-eligible logs only, so postpartum-stamped
 * bleeds never become menstrual history. Presentation still needs the owner's
 * logged flow to paint factual bleed/spotting cells.
 */
export function mergeLoggedFlowOntoMarks(calendar, logs) {
  const next = { ...(calendar || {}) };
  for (const log of logs || []) {
    if (!log?.date) continue;
    const prev = next[log.date] || {};
    next[log.date] = log.flow ? { ...prev, flow: log.flow } : prev;
  }
  return next;
}

export function mergeOwnerClassifiedPeriodOntoMarks(calendar, classifiedDates) {
  const next = { ...(calendar || {}) };
  for (const date of classifiedDates || []) {
    if (!date) continue;
    const prev = next[date] || {};
    next[date] = { ...prev, ownerClassifiedPeriod: true };
  }
  return next;
}

/**
 * Classify one calendar day into presentation layers.
 *
 * @param {object|undefined} mark  CycleDayMark from server predictions.calendar
 *   (merged with log observations): { period, predicted, fertile, ovulation,
 *   logged, flow, hasNote }.
 * @param {object} [opts]
 * @param {boolean} [opts.showFertility=true] engine contraception presentation
 *   (`showFertilityMarkers`); when false, fertility layers are omitted entirely.
 * @param {boolean} [opts.showPredicted=true] when false, predicted period /
 *   fertile / ovulation layers are omitted. Logged facts stay. Low server
 *   confidence does NOT flip this — estimates stay visible as dashed/სავარაუდო.
 * @returns {{
 *   loggedPeriod: boolean,
 *   spotting: boolean,
 *   predictedPeriod: boolean,
 *   fertile: boolean,
 *   ovulation: boolean,
 *   symptomDot: boolean,
 *   ownerClassifiedPeriod: boolean,
 * }}
 */
export function classifyCycleDay(mark, opts) {
  const m = mark || {};
  const showFertility = opts?.showFertility !== false;
  const showPredicted = opts?.showPredicted !== false;
  const loggedPeriod = Boolean(m.period && !m.predicted) || isBleedFlowValue(m.flow);
  const spotting = !loggedPeriod && isSpottingFlowValue(m.flow);
  const predictedPeriod =
    showPredicted && Boolean(m.period && m.predicted) && !loggedPeriod;
  const fertile = showPredicted && showFertility && Boolean(m.fertile && !m.ovulation);
  const ovulation = showPredicted && showFertility && Boolean(m.ovulation);
  const symptomDot = Boolean(m.logged) && !loggedPeriod && !spotting;
  const ownerClassifiedPeriod = Boolean(m.ownerClassifiedPeriod) && loggedPeriod;
  return { loggedPeriod, spotting, predictedPeriod, fertile, ovulation, symptomDot, ownerClassifiedPeriod };
}

/**
 * Provenance of the day's primary marker. Position states (today/selected)
 * are not provenance — they layer on top.
 */
/**
 * Calendar cell presentation — navigation vs health, no engine math.
 * Selection is never a medical symbol.
 *
 * @param {object} input
 * @param {ReturnType<typeof classifyCycleDay>} input.layers
 * @param {boolean} [input.isSelected]
 * @param {boolean} [input.isToday]
 */
export function getCycleCalendarDayVisualState(input) {
  const layers = input?.layers || classifyCycleDay(undefined);
  const isSelected = Boolean(input?.isSelected);
  const isToday = Boolean(input?.isToday);

  const baseState = layers.loggedPeriod
    ? 'loggedPeriod'
    : layers.predictedPeriod
      ? 'predictedPeriod'
      : layers.ovulation
        ? 'ovulation'
        : layers.fertile
          ? 'fertile'
          : layers.spotting
            ? 'spotting'
            : layers.symptomDot
              ? 'symptom'
              : 'plain';

  const semanticIndicator = layers.spotting
    ? 'spottingDot'
    : layers.ovulation
      ? 'ovulationSparkle'
      : layers.fertile
        ? 'fertileDots'
        : layers.symptomDot
          ? 'symptomDot'
          : 'none';

  const fill = layers.loggedPeriod
    ? 'loggedPeriod'
    : isSelected && !layers.predictedPeriod
      ? 'selectedSoft'
      : 'none';

  const ring = isToday ? 'today' : isSelected ? 'selected' : 'none';

  return {
    baseState,
    semanticIndicator,
    fill,
    ring,
    showPredictedDash: Boolean(layers.predictedPeriod),
    showPredictedPrefix: Boolean(layers.predictedPeriod),
    isSelected,
    isToday,
    isLogged: Boolean(layers.loggedPeriod || layers.spotting),
    isPredicted: Boolean(layers.predictedPeriod || layers.fertile || layers.ovulation),
  };
}

export function dayProvenance(layers) {
  if (layers.loggedPeriod || layers.spotting) return CYCLE_PROVENANCE.LOGGED;
  if (layers.predictedPeriod || layers.fertile || layers.ovulation) {
    return CYCLE_PROVENANCE.PREDICTED;
  }
  if (layers.symptomDot) return CYCLE_PROVENANCE.LOGGED;
  return CYCLE_PROVENANCE.DERIVED;
}

/** Leading marker for predicted-period day numerals (§24: "~"). */
export const PREDICTED_NUMERAL_PREFIX = '~';

/**
 * Compose a combined screen-reader label for a calendar day.
 * Keeps engine wording: predicted things are "სავარაუდო", logged are facts.
 *
 * @param {object} input { dayLabel, isToday, isSelected, layers, copy }
 *   copy: { today, selected, loggedPeriod, spotting, predictedPeriod,
 *           fertile, ovulation, symptoms }
 */
export function calendarDayA11y(input) {
  const { dayLabel, isToday, isSelected, layers, copy } = input;
  const bits = [dayLabel];
  if (isToday) bits.push(copy.today);
  if (isSelected) bits.push(copy.selected);
  if (layers.loggedPeriod) bits.push(copy.loggedPeriod);
  if (layers.ownerClassifiedPeriod && copy.classifiedPeriod) bits.push(copy.classifiedPeriod);
  if (layers.spotting) bits.push(copy.spotting);
  if (layers.predictedPeriod) bits.push(copy.predictedPeriod);
  if (layers.fertile) bits.push(copy.fertile);
  if (layers.ovulation) bits.push(copy.ovulation);
  if (layers.symptomDot) bits.push(copy.symptoms);
  return bits.filter(Boolean).join(', ');
}

/**
 * Gauge screen-reader summary (§54): one concise sentence set,
 * built only from server-derived facts passed in.
 */
export function gaugeA11ySummary(input) {
  const bits = [];
  if (input.dayLabel) bits.push(input.dayLabel);
  if (input.phaseLabel) bits.push(input.phaseLabel);
  if (input.nextPeriodLabel) bits.push(input.nextPeriodLabel);
  return bits.filter(Boolean).join('. ');
}

/**
 * Confidence presentation class — never danger styling (§12, §36).
 * Maps server confidence to a neutral pill; low is "still learning",
 * not a warning.
 */
export function confidencePresentation(confidence) {
  const level =
    confidence === 'high' || confidence === 'medium' ? confidence : 'low';
  return {
    level,
    tone: 'neutral', // by contract there is no danger tone for confidence
    softenPrediction: level !== 'high',
    // A new woman with only lastPeriodStart is always confidence=low
    // (needs ≥2 logged cycle gaps for medium). Hiding overlays blanked
    // ovulation + next period after onboarding. Uncertainty is copy +
    // dashed glyphs (CYCLE_DESIGN.md §12), not an empty calendar.
    hidePredictedOverlays: false,
  };
}

/**
 * Recent symptom ids from existing logs — last unique, most recent first.
 * Presentation only. No ranking, no invented frequency.
 */
export function recentSymptomIds(logs, limit = 4) {
  const ids = [];
  const seen = new Set();
  const rows = Array.isArray(logs) ? [...logs] : [];
  rows.sort((a, b) => String(b?.date || '').localeCompare(String(a?.date || '')));
  for (const log of rows) {
    for (const id of log?.symptoms || []) {
      const key = String(id);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ids.push(key);
      if (ids.length >= limit) return ids;
    }
  }
  return ids;
}

/** Journal cycle-length chart: design threshold ≥3 gaps. */
export function journalCycleLengthReady(gapCount) {
  return Number(gapCount) >= 3;
}

/**
 * Alert chrome — late is calm (never danger). Urgent stays urgent only
 * when it is not the late-period estimate.
 */
export function alertPresentation(alert) {
  const late = Boolean(alert?.late) || /გვიანია/.test(String(alert?.messageKa || ''));
  if (late) return { tone: 'calm', late: true };
  if (alert?.level === 'urgent') return { tone: 'urgent', late: false };
  return { tone: 'neutral', late: false };
}
