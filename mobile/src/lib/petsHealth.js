export function newPetsRequestId() {
  try {
    return globalThis.crypto.randomUUID();
  } catch {
    return `pets-${Date.now()}-${Math.random().toString(16).slice(2).padStart(8, '0')}`;
  }
}

export function petsHealthErrorKind(error) {
  if (error?.isSchemaUnavailable || (error?.status === 503 && error?.schemaReady === false)) return 'unavailable';
  if (error?.status === 0 || error?.status === 408) return 'offline';
  return 'error';
}

export function petsHealthErrorMessage(error, copy) {
  const kind = petsHealthErrorKind(error);
  if (kind === 'unavailable') return copy.healthUnavailable;
  if (kind === 'offline') return copy.offline || copy.healthLoadError;
  return error?.message || copy.healthLoadError;
}

export function formatPetWeight(log, copy) {
  return copy.weightDisplay(log.inputValue, log.inputUnit);
}

export function sortWeightChronological(items) {
  return [...items].sort((a, b) => {
    if (a.recordedOn !== b.recordedOn) return a.recordedOn.localeCompare(b.recordedOn);
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });
}

/** Observed measurements only: gaps are not zeroes or fabricated measurements. */
export function petWeightMeasurements(items, limit = 12) {
  return sortWeightChronological(items.filter(row => Number.isFinite(row.weightKg) && row.weightKg > 0 && /^\d{4}-\d{2}-\d{2}$/.test(row.recordedOn))).slice(-limit);
}

function ymdLocal(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Last 7 local days. Missing days carry the previous logged kg — chart only, not a medical gap. */
export function petWeightWeekSeries(items, now = new Date()) {
  const sorted = sortWeightChronological(items);
  const byDay = new Map();
  for (const row of sorted) byDay.set(row.recordedOn, row.weightKg);

  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  const startYmd = ymdLocal(windowStart);
  let carry = null;
  for (const row of sorted) {
    if (row.recordedOn < startYmd) carry = row.weightKg;
  }

  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const ymd = ymdLocal(date);
    if (byDay.has(ymd)) carry = byDay.get(ymd);
    days.push({
      ymd,
      date,
      weekdayIndex: (date.getDay() + 6) % 7,
      value: carry,
    });
  }
  return days;
}

export function petWeightDeltaPercent(items) {
  const sorted = sortWeightChronological(items);
  if (sorted.length < 2) return null;
  const latest = sorted[sorted.length - 1].weightKg;
  const previous = sorted[sorted.length - 2].weightKg;
  if (!previous) return null;
  return Math.round(((latest - previous) / previous) * 1000) / 10;
}

export function weightTrendAccessibleText(items, formatDate, copy) {
  if (!items.length) return copy.weightEmpty;
  if (items.length === 1) {
    const row = items[0];
    return `${copy.weightOnePoint} ${copy.weightKgLabel(row.weightKg, formatDate(row.recordedOn))}`;
  }
  return sortWeightChronological(items)
    .map((row) => copy.weightKgLabel(row.weightKg, formatDate(row.recordedOn)))
    .join('; ');
}
