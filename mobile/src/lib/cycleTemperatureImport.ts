/**
 * Temperature from Apple Health / Health Connect → the cycle log (MEDICARD Cycle brief §9 „მერე“ item 5,
 * §4 convention #10; train 1.0.0.20, store build). Pure: node tests load it.
 *
 * - Off by default; cycle settings → პროფილი „ტემპერატურა Apple Health-იდან“ / „Health Connect-იდან“
 *   (TRACK_PERIOD and TRY_TO_CONCEIVE). The OS read permission is requested ONLY from that switch, after
 *   the one-button „გაგრძელება“ primer (`CycleTemperatureRow`, App Review 5.1.1(iv), iOS 26 rule).
 * - When on, /cycle focus imports at most once per 6 h (`shouldImportTemperature`), never from the
 *   background and never in a loop: the last-run time is written before the read.
 * - The last 40 days: BBT (°F → °C, plausible 35–39, the first reading of a day) is sent as BBT for days
 *   without her own typed BBT (typed always wins; the server checks again — `planTemperatureImport`);
 *   wrist / skin temperature is a deviation from her baseline and is sent as `wristTempDelta` — it never
 *   becomes BBT. Samples Medicard itself wrote to Health are dropped by the platform readers.
 * - The server marks imported BBT `bbtSource: 'health'`; both keys are SENSITIVE (never AI, partner,
 *   analytics) and only feed the retrospective thermal shift (`cycleTtcSignals.ts`, server
 *   `cycleTemperature.js`).
 */
import { tx } from '../i18n/locale.js';

export const TEMPERATURE_IMPORT_DAYS = 40;
export const TEMPERATURE_IMPORT_THROTTLE_MS = 6 * 60 * 60 * 1000;
export const TEMPERATURE_MODES = Object.freeze(['TRACK_PERIOD', 'TRY_TO_CONCEIVE'] as const);
export const BBT_PLAUSIBLE_MIN = 35;
export const BBT_PLAUSIBLE_MAX = 39;
export const WRIST_DELTA_MAX = 2.5;
/** iOS gives absolute sleeping wrist temperatures: a baseline needs at least this many nights. */
export const WRIST_BASELINE_MIN_NIGHTS = 5;

export type TemperatureUnit = 'degC' | 'degF';
/** One reading: a BBT, or an absolute sleeping wrist temperature (iOS). `at` = when it belongs. */
export type HealthTemperatureSample = { at: string | Date; value: number; unit?: TemperatureUnit };
/** A skin temperature deviation (Health Connect `SkinTemperatureRecord` deltas). */
export type HealthTemperatureDelta = { at: string | Date; delta: number; unit?: TemperatureUnit };
export type HealthTemperatureRead = {
  bbt: HealthTemperatureSample[];
  wrist: HealthTemperatureSample[];
  wristDeltas: HealthTemperatureDelta[];
};

export type TemperatureLog = {
  date: string;
  bbt?: number | null;
  observations?: { bbtSource?: string | null; wristTempDelta?: number | null } | null;
};

export type TemperatureReading = { date: string; bbt?: number; wristTempDelta?: number };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const centi = (value: number) => Math.round(value * 100);
const round2 = (value: number) => Math.round(value * 100) / 100;

export function toCelsius(value: number, unit: TemperatureUnit = 'degC'): number {
  return unit === 'degF' ? ((value - 32) * 5) / 9 : value;
}

/** A difference converts without the 32 offset. */
export function deltaToCelsius(delta: number, unit: TemperatureUnit = 'degC'): number {
  return unit === 'degF' ? (delta * 5) / 9 : delta;
}

export function isPlausibleBbt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= BBT_PLAUSIBLE_MIN && value <= BBT_PLAUSIBLE_MAX;
}

export function isPlausibleWristDelta(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= WRIST_DELTA_MAX;
}

/** The phone's civil day of an instant (`YYYY-MM-DD`, local time — like every cycle date). */
export function localDayKey(at: string | Date): string | null {
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function shiftDayKey(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** BBT per day in °C: the first (waking) reading of the day, plausible values only, 2 decimals. */
export function dailyBbt(samples: readonly HealthTemperatureSample[]): Map<string, number> {
  const first = new Map<string, { t: number; value: number }>();
  for (const s of samples ?? []) {
    const value = toCelsius(Number(s?.value), s?.unit);
    if (!isPlausibleBbt(value)) continue;
    const day = localDayKey(s.at);
    if (!day) continue;
    const t = new Date(s.at).getTime();
    const prev = first.get(day);
    if (!prev || t < prev.t) first.set(day, { t, value });
  }
  return new Map([...first.entries()].map(([day, { value }]) => [day, round2(value)]));
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[Math.floor(mid)] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Wrist temperature deviation per day (°C). Health Connect deltas are averaged per day as they are.
 * iOS absolute nightly values become deviations from her own median over the read window (needs ≥ 5
 * nights) — the shift rule only compares nights with each other, so the baseline choice cannot create
 * a shift. Never a BBT.
 */
export function dailyWristDeltas(read: Pick<HealthTemperatureRead, 'wrist' | 'wristDeltas'>): Map<string, number> {
  const out = new Map<string, number>();
  const deltas = new Map<string, number[]>();
  for (const s of read.wristDeltas ?? []) {
    const day = localDayKey(s.at);
    const delta = deltaToCelsius(Number(s?.delta), s?.unit);
    if (!day || !Number.isFinite(delta)) continue;
    deltas.set(day, [...(deltas.get(day) ?? []), delta]);
  }
  for (const [day, values] of deltas) {
    const value = round2(mean(values));
    if (isPlausibleWristDelta(value)) out.set(day, value);
  }

  const absolute = new Map<string, number[]>();
  for (const s of read.wrist ?? []) {
    const day = localDayKey(s.at);
    const raw = Number(s?.value);
    if (!day || !Number.isFinite(raw)) continue;
    // Defensive: a source that already reports a deviation (a few tenths around 0) is used as one.
    if (Math.abs(raw) <= WRIST_DELTA_MAX) {
      if (!deltas.has(day) && !out.has(day)) out.set(day, round2(deltaToCelsius(raw, s?.unit)));
      continue;
    }
    const value = toCelsius(raw, s?.unit);
    if (value < 25 || value > 42) continue;
    absolute.set(day, [...(absolute.get(day) ?? []), value]);
  }
  if (absolute.size >= WRIST_BASELINE_MIN_NIGHTS) {
    const nightly = new Map([...absolute.entries()].map(([day, values]) => [day, mean(values)]));
    const baseline = median([...nightly.values()]);
    for (const [day, value] of nightly) {
      if (out.has(day)) continue; // a platform delta wins over our own baseline
      const delta = round2(value - baseline);
      if (isPlausibleWristDelta(delta)) out.set(day, delta);
    }
  }
  return out;
}

/**
 * What to send: one reading per day of the last `days` days. Her typed BBT (a BBT without
 * `bbtSource: 'health'`) always wins; unchanged imported values are not resent; a wrist deviation is
 * only ever `wristTempDelta`. Days with nothing new are left out.
 */
export function planTemperatureReadings({
  logs,
  read,
  today,
  days = TEMPERATURE_IMPORT_DAYS,
}: {
  logs: readonly TemperatureLog[];
  read: HealthTemperatureRead;
  today: string;
  days?: number;
}): TemperatureReading[] {
  if (!DATE_KEY.test(today)) return [];
  const oldest = shiftDayKey(today, -(days - 1));
  const byDate = new Map((logs ?? []).filter((l) => l && DATE_KEY.test(l.date)).map((l) => [l.date, l]));
  const bbt = dailyBbt(read.bbt ?? []);
  const wrist = dailyWristDeltas(read);
  const dates = [...new Set([...bbt.keys(), ...wrist.keys()])].filter((d) => d >= oldest && d <= today).sort();
  const out: TemperatureReading[] = [];
  for (const date of dates) {
    const log = byDate.get(date);
    const reading: TemperatureReading = { date };
    const value = bbt.get(date);
    if (value != null) {
      const typed = log?.bbt != null && log.observations?.bbtSource !== 'health';
      const same = log?.bbt != null && centi(Number(log.bbt)) === centi(value);
      if (!typed && !same) reading.bbt = value;
    }
    const delta = wrist.get(date);
    if (delta != null) {
      const before = log?.observations?.wristTempDelta;
      if (typeof before !== 'number' || centi(before) !== centi(delta)) reading.wristTempDelta = delta;
    }
    if (reading.bbt != null || reading.wristTempDelta != null) out.push(reading);
  }
  return out;
}

/** The BBT a log save writes back to Health: never a value that came from Health unchanged. */
export function bbtForHealthWrite(bbt: number | null, fromHealth: number | null | undefined): number | null {
  if (bbt == null || fromHealth == null) return bbt;
  return centi(bbt) === centi(fromHealth) ? null : bbt;
}

export function temperatureModeAllowed(mode: string | null | undefined): boolean {
  return (TEMPERATURE_MODES as readonly string[]).includes(String(mode));
}

/** On, a mode that reads temperature, a supported phone, and ≥ 6 h since the last run (or never). */
export function shouldImportTemperature({
  enabled,
  mode,
  supported,
  lastAt,
  now,
}: {
  enabled: boolean;
  mode: string | null | undefined;
  supported: boolean;
  lastAt: number | null | undefined;
  now: number;
}): boolean {
  if (!enabled || !supported || !temperatureModeAllowed(mode)) return false;
  if (typeof lastAt !== 'number' || !Number.isFinite(lastAt) || lastAt <= 0) return true;
  // A clock set backwards must not open the gate early either.
  if (lastAt > now) return false;
  return now - lastAt >= TEMPERATURE_IMPORT_THROTTLE_MS;
}

type HealthOs = 'ios' | 'android' | string;

/** „ტემპერატურა Apple Health-იდან“ / „ტემპერატურა Health Connect-იდან“. */
export function temperatureRowLabel(os: HealthOs): string {
  return os === 'android'
    ? tx('ტემპერატურა Health Connect-იდან', 'Temperature from Health Connect')
    : tx('ტემპერატურა Apple Health-იდან', 'Temperature from Apple Health');
}

export function temperatureRowHint(os: HealthOs): string {
  return os === 'android'
    ? tx(
      'BBT და კანის ტემპერატურა ბოლო 40 დღიდან — ოვულაციას სავარაუდოდ, რეტროსპექტულად აჩვენებს. შენ მიერ ჩაწერილი BBT ყოველთვის რჩება.',
      'BBT and skin temperature from the last 40 days — shows ovulation as a likely, in-hindsight estimate. BBT you type in always stays.',
    )
    : tx(
      'BBT და ძილის დროს მაჯის ტემპერატურა ბოლო 40 დღიდან — ოვულაციას სავარაუდოდ, რეტროსპექტულად აჩვენებს. შენ მიერ ჩაწერილი BBT ყოველთვის რჩება.',
      'BBT and sleeping wrist temperature from the last 40 days — shows ovulation as a likely, in-hindsight estimate. BBT you type in always stays.',
    );
}

/** The day's BBT came from Health: „Apple Health-იდან“ / „Health Connect-იდან“. */
export function healthBbtSourceLabel(os: HealthOs): string {
  return os === 'android'
    ? tx('Health Connect-იდან', 'from Health Connect')
    : tx('Apple Health-იდან', 'from Apple Health');
}

/** Status after the switch: what happened, calmly (never an error tone for a „no“). */
export function temperatureStatusText(kind: 'on' | 'off' | 'denied' | 'unavailable' | 'error', os: HealthOs): string {
  const app = os === 'android' ? 'Health Connect' : 'Apple Health';
  switch (kind) {
    case 'on':
      return tx('ჩართულია — ციკლის გვერდის გახსნისას გადმოვიტანთ (არაუმეტეს 6 საათში ერთხელ).', 'On — we bring it in when you open the cycle page (at most once every 6 hours).');
    case 'off':
      return tx('გამორთულია. უკვე გადმოტანილი მნიშვნელობები ჩანაწერებში რჩება.', 'Off. Values already brought in stay in your log.');
    case 'denied':
      return tx(`${app}-ში წვდომა არ მოგვეცა — შეცვლა ${app}-ის პარამეტრებში შეგიძლია.`, `${app} did not give access — you can change this in ${app} settings.`);
    case 'unavailable':
      return tx(`${app} ამ ტელეფონზე მიუწვდომელია.`, `${app} is not available on this phone.`);
    default:
      return tx('ვერ ჩაირთო. სცადე ცოტა ხანში.', 'Could not turn on. Try again in a moment.');
  }
}
