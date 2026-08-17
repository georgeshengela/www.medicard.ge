import {
  dateToYmd,
  eighteenMonthsAgo,
  type CycleHealthPayload,
  type HealthConnectResult,
  ymdToLocalNoon,
} from '@/lib/healthSync.shared';

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
];

async function loadHealthConnect() {
  return import('react-native-health-connect');
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
