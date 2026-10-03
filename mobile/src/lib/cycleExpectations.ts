/**
 * Local expectation engine (MEDICARD Cycle brief §8.5, §9 item 11 — Flo's „Symptoms to expect“,
 * Clue's „Cramps are likely today“).
 *
 * A symptom, mood or pain type that the person logged in at least 2 of her last 3 completed cycles on
 * the same cycle day (± 1) is „expected“ for that day: the quick log shows it first as a dashed tile,
 * the hero shows one quiet line („სპაზმები დღეს სავარაუდოა — ბოლო 3 ციკლიდან 2-ში ამ დღეებში გქონდა“).
 *
 * Rules (owner + brief): at least 3 completed cycles, otherwise nothing — a false expectation is worse
 * than none; the wording is always „სავარაუდოა“, never a diagnosis; sex and sex drive, intimate symptoms,
 * discharge, BBT, mucus and tests never take part (`SENSITIVE_SHORTCUT_IDS`) — this engine only ever
 * reads everyday observations. Everything runs on the device from the bundle the screens already hold:
 * nothing is sent anywhere, nothing is stored.
 *
 * Pure (no React Native, relative imports): `node --experimental-strip-types --test` loads it.
 */
import { MOOD_OPTIONS, PHYSICAL_SYMPTOMS } from '../constants/cycle.ts';
import { ka } from '../i18n/ka.ts';
import { tx } from '../i18n/locale.js';
import { PAIN_MANAGED_SYMPTOM_IDS, SENSITIVE_SHORTCUT_IDS } from './cycleObservationRegistry.ts';
import { cycleModeCapabilities } from './cycleModes.js';

export type CycleExpectationKind = 'pain' | 'symptom' | 'mood';

export type CycleExpectation = {
  kind: CycleExpectationKind;
  id: string;
  label: string;
  /** In how many of the last `of` completed cycles it was logged on this cycle day ± 1. */
  cyclesSeen: number;
  of: number;
};

/** How many completed cycles are read, how many of them must agree, and the day tolerance. */
export const EXPECTATION_CYCLES = 3;
export const EXPECTATION_MIN_SEEN = 2;
export const EXPECTATION_DAY_TOLERANCE = 1;

export type ExpectationLog = {
  date: string;
  symptoms?: string[] | null;
  moods?: string[] | null;
  painEntries?: { type: string }[] | null;
};

export type ExpectationInput = {
  logs: ExpectationLog[];
  /** Logged period starts (any order; duplicates are fine). */
  periodStarts: string[];
  /** The day the expectation is for (today on the hero, the edited day in the quick log). */
  date: string;
};

/** Legacy symptom ids that the pain row owns today → the pain type they stand for. */
const SYMPTOM_TO_PAIN: Record<string, string> = {
  cramps: 'cramps',
  headache: 'headache',
  back_pain: 'lower_back',
  breast_tenderness: 'breast',
  pelvic_pain: 'pelvic',
  ovulation_pain: 'ovulation_side',
};

const KIND_ORDER: Record<CycleExpectationKind, number> = { pain: 0, symptom: 1, mood: 2 };

function daysBetween(fromKey: string, toKey: string): number {
  const [ay, am, ad] = fromKey.split('-').map(Number);
  const [by, bm, bd] = toKey.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Which everyday observations a log holds, as `kind:id` keys — never a private or fertility field. */
export function observationKeys(log: ExpectationLog): string[] {
  const keys = new Set<string>();
  for (const entry of log.painEntries ?? []) {
    if (entry?.type && !SENSITIVE_SHORTCUT_IDS.has(entry.type)) keys.add(`pain:${entry.type}`);
  }
  for (const id of log.symptoms ?? []) {
    if (!id || SENSITIVE_SHORTCUT_IDS.has(id)) continue;
    if (PAIN_MANAGED_SYMPTOM_IDS.has(id)) {
      keys.add(`pain:${SYMPTOM_TO_PAIN[id] ?? id}`);
      continue;
    }
    if (PHYSICAL_SYMPTOMS.some((o) => o.id === id)) keys.add(`symptom:${id}`);
  }
  for (const id of log.moods ?? []) {
    if (!id || SENSITIVE_SHORTCUT_IDS.has(id)) continue;
    if (MOOD_OPTIONS.some((o) => o.id === id)) keys.add(`mood:${id}`);
  }
  return [...keys];
}

export function expectationLabel(kind: CycleExpectationKind, id: string): string {
  if (kind === 'pain') return (ka.cycle.painType as Record<string, string>)[id] ?? id;
  const table = kind === 'mood' ? MOOD_OPTIONS : PHYSICAL_SYMPTOMS;
  return table.find((o) => o.id === id)?.label ?? id;
}

/**
 * The expectations for `date`. Empty unless there are at least `EXPECTATION_CYCLES` completed cycles
 * before the cycle `date` belongs to. Sorted: most cycles first, then pain → symptom → mood, then the
 * order they were first logged in (stable, so the rows do not jump between days).
 */
export function cycleExpectations({ logs, periodStarts, date }: ExpectationInput): CycleExpectation[] {
  if (!DATE_KEY.test(date)) return [];
  const starts = [...new Set(periodStarts.filter((d) => DATE_KEY.test(d) && d <= date))].sort();
  // The cycle `date` belongs to starts at the last start on or before it; every earlier pair is a completed cycle.
  const currentStart = starts[starts.length - 1];
  if (!currentStart) return [];
  const completed = starts.length - 1;
  if (completed < EXPECTATION_CYCLES) return [];
  const targetDay = daysBetween(currentStart, date) + 1;
  if (targetDay < 1) return [];

  const windows = starts.slice(-(EXPECTATION_CYCLES + 1)).map((start, i, arr) => ({ start, end: arr[i + 1] })).filter((w) => w.end);
  const seenIn = new Map<string, Set<number>>();
  const firstSeen = new Map<string, number>();
  let order = 0;
  const sorted = [...logs].filter((l) => l && DATE_KEY.test(l.date)).sort((a, b) => a.date.localeCompare(b.date));
  windows.forEach((w, cycleIndex) => {
    for (const log of sorted) {
      if (log.date < w.start || log.date >= w.end!) continue;
      const day = daysBetween(w.start, log.date) + 1;
      if (Math.abs(day - targetDay) > EXPECTATION_DAY_TOLERANCE) continue;
      for (const key of observationKeys(log)) {
        if (!seenIn.has(key)) {
          seenIn.set(key, new Set());
          firstSeen.set(key, order++);
        }
        seenIn.get(key)!.add(cycleIndex);
      }
    }
  });

  const out: CycleExpectation[] = [];
  for (const [key, cycles] of seenIn) {
    if (cycles.size < EXPECTATION_MIN_SEEN) continue;
    const [kind, id] = key.split(':') as [CycleExpectationKind, string];
    out.push({ kind, id, label: expectationLabel(kind, id), cyclesSeen: cycles.size, of: windows.length });
  }
  return out.sort(
    (a, b) => b.cyclesSeen - a.cyclesSeen || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (firstSeen.get(`${a.kind}:${a.id}`) ?? 0) - (firstSeen.get(`${b.kind}:${b.id}`) ?? 0),
  );
}

/** The slice of a cycle bundle this engine reads (the screens hold the full `CycleBundle`). */
export type ExpectationBundle = {
  profile: { mode?: string | null };
  logs: ExpectationLog[];
  inferred?: { periodStarts?: string[] | null } | null;
  trends?: { periodStarts?: string[] | null } | null;
  periodRanges?: { start: string }[] | null;
};

/** Period starts as the server reports them (inferred → trends → logged ranges). */
export function bundlePeriodStarts(bundle: ExpectationBundle): string[] {
  const inferred = bundle.inferred?.periodStarts;
  if (inferred?.length) return inferred;
  const trends = bundle.trends?.periodStarts;
  if (trends?.length) return trends;
  return (bundle.periodRanges ?? []).map((r) => r.start);
}

/** Expectations for `date` from a bundle — only in the classic modes (period tracking / trying to conceive). */
export function expectationsFromBundle(bundle: ExpectationBundle | null | undefined, date: string): CycleExpectation[] {
  if (!bundle) return [];
  const caps = cycleModeCapabilities(bundle.profile?.mode ?? null) as { showClassicCycleOverview?: boolean };
  if (!caps.showClassicCycleOverview) return [];
  return cycleExpectations({ logs: bundle.logs ?? [], periodStarts: bundlePeriodStarts(bundle), date });
}

/** Whether the day's log already holds the expected item (then the hero line has nothing to announce). */
export function expectationLogged(item: CycleExpectation, log: ExpectationLog | null | undefined): boolean {
  if (!log) return false;
  return observationKeys(log).includes(`${item.kind}:${item.id}`);
}

/**
 * The one line under the hero: the most frequent expectation not yet logged that day. Pain and symptoms
 * read „სპაზმები დღეს სავარაუდოა — ბოლო 3 ციკლიდან 2-ში ამ დღეებში გქონდა“; a mood says how she felt.
 * Always „სავარაუდოა“ — an observation of her own pattern, never a diagnosis.
 */
export function expectationLine(items: CycleExpectation[], dayLog: ExpectationLog | null | undefined): string | null {
  const item = items.find((e) => !expectationLogged(e, dayLog));
  if (!item) return null;
  return expectationSentence(item);
}

export function expectationSentence(item: CycleExpectation): string {
  const { label, cyclesSeen: n, of } = item;
  if (item.kind === 'mood') {
    // Mood labels mix nouns („გაღიზიანება“) and adjectives („მშვიდი“), so the label is quoted as she picked it.
    return tx(
      `განწყობა „${label}“ დღეს სავარაუდოა — ბოლო ${of} ციკლიდან ${n}-ში ამ დღეებში ასე აღნიშნე`,
      `Mood “${label}” is likely today — you logged it around this day in ${n} of your last ${of} cycles`,
    );
  }
  return tx(
    `${label} დღეს სავარაუდოა — ბოლო ${of} ციკლიდან ${n}-ში ამ დღეებში გქონდა`,
    `${label} likely today — you had it around this day in ${n} of your last ${of} cycles`,
  );
}

/** Spoken hint on a dashed tile. */
export function expectationTileHint(item: CycleExpectation): string {
  return tx(
    `სავარაუდოა დღეს — ბოლო ${item.of} ციკლიდან ${item.cyclesSeen}-ში ამ დღეებში გქონდა. შეხება აღრიცხავს`,
    `Likely today — logged around this day in ${item.cyclesSeen} of your last ${item.of} cycles. Tap to log it`,
  );
}

/** Ids of one kind, in expectation order — the rows put them first. */
export function expectedIds(items: CycleExpectation[], kind: CycleExpectationKind): string[] {
  return items.filter((e) => e.kind === kind).map((e) => e.id);
}
