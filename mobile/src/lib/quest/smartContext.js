/**
 * Phase 5 — deterministic Smart Quest presentation context (pure, testable).
 *
 * The SERVER owns the target (Smart Quest Engine). Mobile only picks ONE short
 * Medi line for the movement card from safe presentation inputs:
 *   - quest reasonKey / targetSource (safe API metadata)
 *   - local hour + progress (evening pressure / near-completion rules)
 *   - Weather Wellness recommendation (existing single weather source; copy only)
 *   - loggedPain boolean (suppression only — no live product source yet, so it
 *     defaults to false; type/severity is never inspected)
 *
 * Weather and time NEVER change target or reward here — copy only.
 * Copy rotation is deterministic per day: hash(seed) picks a stable variant.
 */

const SMART_CONTEXT_KEYS = Object.freeze([
  'PAIN_NEUTRAL',
  'COMEBACK_EASY',
  'EVENING_GENTLE',
  'NEAR_COMPLETION',
  'SEVERE_INDOOR',
  'RAIN_INDOOR',
  'HIGH_UV',
  'WINDY',
  'GOOD_WEATHER_WINDOW',
  'STRUGGLING_ADJUSTED',
  'PERSONAL_BASELINE',
  'MORNING_CALM',
  'DEFAULT_TARGET',
]);

const RAIN_CATEGORIES = new Set(['rainy', 'heavy_rain', 'rain_soon']);
const SEVERE_CATEGORIES = new Set(['storm']);
const GOOD_OUTDOOR_CATEGORIES = new Set(['excellent_outdoor', 'good_outdoor']);
const UV_CATEGORIES = new Set(['high_uv', 'very_hot']);
const WIND_CATEGORIES = new Set(['very_windy']);

/**
 * Weather → safe context key (copy only). `null` when weather is unavailable,
 * stale, or simply not remarkable — the Quest works fine without it (§34).
 */
function weatherContextKey(weather) {
  if (!weather || weather.stale) return null;
  const category = String(weather.category || '');
  if (weather.severity === 'avoid' || SEVERE_CATEGORIES.has(category)) return 'SEVERE_INDOOR';
  if (RAIN_CATEGORIES.has(category)) return 'RAIN_INDOOR';
  if (UV_CATEGORIES.has(category)) return 'HIGH_UV';
  if (WIND_CATEGORIES.has(category)) return 'WINDY';
  if (GOOD_OUTDOOR_CATEGORIES.has(category) && weather.bestOutdoorWindow) return 'GOOD_WEATHER_WINDOW';
  return null;
}

/**
 * One primary contextual line for an ACTIVE movement quest.
 *
 * Deterministic priority (first match wins):
 *  1. PAIN_NEUTRAL       — pain logged today → neutral pace, no outdoor push
 *  2. COMEBACK_EASY      — server assigned a comeback re-entry target
 *  3. EVENING_GENTLE     — after 20:00 with <50% progress → no pressure (§68)
 *  4. NEAR_COMPLETION    — ≥80% before 20:00 → gentle encouragement (§69)
 *  5. weather context    — severe → indoor-neutral; rain/UV/wind → copy only;
 *                          good outdoor + best window → time suggestion
 *  6. STRUGGLING_ADJUSTED— easier target so today is achievable
 *  7. PERSONAL_BASELINE  — target fitted to the user's own rhythm
 *  8. MORNING_CALM       — before 12:00, default targets get the morning line
 *  9. DEFAULT_TARGET     — still learning the user's rhythm
 *
 * Returns { key, window } or null when the quest is not an active movement one.
 */
function movementContextState(input = {}) {
  const {
    kind,
    status,
    reasonKey,
    targetSource,
    progressPercent = 0,
    hour = 12,
    weather = null,
    loggedPain = false,
  } = input;

  if (kind !== 'movement' || status !== 'ACTIVE') return null;

  if (loggedPain) return { key: 'PAIN_NEUTRAL', window: null };
  if (reasonKey === 'COMEBACK_EASY' || targetSource === 'COMEBACK') {
    return { key: 'COMEBACK_EASY', window: null };
  }
  if (hour >= 20 && progressPercent < 50) return { key: 'EVENING_GENTLE', window: null };
  if (progressPercent >= 80 && hour < 20) return { key: 'NEAR_COMPLETION', window: null };

  const weatherKey = weatherContextKey(weather);
  if (weatherKey === 'GOOD_WEATHER_WINDOW') {
    return { key: weatherKey, window: weather.bestOutdoorWindow };
  }
  if (weatherKey) return { key: weatherKey, window: null };

  if (reasonKey === 'STRUGGLING_ADJUSTED') return { key: 'STRUGGLING_ADJUSTED', window: null };
  if (targetSource === 'PERSONALIZED') return { key: 'PERSONAL_BASELINE', window: null };
  if (hour < 12) return { key: 'MORNING_CALM', window: null };
  return { key: 'DEFAULT_TARGET', window: null };
}

/** Stable per-day rotation seed (§66): quest id already encodes user + period. */
function smartContextSeed(questId, periodKey, contextKey) {
  return `${questId || ''}:${periodKey || ''}:${contextKey || ''}`;
}

/** Why-this-target sheet flavor from the safe API field. */
function whyTargetKind(targetSource) {
  if (targetSource === 'COMEBACK') return 'comeback';
  if (targetSource === 'PERSONALIZED') return 'personalized';
  return 'default';
}

/** The affordance only appears when the server actually sent smart metadata. */
function showWhyTarget(quest) {
  return Boolean(
    quest &&
      quest.status === 'ACTIVE' &&
      quest.targetSource &&
      ['DEFAULT', 'PERSONALIZED', 'COMEBACK'].includes(quest.targetSource),
  );
}

module.exports = {
  SMART_CONTEXT_KEYS,
  weatherContextKey,
  movementContextState,
  smartContextSeed,
  whyTargetKind,
  showWhyTarget,
};
