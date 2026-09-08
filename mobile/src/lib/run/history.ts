import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { LatLng, RunTarget } from '@/lib/run/geo';

const KEY = 'medicard.run.history.v1';
const MAX = 60;

export type RunSummary = {
  id: string;
  startedAt: string;
  endedAt: string;
  target: RunTarget;
  targetMeters: number;
  distanceM: number;
  movingMs: number;
  elapsedMs: number;
  calories: number;
  steps: number;
  paceSecPerKm: number | null;
  reachedPin: boolean;
  completedTarget: boolean;
  pin: LatLng | null;
  origin: LatLng | null;
  /** Down-sampled trail for the summary map. */
  path: LatLng[];
};

function parse(raw: string | null): RunSummary[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as RunSummary[]) : [];
  } catch {
    return [];
  }
}

export async function loadRunHistory(): Promise<RunSummary[]> {
  return parse(await getScopedPreference(KEY));
}

export async function saveRunSummary(summary: RunSummary): Promise<void> {
  const list = await loadRunHistory();
  const next = [summary, ...list.filter((r) => r.id !== summary.id)].slice(0, MAX);
  await setScopedPreference(KEY, JSON.stringify(next));
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
}

export async function getRunById(id: string): Promise<RunSummary | null> {
  if (!id) return null;
  const list = await loadRunHistory();
  return list.find((r) => r.id === id) ?? null;
}

export type RunTotals = { runs: number; distanceM: number; calories: number; pins: number; best: RunSummary | null };

export function runTotals(list: RunSummary[]): RunTotals {
  let distanceM = 0;
  let calories = 0;
  let pins = 0;
  let best: RunSummary | null = null;
  for (const r of list) {
    distanceM += r.distanceM;
    calories += r.calories;
    if (r.reachedPin) pins += 1;
    if (!best || r.distanceM > best.distanceM) best = r;
  }
  return { runs: list.length, distanceM, calories, pins, best };
}

/** Keep every Nth point so the stored trail stays small. */
export function downsamplePath(path: LatLng[], max = 240): LatLng[] {
  if (path.length <= max) return path;
  const step = path.length / max;
  const out: LatLng[] = [];
  for (let i = 0; i < path.length; i += step) out.push(path[Math.floor(i)]);
  if (out[out.length - 1] !== path[path.length - 1]) out.push(path[path.length - 1]);
  return out;
}
