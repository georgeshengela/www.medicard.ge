import { getScopedPreference, setScopedPreference } from '@/lib/localAccount';
import type { LatLng, RunTarget } from '@/lib/run/geo';
import { downsamplePath } from '@/lib/run/history';
import type { RunRoute } from '@/lib/run/mapbox';

const KEY = 'medicard.run.active.v1';

/** Snapshot of a live run — survives kill / cold start until finish or cancel. */
export type PersistedActiveRun = {
  v: 1;
  phase: 'running' | 'paused';
  target: RunTarget;
  targetMeters: number;
  origin: LatLng;
  pin: LatLng | null;
  route: RunRoute | null;
  routed: boolean;
  expectedDistanceM: number;
  path: LatLng[];
  current: LatLng | null;
  headingDeg: number | null;
  accuracyM: number | null;
  distanceM: number;
  /** Accumulated moving time excluding the open segment. */
  movingAccumMs: number;
  startedAt: number;
  reachedPin: boolean;
  reachedAt: number | null;
  completedTarget: boolean;
  weightKg: number | null;
  heightCm: number | null;
  savedAt: number;
};

function parse(raw: string | null): PersistedActiveRun | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as PersistedActiveRun;
    if (data?.v !== 1) return null;
    if (data.phase !== 'running' && data.phase !== 'paused') return null;
    if (!data.target || !data.origin || !data.startedAt) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loadActiveRun(): Promise<PersistedActiveRun | null> {
  return parse(await getScopedPreference(KEY));
}

export async function saveActiveRun(snap: PersistedActiveRun): Promise<void> {
  const trimmed: PersistedActiveRun = {
    ...snap,
    path: downsamplePath(snap.path, 320),
    route: snap.route
      ? {
          ...snap.route,
          coords: downsampleRouteCoords(snap.route.coords, 280),
        }
      : null,
    savedAt: Date.now(),
  };
  await setScopedPreference(KEY, JSON.stringify(trimmed));
}

export async function clearActiveRun(): Promise<void> {
  await setScopedPreference(KEY, '');
}

function downsampleRouteCoords(coords: [number, number][], max: number): [number, number][] {
  if (coords.length <= max) return coords;
  const step = coords.length / max;
  const out: [number, number][] = [];
  for (let i = 0; i < coords.length; i += step) out.push(coords[Math.floor(i)]);
  const last = coords[coords.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}
