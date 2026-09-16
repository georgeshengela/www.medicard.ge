/** Health Connect `RecordingMethod.RECORDING_METHOD_MANUAL_ENTRY`. */
export const HC_MANUAL_ENTRY = 3;

export function isManualHealthConnectRecord(record) {
  const method = record?.metadata?.recordingMethod;
  return method === HC_MANUAL_ENTRY || method === 'RECORDING_METHOD_MANUAL_ENTRY' || method === 3;
}

export function isManualHealthKitSample(sample) {
  const meta = sample?.metadata;
  return meta?.HKWasUserEntered === true || meta?.HKWasUserEntered === 1;
}

/**
 * Sum non-overlapping step records. Overlapping clusters take the max count
 * (never a naive SUM of phone+watch windows).
 */
export function nonOverlappingStepSum(items) {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  let total = 0;
  let cluster = [];
  const flush = () => {
    if (!cluster.length) return;
    total += cluster.length === 1 ? cluster[0].count : Math.max(...cluster.map((row) => row.count));
    cluster = [];
  };
  for (const item of sorted) {
    if (!cluster.length) {
      cluster.push(item);
      continue;
    }
    const clusterEnd = Math.max(...cluster.map((row) => row.end));
    if (item.start < clusterEnd) cluster.push(item);
    else {
      flush();
      cluster.push(item);
    }
  }
  flush();
  return total;
}

export function healthConnectOriginId(dataOrigin) {
  if (dataOrigin == null || dataOrigin === '') return '_unknown';
  if (typeof dataOrigin === 'string') return dataOrigin.trim() || '_unknown';
  if (typeof dataOrigin === 'object') {
    return String(dataOrigin.packageName || dataOrigin.applicationId || '').trim() || '_unknown';
  }
  const text = String(dataOrigin).trim();
  return !text || text === '[object Object]' ? '_unknown' : text;
}

/** Inclusive overlap: Health Connect day-buckets often end after `now`. */
export function recordOverlapsInterval(record, startMs, endMs) {
  const start = new Date(record?.startTime || record?.start || 0).getTime();
  if (!Number.isFinite(start)) return false;
  const rawEnd = new Date(record?.endTime || record?.end || record?.startTime || 0).getTime();
  const end = Number.isFinite(rawEnd) && rawEnd > start ? rawEnd : start + 1;
  return start < endMs && end > startMs;
}

export function hasCompetitionStepsGrant(granted = []) {
  return granted.some((item) => {
    const type = String(item.recordType || item.permission || '')
      .replace(/_/g, '')
      .toLowerCase();
    const access = String(item.accessType || 'read').toLowerCase();
    const isSteps =
      type === 'steps' ||
      type.includes('readsteps') ||
      type.includes('stepsrecord') ||
      type.endsWith('stepcount');
    return isSteps && (access === 'read' || access === 'write' || !item.accessType);
  });
}

function sampleAtMs(sample) {
  return Date.parse(sample?.at || sample?.startTime || sample?.start || '');
}

function localYmdFromAt(iso) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Same total Home uses: daily bucket wins, otherwise sum samples in range. */
export function homeStyleIntervalSteps(samples, startMs, endMs) {
  const inRange = (samples || []).filter((sample) => {
    const at = sampleAtMs(sample);
    return Number.isFinite(at) && at >= startMs && at < endMs;
  });
  const daily = inRange.find((sample) => sample.daily);
  if (daily) return Math.max(0, Math.round(Number(daily.count) || 0));
  return inRange.reduce((sum, sample) => sum + Math.max(0, Math.round(Number(sample.count) || 0)), 0);
}

export function homeStyleLocalDaySteps(samples, localYmd) {
  if (!localYmd) return 0;
  const day = (samples || []).filter((sample) => localYmdFromAt(sample.at || sample.startTime) === localYmd);
  const daily = day.find((sample) => sample.daily);
  if (daily) return Math.max(0, Math.round(Number(daily.count) || 0));
  return day.reduce((sum, sample) => sum + Math.max(0, Math.round(Number(sample.count) || 0)), 0);
}

export function homeStyleCompetitionSteps(samples, startMs, endMs, localYmd) {
  return homeStyleIntervalSteps(samples, startMs, endMs) || homeStyleLocalDaySteps(samples, localYmd);
}

export function originTotalsFromHealthConnectRecords(records) {
  const byOrigin = new Map();
  let manualCount = 0;
  for (const rec of records) {
    if (isManualHealthConnectRecord(rec)) {
      manualCount += 1;
      continue;
    }
    const origin = healthConnectOriginId(rec?.metadata?.dataOrigin);
    const list = byOrigin.get(origin) || [];
    const start = new Date(rec.startTime || rec.start || 0).getTime();
    const end = new Date(rec.endTime || rec.end || rec.startTime || 0).getTime();
    list.push({
      start,
      end: Number.isFinite(end) && end > start ? end : start + 1,
      count: Math.max(0, Math.round(Number(rec.count) || 0)),
    });
    byOrigin.set(origin, list);
  }
  const totals = [...byOrigin.entries()].map(([origin, items]) => ({
    origin,
    steps: nonOverlappingStepSum(items),
  }));
  totals.sort((a, b) => b.steps - a.steps || a.origin.localeCompare(b.origin));
  return { totals, manualCount, sensorCount: records.length - manualCount };
}

export function pickHighestOrigin(totals) {
  if (!totals.length) return null;
  return totals[0];
}

export function originTotalsFromHealthKitSources(rows) {
  const totals = rows
    .map((row) => ({
      origin: String(row.source?.bundleIdentifier || row.source?.name || row.origin || '_unknown'),
      steps: Math.max(0, Math.round(Number(row.sumQuantity?.quantity ?? row.steps ?? 0))),
    }))
    .filter((row) => row.steps >= 0);
  totals.sort((a, b) => b.steps - a.steps || a.origin.localeCompare(b.origin));
  return totals;
}
