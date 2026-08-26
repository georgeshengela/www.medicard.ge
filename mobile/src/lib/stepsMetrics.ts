import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { pullStoredHealth, syncNativeHealthToServer } from '@/lib/healthDataSync';
import {
  defaultSyncFromDate,
  defaultSyncToDate,
  mergeStepSamples,
  storedStepLogsToSamples,
  ymd,
} from '@/lib/healthMetricsStorage';
import { buildStepsBundle, sinceDateForPeriod } from '@/lib/stepsMetrics.shared';
import { isHealthSyncEnabled, getHealthPlatform } from '@/lib/healthSync';
import type { StepChartPeriod, StepSample, StepsMetricsBundle } from '@/types/stepsMetrics';

function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

async function stepsNativeImpl() {
  if (Platform.OS === 'ios') return import('@/lib/healthSyncPlatform.ios');
  if (Platform.OS === 'android') return import('@/lib/healthSyncPlatform.android');
  return null;
}

export async function fetchStepsSamples(since: Date): Promise<StepSample[]> {
  const connected = await isHealthSyncEnabled();
  if (!connected || isExpoGo()) return [];

  const impl = await stepsNativeImpl();
  if (!impl?.fetchStepsNative) return [];

  return impl.fetchStepsNative(since);
}

export async function fetchStepsMetrics(period: StepChartPeriod = '1d'): Promise<StepsMetricsBundle> {
  const deviceConnected = (await isHealthSyncEnabled()) && !isExpoGo();
  const since = sinceDateForPeriod(period);
  const sinceTs = since.getTime();

  let nativeSamples: StepSample[] = [];
  if (deviceConnected) {
    // Always pull at least 7 days for history; period controls chart grouping only.
    const fetchSince = new Date(Math.min(since.getTime(), Date.now() - 6 * 86_400_000));
    fetchSince.setHours(0, 0, 0, 0);
    nativeSamples = await fetchStepsSamples(fetchSince);
    void syncNativeHealthToServer({}, nativeSamples);
  }

  const stored = await pullStoredHealth(defaultSyncFromDate(), defaultSyncToDate());
  const storedSamples = storedStepLogsToSamples(stored.stepLogs).filter(
    (s) => new Date(s.at).getTime() >= sinceTs,
  );
  let merged = mergeStepSamples(nativeSamples, storedSamples);

  for (const row of stored.daily) {
    if (row.steps == null || row.steps <= 0) continue;
    if (new Date(`${row.date}T12:00:00`).getTime() < sinceTs) continue;
    const hasDay = merged.some((s) => ymd(new Date(s.at)) === row.date);
    if (!hasDay) {
      merged = mergeStepSamples(merged, [{ at: `${row.date}T12:00:00.000Z`, count: row.steps }]);
    }
  }

  const hasData = merged.length > 0 || stored.daily.some((d) => d.steps != null);

  return buildStepsBundle(merged, deviceConnected || hasData, period);
}

export { getHealthPlatform };
