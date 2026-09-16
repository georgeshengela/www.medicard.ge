import { isHealthDataAvailableAsync, queryQuantitySamples, queryStatisticsForQuantity, queryStatisticsForQuantitySeparateBySource, requestAuthorization } from '@kingstinct/react-native-healthkit';
import { isManualHealthKitSample, originTotalsFromHealthKitSources, pickHighestOrigin } from '@/lib/tbilisiMoves/originPolicy.js';
import { competitionInterval } from '@/lib/tbilisiMoves/civilTime.js';
import type { SensorReading } from '@/lib/tbilisiMoves/types';

const STEP = 'HKQuantityTypeIdentifierStepCount' as const;

async function ensureStepRead(prompt: boolean): Promise<boolean> {
  try {
    const available = await isHealthDataAvailableAsync();
    if (!available) return false;
    if (prompt) {
      await requestAuthorization({ toShare: [], toRead: [STEP] });
    }
    return true;
  } catch {
    return false;
  }
}

function quantitySum(stat: { sumQuantity?: { quantity: number } } | null | undefined): number | null {
  const raw = stat?.sumQuantity?.quantity;
  if (raw == null || !Number.isFinite(raw)) return null;
  return Math.max(0, Math.round(raw));
}

export async function readCompetitionSteps(
  ymd: string,
  now = new Date(),
  opts?: { prompt?: boolean },
): Promise<SensorReading> {
  const interval = competitionInterval(ymd, now);
  const intervalStart = interval.start.toISOString();
  const intervalEnd = interval.end.toISOString();
  const recordedAt = now.toISOString();
  const base = { intervalStart, intervalEnd, tbilisiDate: ymd, recordedAt, provider: 'APPLE_HEALTH' as const };

  try {
    const ok = await ensureStepRead(Boolean(opts?.prompt));
    if (!ok) {
      return { kind: 'unavailable', ...base, note: 'HealthKit is not available on this device.' };
    }

    const filter = { date: { startDate: interval.start, endDate: interval.end } };
    const options = { unit: 'count' as const, filter };

    let samples: Array<{ metadata?: Record<string, unknown>; sourceRevision?: { source?: { bundleIdentifier?: string } } }> = [];
    try {
      samples = (await queryQuantitySamples(STEP, {
        limit: 0,
        ascending: false,
        unit: 'count',
        filter,
      })) as typeof samples;
    } catch {
      samples = [];
    }

    if (samples.length === 0) {
      const localStart = new Date(now);
      localStart.setHours(0, 0, 0, 0);
      try {
        samples = (await queryQuantitySamples(STEP, {
          limit: 0,
          ascending: false,
          unit: 'count',
          filter: { date: { startDate: localStart, endDate: now } },
        })) as typeof samples;
      } catch {
        samples = [];
      }
    }

    const nonManual = samples.filter((sample) => !isManualHealthKitSample(sample));
    if (samples.length > 0 && nonManual.length === 0) {
      return { kind: 'manual_only', ...base, note: 'HealthKit samples for this interval are marked HKWasUserEntered.' };
    }

    const allowedBundles = new Set(
      nonManual
        .map((sample) => sample.sourceRevision?.source?.bundleIdentifier)
        .filter((value): value is string => Boolean(value)),
    );

    try {
      const bySource = await queryStatisticsForQuantitySeparateBySource(STEP, ['cumulativeSum'], options);
      const rows = (bySource || []).filter((row) => {
        const bundle = row.source?.bundleIdentifier;
        if (!allowedBundles.size) return true;
        return !bundle || allowedBundles.has(bundle);
      });
      const totals = originTotalsFromHealthKitSources(rows);
      const winner = pickHighestOrigin(totals);
      if (winner) {
        return {
          kind: winner.steps === 0 ? 'zero' : 'ok',
          steps: winner.steps,
          origin: winner.origin,
          ...base,
          note: 'HealthKit statistics by source; highest single source. Statistics queries cannot always exclude HKWasUserEntered.',
        };
      }
    } catch {
      /* fall through to combined statistics */
    }

    const stat = await queryStatisticsForQuantity(STEP, ['cumulativeSum'], options);
    let steps = quantitySum(stat);
    if (steps == null || steps === 0) {
      const localStart = new Date(now);
      localStart.setHours(0, 0, 0, 0);
      const localStat = await queryStatisticsForQuantity(STEP, ['cumulativeSum'], {
        unit: 'count',
        filter: { date: { startDate: localStart, endDate: now } },
      });
      steps = quantitySum(localStat);
    }
    if (steps == null || steps === 0) {
      const { fetchStepsNative } = await import('@/lib/healthSyncPlatform.ios');
      const { homeStyleCompetitionSteps } = await import('@/lib/tbilisiMoves/originPolicy.js');
      const samples = await fetchStepsNative(interval.start);
      const homeSteps = homeStyleCompetitionSteps(
        samples,
        interval.start.getTime(),
        interval.end.getTime(),
        `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
      );
      if (homeSteps > 0) {
        return {
          kind: 'ok',
          steps: homeSteps,
          origin: 'healthkit-home-read',
          ...base,
          note: 'Same HealthKit step read as Home.',
        };
      }
    }
    if (steps == null) {
      return {
        kind: samples.length === 0 ? 'empty' : 'error',
        ...base,
        note: 'HealthKit statistics returned no quantity. Denied read access cannot be distinguished from no samples.',
      };
    }
    return {
      kind: steps === 0 ? 'zero' : 'ok',
      steps,
      origin: 'healthkit-statistics',
      ...base,
      note: 'HealthKit cumulativeSum for the Tbilisi interval. HKWasUserEntered is not filtered on the statistics query.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/denied|authorization|not authorized/i.test(message)) {
      return { kind: 'permission', ...base, note: message };
    }
    return { kind: 'error', ...base, note: message };
  }
}

export async function competitionSensorSupported(): Promise<boolean> {
  try {
    return await isHealthDataAvailableAsync();
  } catch {
    return false;
  }
}
