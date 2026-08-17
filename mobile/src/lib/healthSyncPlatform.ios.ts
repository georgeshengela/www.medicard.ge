import {
  dateToYmd,
  eighteenMonthsAgo,
  type CycleHealthPayload,
  type HealthConnectResult,
  ymdToLocalNoon,
} from '@/lib/healthSync.shared';

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
