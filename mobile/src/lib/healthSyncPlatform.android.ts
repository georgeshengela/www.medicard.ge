import {
  dateToYmd,
  eighteenMonthsAgo,
  type CycleHealthPayload,
  type HealthConnectResult,
  ymdToLocalNoon,
} from '@/lib/healthSync.shared';
import { weekStart } from '@/lib/healthMetrics.shared';
import type { HealthMetricKey, HealthMetricPoint } from '@/types/healthMetrics';
import type { StepSample } from '@/types/stepsMetrics';

const PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'MenstruationFlow' as const },
  { accessType: 'write' as const, recordType: 'MenstruationFlow' as const },
  { accessType: 'read' as const, recordType: 'MenstruationPeriod' as const },
  { accessType: 'write' as const, recordType: 'MenstruationPeriod' as const },
  { accessType: 'read' as const, recordType: 'IntermenstrualBleeding' as const },
  { accessType: 'write' as const, recordType: 'IntermenstrualBleeding' as const },
  { accessType: 'read' as const, recordType: 'BasalBodyTemperature' as const },
  { accessType: 'write' as const, recordType: 'BasalBodyTemperature' as const },
  { accessType: 'read' as const, recordType: 'CervicalMucus' as const },
  { accessType: 'write' as const, recordType: 'CervicalMucus' as const },
  { accessType: 'read' as const, recordType: 'Weight' as const },
  { accessType: 'read' as const, recordType: 'BloodPressure' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
  { accessType: 'read' as const, recordType: 'RestingHeartRate' as const },
  { accessType: 'read' as const, recordType: 'SleepSession' as const },
  { accessType: 'read' as const, recordType: 'Nutrition' as const },
  { accessType: 'read' as const, recordType: 'Hydration' as const },
  { accessType: 'read' as const, recordType: 'Steps' as const },
];

async function loadHealthConnect() {
  return import('react-native-health-connect');
}

function recordInstant(r: { time?: Date | string; startTime?: Date | string }): Date {
  if ('time' in r && r.time) return new Date(r.time);
  if ('startTime' in r && r.startTime) return new Date(r.startTime);
  return new Date();
}

function mapFlow(
  flow: string | null,
  MenstruationFlow: Awaited<ReturnType<typeof loadHealthConnect>>['MenstruationFlow'],
) {
  switch (flow) {
    case 'light':
      return MenstruationFlow.LIGHT;
    case 'medium':
      return MenstruationFlow.MEDIUM;
    case 'heavy':
      return MenstruationFlow.HEAVY;
    default:
      return null;
  }
}

function mapMucus(
  mucus: string | null,
  CervicalMucusAppearance: Awaited<ReturnType<typeof loadHealthConnect>>['CervicalMucusAppearance'],
) {
  switch (mucus) {
    case 'dry':
      return CervicalMucusAppearance.DRY;
    case 'sticky':
      return CervicalMucusAppearance.STICKY;
    case 'creamy':
      return CervicalMucusAppearance.CREAMY;
    case 'watery':
      return CervicalMucusAppearance.WATERY;
    case 'eggwhite':
      return CervicalMucusAppearance.EGG_WHITE;
    default:
      return null;
  }
}

async function ensureReady(): Promise<HealthConnectResult> {
  const HC = await loadHealthConnect();
  const status = await HC.getSdkStatus();
  if (status === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE) {
    return { ok: false, reason: 'not_installed' };
  }
  if (status === HC.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) {
    return { ok: false, reason: 'not_installed' };
  }
  const ready = await HC.initialize();
  if (!ready) return { ok: false, reason: 'unavailable' };
  return { ok: true };
}

export async function connectHealthNative(): Promise<HealthConnectResult> {
  try {
    const ready = await ensureReady();
    if (!ready.ok) return ready;

    const HC = await loadHealthConnect();
    const granted = await HC.requestPermission(PERMISSIONS);
    if (!granted.length) return { ok: false, reason: 'denied' };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : undefined,
    };
  }
}

export async function openHealthSettingsNative(): Promise<void> {
  const HC = await loadHealthConnect();
  HC.openHealthConnectSettings();
}

export async function importLatestPeriodStartNative(): Promise<string | null> {
  try {
    const ready = await ensureReady();
    if (!ready.ok) return null;

    const HC = await loadHealthConnect();
    const start = eighteenMonthsAgo().toISOString();
    const period = await HC.readRecords('MenstruationPeriod', {
      timeRangeFilter: { operator: 'after', startTime: start },
      ascendingOrder: false,
      pageSize: 30,
    });

    const periodRecord = period.records?.[0];
    if (periodRecord && 'time' in periodRecord && periodRecord.time) {
      return dateToYmd(new Date(periodRecord.time));
    }

    const flow = await HC.readRecords('MenstruationFlow', {
      timeRangeFilter: { operator: 'after', startTime: start },
      ascendingOrder: false,
      pageSize: 60,
    });

    const flowRecord = flow.records?.find(
      (r) => 'flow' in r && r.flow != null && r.flow !== HC.MenstruationFlow.UNKNOWN,
    );
    if (flowRecord && 'time' in flowRecord && flowRecord.time) {
      return dateToYmd(new Date(flowRecord.time));
    }
    return null;
  } catch {
    return null;
  }
}

export async function syncCycleLogNative(payload: CycleHealthPayload): Promise<void> {
  const ready = await ensureReady();
  if (!ready.ok) return;

  const HC = await loadHealthConnect();
  const time = ymdToLocalNoon(payload.date).toISOString();
  const batch: Parameters<typeof HC.insertRecords>[0] = [];

  if (payload.flow === 'spotting') {
    batch.push({ recordType: 'IntermenstrualBleeding', time });
  } else {
    const flow = mapFlow(payload.flow, HC.MenstruationFlow);
    if (flow != null) {
      batch.push({ recordType: 'MenstruationFlow', time, flow });
    }
  }

  if (payload.isPeriodStart) {
    batch.push({ recordType: 'MenstruationPeriod', time });
  }

  const mucus = mapMucus(payload.cervicalMucus, HC.CervicalMucusAppearance);
  if (mucus != null) {
    batch.push({
      recordType: 'CervicalMucus',
      time,
      appearance: mucus,
    });
  }

  if (payload.bbt != null && Number.isFinite(payload.bbt)) {
    batch.push({
      recordType: 'BasalBodyTemperature',
      time,
      temperature: { value: payload.bbt, unit: 'celsius' },
      measurementLocation: HC.TemperatureMeasurementLocation.VAGINA,
    });
  }

  for (const record of batch) {
    await HC.insertRecords([record]);
  }
}

export async function syncPeriodStartNative(ymd: string): Promise<void> {
  const ready = await ensureReady();
  if (!ready.ok) return;

  const HC = await loadHealthConnect();
  const time = ymdToLocalNoon(ymd).toISOString();
  await HC.insertRecords([
    { recordType: 'MenstruationFlow', time, flow: HC.MenstruationFlow.MEDIUM },
  ]);
  await HC.insertRecords([{ recordType: 'MenstruationPeriod', time }]);
}

function timeRangeSinceWeekStart() {
  return { operator: 'after' as const, startTime: weekStart().toISOString() };
}

export async function fetchHealthMetricsNative(): Promise<
  Partial<Record<HealthMetricKey, HealthMetricPoint[]>>
> {
  try {
    const ready = await ensureReady();
    if (!ready.ok) return {};

    const HC = await loadHealthConnect();
    const range = timeRangeSinceWeekStart();
    const opts = { timeRangeFilter: range, ascendingOrder: false, pageSize: 200 };

    const [weight, bp, heartRate, resting, sleep, nutrition, hydration] = await Promise.all([
      HC.readRecords('Weight', opts),
      HC.readRecords('BloodPressure', opts),
      HC.readRecords('HeartRate', opts),
      HC.readRecords('RestingHeartRate', opts),
      HC.readRecords('SleepSession', opts),
      HC.readRecords('Nutrition', opts),
      HC.readRecords('Hydration', opts),
    ]);

    const weightPoints: HealthMetricPoint[] = (weight.records ?? [])
      .filter((r): r is Extract<(typeof weight.records)[number], { weight: { inGrams: number } }> => 'weight' in r)
      .map((r) => ({
        date: dateToYmd(recordInstant(r)),
        value: r.weight.inGrams / 1000,
      }));

    const bpPoints: HealthMetricPoint[] = (bp.records ?? [])
      .filter(
        (r): r is Extract<(typeof bp.records)[number], { systolic: { inMillimetersOfMercury: number } }> =>
          'systolic' in r && 'diastolic' in r,
      )
      .map((r) => ({
        date: dateToYmd(new Date('time' in r && r.time ? r.time : new Date())),
        value: r.systolic.inMillimetersOfMercury,
        valueSecondary: r.diastolic.inMillimetersOfMercury,
      }));

    const hrRecords = (resting.records?.length ? resting.records : heartRate.records) ?? [];
    const heartPoints: HealthMetricPoint[] = hrRecords
      .map((r) => {
        if ('beatsPerMinute' in r && typeof r.beatsPerMinute === 'number') {
          return {
            date: dateToYmd(new Date('time' in r && r.time ? r.time : new Date())),
            value: r.beatsPerMinute,
          };
        }
        if ('samples' in r && Array.isArray(r.samples) && r.samples[0]) {
          const avg =
            r.samples.reduce((sum, s) => sum + (s.beatsPerMinute ?? 0), 0) / r.samples.length;
          return {
            date: dateToYmd(new Date(r.startTime ?? new Date())),
            value: avg,
          };
        }
        return null;
      })
      .filter((p): p is HealthMetricPoint => p != null);

    const sleepPoints: HealthMetricPoint[] = (sleep.records ?? []).map((r) => {
      const start = new Date('startTime' in r ? r.startTime : new Date());
      const end = new Date('endTime' in r ? r.endTime : start);
      return {
        date: dateToYmd(start),
        value: Math.max(0, (end.getTime() - start.getTime()) / 3_600_000),
      };
    });

    const nutritionPoints: HealthMetricPoint[] = (nutrition.records ?? []).flatMap((r) => {
      const energy = 'energy' in r ? r.energy : undefined;
      const kcal = energy && typeof energy === 'object' && 'inKilocalories' in energy ? energy.inKilocalories : null;
      if (typeof kcal !== 'number') return [];
      return [{ date: dateToYmd(recordInstant(r as { time?: Date | string; startTime?: Date | string })), value: kcal }];
    });

    const hydrationPoints: HealthMetricPoint[] = (hydration.records ?? [])
      .filter((r): r is Extract<(typeof hydration.records)[number], { volume: { inMilliliters: number } }> => 'volume' in r)
      .map((r) => ({
        date: dateToYmd(new Date(r.startTime ?? new Date())),
        value: r.volume.inMilliliters,
      }));

    return {
      weight: weightPoints,
      bloodPressure: bpPoints,
      heartRate: heartPoints,
      sleep: sleepPoints,
      nutrition: nutritionPoints,
      hydration: hydrationPoints,
    };
  } catch {
    return {};
  }
}

export async function fetchStepsNative(since: Date): Promise<StepSample[]> {
  try {
    const ready = await ensureReady();
    if (!ready.ok) return [];

    const HC = await loadHealthConnect();
    const result = await HC.readRecords('Steps', {
      timeRangeFilter: { operator: 'after', startTime: since.toISOString() },
      ascendingOrder: false,
      pageSize: 500,
    });

    return (result.records ?? [])
      .map((r) => {
        const rec = r as { count?: number; startTime?: string; endTime?: string };
        if (typeof rec.count !== 'number') return null;
        return {
          at: new Date(rec.startTime ?? rec.endTime ?? new Date()).toISOString(),
          count: Math.max(0, Math.round(rec.count)),
        };
      })
      .filter((s): s is { at: string; count: number } => s != null);
  } catch {
    return [];
  }
}
