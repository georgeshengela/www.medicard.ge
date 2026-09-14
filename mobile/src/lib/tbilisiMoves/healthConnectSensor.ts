import {
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  RecordingMethod,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { competitionInterval } from '@/lib/tbilisiMoves/civilTime.js';
import { originTotalsFromHealthConnectRecords, pickHighestOrigin } from '@/lib/tbilisiMoves/originPolicy.js';
import type { SensorReading } from '@/lib/tbilisiMoves/types';

function hasStepsRead(granted: Array<{ accessType?: string; recordType?: string }>) {
  return granted.some((item) => item.recordType === 'Steps' && item.accessType === 'read');
}

export async function competitionSensorSupported(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
}

export async function readCompetitionSteps(ymd: string, now = new Date()): Promise<SensorReading> {
  const interval = competitionInterval(ymd, now);
  const intervalStart = interval.start.toISOString();
  const intervalEnd = interval.end.toISOString();
  const recordedAt = now.toISOString();
  const base = { intervalStart, intervalEnd, tbilisiDate: ymd, recordedAt, provider: 'HEALTH_CONNECT' as const };

  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { kind: 'unavailable', ...base, note: 'Health Connect is not available.' };
    }
    const ready = await initialize();
    if (!ready) return { kind: 'unavailable', ...base };

    const granted = await getGrantedPermissions().catch(() => []);
    if (!hasStepsRead(granted)) {
      return {
        kind: 'permission',
        ...base,
        note: 'Steps read is not granted. Health Connect cannot always distinguish denial from empty data after a grant.',
      };
    }

    const timeRangeFilter = {
      operator: 'between' as const,
      startTime: intervalStart,
      endTime: intervalEnd,
    };

    const result = await readRecords('Steps', {
      timeRangeFilter,
      ascendingOrder: true,
      pageSize: 5000,
    });
    const records = result.records ?? [];
    const { totals, manualCount, sensorCount } = originTotalsFromHealthConnectRecords(records);

    if (records.length > 0 && sensorCount === 0) {
      return { kind: 'manual_only', ...base, note: 'All Health Connect step records for this interval are MANUAL_ENTRY.' };
    }

    const origins = totals.map((row) => row.origin).filter((origin) => origin && origin !== '_unknown');
    if (origins.length) {
      let best: { origin: string; steps: number } | null = null;
      for (const origin of origins) {
        try {
          const agg = await aggregateRecord({
            recordType: 'Steps',
            timeRangeFilter,
            dataOriginFilter: [origin],
          });
          const steps = Math.max(0, Math.round(Number(agg.COUNT_TOTAL) || 0));
          if (!best || steps > best.steps) best = { origin, steps };
        } catch {
          /* originPolicy fallback below */
        }
      }
      if (best) {
        return {
          kind: best.steps === 0 ? 'zero' : 'ok',
          steps: best.steps,
          origin: best.origin,
          ...base,
          note: 'Health Connect aggregateRecord per data origin; highest single origin. Manual records excluded from origin list.',
        };
      }
    }

    const winner = pickHighestOrigin(totals);
    if (!winner) {
      return {
        kind: records.length === 0 ? 'empty' : 'error',
        ...base,
        note:
          records.length === 0
            ? 'No step records in the Tbilisi interval. Denied access and empty data cannot always be distinguished.'
            : 'No usable non-manual origin total.',
      };
    }
    return {
      kind: winner.steps === 0 ? 'zero' : 'ok',
      steps: winner.steps,
      origin: winner.origin,
      ...base,
      note: `Highest single origin after excluding recordingMethod=${RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY}. Overlapping samples in one origin use max-in-cluster, not a naive sum.`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/denied|permission/i.test(message)) return { kind: 'permission', ...base, note: message };
    return { kind: 'error', ...base, note: message };
  }
}
