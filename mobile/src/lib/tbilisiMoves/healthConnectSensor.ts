import {
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from 'react-native-health-connect';
import { fetchStepsNative } from '@/lib/healthSyncPlatform.android';
import { competitionInterval } from '@/lib/tbilisiMoves/civilTime.js';
import {
  hasCompetitionStepsGrant,
  homeStyleCompetitionSteps,
  recordOverlapsInterval,
} from '@/lib/tbilisiMoves/originPolicy.js';
import type { SensorReading } from '@/lib/tbilisiMoves/types';

function localYmd(now: Date) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function samplesFromRecords(
  records: Array<{ count?: number; startTime?: string; endTime?: string }>,
  startMs: number,
  endMs: number,
) {
  return records
    .filter((record) => recordOverlapsInterval(record, startMs, endMs))
    .map((record) => ({
      at: String(record.startTime || record.endTime || ''),
      count: Math.max(0, Math.round(Number(record.count) || 0)),
    }))
    .filter((sample) => sample.at && sample.count > 0);
}

async function loadStepRecords(intervalStart: string, intervalEnd: string) {
  const between = await readRecords('Steps', {
    timeRangeFilter: {
      operator: 'between',
      startTime: intervalStart,
      endTime: intervalEnd,
    },
    ascendingOrder: true,
    pageSize: 5000,
  });
  const first = between.records ?? [];
  if (first.length) return first;

  const after = await readRecords('Steps', {
    timeRangeFilter: { operator: 'after', startTime: intervalStart },
    ascendingOrder: true,
    pageSize: 5000,
  });
  const startMs = new Date(intervalStart).getTime();
  const endMs = new Date(intervalEnd).getTime();
  return (after.records ?? []).filter((record) => recordOverlapsInterval(record, startMs, endMs));
}

export async function competitionSensorSupported(): Promise<boolean> {
  try {
    const status = await getSdkStatus();
    return status === SdkAvailabilityStatus.SDK_AVAILABLE;
  } catch {
    return false;
  }
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
  const startMs = interval.start.getTime();
  const endMs = interval.end.getTime();
  const base = { intervalStart, intervalEnd, tbilisiDate: ymd, recordedAt, provider: 'HEALTH_CONNECT' as const };

  try {
    const status = await getSdkStatus();
    if (status !== SdkAvailabilityStatus.SDK_AVAILABLE) {
      return { kind: 'unavailable', ...base, note: 'Health Connect is not available.' };
    }
    const ready = await initialize();
    if (!ready) return { kind: 'unavailable', ...base };

    let granted = await getGrantedPermissions().catch(() => []);
    if (!hasCompetitionStepsGrant(granted) && opts?.prompt) {
      granted = await requestPermission([
        { accessType: 'read', recordType: 'Steps' },
        { accessType: 'read', recordType: 'ReadHealthDataHistory' },
      ]).catch(() => granted);
    }

    const samples = await fetchStepsNative(interval.start);
    const homeSteps = homeStyleCompetitionSteps(samples, startMs, endMs, localYmd(now));
    if (homeSteps > 0) {
      return {
        kind: 'ok',
        steps: homeSteps,
        origin: 'health-connect',
        ...base,
        note: 'Same Health Connect Steps read as Home.',
      };
    }

    let records: Awaited<ReturnType<typeof readRecords>>['records'] = [];
    try {
      records = await loadStepRecords(intervalStart, intervalEnd);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/denied|permission/i.test(message) && homeSteps <= 0) {
        return { kind: 'permission', ...base, note: message };
      }
      if (homeSteps <= 0) return { kind: 'error', ...base, note: message };
    }

    const fallback = homeStyleCompetitionSteps(samplesFromRecords(records, startMs, endMs), startMs, endMs, localYmd(now));
    if (fallback > 0) {
      return {
        kind: 'ok',
        steps: fallback,
        origin: 'health-connect',
        ...base,
        note: 'Health Connect step records overlapping the competition interval.',
      };
    }

    if (!hasCompetitionStepsGrant(granted) && records.length === 0 && samples.length === 0) {
      return {
        kind: 'permission',
        ...base,
        note: 'Steps read is not granted.',
      };
    }

    return {
      kind: 'empty',
      ...base,
      note: 'Health Connect returned no overlapping step samples for this interval.',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/denied|permission/i.test(message)) return { kind: 'permission', ...base, note: message };
    return { kind: 'error', ...base, note: message };
  }
}
