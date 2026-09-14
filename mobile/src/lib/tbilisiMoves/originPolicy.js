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

export function originTotalsFromHealthConnectRecords(records) {
  const byOrigin = new Map();
  let manualCount = 0;
  for (const rec of records) {
    if (isManualHealthConnectRecord(rec)) {
      manualCount += 1;
      continue;
    }
    const origin = String(rec?.metadata?.dataOrigin || '_unknown');
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
