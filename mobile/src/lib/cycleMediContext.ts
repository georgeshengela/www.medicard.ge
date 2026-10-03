/**
 * Medi with cycle context (W2-8 — brief §7 pillar 2, §9 wave 2 item 11, [კ-10]).
 *
 * When she opens Medi from a cycle entry point (the /cycle „ჰკითხე Medi-ს ციკლზე“ tile, the women's
 * Home question chips), her first question may carry a short, readable context: the cycle day, the
 * phase word (an estimate — „სავარაუდოდ“), how soon the next period / the fertile days are expected,
 * and TODAY's logged pain (places + strength) and moods. Nothing else, ever:
 *
 * - only keys the registry lets AI read (`isAiContextKey` — HEALTH sensitivity + the server's
 *   `aiDefaultAllowed`, parity-tested): sex and sex drive, intimate symptoms, discharge, mucus,
 *   OPK / pregnancy tests, BBT, notes / journal text and partner info never enter — the builder does
 *   not even read those fields;
 * - the Face ID / PIN cycle lock (or its state not known yet), privacy mode and discreet notifications
 *   → no context at all, only the question text;
 * - Tracking („მენსტრუაციას არ ველი“), a non-classic mode or a forecast that may not be shown → no
 *   phase and no forecast; the fertile-days display off (or contraception hiding it) → no fertile or
 *   ovulation words.
 *
 * It is the same category the AI consent manifest already names („ციკლის ან ორსულობის ინფორმაცია,
 * როცა ამ ფუნქციას იყენებ“), so the consent version does not change. The context travels in memory
 * (`mediHandoff.ts`), never in a route, and only through the consented `/api/ai/query` path; she sees
 * it as a removable chip in the composer before anything is sent.
 *
 * Pure (no React Native, relative imports): `node --experimental-strip-types --test` loads it.
 */
import type { CycleBundle, CycleLog, CyclePhaseKind } from './api';
import { MOOD_OPTIONS } from '../constants/cycle.ts';
import { ka } from '../i18n/ka.ts';
import { tx } from '../i18n/locale.js';
import { phaseFromBundle } from './cycleCanonical.ts';
import { bleedingIsUncertain, showFertilityUi, showPhaseAsBiological } from './cycleContraception.ts';
import { forecastPresentationAllowed, isTrackingOnly, suppressCycleLengthChrome } from './cycleForecastEligibility.js';
import { cycleModeCapabilities } from './cycleModes.js';
import { AI_CONTEXT_PAIN_SEVERITIES, AI_CONTEXT_PAIN_TYPES, isAiContextKey } from './cycleObservationRegistry.ts';
import { isBleedFlowValue } from './cyclePresentation.js';
import { cycleAheadModel, type AheadEvent } from './home/homeCycle.ts';

export type CycleMediPain = { type: (typeof AI_CONTEXT_PAIN_TYPES)[number]; severity: (typeof AI_CONTEXT_PAIN_SEVERITIES)[number] };

/** Everything that may travel — and nothing else. `text` is exactly what the AI receives. */
export type CycleMediContext = {
  day: number | null;
  phase: Exclude<CyclePhaseKind, 'unknown'> | null;
  /** The phase is her logged bleeding today (a fact), not an estimate. */
  phaseLogged: boolean;
  nextPeriod: { inDays: number; untilDays: number | null; ongoing: boolean } | null;
  fertile: { inDays: number; ongoing: boolean; wide: boolean } | null;
  pain: CycleMediPain[];
  moods: string[];
  /** Composer chip: „ციკლის კონტექსტი · დღე 12, სავარაუდოდ ფოლიკულური“. */
  chipLabel: string;
  /** The readable lines (shown when the chip is opened, and sent). */
  lines: string[];
  /** What `/api/ai/query` receives as `context` (the server wraps it as an untrusted client note). */
  text: string;
};

export type CycleMediContextInput = {
  bundle: CycleBundle | null | undefined;
  /** Civil today of the cycle screens (`cycleToday`). */
  today: string;
  /** Face ID / PIN cycle lock; `null` = not read yet → treated as locked. */
  locked: boolean | null;
  /** Privacy mode (`profile.privacyEnabled`), discreet / masked notifications. */
  privacy: boolean;
};

const MOOD_LABEL = new Map(MOOD_OPTIONS.map((o) => [o.id, o.label]));

function phaseWord(phase: Exclude<CyclePhaseKind, 'unknown'>): string {
  switch (phase) {
    case 'period':
      return tx('მენსტრუაცია', 'period');
    case 'follicular':
      return tx('ფოლიკულური', 'follicular');
    case 'fertile':
      return tx('ნაყოფიერი დღეები', 'fertile days');
    case 'ovulation':
      return tx('ოვულაცია', 'ovulation');
    case 'luteal':
      return tx('ლუთეალური', 'luteal');
  }
}

function soon(inDays: number, untilDays: number | null = null): string {
  if (untilDays != null && untilDays > inDays) {
    return inDays <= 0
      ? tx(`სავარაუდოდ ${untilDays} დღის განმავლობაში`, `likely within ${untilDays} days`)
      : tx(`სავარაუდოდ ${inDays}–${untilDays} დღეში`, `likely in ${inDays}–${untilDays} days`);
  }
  if (inDays <= 0) return tx('სავარაუდოდ დღეს', 'likely today');
  if (inDays === 1) return tx('სავარაუდოდ ხვალ', 'likely tomorrow');
  return tx(`სავარაუდოდ ${inDays} დღეში`, `likely in ${inDays} days`);
}

function painLabel(entry: CycleMediPain): string {
  const place =
    entry.type === 'other'
      ? tx('სხვა ტკივილი', 'Other pain')
      : ((ka.cycle.painType as Record<string, string>)[entry.type] ?? entry.type);
  const strength = (ka.cycle.painSeverity as Record<string, string>)[entry.severity] ?? entry.severity;
  return `${place} (${tx(strength, strength.toLowerCase())})`;
}

/** Today's pain, registry-filtered: one row per place, known places and strengths only. */
function todayPain(log: Pick<CycleLog, 'painEntries'> | null | undefined): CycleMediPain[] {
  if (!isAiContextKey('pain')) return [];
  const seen = new Set<string>();
  const out: CycleMediPain[] = [];
  for (const entry of log?.painEntries ?? []) {
    const type = String(entry?.type ?? '');
    const severity = String(entry?.severity ?? '');
    if (seen.has(type)) continue;
    if (!(AI_CONTEXT_PAIN_TYPES as readonly string[]).includes(type)) continue;
    if (!(AI_CONTEXT_PAIN_SEVERITIES as readonly string[]).includes(severity)) continue;
    seen.add(type);
    out.push({ type, severity } as CycleMediPain);
  }
  return out;
}

/** Today's moods, registry-filtered (an id the registry does not let AI read never passes). */
function todayMoods(log: Pick<CycleLog, 'moods'> | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of log?.moods ?? []) {
    const id = String(raw ?? '');
    if (!MOOD_LABEL.has(id) || !isAiContextKey(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * The context for a cycle entry point, or `null` when nothing may (or nothing useful can) travel.
 * Reads only: profile mode / Tracking / display gates, the server-stamped day and phase, the
 * forecast (`predictions`), and today's `painEntries` + `moods`.
 */
export function cycleMediContext({ bundle, today, locked, privacy }: CycleMediContextInput): CycleMediContext | null {
  if (locked !== false || privacy || !bundle) return null;

  const caps = cycleModeCapabilities(bundle.profile?.mode);
  const tracking = isTrackingOnly(bundle);
  const classic = Boolean(caps.showClassicCycleOverview) && !tracking && Boolean(bundle.profile?.lastPeriodStart);
  const forecast = classic && forecastPresentationAllowed(bundle);
  const fertilityVisible = forecast && showFertilityUi(bundle) && Boolean(caps.showFertileEstimates);
  const log = (bundle.logs ?? []).find((l) => l.date === today) ?? null;
  const bleedingToday = isBleedFlowValue(log?.flow);

  // Cycle day — not while the cycle length itself is still being learnt after a birth.
  const info = classic ? phaseFromBundle(bundle, today) : null;
  const day = classic && !suppressCycleLengthChrome(bundle) && info?.day != null && info.day > 0 ? info.day : null;

  // Phase word — an estimate, only where the cycle screen would show it as biology.
  let phase: CycleMediContext['phase'] = null;
  let phaseLogged = false;
  if (forecast && info && info.phase !== 'unknown' && showPhaseAsBiological(bundle)) {
    const fertileWord = info.phase === 'fertile' || info.phase === 'ovulation';
    if (!fertileWord || fertilityVisible) {
      phase = info.phase;
      phaseLogged = info.phase === 'period' && bleedingToday && !bleedingIsUncertain(bundle);
    }
  }

  // What's ahead — the same gates and model as Home's „წინ რა გელის“; ovulation is not sent.
  let nextPeriod: CycleMediContext['nextPeriod'] = null;
  let fertile: CycleMediContext['fertile'] = null;
  if (forecast) {
    const next = bundle.predictions?.nextPeriodStart ?? null;
    const events: AheadEvent[] = cycleAheadModel({
      today,
      phases: bundle.predictions?.phases,
      nextPeriodStart: next,
      nextPeriodEnd: bundle.predictions?.nextPeriodEnd ?? null,
      nextPeriodRange: bundle.predictions?.nextPeriodRange ?? null,
      onPeriod: bleedingToday,
      showPeriod: Boolean(next) && Boolean(caps.showNextPeriodForecast) && !bleedingIsUncertain(bundle),
      showFertility: fertilityVisible,
      showOvulation: false,
    });
    const p = events.find((e) => e.kind === 'period');
    if (p) {
      const range = bundle.predictions?.nextPeriodRange;
      const until = range?.from && range?.to && p.end ? Math.max(p.inDays, dayDiff(today, p.end)) : null;
      nextPeriod = { inDays: p.inDays, untilDays: until, ongoing: p.ongoing };
    }
    const f = events.find((e) => e.kind === 'fertile');
    if (f) fertile = { inDays: f.inDays, ongoing: f.ongoing, wide: Boolean(f.wide) };
  }

  const pain = todayPain(log);
  const moods = todayMoods(log);
  if (day == null && !phase && !nextPeriod && !fertile && !pain.length && !moods.length) return null;

  const phaseText = phase ? (phaseLogged ? phaseWord(phase) : tx(`სავარაუდოდ ${phaseWord(phase)}`, `likely ${phaseWord(phase)}`)) : null;

  const lines: string[] = [];
  if (day != null) lines.push(tx(`ციკლის დღე: ${day}`, `Cycle day: ${day}`));
  if (phaseText) lines.push(tx(`ფაზა: ${phaseText}`, `Phase: ${phaseText}`));
  if (nextPeriod) {
    const when = nextPeriod.ongoing
      ? tx('სავარაუდო ფანჯარა უკვე დაიწყო', 'the estimated window has started')
      : soon(nextPeriod.inDays, nextPeriod.untilDays);
    lines.push(tx(`შემდეგი მენსტრუაცია: ${when}`, `Next period: ${when}`));
  }
  if (fertile) {
    const when = fertile.ongoing ? tx('სავარაუდოდ ახლაა', 'likely now') : soon(fertile.inDays);
    const wide = fertile.wide ? tx(' (ფართო შეფასება)', ' (a wide estimate)') : '';
    lines.push(tx(`ნაყოფიერი დღეები: ${when}${wide}`, `Fertile days: ${when}${wide}`));
  }
  if (pain.length) lines.push(tx(`დღევანდელი ტკივილი: ${pain.map(painLabel).join(', ')}`, `Today's pain: ${pain.map(painLabel).join(', ')}`));
  if (moods.length) {
    const words = moods.map((id) => MOOD_LABEL.get(id) as string).join(', ');
    lines.push(tx(`დღევანდელი განწყობა: ${words}`, `Today's mood: ${words}`));
  }

  const summary: string[] = [];
  if (day != null) summary.push(tx(`დღე ${day}`, `day ${day}`));
  if (phaseText) summary.push(phaseText);
  if (!summary.length) {
    if (pain.length) summary.push(tx('დღევანდელი ტკივილი', "today's pain"));
    if (moods.length) summary.push(tx('განწყობა', 'mood'));
    if (!summary.length && nextPeriod) summary.push(tx('შემდეგი მენსტრუაცია', 'next period'));
    if (!summary.length && fertile) summary.push(tx('ნაყოფიერი დღეები', 'fertile days'));
  }
  const chipLabel = `${tx('ციკლის კონტექსტი', 'Cycle context')} · ${summary.join(', ')}`;

  const text = [
    tx(
      'ციკლის კონტექსტი, რომელიც მან ციკლის ეკრანიდან გაგიზიარა (აპის შეფასებებია და არა დიაგნოზი):',
      'Cycle context she shared from the cycle screen (app estimates, not a diagnosis):',
    ),
    ...lines.map((line) => `- ${line}`),
  ].join('\n');

  return { day, phase, phaseLogged, nextPeriod, fertile, pain, moods, chipLabel, lines, text };
}

function dayDiff(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}
