import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { SensorReading } from '@/lib/tbilisiMoves/types';
import { competitionInterval } from '@/lib/tbilisiMoves/civilTime.js';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

/** HealthKit / Health Connect can only run in a development or store build. */
export function isNativeCompetitionRuntime(): boolean {
  return !isExpoGo() && Platform.OS !== 'web';
}

function unsupported(ymd: string, now = new Date()): SensorReading {
  const interval = competitionInterval(ymd, now);
  return {
    kind: 'unsupported',
    intervalStart: interval.start.toISOString(),
    intervalEnd: interval.end.toISOString(),
    tbilisiDate: ymd,
    recordedAt: now.toISOString(),
    note:
      Platform.OS === 'web' || isExpoGo()
        ? 'Competition steps need a development build with HealthKit or Health Connect. Expo Go / web cannot read native sensors.'
        : 'Native health APIs are not available in this runtime. Use a development or production build.',
  };
}

async function nativeImpl() {
  if (isExpoGo()) return null;
  if (Platform.OS === 'ios') return import('@/lib/tbilisiMoves/healthKitSensor');
  if (Platform.OS === 'android') return import('@/lib/tbilisiMoves/healthConnectSensor');
  return null;
}

/** Personal HealthMetricDaily / StepLog are never a competition source. */

export async function competitionSensorSupported(): Promise<boolean> {
  try {
    const impl = await nativeImpl();
    if (!impl) return false;
    return impl.competitionSensorSupported();
  } catch {
    return false;
  }
}

export type CompetitionSensorReadOptions = {
  /** OS permission sheets only from enroll / explicit retry. Foreground retries stay silent. */
  prompt?: boolean;
};

export async function readCompetitionSteps(
  ymd: string,
  now = new Date(),
  opts?: CompetitionSensorReadOptions,
): Promise<SensorReading> {
  try {
    const impl = await nativeImpl();
    if (!impl) return unsupported(ymd, now);
    return impl.readCompetitionSteps(ymd, now, opts);
  } catch {
    return unsupported(ymd, now);
  }
}
