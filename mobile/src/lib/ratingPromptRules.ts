/**
 * When the „MEDICARD შენთვის უფასოა“ rating card may appear (owner 2026-10-11). Pure, no React Native,
 * so tests/rating-prompt.test.cjs loads it under node. The store and the native call live in ratingPrompt.ts.
 *
 * Calm by design: only right after a good moment (a finished MEDIRUN walk, every dose of the day taken,
 * a steps or weight goal reached), never before the account is a week old, at most three times ever,
 * 30 days apart, and never again once „შეაფასე“ was tapped. Nothing here ever rewards a rating.
 */

const DAY_MS = 86_400_000;

export const RATING_PROMPT_RULES = Object.freeze({
  /** The account must be at least this old. */
  minAccountAgeMs: 7 * DAY_MS,
  /** Good moments seen on this device before the first ask (the current one counts). */
  minMoments: 2,
  /** The card follows a good moment only while it is fresh: the next Home visit within this window. */
  momentWindowMs: 3 * 60 * 60_000,
  /** „მოგვიანებით“ (or closing the card) waits this long before the next ask. */
  cooldownMs: 30 * DAY_MS,
  /** Never more than this many asks on one device. */
  maxShows: 3,
});

export type RatingPromptState = {
  /** Good moments seen on this device. */
  moments: number;
  /** When the latest good moment happened (ms); cleared once the card has shown for it. */
  lastMomentAt: number | null;
  shows: number;
  lastShownAt: number | null;
  /** „შეაფასე“ was tapped: never ask again on this device. */
  rated: boolean;
};

export type RatingAnswer = 'rate' | 'later';

export const EMPTY_RATING_STATE: RatingPromptState = Object.freeze({
  moments: 0,
  lastMomentAt: null,
  shows: 0,
  lastShownAt: null,
  rated: false,
});

const count = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const stamp = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/** Whatever is stored (or nothing, or garbage) → a valid state. */
export function parseRatingState(raw: string | null | undefined): RatingPromptState {
  if (!raw) return { ...EMPTY_RATING_STATE };
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (!v || typeof v !== 'object') return { ...EMPTY_RATING_STATE };
    return {
      moments: count(v.moments),
      lastMomentAt: stamp(v.lastMomentAt),
      shows: count(v.shows),
      lastShownAt: stamp(v.lastShownAt),
      rated: v.rated === true,
    };
  } catch {
    return { ...EMPTY_RATING_STATE };
  }
}

export function withGoodMoment(state: RatingPromptState, now: number): RatingPromptState {
  return { ...state, moments: state.moments + 1, lastMomentAt: now };
}

/** True when the card may appear now (the caller also checks platform, admin switch and other overlays). */
export function ratingPromptDue(
  state: RatingPromptState,
  { now, accountCreatedAt }: { now: number; accountCreatedAt: string | number | null | undefined },
): boolean {
  const R = RATING_PROMPT_RULES;
  if (state.rated || state.shows >= R.maxShows) return false;
  if (state.moments < R.minMoments || state.lastMomentAt == null) return false;
  if (now - state.lastMomentAt > R.momentWindowMs || state.lastMomentAt > now) return false;
  if (state.lastShownAt != null && now - state.lastShownAt < R.cooldownMs) return false;
  const created = accountCreatedAt == null ? NaN : new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(created) || now - created < R.minAccountAgeMs) return false;
  return true;
}

/** The card is on screen: count it and use up the moment that brought it. */
export function withShown(state: RatingPromptState, now: number): RatingPromptState {
  return { ...state, shows: state.shows + 1, lastShownAt: now, lastMomentAt: null };
}

export function withAnswer(state: RatingPromptState, answer: RatingAnswer): RatingPromptState {
  return answer === 'rate' ? { ...state, rated: true } : state;
}
