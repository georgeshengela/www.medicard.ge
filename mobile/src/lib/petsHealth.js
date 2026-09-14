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
