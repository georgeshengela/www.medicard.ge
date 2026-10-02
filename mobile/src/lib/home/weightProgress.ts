/**
 * Pure helpers for the Home weight card („წონა და მიზანი“, layout „კვება და წონა“).
 * No React Native, so node tests load it.
 *
 * Tone rules (ED-safe): progress only ever counts movement toward the goal; moving away is never
 * shown as a negative number, there is no "behind schedule", no percent text, and the sparkline
 * never magnifies a few hundred grams into a cliff (its vertical range is at least 1 kg).
 */
import { addDaysYmd, buildWeightProgress } from '../weightGoal.shared.ts';
import type { NutritionDashboard } from '../nutritionProgram.ts';
import type { WeightGoal, WeightLog } from '@/types/weightGoal';

export type CurrentWeight = {
  kg: number;
  /** YYYY-MM-DD; null when the value only comes from the onboarding profile. */
  date: string | null;
  source: 'measurement' | 'weight_log' | 'profile';
};

type ServerCurrent = NutritionDashboard['facts']['current'];

const plausible = (kg: unknown): kg is number => typeof kg === 'number' && Number.isFinite(kg) && kg >= 20 && kg <= 300;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** The newest weigh-in the person typed on this device (`wlog-` ids; `wseed-` rows are derived seeds). */
export function latestUserLog(logs: readonly WeightLog[] | null | undefined, today: string): WeightLog | null {
  const own = (logs ?? []).filter((row) => row?.id?.startsWith('wlog-') && plausible(row.kg) && row.date <= today);
  own.sort((a, b) => (a.date === b.date ? b.at.localeCompare(a.at) : b.date.localeCompare(a.date)));
  return own[0] ?? null;
}

/**
 * One current weight for the card.
 * 1. A weigh-in just saved on Home (until the dashboard answer that includes it lands).
 * 2. The dashboard's `facts.current` (server: daily measurement ≥ shared log ≥ profile) — unless this
 *    device holds a newer typed log that has not reached the server yet.
 * 3. Local typed log, then the profile weight.
 */
export function pickCurrentWeight({
  server,
  logs,
  profileKg,
  saved,
  today,
}: {
  server: ServerCurrent | null | undefined;
  logs: readonly WeightLog[] | null | undefined;
  profileKg: number | null | undefined;
  saved?: { kg: number; date: string } | null;
  today: string;
}): CurrentWeight | null {
  if (saved && plausible(saved.kg)) return { kg: saved.kg, date: saved.date, source: 'weight_log' };
  const local = latestUserLog(logs, today);
  const fromServer = server && plausible(server.kg) ? server : null;
  if (fromServer && fromServer.source !== 'profile' && fromServer.date) {
    if (local && local.date > fromServer.date) return { kg: local.kg, date: local.date, source: 'weight_log' };
    return {
      kg: fromServer.kg,
      date: fromServer.date,
      source: fromServer.source === 'measurement' ? 'measurement' : 'weight_log',
    };
  }
  if (local) return { kg: local.kg, date: local.date, source: 'weight_log' };
  if (fromServer) return { kg: fromServer.kg, date: null, source: 'profile' };
  if (plausible(profileKg)) return { kg: profileKg, date: null, source: 'profile' };
  return null;
}

export type WeighInWhen = { kind: 'profile' } | { kind: 'today' } | { kind: 'yesterday' } | { kind: 'date'; date: string };

export function weighInWhen(current: CurrentWeight, today: string): WeighInWhen {
  if (current.source === 'profile' || !current.date) return { kind: 'profile' };
  if (current.date === today) return { kind: 'today' };
  if (current.date === addDaysYmd(today, -1)) return { kind: 'yesterday' };
  return { kind: 'date', date: current.date };
}

export type WeightGoalView =
  | { kind: 'none' }
  | { kind: 'maintain'; targetKg: number }
  | { kind: 'reached'; startKg: number; targetKg: number }
  | { kind: 'progress'; startKg: number; targetKg: number; percent: number; movedKg: number; remainingKg: number };

/** Below this start↔target gap the goal is "keep my weight": a percent bar would be meaningless. */
export const MAINTAIN_GAP_KG = 0.5;

export function weightGoalView(goal: WeightGoal | null | undefined, currentKg: number): WeightGoalView {
  if (!goal || !plausible(goal.targetKg) || !plausible(goal.startKg)) return { kind: 'none' };
  const { startKg, targetKg } = goal;
  if (Math.abs(startKg - targetKg) < MAINTAIN_GAP_KG) return { kind: 'maintain', targetKg };
  const losing = targetKg < startKg;
  const passed = losing ? currentKg <= targetKg : currentKg >= targetKg;
  const progress = buildWeightProgress(goal, currentKg);
  if (passed || progress.completed) return { kind: 'reached', startKg, targetKg };
  const toward = losing ? currentKg <= startKg : currentKg >= startKg;
  return {
    kind: 'progress',
    startKg,
    targetKg,
    percent: progress.percent,
    movedKg: toward ? round1(Math.abs(startKg - currentKg)) : 0,
    remainingKg: progress.remaining,
  };
}

/**
 * Points for the sparkline, oldest first: the dashboard history (≤ 28, server wins on a date), gaps
 * filled from this device's logs, and the shown current weight as the last point so line and number agree.
 */
export function weightSeries({
  history,
  logs,
  current,
  limit = 28,
}: {
  history: readonly { date: string; weightKg: number }[] | null | undefined;
  logs: readonly WeightLog[] | null | undefined;
  current: CurrentWeight | null;
  limit?: number;
}): { date: string; kg: number }[] {
  const byDate = new Map<string, number>();
  for (const row of history ?? []) if (row?.date && plausible(row.weightKg)) byDate.set(row.date, row.weightKg);
  for (const row of logs ?? []) if (row?.date && plausible(row.kg) && !byDate.has(row.date)) byDate.set(row.date, row.kg);
  if (current?.date && current.source !== 'profile') byDate.set(current.date, current.kg);
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-limit)
    .map(([date, kg]) => ({ date, kg }));
}

/** Minimum number of weigh-ins before a line is drawn. */
export const SPARKLINE_MIN_POINTS = 3;

/** x/y for a polyline inside `width × height` with `pad` inset; the vertical range is at least `minRangeKg`. */
export function sparklinePoints(values: readonly number[], width: number, height: number, pad = 6, minRangeKg = 1): { x: number; y: number }[] {
  const n = values.length;
  if (n < 2 || width <= pad * 2 || height <= pad * 2) return [];
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < minRangeKg) {
    const mid = (max + min) / 2;
    min = mid - minRangeKg / 2;
    max = mid + minRangeKg / 2;
  }
  const w = width - pad * 2;
  const h = height - pad * 2;
  return values.map((v, i) => ({
    x: Math.round((pad + (i / (n - 1)) * w) * 10) / 10,
    y: Math.round((pad + ((max - v) / (max - min)) * h) * 10) / 10,
  }));
}

/**
 * „ორიენტირი … — დაახლოებით <date>“ — only under the hub's own rule (a plan with today's targets,
 * i.e. `targets != null`), only while the goal is still ahead, and only when the server's projection
 * was computed for the same target the card shows (a goal edited on this device may not be synced yet).
 */
export function weightEta(
  dashboard: Pick<NutritionDashboard, 'targets' | 'projection'> | null | undefined,
  view: WeightGoalView,
): { kind: 'trend' | 'plan'; date: string } | null {
  if (!dashboard || dashboard.targets == null || view.kind !== 'progress') return null;
  const p = dashboard.projection;
  if (!p || p.direction === 'reached') return null;
  if (p.target != null && Math.abs(p.target - view.targetKg) > 0.05) return null;
  if (p.trendEta) return { kind: 'trend', date: p.trendEta };
  if (p.planEta) return { kind: 'plan', date: p.planEta };
  return null;
}
