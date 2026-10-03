import { Linking } from 'react-native';
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

const HEALTH_CONNECT_PLAY =
  'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
const HEALTH_CONNECT_MARKET = 'market://details?id=com.google.android.apps.healthdata';

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

const HISTORY_PERMISSION = {
  accessType: 'read' as const,
  recordType: 'ReadHealthDataHistory' as const,
};

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

async function openHealthConnectStore(): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(HEALTH_CONNECT_MARKET);
    await Linking.openURL(canOpen ? HEALTH_CONNECT_MARKET : HEALTH_CONNECT_PLAY);
  } catch {
    await Linking.openURL(HEALTH_CONNECT_PLAY).catch(() => undefined);
  }
}

function hasGrantedAccess(
  granted: Array<{ accessType?: string; recordType?: string }>,
): boolean {
  return granted.some((item) => typeof item.recordType === 'string' && item.recordType.length > 0);
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

let readyCache: Awaited<ReturnType<typeof ensureReady>> | null = null;

export async function preload() {
  readyCache = await ensureReady();
}

export async function connectHealthNative(): Promise<HealthConnectResult> {
  try {
    const ready = readyCache || (await ensureReady());
    readyCache = ready;
    if (!ready.ok) {
      if (ready.reason === 'not_installed') {
        await openHealthConnectStore();
      }
      return ready;
    }

    const HC = await loadHealthConnect();
    const requested = await HC.requestPermission(PERMISSIONS);
    const granted = requested.length ? requested : await HC.getGrantedPermissions().catch(() => []);
    if (hasGrantedAccess(granted)) {
      await HC.requestPermission([HISTORY_PERMISSION]).catch(() => []);
      return { ok: true };
    }

    const after = await HC.getGrantedPermissions().catch(() => []);
    if (hasGrantedAccess(after)) {
      await HC.requestPermission([HISTORY_PERMISSION]).catch(() => []);
      return { ok: true };
    }

    HC.openHealthConnectSettings();
    return { ok: false, reason: 'denied' };
  } catch (err) {
    return {
      ok: false,
      reason: 'error',
      message: err instanceof Error ? err.message : undefined,
    };
  }
}

export async function openHealthSettingsNative(): Promise<void> {
  try {
    const HC = await loadHealthConnect();
    HC.openHealthConnectSettings();
  } catch {
    await openHealthConnectStore();
  }
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

/* ---------- nutrition write-back (Medicard diary → Health Connect) ---------- */
const NUTRITION_WRITE = { accessType: 'write' as const, recordType: 'Nutrition' as const };
const clientId = (mealId: string) => `medicard-meal-${mealId}`;

export async function connectNutritionWriteNative(): Promise<HealthConnectResult> {
  try {
    const ready = readyCache || (await ensureReady());
    readyCache = ready;
    if (!ready.ok) {
      if (ready.reason === 'not_installed') await openHealthConnectStore();
      return ready;
    }
    const HC = await loadHealthConnect();
    await HC.requestPermission([NUTRITION_WRITE]);
    const granted = await HC.getGrantedPermissions().catch(() => []);
    return granted.some((p: { accessType?: string; recordType?: string }) => p.accessType === 'write' && p.recordType === 'Nutrition')
      ? { ok: true }
      : { ok: false, reason: 'denied' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
  }
}

/** Upsert by client record id: a newer version replaces the same meal in Health Connect. */
export async function writeMealNative(meal: HealthMeal): Promise<void> {
  const HC = await loadHealthConnect();
  if (!readyCache?.ok) {
    readyCache = await ensureReady();
    if (!readyCache.ok) return;
  }
  const start = new Date(meal.at);
  const grams = (value: number | null | undefined) =>
    value != null && value > 0 ? { value: Math.round(value * 10) / 10, unit: 'grams' as const } : undefined;
  const record = {
    recordType: 'Nutrition' as const,
    startTime: start.toISOString(),
    endTime: new Date(start.getTime() + 60_000).toISOString(),
    name: meal.name.slice(0, 120),
    mealType: { breakfast: HC.MealType.BREAKFAST, lunch: HC.MealType.LUNCH, dinner: HC.MealType.DINNER, snack: HC.MealType.SNACK }[meal.type],
    energy: { value: Math.round(meal.calories), unit: 'kilocalories' as const },
    protein: grams(meal.protein),
    totalCarbohydrate: grams(meal.carbs),
    totalFat: grams(meal.fat),
    dietaryFiber: grams(meal.fiber),
    sugar: grams(meal.sugar),
    sodium: meal.sodium != null && meal.sodium > 0 ? { value: Math.round(meal.sodium), unit: 'milligrams' as const } : undefined,
    metadata: { clientRecordId: clientId(meal.id), clientRecordVersion: Date.now() },
  };
  await HC.insertRecords([record as never]);
}

export async function deleteMealNative(mealId: string): Promise<void> {
  const HC = await loadHealthConnect();
  if (!readyCache?.ok) {
    readyCache = await ensureReady();
    if (!readyCache.ok) return;
  }
  await HC.deleteRecordsByUuids('Nutrition', [], [clientId(mealId)]);
}

// ——— MEDICOACH: workouts (read-only summary) ———

export type NativeWorkout = {
  externalId: string;
  source: 'health_connect';
  kind: string;
  startedAt: string;
  endedAt: string;
  kcal: number | null;
  avgHeartRate: number | null;
  distanceKm: number | null;
};

const WORKOUT_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'ExerciseSession' as const },
  { accessType: 'read' as const, recordType: 'ActiveCaloriesBurned' as const },
  { accessType: 'read' as const, recordType: 'HeartRate' as const },
];

const HC_KIND: Record<string, string> = {
  STRENGTH_TRAINING: 'traditionalStrengthTraining',
  WEIGHTLIFTING: 'traditionalStrengthTraining',
  HIGH_INTENSITY_INTERVAL_TRAINING: 'highIntensityIntervalTraining',
  RUNNING: 'running',
  RUNNING_TREADMILL: 'running',
  WALKING: 'walking',
  BIKING: 'cycling',
  BIKING_STATIONARY: 'cycling',
  SWIMMING_POOL: 'swimming',
  SWIMMING_OPEN_WATER: 'swimming',
  YOGA: 'yoga',
  PILATES: 'pilates',
  BOXING: 'boxing',
  ELLIPTICAL: 'elliptical',
  ROWING_MACHINE: 'rowing',
  STAIR_CLIMBING_MACHINE: 'stairClimbing',
  CALISTHENICS: 'functionalStrengthTraining',
  STRETCHING: 'flexibility',
};

/** Must be called from a button press: it shows the system permission sheet. */
export async function connectWorkoutsNative(): Promise<HealthConnectResult> {
  try {
    const ready = readyCache || (await ensureReady());
    readyCache = ready;
    if (!ready.ok) {
      if (ready.reason === 'not_installed') await openHealthConnectStore();
      return ready;
    }
    const HC = await loadHealthConnect();
    await HC.requestPermission(WORKOUT_PERMISSIONS as never);
    const granted = await HC.getGrantedPermissions().catch(() => []);
    return granted.some((p: { accessType?: string; recordType?: string }) => p.accessType === 'read' && p.recordType === 'ExerciseSession')
      ? { ok: true }
      : { ok: false, reason: 'denied' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
  }
}

export async function fetchWorkoutsNative(since: Date): Promise<NativeWorkout[]> {
  const HC = await loadHealthConnect();
  if (!readyCache?.ok) {
    readyCache = await ensureReady();
    if (!readyCache.ok) return [];
  }
  const filter = { operator: 'between' as const, startTime: since.toISOString(), endTime: new Date().toISOString() };
  const { records } = await HC.readRecords('ExerciseSession', { timeRangeFilter: filter });
  const names = Object.fromEntries(Object.entries(HC.ExerciseType as Record<string, number>).map(([k, v]) => [v, k]));
  const out: NativeWorkout[] = [];
  for (const r of records.slice(0, 100)) {
    const range = { operator: 'between' as const, startTime: r.startTime, endTime: r.endTime };
    let kcal: number | null = null;
    let avgHeartRate: number | null = null;
    try {
      const cal = await HC.readRecords('ActiveCaloriesBurned', { timeRangeFilter: range });
      const total = cal.records.reduce((s, c) => s + (c.energy?.inKilocalories ?? 0), 0);
      kcal = total > 0 ? Math.round(total) : null;
    } catch {
      kcal = null;
    }
    try {
      const hr = await HC.readRecords('HeartRate', { timeRangeFilter: range });
      const beats = hr.records.flatMap((h) => h.samples.map((s) => s.beatsPerMinute));
      avgHeartRate = beats.length ? Math.round(beats.reduce((a, b) => a + b, 0) / beats.length) : null;
    } catch {
      avgHeartRate = null;
    }
    const typeName = names[r.exerciseType] || 'OTHER_WORKOUT';
    out.push({
      externalId: `hc:${r.metadata?.id ?? `${r.startTime}`}`,
      source: 'health_connect',
      kind: HC_KIND[typeName] || 'other',
      startedAt: new Date(r.startTime).toISOString(),
      endedAt: new Date(r.endTime).toISOString(),
      kcal,
      avgHeartRate,
      distanceKm: null,
    });
  }
  return out;
}

// ——— Cycle: temperature for the retrospective ovulation estimate (train 1.0.0.20) ———

const TEMPERATURE_PERMISSIONS = [
  { accessType: 'read' as const, recordType: 'BasalBodyTemperature' as const },
  { accessType: 'read' as const, recordType: 'SkinTemperature' as const },
];
/** Records Medicard wrote itself (her typed BBT) are never read back as imports. */
const OWN_PACKAGE = 'ge.medicard.app';

/**
 * Must be called from the cycle settings switch (after the „გაგრძელება“ primer): it shows the Health
 * Connect sheet. Skin temperature needs a recent Health Connect; without it BBT alone. History access
 * lets the first import reach 40 days back.
 */
export async function connectTemperatureNative(): Promise<HealthConnectResult> {
  try {
    const ready = readyCache || (await ensureReady());
    readyCache = ready;
    if (!ready.ok) {
      if (ready.reason === 'not_installed') await openHealthConnectStore();
      return ready;
    }
    const HC = await loadHealthConnect();
    try {
      await HC.requestPermission([...TEMPERATURE_PERMISSIONS, HISTORY_PERMISSION] as never);
    } catch {
      await HC.requestPermission([TEMPERATURE_PERMISSIONS[0], HISTORY_PERMISSION] as never);
    }
    const granted = await HC.getGrantedPermissions().catch(() => []);
    return granted.some(
      (p: { accessType?: string; recordType?: string }) =>
        p.accessType === 'read' && (p.recordType === 'BasalBodyTemperature' || p.recordType === 'SkinTemperature'),
    )
      ? { ok: true }
      : { ok: false, reason: 'denied' };
  } catch (err) {
    return { ok: false, reason: 'error', message: err instanceof Error ? err.message : undefined };
  }
}

/** BBT and skin temperature deltas since `since` (°C). Never requests permissions. */
export async function fetchTemperatureNative(since: Date): Promise<import('@/lib/cycleTemperatureImport').HealthTemperatureRead> {
  const empty = { bbt: [], wrist: [], wristDeltas: [] };
  if (!readyCache?.ok) {
    readyCache = await ensureReady();
    if (!readyCache.ok) return empty;
  }
  const HC = await loadHealthConnect();
  const timeRangeFilter = { operator: 'between' as const, startTime: since.toISOString(), endTime: new Date().toISOString() };
  const own = (r: { metadata?: { dataOrigin?: string } }) => r.metadata?.dataOrigin === OWN_PACKAGE;
  let bbt: { at: string; value: number; unit: 'degC' }[] = [];
  try {
    const { records } = await HC.readRecords('BasalBodyTemperature', { timeRangeFilter, pageSize: 400 });
    bbt = records
      .filter((r) => !own(r))
      .map((r) => ({ at: r.time, value: r.temperature.inCelsius, unit: 'degC' as const }));
  } catch {
    bbt = [];
  }
  let wristDeltas: { at: string; delta: number; unit: 'degC' }[] = [];
  try {
    const { records } = await HC.readRecords('SkinTemperature', { timeRangeFilter, pageSize: 400 });
    wristDeltas = records
      .filter((r) => !own(r) && Array.isArray(r.deltas) && r.deltas.length > 0)
      .map((r) => ({
        // A night's record belongs to the morning it ends on; one mean deviation per record.
        at: r.endTime,
        delta: r.deltas.reduce((sum, d) => sum + d.delta.inCelsius, 0) / r.deltas.length,
        unit: 'degC' as const,
      }));
  } catch {
    wristDeltas = [];
  }
  return { bbt, wrist: [], wristDeltas };
}
