import { newPetsRequestId } from './petsHealth.js';

export const CARE_KINDS = Object.freeze(['VACCINATION', 'FLEA_TICK', 'DEWORMING', 'MEDICATION', 'OTHER']);

export function petsCareErrorKind(error) {
  if (error?.isCareSchemaUnavailable || error?.careSchemaReady === false) return 'unavailable';
  if (error?.status === 503 && error?.schemaReady === false) return 'unavailable';
  if (error?.status === 409) return 'conflict';
  if (error?.status === 0 || error?.status === 408) return 'offline';
  return 'error';
}

export function petsCareErrorMessage(error, copy) {
  const kind = petsCareErrorKind(error);
  if (kind === 'unavailable') return copy.careUnavailable;
  if (kind === 'conflict') return error?.message || copy.careConflict;
  if (kind === 'offline') return copy.offline || copy.healthLoadError;
  return error?.message || copy.healthLoadError || copy.saveError;
}

export function kindLabel(kind, copy) {
  if (kind === 'VACCINATION') return copy.kindVaccination;
  if (kind === 'FLEA_TICK') return copy.kindFleaTick;
  if (kind === 'DEWORMING') return copy.kindDeworming;
  if (kind === 'MEDICATION') return copy.kindMedication;
  return copy.kindOther;
}

export function completeLabel(kind, copy) {
  if (kind === 'MEDICATION' || kind === 'FLEA_TICK' || kind === 'DEWORMING') return copy.completeMed;
  if (kind === 'VACCINATION') return copy.completeVaccine;
  return copy.completeOther;
}

export function sourceLabel(source, copy) {
  if (source === 'VETERINARIAN') return copy.sourceVet;
  if (source === 'PRODUCT_INSTRUCTIONS') return copy.sourceProduct;
  return copy.sourceUser;
}

export function recurrenceLabel(plan, copy) {
  if (plan.recurrenceKind === 'ONCE') return copy.once;
  if (plan.recurrenceKind === 'EVERY_N_DAYS') return copy.everyN(plan.intervalCount, 'დღეში');
  if (plan.recurrenceKind === 'EVERY_N_WEEKS') return copy.everyN(plan.intervalCount, 'კვირაში');
  if (plan.recurrenceKind === 'EVERY_N_MONTHS') return copy.everyN(plan.intervalCount, 'თვეში');
  if (plan.recurrenceKind === 'DAILY_COURSE') return copy.dailyCourse;
  return copy.once;
}

export function summarizePlanKa(plan, copy, formatDate) {
  const lines = [
    kindLabel(plan.kind, copy),
    plan.productName || plan.title,
    `${copy.firstDate}: ${formatDate(plan.startOn)}`,
    recurrenceLabel(plan, copy),
  ];
  if (plan.courseEndsOn) lines.push(`${copy.courseEndsOn}: ${formatDate(plan.courseEndsOn)}`);
  if (plan.occurrenceLimit) lines.push(copy.limitN(plan.occurrenceLimit));
  if (plan.recurrenceKind !== 'ONCE') {
    lines.push(plan.recurrenceBasis === 'FROM_ADMINISTRATION' ? copy.basisAdmin : copy.basisCalendar);
  }
  lines.push(copy.plannedDisclaimer);
  lines.push(copy.remindersNotEnabled);
  return lines.filter(Boolean).join('\n');
}

export function localUtcOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}

export { newPetsRequestId };
