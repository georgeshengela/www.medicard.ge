/**
 * „საშუალოდან დამალვა“ — Clue's „Hide this cycle“ (brief §9 „მერე“ item 6), app side.
 *
 * The server keeps `profile.hiddenCycles` (cycle start dates, only real logged starts) and leaves those
 * cycles out of every average and forecast (server/src/lib/cycleHiddenCycles.js). Here: what the history
 * list shows and the whole list a one-tap toggle sends (`PUT /api/cycle/profile { hiddenCycles }`).
 * The app never asks why a cycle is hidden. Pure: node tests load it.
 */

/** Same cap as the server (MAX_HIDDEN_CYCLES). */
export const MAX_HIDDEN_CYCLES = 24;

type BundleLike = {
  profile?: { hiddenCycles?: string[] | null } | null;
  inferred?: { periodStarts?: string[] | null } | null;
  periodRanges?: { start: string; hidden?: boolean }[] | null;
} | null | undefined;

/** Hidden starts the server confirmed (real logged starts only), sorted. */
export function hiddenCyclesOf(bundle: BundleLike): string[] {
  const list = Array.isArray(bundle?.profile?.hiddenCycles) ? bundle!.profile!.hiddenCycles! : [];
  const fromRanges = (bundle?.periodRanges ?? []).filter((r) => r?.hidden === true).map((r) => r.start);
  return [...new Set([...list, ...fromRanges].map(String))].sort();
}

export function isCycleHidden(bundle: BundleLike, start: string): boolean {
  return hiddenCyclesOf(bundle).includes(start);
}

/** How many cycles she hid — the stats card footnote. */
export function hiddenCycleCount(bundle: BundleLike): number {
  return hiddenCyclesOf(bundle).length;
}

/**
 * Whether a history row can offer the toggle: the server must know the start (an older server sends no
 * `hiddenCycles` at all → no toggle), and a new hide must stay within the cap. „დაბრუნება“ is always allowed.
 */
export function canToggleHiddenCycle(bundle: BundleLike, start: string): boolean {
  if (!Array.isArray(bundle?.profile?.hiddenCycles)) return false;
  const starts = bundle?.inferred?.periodStarts ?? (bundle?.periodRanges ?? []).map((r) => r.start);
  if (!starts.includes(start)) return false;
  if (isCycleHidden(bundle, start)) return true;
  return hiddenCycleCount(bundle) < MAX_HIDDEN_CYCLES;
}

/** The whole list to send after one tap (hide → add, return → remove). */
export function nextHiddenCycles(current: readonly string[], start: string, hide: boolean): string[] {
  const set = new Set(current.map(String));
  if (hide) set.add(start);
  else set.delete(start);
  return [...set].sort();
}

