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

const SHARE_TYPES = [
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKCategoryTypeIdentifierIntermenstrualBleeding',
  'HKCategoryTypeIdentifierCervicalMucusQuality',
  'HKQuantityTypeIdentifierBasalBodyTemperature',
] as const;

const READ_TYPES = [
  'HKCategoryTypeIdentifierMenstrualFlow',
  'HKCategoryTypeIdentifierIntermenstrualBleeding',
  'HKQuantityTypeIdentifierBasalBodyTemperature',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryWater',
  'HKQuantityTypeIdentifierStepCount',
] as const;

async function loadHealthKit() {
  return import('@kingstinct/react-native-healthkit');
}

function mapFlow(
  flow: string | null,
  CategoryValueMenstrualFlow: Awaited<ReturnType<typeof loadHealthKit>>['CategoryValueMenstrualFlow'],
) {
  switch (flow) {
    case 'none':
      return CategoryValueMenstrualFlow.none;
    case 'light':
      return CategoryValueMenstrualFlow.light;
    case 'medium':
      return CategoryValueMenstrualFlow.medium;
    case 'heavy':
      return CategoryValueMenstrualFlow.heavy;
    default:
      return null;
  }
}

function mapMucus(
  mucus: string | null,
  CategoryValueCervicalMucusQuality: Awaited<ReturnType<typeof loadHealthKit>>['CategoryValueCervicalMucusQuality'],
) {
  switch (mucus) {
    case 'dry':
      return CategoryValueCervicalMucusQuality.dry;
    case 'sticky':
      return CategoryValueCervicalMucusQuality.sticky;
    case 'creamy':
      return CategoryValueCervicalMucusQuality.creamy;
    case 'watery':
      return CategoryValueCervicalMucusQuality.watery;
    case 'eggwhite':
      return CategoryValueCervicalMucusQuality.eggWhite;
    default:
      return null;
  }
}

export async function connectHealthNative(): Promise<HealthConnectResult> {
  try {
    const HealthKit = await loadHealthKit();
    const available = await HealthKit.isHealthDataAvailableAsync();
    if (!available) return { ok: false, reason: 'unavailable' };

    const granted = await HealthKit.requestAuthorization({
      toShare: [...SHARE_TYPES],
      toRead: [...READ_TYPES],
    });
    if (!granted) return { ok: false, reason: 'denied' };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : undefined,
    };
  }
}

export async function importLatestPeriodStartNative(): Promise<string | null> {
  try {
    const HealthKit = await loadHealthKit();
    const samples = await HealthKit.queryCategorySamples('HKCategoryTypeIdentifierMenstrualFlow', {
      limit: 120,
      ascending: false,
      filter: {
        date: { startDate: eighteenMonthsAgo() },
      },
    });

    for (const sample of samples) {
      const meta = sample.metadata as Record<string, unknown> | undefined;
      if (meta?.HKMenstrualCycleStart === true || meta?.HKMenstrualCycleStart === 1) {
        return dateToYmd(sample.startDate);
      }
    }

    const { CategoryValueMenstrualFlow } = HealthKit;
    const flowDay = samples.find((s) => {
      const v = s.value as (typeof CategoryValueMenstrualFlow)[keyof typeof CategoryValueMenstrualFlow];
      return (
        v === CategoryValueMenstrualFlow.light ||
        v === CategoryValueMenstrualFlow.medium ||
        v === CategoryValueMenstrualFlow.heavy
      );
    });
    return flowDay ? dateToYmd(flowDay.startDate) : null;
  } catch {
    return null;
  }
}

export async function syncCycleLogNative(payload: CycleHealthPayload): Promise<void> {
  const HealthKit = await loadHealthKit();
  const when = ymdToLocalNoon(payload.date);
  const end = new Date(when.getTime() + 60_000);

  if (payload.flow === 'spotting') {
    await HealthKit.saveCategorySample(
      'HKCategoryTypeIdentifierIntermenstrualBleeding',
      HealthKit.CategoryValueNotApplicable.notApplicable,
      when,
      end,
    );
    return;
  }

  const flow = mapFlow(payload.flow, HealthKit.CategoryValueMenstrualFlow);
  if (flow != null && flow !== HealthKit.CategoryValueMenstrualFlow.none) {
    await HealthKit.saveCategorySample(
      'HKCategoryTypeIdentifierMenstrualFlow',
      flow,
      when,
      end,
      payload.isPeriodStart ? { HKMenstrualCycleStart: true } : undefined,
    );
  }

  const mucus = mapMucus(payload.cervicalMucus, HealthKit.CategoryValueCervicalMucusQuality);
  if (mucus != null) {
    await HealthKit.saveCategorySample(
      'HKCategoryTypeIdentifierCervicalMucusQuality',
      mucus,
      when,
      end,
    );
  }

  if (payload.bbt != null && Number.isFinite(payload.bbt)) {
    await HealthKit.saveQuantitySample(
      'HKQuantityTypeIdentifierBasalBodyTemperature',
      'degC',
      payload.bbt,
      when,
      end,
    );
  }
}

export async function syncPeriodStartNative(ymd: string): Promise<void> {
  const HealthKit = await loadHealthKit();
  const when = ymdToLocalNoon(ymd);
  const end = new Date(when.getTime() + 60_000);
  await HealthKit.saveCategorySample(
    'HKCategoryTypeIdentifierMenstrualFlow',
    HealthKit.CategoryValueMenstrualFlow.medium,
    when,
    end,
    { HKMenstrualCycleStart: true },
  );
}

function quantityPoints(
  samples: readonly { quantity: number; startDate: Date }[],
): HealthMetricPoint[] {
  return samples.map((s) => ({ date: dateToYmd(s.startDate), value: s.quantity }));
}

function pairBloodPressure(
  systolic: readonly { quantity: number; startDate: Date }[],
  diastolic: readonly { quantity: number; startDate: Date }[],
): HealthMetricPoint[] {
  const diaByDay = new Map<string, number>();
  for (const sample of diastolic) {
    diaByDay.set(dateToYmd(sample.startDate), sample.quantity);
  }
  return systolic.map((s) => ({
    date: dateToYmd(s.startDate),
    value: s.quantity,
    valueSecondary: diaByDay.get(dateToYmd(s.startDate)),
  }));
}

export async function fetchHealthMetricsNative(): Promise<
  Partial<Record<HealthMetricKey, HealthMetricPoint[]>>
> {
  try {
    const HealthKit = await loadHealthKit();
    const start = weekStart();
    const filter = { date: { startDate: start } };

    const [
      weight,
      systolic,
      diastolic,
      heartRate,
      restingHeartRate,
      sleep,
      nutrition,
      hydration,
    ] = await Promise.all([
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', {
        limit: 200,
        ascending: false,
        unit: 'kg',
        filter,
      }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierBloodPressureSystolic', {
        limit: 200,
        ascending: false,
        unit: 'mmHg',
        filter,
      }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierBloodPressureDiastolic', {
        limit: 200,
        ascending: false,
        unit: 'mmHg',
        filter,
      }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
        limit: 400,
        ascending: false,
        unit: 'count/min',
        filter,
      }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierRestingHeartRate', {
        limit: 200,
        ascending: false,
        unit: 'count/min',
        filter,
      }),
      HealthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
        limit: 400,
        ascending: false,
        filter,
      }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierDietaryEnergyConsumed', {
        limit: 200,
        ascending: false,
        unit: 'kcal',
        filter,
      }),
      HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierDietaryWater', {
        limit: 200,
        ascending: false,
        unit: 'mL',
        filter,
      }),
    ]);

    const sleepPoints: HealthMetricPoint[] = [];
    const sleepByDay = new Map<string, number>();
    for (const sample of sleep) {
      const day = dateToYmd(sample.startDate);
      const hours = (sample.endDate.getTime() - sample.startDate.getTime()) / 3_600_000;
      sleepByDay.set(day, (sleepByDay.get(day) ?? 0) + hours);
    }
    sleepByDay.forEach((value, date) => sleepPoints.push({ date, value }));

    const hrSamples = restingHeartRate.length ? restingHeartRate : heartRate;

    return {
      weight: quantityPoints(weight),
      bloodPressure: pairBloodPressure(systolic, diastolic),
      heartRate: quantityPoints(hrSamples),
      sleep: sleepPoints,
      nutrition: quantityPoints(nutrition),
      hydration: quantityPoints(hydration),
    };
  } catch {
    return {};
  }
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function noonLocal(dayStart: Date): Date {
  const x = new Date(dayStart);
  x.setHours(12, 0, 0, 0);
  return x;
}

function extractStepCount(stat: {
  sumQuantity?: { quantity: number };
  mostRecentQuantity?: { quantity: number };
}): number | null {
  const raw = stat.sumQuantity?.quantity ?? stat.mostRecentQuantity?.quantity;
  if (raw == null || !Number.isFinite(raw)) return null;
  const rounded = Math.round(raw);
  return rounded > 0 ? rounded : null;
}

/** Re-request full read set — covers users who connected before StepCount was added. */
async function ensureHealthReadAccess(HealthKit: Awaited<ReturnType<typeof loadHealthKit>>): Promise<void> {
  try {
    await HealthKit.requestAuthorization({
      toShare: [],
      toRead: [...READ_TYPES],
    });
  } catch {
    // Best-effort — user may have denied in Settings.
  }
}

async function queryDayStepTotal(
  HealthKit: Awaited<ReturnType<typeof loadHealthKit>>,
  dayStart: Date,
  dayEnd: Date,
): Promise<number | null> {
  const stat = await HealthKit.queryStatisticsForQuantity(
    'HKQuantityTypeIdentifierStepCount',
    ['cumulativeSum'],
    {
      unit: 'count',
      filter: { date: { startDate: dayStart, endDate: dayEnd } },
    },
  );
  return extractStepCount(stat);
}

function aggregateRawSamplesByDay(
  raw: readonly { quantity: number; startDate: Date }[],
): StepSample[] {
  const byDay = new Map<string, number>();
  for (const s of raw) {
    const day = dateToYmd(s.startDate);
    byDay.set(day, (byDay.get(day) ?? 0) + Math.max(0, Math.round(s.quantity)));
  }

  return [...byDay.entries()]
    .filter(([, count]) => count > 0)
    .map(([day, count]) => ({
      at: ymdToLocalNoon(day).toISOString(),
      count,
      daily: true as const,
    }));
}

export async function fetchStepsNative(since: Date): Promise<StepSample[]> {
  try {
    const HealthKit = await loadHealthKit();
    const available = await HealthKit.isHealthDataAvailableAsync();
    if (!available) return [];

    await ensureHealthReadAccess(HealthKit);

    const now = new Date();
    const from = startOfLocalDay(since);
    const todayStart = startOfLocalDay(now);
    const samples: StepSample[] = [];

    let cursor = new Date(from);
    while (cursor.getTime() <= todayStart.getTime()) {
      const dayStart = startOfLocalDay(cursor);
      const isToday = dayStart.getTime() === todayStart.getTime();
      const dayEnd = isToday ? now : endOfLocalDay(dayStart);

      const total = await queryDayStepTotal(HealthKit, dayStart, dayEnd);
      if (total != null) {
        samples.push({
          at: noonLocal(dayStart).toISOString(),
          count: total,
          daily: true,
        });
      }

      if (isToday) {
        try {
          const hourly = await HealthKit.queryStatisticsCollectionForQuantity(
            'HKQuantityTypeIdentifierStepCount',
            ['cumulativeSum'],
            todayStart,
            { hour: 1 },
            {
              unit: 'count',
              filter: { date: { startDate: todayStart, endDate: now } },
            },
          );
          for (const stat of hourly) {
            const count = extractStepCount(stat);
            if (count == null) continue;
            samples.push({
              at: (stat.endDate ?? stat.startDate ?? todayStart).toISOString(),
              count,
            });
          }
        } catch {
          // Hourly chart is optional — daily total is already stored.
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    if (samples.length) return samples;

    const raw = await HealthKit.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', {
      limit: 0,
      ascending: false,
      unit: 'count',
      filter: { date: { startDate: from, endDate: now } },
    });

    return aggregateRawSamplesByDay(raw);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.warn('[fetchStepsNative]', err);
    }
    return [];
  }
}
