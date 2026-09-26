/**
 * Pure MEDIRUN insights: weekly rhythm, streak, personal records, km splits
 * and route thumbnails. No React, no IO — unit-testable.
 */
import type { LatLng } from './geo';

export type WalkLike = { startedAt: string; meters: number; seconds?: number };
export type RecordRun = { id: string; startedAt: string; distanceM: number; movingMs: number; paceSecPerKm: number | null };

const WEEKDAYS = ['კვ', 'ორ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const DAY_MS = 86_400_000;

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function validDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export type DayBucket = { key: string; label: string; meters: number; isToday: boolean };

/** Last seven local days ending today, oldest first. */
export function weekBuckets(walks: WalkLike[], now = new Date()): DayBucket[] {
  const today = startOfDay(now);
  const days: DayBucket[] = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (6 - i));
    return { key: dayKey(day), label: WEEKDAYS[day.getDay()], meters: 0, isToday: i === 6 };
  });
  const index = new Map(days.map((d, i) => [d.key, i]));
  for (const walk of walks) {
    const date = validDate(walk.startedAt);
    if (!date || !(walk.meters > 0)) continue;
    const at = index.get(dayKey(date));
    if (at != null) days[at].meters += walk.meters;
  }
  return days;
}

/**
 * Consecutive local days with at least one walk. A streak survives until the
 * end of today, so a walk yesterday still counts while today is open.
 */
export function walkStreak(walks: WalkLike[], now = new Date()): number {
  const active = new Set<string>();
  for (const walk of walks) {
    const date = validDate(walk.startedAt);
    if (date && walk.meters > 0) active.add(dayKey(date));
  }
  const today = startOfDay(now);
  let cursor = active.has(dayKey(today)) ? today : new Date(today.getTime() - DAY_MS);
  let streak = 0;
  while (active.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - 1);
  }
  return streak;
}

/** Pace is only a fair record over a real distance. */
export const RECORD_PACE_MIN_M = 1000;

export type Records<T extends RecordRun> = { longest: T | null; fastest: T | null; longestTime: T | null };

export function personalRecords<T extends RecordRun>(runs: T[]): Records<T> {
  let longest: T | null = null;
  let fastest: T | null = null;
  let longestTime: T | null = null;
  for (const run of runs) {
    if (run.distanceM > 0 && (!longest || run.distanceM > longest.distanceM)) longest = run;
    if (run.movingMs > 0 && (!longestTime || run.movingMs > longestTime.movingMs)) longestTime = run;
    if (run.paceSecPerKm != null && run.distanceM >= RECORD_PACE_MIN_M && (!fastest || run.paceSecPerKm < (fastest.paceSecPerKm ?? Infinity))) fastest = run;
  }
  return { longest, fastest, longestTime };
}

export type RecordKind = 'distance' | 'pace' | 'time';

/** Records this run beats against every *other* run. The first walk sets none. */
export function recordsSetBy(run: RecordRun, all: RecordRun[]): RecordKind[] {
  const others = all.filter(r => r.id !== run.id);
  if (!others.length) return [];
  const best = personalRecords(others);
  const out: RecordKind[] = [];
  if (run.distanceM >= 200 && run.distanceM > (best.longest?.distanceM ?? 0)) out.push('distance');
  if (run.paceSecPerKm != null && run.distanceM >= RECORD_PACE_MIN_M && best.fastest?.paceSecPerKm != null && run.paceSecPerKm < best.fastest.paceSecPerKm) out.push('pace');
  if (run.movingMs >= 5 * 60_000 && run.movingMs > (best.longestTime?.movingMs ?? 0)) out.push('time');
  return out;
}

/**
 * `splits[i]` is the cumulative moving time (ms) when kilometre i+1 was
 * reached, or -1 when it was carried over from an earlier session. Returns
 * each kilometre's duration in ms, or null when unknown.
 */
export function splitDurations(splits: number[]): (number | null)[] {
  return splits.map((at, i) => {
    if (at < 0) return null;
    if (i === 0) return at;
    const prev = splits[i - 1];
    return prev < 0 ? null : Math.max(0, at - prev);
  });
}

/** Append kilometre marks crossed by `distanceM`. Returns the same array when nothing changed. */
export function advanceSplits(splits: number[], distanceM: number, movingMs: number): number[] {
  const reached = Math.floor(Math.max(0, distanceM) / 1000);
  if (reached <= splits.length) return splits;
  return [...splits, ...Array.from({ length: reached - splits.length }, () => movingMs)];
}

/**
 * Project GPS segments into an SVG path that fits `width`×`height`, keeping
 * the real aspect ratio (equirectangular around the route's latitude).
 */
export function routeThumbPath(segments: LatLng[][], width: number, height: number, pad = 6): string {
  const points = segments.flat();
  if (points.length < 2) return '';
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const k = Math.cos((points.reduce((s, p) => s + p.lat, 0) / points.length) * Math.PI / 180);
  const project = (p: LatLng) => ({ x: p.lng * k, y: -p.lat });
  for (const p of points) {
    const q = project(p);
    minX = Math.min(minX, q.x); maxX = Math.max(maxX, q.x);
    minY = Math.min(minY, q.y); maxY = Math.max(maxY, q.y);
  }
  const spanX = maxX - minX || 1e-9, spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2, offY = (height - spanY * scale) / 2;
  const fmt = (n: number) => Math.round(n * 10) / 10;
  return segments
    .filter(segment => segment.length > 1)
    .map(segment => segment.map((p, i) => {
      const q = project(p);
      return `${i ? 'L' : 'M'}${fmt(offX + (q.x - minX) * scale)} ${fmt(offY + (q.y - minY) * scale)}`;
    }).join(' '))
    .join(' ');
}

/** Georgian greeting line for the hub, by local hour. */
export function dayMoment(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'ღამის სიმშვიდე';
  if (h < 12) return 'დილის სიახლე';
  if (h < 17) return 'დღის რიტმი';
  if (h < 21) return 'საღამოს გასეირნება';
  return 'ღამის სიმშვიდე';
}
