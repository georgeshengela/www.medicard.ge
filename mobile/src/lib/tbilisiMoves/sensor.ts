import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { SensorReading } from '@/lib/tbilisiMoves/types';
import { competitionInterval, tbilisiYmd } from '@/lib/tbilisiMoves/civilTime.js';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** Native HealthKit / Health Connect can write personal daily steps. Expo Go cannot. */
export function isNativeHealthPushRuntime(): boolean {
  return !isExpoGo() && Platform.OS !== 'web';
}

/** District war follows stored daily steps on phone, Expo Go, and web. */
export function isNativeCompetitionRuntime(): boolean {
  return true;
}

function competitionProvider(): SensorReading['provider'] {
  return Platform.OS === 'ios' ? 'APPLE_HEALTH' : 'HEALTH_CONNECT';
}

function emptyReading(ymd: string, now = new Date(), note?: string): SensorReading {
  const interval = competitionInterval(ymd, now);
  return {
    kind: 'empty',
    steps: 0,
    intervalStart: interval.start.toISOString(),
    intervalEnd: interval.end.toISOString(),
    tbilisiDate: ymd,
    recordedAt: now.toISOString(),
    provider: competitionProvider(),
    origin: 'medicard-health-metrics',
    note: note || 'No stored daily steps for this date.',
  };
}

function okReading(ymd: string, now: Date, steps: number): SensorReading {
  const interval = competitionInterval(ymd, now);
  return {
    kind: 'ok',
    steps,
    intervalStart: interval.start.toISOString(),
    intervalEnd: interval.end.toISOString(),
    tbilisiDate: ymd,
    recordedAt: now.toISOString(),
    provider: competitionProvider(),
    origin: 'medicard-health-metrics',
  };
}

/**
 * Competition total is the same HealthMetricDaily number Home already loaded.
 * Does not re-fetch Home/hydration — uses the stored daily pull only.
 */
export async function competitionSensorSupported(): Promise<boolean> {
  return Platform.OS !== 'web';
}

export type CompetitionSensorReadOptions = {
  prompt?: boolean;
};

export async function readCompetitionSteps(
  ymd: string,
  now = new Date(),
  _opts?: CompetitionSensorReadOptions,
): Promise<SensorReading> {
  if (Platform.OS === 'web') {
    return { ...emptyReading(ymd, now, 'Web does not credit district steps.'), kind: 'unsupported' };
  }

  try {
    const { pullStoredHealth } = await import('@/lib/healthDataSync');
    const stored = await pullStoredHealth(ymd, ymd);
    const daily = stored.daily.find((row) => row.date === ymd);
    const logSum = stored.stepLogs
      .filter((log) => tbilisiYmd(new Date(log.at)) === ymd || String(log.at).slice(0, 10) === ymd)
      .reduce((sum, log) => sum + Math.max(0, Math.round(Number(log.count) || 0)), 0);
    const steps = Math.max(
      0,
      Math.round(Number(daily?.steps) || 0),
      logSum,
    );
    if (steps <= 0) return emptyReading(ymd, now);
    return okReading(ymd, now, steps);
  } catch {
    return emptyReading(ymd, now);
  }
}
