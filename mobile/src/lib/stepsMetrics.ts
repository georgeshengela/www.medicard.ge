import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getLastHealthPullMeta, pullStoredHealth, syncNativeHealthToServer } from '@/lib/healthDataSync';
import {
  defaultSyncFromDate,
  defaultSyncToDate,
  mergeStepSamples,
  storedStepLogsToSamples,
  ymd,
} from '@/lib/healthMetricsStorage';
import { describePersonalStepsOrigin } from '@/lib/personalStepsOrigin.js';
import { buildStepsBundle, sinceDateForPeriod } from '@/lib/stepsMetrics.shared';
import { isHealthSyncEnabled, setHealthSyncEnabled, getHealthPlatform } from '@/lib/healthSync';
import { tbilisiYmd } from '@/lib/tbilisiDate.js';
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
  if (isExpoGo()) return [];

  const impl = await stepsNativeImpl();
  if (!impl?.fetchStepsNative) return [];

  const samples = await impl.fetchStepsNative(since);
  if (samples.length && !(await isHealthSyncEnabled())) {
    await setHealthSyncEnabled(true);
  }
  return samples;
}

export async function fetchStepsMetrics(period: StepChartPeriod = '1d', opts?: { force?: boolean }): Promise<StepsMetricsBundle> {
  const nativeRuntime = !isExpoGo() && Platform.OS !== 'web';
  const since = sinceDateForPeriod(period);
  const sinceTs = since.getTime();

  let nativeSamples: StepSample[] = [];
  if (nativeRuntime) {
    // Always pull at least 7 days for history; period controls chart grouping only.
    const fetchSince = new Date(Math.min(since.getTime(), Date.now() - 6 * 86_400_000));
    fetchSince.setHours(0, 0, 0, 0);
    nativeSamples = await fetchStepsSamples(fetchSince);
    await syncNativeHealthToServer({}, nativeSamples);
  }
  const deviceConnected = nativeRuntime && ((await isHealthSyncEnabled()) || nativeSamples.length > 0);

  const stored = await pullStoredHealth(defaultSyncFromDate(), defaultSyncToDate(), opts);
  const storedSamples = storedStepLogsToSamples(stored.stepLogs).filter(
    (s) => new Date(s.at).getTime() >= sinceTs,
  );
  let merged = mergeStepSamples(nativeSamples, storedSamples);

  for (const row of stored.daily) {
    if (row.steps == null || row.steps <= 0) continue;
    if (new Date(`${row.date}T12:00:00`).getTime() < sinceTs) continue;
    const daySamples = merged.filter((sample) => ymd(new Date(sample.at)) === row.date);
    const daySum = daySamples.find((sample) => sample.daily)?.count
      ?? daySamples.reduce((sum, sample) => sum + sample.count, 0);
    if (!daySamples.length || row.steps >= daySum) {
      merged = merged.filter((sample) => ymd(new Date(sample.at)) !== row.date);
      merged = mergeStepSamples(merged, [{ at: `${row.date}T12:00:00.000Z`, count: row.steps, daily: true }]);
    }
  }

  const hasData = merged.length > 0 || stored.daily.some((d) => d.steps != null);
  const bundle = buildStepsBundle(merged, deviceConnected || hasData, period);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const todayKey = ymd(new Date());
    const dailyRow = stored.daily.find((row) => row.date === todayKey) ?? null;
    const todayLogs = stored.stepLogs.filter((log) => ymd(new Date(log.at)) === todayKey);
    console.log(
      '[steps-origin]',
      describePersonalStepsOrigin({
        expoGo: isExpoGo(),
        healthSyncEnabled: deviceConnected,
        nativeSampleCount: nativeSamples.length,
        deviceLocalYmd: todayKey,
        tbilisiYmd: tbilisiYmd(new Date()),
        dailyRow,
        todayStepLogCount: todayLogs.length,
        todayStepLogSum: todayLogs.reduce((sum, log) => sum + (Number(log.count) || 0), 0),
        displayTotal: bundle.todayTotal,
        pullKind: getLastHealthPullMeta().kind,
      }),
    );
  }

  return bundle;
}

export async function fetchStepsTotalBetween(fromYmd: string, toYmd: string): Promise<number> {
  const from = new Date(`${fromYmd}T00:00:00`);
  const stored = await pullStoredHealth(fromYmd, toYmd);
  const byDay = new Map<string, number>();

  for (const row of stored.daily) {
    if (row.date < fromYmd || row.date > toYmd || row.steps == null || row.steps <= 0) continue;
    byDay.set(row.date, row.steps);
  }

  const samples = await fetchStepsSamples(from);
  for (const sample of samples) {
    const day = ymd(new Date(sample.at));
    if (day < fromYmd || day > toYmd) continue;
    if (sample.daily) {
      byDay.set(day, sample.count);
      continue;
    }
    if (!byDay.has(day)) byDay.set(day, 0);
    if (!samples.some((s) => s.daily && ymd(new Date(s.at)) === day)) {
      byDay.set(day, (byDay.get(day) ?? 0) + sample.count);
    }
  }

  return [...byDay.values()].reduce((sum, n) => sum + n, 0);
}

export { getHealthPlatform };
