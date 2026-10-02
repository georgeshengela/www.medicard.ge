/**
 * Pure helpers for the „აქტიური“ Home sections (movement hero, water + outdoors, MEDIRUN, MEDI QUEST).
 * No React Native: node tests load this file (`node --experimental-strip-types --test`).
 *
 * Day keys are always local `YYYY-MM-DD` with zero padding — the format of the stored health rows.
 * (`run/insights.ts` keys its buckets `YYYY-M-D`, so its keys are never matched against health rows.)
 */
import { tx } from '../../i18n/locale.js';
import { metersBetween } from '../geoPlace.ts';
import { dropDay, grandPercent, grandProgress, levelPercent, streetsLeftLabel, type GrandPrize } from '../medipulsi/grand.ts';
import { weekBuckets } from '../run/insights.ts';
import { weatherConditionLabel } from '../weather/copy.ts';
import { findBestOutdoorWindow } from '../weather/outdoorWindow.ts';
import {
  WEATHER_MOVE_INVALIDATE_M,
  WEATHER_STALE_ADVICE_MS,
  type OutdoorWindow,
  type WeatherCacheRecord,
  type WeatherCondition,
} from '../weather/types.ts';
import type { QuestDashboard, QuestItem } from '../quest/api.ts';

const NBSP = ' ';
const DAY_MS = 86_400_000;

/** „7 842“ — Hermes has no ka-GE grouping; a no-break space keeps the number on one line. */
export function groupThousands(n: number): string {
  const v = Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** One decimal, the MEDIRUN hub's own format („12.4“). */
export function kmText(km: number): string {
  return (Number.isFinite(km) && km > 0 ? km : 0).toFixed(1);
}

export function localYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAYS = tx(['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'], ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
const MONTHS = tx(
  ['იანვარი', 'თებერვალი', 'მარტი', 'აპრილი', 'მაისი', 'ივნისი', 'ივლისი', 'აგვისტო', 'სექტემბერი', 'ოქტომბერი', 'ნოემბერი', 'დეკემბერი'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
);

// ---------------------------------------------------------------------------
// Steps: 7-day bars
// ---------------------------------------------------------------------------

/** Stored daily rows → `{ 'YYYY-MM-DD': steps }` for the last `days` local days (rows without steps are left out). */
export function stepsByDay(
  daily: ReadonlyArray<{ date: string; steps: number | null | undefined }> | null | undefined,
  now = new Date(),
  days = 7,
): Record<string, number> {
  const keep = new Set<string>();
  for (let i = 0; i < days; i += 1) keep.add(localYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)));
  const out: Record<string, number> = {};
  for (const row of daily ?? []) {
    const key = String(row?.date ?? '').slice(0, 10);
    const steps = Number(row?.steps);
    if (!keep.has(key) || !Number.isFinite(steps) || steps <= 0) continue;
    out[key] = Math.round(steps);
  }
  return out;
}

export type StepsBar = { key: string; label: string; value: number | null; isToday: boolean };
export type StepsWeek = {
  bars: StepsBar[];
  /** Completed days (before today) that have a synced value. */
  pastDays: number;
  /** Average of those days; null below 3 days (a two-day "average" says nothing). */
  average: number | null;
  /** Value at the top of the chart (goal line sits at goal / scaleMax). */
  scaleMax: number;
};

/**
 * Six completed days from the stored rows + today from the live count. A day without a row is
 * `null` (drawn as a stub, never as 0). Today is excluded from the average (a partial day pulls it down).
 */
export function buildStepsWeek({
  rows,
  todayTotal,
  goal,
  now = new Date(),
}: {
  rows: Record<string, number>;
  todayTotal: number;
  goal: number;
  now?: Date;
}): StepsWeek {
  const bars: StepsBar[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = localYmd(day);
    const raw = i === 0 ? todayTotal : rows[key];
    const value = Number.isFinite(raw) && (raw as number) > 0 ? Math.round(raw as number) : null;
    bars.push({ key, label: WEEKDAYS[day.getDay()], value, isToday: i === 0 });
  }
  const past = bars.slice(0, 6).flatMap((bar) => (bar.value == null ? [] : [bar.value]));
  const average = past.length >= 3 ? Math.round(past.reduce((sum, v) => sum + v, 0) / past.length) : null;
  const peak = bars.reduce((max, bar) => Math.max(max, bar.value ?? 0), 0);
  const scaleMax = Math.max(goal > 0 ? goal * 1.25 : 0, peak * 1.05, 1);
  return { bars, pastDays: past.length, average, scaleMax };
}

/** Bar height in points; a real value never collapses below `minPx`. */
export function barHeight(value: number | null, scaleMax: number, maxPx: number, minPx = 6): number {
  if (value == null || !(value > 0) || !(scaleMax > 0)) return 0;
  return Math.max(minPx, Math.min(maxPx, Math.round((value / scaleMax) * maxPx)));
}

// ---------------------------------------------------------------------------
// MEDIRUN: this week from the local walk history
// ---------------------------------------------------------------------------

export type WalkRow = { startedAt: string; distanceM: number };
export type RunWeek = { weekKm: number; activeDays: number; hasHistory: boolean; last: WalkRow | null };

/** Last seven local days (the hub's own „ამ კვირაში“ definition, `weekBuckets`) and the latest walk. */
export function summarizeRunWeek(walks: ReadonlyArray<WalkRow>, now = new Date()): RunWeek {
  const valid = walks.filter((w) => Number.isFinite(new Date(w.startedAt).getTime()) && w.distanceM > 0);
  const week = weekBuckets(valid.map((w) => ({ startedAt: w.startedAt, meters: w.distanceM })), now);
  const meters = week.reduce((sum, day) => sum + day.meters, 0);
  let last: WalkRow | null = null;
  for (const walk of valid) {
    if (!last || new Date(walk.startedAt).getTime() > new Date(last.startedAt).getTime()) last = walk;
  }
  return {
    weekKm: meters / 1000,
    activeDays: week.filter((day) => day.meters > 0).length,
    hasHistory: valid.length > 0,
    last: last ? { startedAt: last.startedAt, distanceM: last.distanceM } : null,
  };
}

/** „დღეს“ / „გუშინ“ / „28 სექტემბერი“ (the year only when it differs). Local calendar days. */
export function walkDayLabel(startedAt: string, now = new Date()): string {
  const at = new Date(startedAt);
  if (!Number.isFinite(at.getTime())) return '';
  const day = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((today - day) / DAY_MS);
  if (diff === 0) return tx('დღეს', 'today');
  if (diff === 1) return tx('გუშინ', 'yesterday');
  const base = `${at.getDate()} ${MONTHS[at.getMonth()]}`;
  return at.getFullYear() === now.getFullYear() ? base : `${base} ${at.getFullYear()}`;
}

/** „ბოლო გასეირნება · გუშინ, 4.1 კმ“. */
export function lastWalkLine(last: WalkRow, now = new Date()): string {
  const day = walkDayLabel(last.startedAt, now);
  const km = kmText(last.distanceM / 1000);
  return tx(`ბოლო გასეირნება · ${day}, ${km} კმ`, `Last walk · ${day}, ${km} km`);
}

// ---------------------------------------------------------------------------
// MEDIRUN „გაანათე თბილისი“ row
// ---------------------------------------------------------------------------

/** The profile's city is Tbilisi (Georgian or English name). */
export function isTbilisiPlace(place: { cityKa?: string | null; cityName?: string | null } | null | undefined): boolean {
  const names = [place?.cityKa, place?.cityName].map((v) => String(v ?? '').trim().toLowerCase());
  return names.some((name) => name.includes('tbilisi') || name.includes('თბილის'));
}

/** Georgian dative of „31 დეკემბერი“ → „31 დეკემბერს“ (the nominative -ი drops before -ს). */
export function kaDative(dayMonth: string): string {
  const s = dayMonth.trim();
  if (!s) return s;
  return s.endsWith('ი') ? `${s.slice(0, -1)}ს` : `${s}ს`;
}

/** End of the drop's Tbilisi calendar day (Georgia is UTC+4 all year). */
export function dropDayEndMs(dropAt: string): number {
  const at = new Date(dropAt).getTime();
  if (!Number.isFinite(at)) return Number.NaN;
  const offset = 4 * 3600_000;
  const local = new Date(at + offset);
  return Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - offset;
}

export type CampaignRow = { name: string; percentLabel: string; progress: number; caption: string };

/**
 * The campaign row on the MEDIRUN card, or null. The app has no campaign calendar of its own, so
 * every date comes from `GET /api/medipulsi/grand`: hidden once the campaign ended (server status or
 * the drop day is over), for people who are not Tbilisi walkers (nothing lit and the profile city is
 * not Tbilisi) and whenever the endpoint has no answer.
 */
export function campaignRow(
  grand: GrandPrize | null | undefined,
  { tbilisiProfile, now = Date.now() }: { tbilisiProfile: boolean; now?: number },
): CampaignRow | null {
  const me = grand?.me;
  if (!grand || !me) return null;
  const status = grand.campaign?.status;
  if (status === 'ended') return null;
  const end = dropDayEndMs(grand.campaign.dropAt);
  if (!Number.isFinite(end) || now >= end) return null;
  if (!(me.percent > 0) && !tbilisiProfile) return null;
  const level = levelPercent(grand.requirement.percent);
  const day = dropDay(grand.campaign.dropAt);
  const caption = me.eligible
    ? status === 'live'
      ? tx('შენ ხედავ დიდ საჩუქარს', 'You can see the grand prize')
      : tx('შენ დაინახავ დიდ საჩუქარს', 'You’ll see the grand prize')
    : status === 'live'
      ? streetsLeftLabel(me.remainingStreetKm)
      : tx(`${level}-დან ${kaDative(day)} დიდი საჩუქარი გამოჩნდება`, `From ${level}, the grand prize appears on ${day}`);
  return {
    name: grand.campaign.name || tx('გაანათე თბილისი', 'Light up Tbilisi'),
    percentLabel: `${grandPercent(me.percent)} / ${level}`,
    progress: grandProgress(grand),
    caption,
  };
}

// ---------------------------------------------------------------------------
// Outdoors: the weather module's own best window, from the cached snapshot
// ---------------------------------------------------------------------------

export type OutdoorView = {
  window: OutdoorWindow | null;
  condition: WeatherCondition;
  isDay: boolean;
  temperatureC: number;
};

/**
 * What the outdoor tile may show from the weather device cache: nothing when the cache is for
 * another place (moved ≥ 2 km, the same rule as useWeather), older than the weather screen's
 * advice limit (90 min) or missing. The window is `findBestOutdoorWindow` — the same one /weather shows.
 */
export function outdoorView(
  record: WeatherCacheRecord | null | undefined,
  coords: { lat: number; lng: number } | null | undefined,
  now = new Date(),
): OutdoorView | null {
  if (!record?.snapshot || !coords) return null;
  if (!Number.isFinite(record.latitude) || !Number.isFinite(record.longitude)) return null;
  if (metersBetween({ lat: record.latitude, lng: record.longitude }, coords) >= WEATHER_MOVE_INVALIDATE_M) return null;
  const age = now.getTime() - record.fetchedAt;
  if (!Number.isFinite(age) || age < -60_000 || age > WEATHER_STALE_ADVICE_MS) return null;
  const current = record.snapshot.current;
  return {
    window: findBestOutdoorWindow(record.snapshot, now),
    condition: current.condition,
    isDay: current.isDay,
    temperatureC: Math.round(current.temperatureC),
  };
}

/** Condition name; a clear night is „მოწმენდილი“, not „მზიანი“. */
export function conditionText(condition: WeatherCondition, isDay: boolean): string {
  if (!isDay && (condition === 'clear' || condition === 'mostly_clear')) return tx('მოწმენდილი', 'Clear');
  return weatherConditionLabel(condition);
}

export function outdoorCopy(view: OutdoorView): { value: string; caption: string; detail: string } {
  const condition = conditionText(view.condition, view.isDay);
  const temp = `${view.temperatureC}°`;
  const w = view.window;
  if (!w) {
    return { value: temp, caption: tx('დღეს კარგი ფანჯარა ვერ ვიპოვე', 'No good window today'), detail: condition };
  }
  const caption =
    w.day === 'tomorrow'
      ? tx('ხვალ, კარგი დრო გარეთ', 'Tomorrow, a good time outside')
      : w.label === 'best'
        ? tx('საუკეთესო დრო გარეთ', 'Best time outside')
        : tx('კარგი დრო გარეთ', 'Good time outside');
  return { value: `${w.start}–${w.end}`, caption, detail: `${condition} · ${temp}` };
}

// ---------------------------------------------------------------------------
// MEDI QUEST summary
// ---------------------------------------------------------------------------

export type QuestWeekly = { title: string; progress: number; target: number; ratio: number; coins: number; claimed: boolean };
export type QuestSummary = {
  coins: number;
  level: number;
  dailyDone: number;
  dailyTotal: number;
  /** Rewards waiting (daily + weekly). */
  claimable: number;
  weekly: QuestWeekly | null;
};

function weeklyStepsQuest(dashboard: QuestDashboard): QuestItem | null {
  const list = (dashboard.weekly?.quests ?? []).filter((q) => q.status !== 'EXPIRED' && q.status !== 'CANCELLED');
  return list.find((q) => q.key === 'weekly_steps') ?? list.find((q) => q.progressType === 'STEPS') ?? null;
}

/** Null while the quest tables are unavailable for this account (the card then stays away). */
export function questSummary(dashboard: QuestDashboard | null | undefined): QuestSummary | null {
  if (!dashboard || dashboard.unavailable || !dashboard.profile) return null;
  const summary = dashboard.summary;
  const dailyTotal = Math.max(0, Math.round(summary?.dailyTotal ?? 0));
  const quest = weeklyStepsQuest(dashboard);
  let weekly: QuestWeekly | null = null;
  if (quest && quest.target > 0) {
    const progress = Math.max(0, Math.min(quest.progress, quest.target));
    weekly = {
      title: tx('კვირის ნაბიჯების მისია', 'Weekly steps mission'),
      progress,
      target: quest.target,
      ratio: Math.min(1, progress / quest.target),
      coins: Math.max(0, quest.rewardCoins || 0),
      claimed: quest.status === 'CLAIMED',
    };
  }
  return {
    coins: Math.max(0, Math.round(dashboard.profile.coinBalance || 0)),
    level: Math.max(1, Math.round(dashboard.profile.level || 1)),
    dailyDone: Math.min(dailyTotal, Math.max(0, Math.round(summary?.dailyCompleted ?? 0))),
    dailyTotal,
    claimable: Math.max(0, Math.round(summary?.unclaimedRewards ?? 0)),
    weekly,
  };
}

export function weeklyLine(weekly: QuestWeekly): string {
  const numbers = `${groupThousands(weekly.progress)} / ${groupThousands(weekly.target)}`;
  if (weekly.claimed) return tx(`${numbers} · ჯილდო მიღებულია`, `${numbers} · reward claimed`);
  return tx(`${numbers} · +${weekly.coins} მონეტა`, `${numbers} · +${weekly.coins} coins`);
}
