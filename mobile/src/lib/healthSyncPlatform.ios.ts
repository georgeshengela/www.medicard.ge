import {
  dateToYmd,
  eighteenMonthsAgo,
  type CycleHealthPayload,
  type HealthConnectResult,
  type HealthMeal,
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

let kitMod: typeof import('@kingstinct/react-native-healthkit') | null = null;

async function loadHealthKit() {
  if (!kitMod) kitMod = await import('@kingstinct/react-native-healthkit');
  return kitMod;
}

export async function preload() {
  await loadHealthKit();
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
    const HealthKit = kitMod || (await loadHealthKit());
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
    // HealthKit requires HKMenstrualCycleStart on every flow sample: true only for a real new start (CYC-03).
    await HealthKit.saveCategorySample(
      'HKCategoryTypeIdentifierMenstrualFlow',
      flow,
      when,
      end,
      { HKMenstrualCycleStart: payload.isPeriodStart === true },
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

    const now = new Date();
    const from = startOfLocalDay(since);
    const todayStart = startOfLocalDay(now);
    const samples: StepSample[] = [];

    try {
      const daily = await HealthKit.queryStatisticsCollectionForQuantity(
        'HKQuantityTypeIdentifierStepCount',
        ['cumulativeSum'],
        from,
        { day: 1 },
        {
          unit: 'count',
          filter: { date: { startDate: from, endDate: now } },
        },
      );
      for (const stat of daily) {
        const count = extractStepCount(stat);
        if (count == null) continue;
        const dayStart = startOfLocalDay(stat.startDate ?? from);
        samples.push({
          at: noonLocal(dayStart).toISOString(),
          count,
          daily: true,
        });
      }
    } catch {
      // Collection can fail on older HealthKit — fall back to raw samples below.
    }

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
      // Hourly chart is optional — daily totals are enough to show the page.
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

/* ---------- nutrition write-back (Medicard diary → Apple Health) ---------- */
const NUTRITION_WRITE_TYPES = [
  'HKQuantityTypeIdentifierDietaryEnergyConsumed',
  'HKQuantityTypeIdentifierDietaryProtein',
  'HKQuantityTypeIdentifierDietaryCarbohydrates',
  'HKQuantityTypeIdentifierDietaryFatTotal',
] as const;
const MEAL_KEY = 'MedicardMealId';
// NSComparisonPredicate equalTo; passed as a number so no runtime enum object is needed.
const EQUAL_TO = 4;

export async function connectNutritionWriteNative(): Promise<HealthConnectResult> {
  try {
    const HealthKit = kitMod || (await loadHealthKit());
    const granted = await HealthKit.requestAuthorization({ toShare: [...NUTRITION_WRITE_TYPES] });
    return granted ? { ok: true } : { ok: false, reason: 'denied' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
  }
}

export async function deleteMealNative(mealId: string): Promise<void> {
  const HealthKit = await loadHealthKit();
  const filter = { metadata: { withMetadataKey: MEAL_KEY, operatorType: EQUAL_TO, value: mealId } } as never;
  for (const type of NUTRITION_WRITE_TYPES) {
    // Samples Apple Health refuses to delete (no share access) are left alone.
    await HealthKit.deleteObjects(type, filter).catch(() => 0);
  }
}

/** Replaces the meal's samples: delete by the meal id, then write energy and macros. */
export async function writeMealNative(meal: HealthMeal): Promise<void> {
  const HealthKit = await loadHealthKit();
  await deleteMealNative(meal.id);
  const start = new Date(meal.at);
  const end = new Date(start.getTime() + 60_000);
  const metadata = { [MEAL_KEY]: meal.id, HKFoodType: meal.name.slice(0, 120) } as never;
  const values: [(typeof NUTRITION_WRITE_TYPES)[number], string, number][] = [
    ['HKQuantityTypeIdentifierDietaryEnergyConsumed', 'kcal', meal.calories],
    ['HKQuantityTypeIdentifierDietaryProtein', 'g', meal.protein],
    ['HKQuantityTypeIdentifierDietaryCarbohydrates', 'g', meal.carbs],
    ['HKQuantityTypeIdentifierDietaryFatTotal', 'g', meal.fat],
  ];
  for (const [type, unit, value] of values) {
    if (!(value > 0)) continue;
    await HealthKit.saveQuantitySample(type, unit as never, Math.round(value * 10) / 10, start, end, metadata);
  }
}

// ——— MEDICOACH: workouts (read-only summary) ———

export type NativeWorkout = {
  externalId: string;
  source: 'apple_health';
  kind: string;
  startedAt: string;
  endedAt: string;
  kcal: number | null;
  avgHeartRate: number | null;
  distanceKm: number | null;
};

const WORKOUT_READ_TYPES = ['HKWorkoutTypeIdentifier', 'HKQuantityTypeIdentifierActiveEnergyBurned', 'HKQuantityTypeIdentifierHeartRate'] as const;

/** Must be called from a button press: it shows the system permission sheet (iOS 26 rule). */
export async function connectWorkoutsNative(): Promise<HealthConnectResult> {
  try {
    const HealthKit = kitMod || (await loadHealthKit());
    const granted = await HealthKit.requestAuthorization({ toRead: [...WORKOUT_READ_TYPES] as never });
    return granted ? { ok: true } : { ok: false, reason: 'denied' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
  }
}

/** Workouts since `since` (never re-requests authorization; unreadable data just returns []). */
export async function fetchWorkoutsNative(since: Date): Promise<NativeWorkout[]> {
  const HealthKit = kitMod || (await loadHealthKit());
  const rows = await HealthKit.queryWorkoutSamples({ limit: 100, ascending: false, filter: { date: { startDate: since, endDate: new Date() } } });
  const out: NativeWorkout[] = [];
  for (const w of rows) {
    const types = HealthKit.WorkoutActivityType as unknown as Record<number, string>;
    let avgHeartRate: number | null = null;
    try {
      const hr = await w.getStatistic('HKQuantityTypeIdentifierHeartRate', 'count/min');
      avgHeartRate = hr?.averageQuantity?.quantity ? Math.round(hr.averageQuantity.quantity) : null;
    } catch {
      avgHeartRate = null;
    }
    const energy = w.totalEnergyBurned;
    const distance = w.totalDistance;
    out.push({
      externalId: `hk:${w.uuid}`,
      source: 'apple_health',
      kind: types[w.workoutActivityType as unknown as number] || 'other',
      startedAt: new Date(w.startDate).toISOString(),
      endedAt: new Date(w.endDate).toISOString(),
      kcal: energy ? Math.round(energy.unit === 'kJ' ? energy.quantity / 4.184 : energy.quantity) : null,
      avgHeartRate,
      distanceKm: distance ? Math.round((distance.unit === 'km' ? distance.quantity : distance.quantity / 1000) * 100) / 100 : null,
    });
  }
  return out;
}

// ——— Cycle: temperature for the retrospective ovulation estimate (train 1.0.0.20) ———

const TEMPERATURE_BBT = 'HKQuantityTypeIdentifierBasalBodyTemperature' as const;
const TEMPERATURE_WRIST = 'HKQuantityTypeIdentifierAppleSleepingWristTemperature' as const;
/** Our own samples (BBT she typed and Medicard wrote to Health) are never read back as imports. */
const OWN_BUNDLE_PREFIX = 'ge.medicard.app';

/**
 * Must be called from the cycle settings switch (after the „გაგრძელება“ primer): it shows the system
 * sheet (iOS 26 rule). Sleeping wrist temperature needs iOS 16 / a recent Watch; without it BBT alone.
 */
export async function connectTemperatureNative(): Promise<HealthConnectResult> {
  try {
    const HealthKit = kitMod || (await loadHealthKit());
    let granted: boolean;
    try {
      granted = await HealthKit.requestAuthorization({ toRead: [TEMPERATURE_BBT, TEMPERATURE_WRIST] as never });
    } catch {
      granted = await HealthKit.requestAuthorization({ toRead: [TEMPERATURE_BBT] as never });
    }
    return granted ? { ok: true } : { ok: false, reason: 'denied' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
  }
}

function fromOtherSource(sample: { sourceRevision?: { source?: { bundleIdentifier?: string } } }): boolean {
  const id = sample.sourceRevision?.source?.bundleIdentifier ?? '';
  return !id.startsWith(OWN_BUNDLE_PREFIX);
}

/** BBT and sleeping wrist temperature since `since` (°C). Never requests authorization. */
export async function fetchTemperatureNative(since: Date): Promise<import('@/lib/cycleTemperatureImport').HealthTemperatureRead> {
  const HealthKit = kitMod || (await loadHealthKit());
  const filter = { date: { startDate: since, endDate: new Date() } };
  const read = async (id: typeof TEMPERATURE_BBT | typeof TEMPERATURE_WRIST) => {
    try {
      return await HealthKit.queryQuantitySamples(id, { limit: 400, ascending: true, unit: 'degC', filter } as never);
    } catch {
      return [];
    }
  };
  const [bbt, wrist] = await Promise.all([read(TEMPERATURE_BBT), read(TEMPERATURE_WRIST)]);
  return {
    bbt: bbt.filter(fromOtherSource).map((s) => ({ at: s.startDate, value: s.quantity, unit: 'degC' as const })),
    // A night's sample belongs to the morning it ends on.
    wrist: wrist.filter(fromOtherSource).map((s) => ({ at: s.endDate, value: s.quantity, unit: 'degC' as const })),
    wristDeltas: [],
  };
}
