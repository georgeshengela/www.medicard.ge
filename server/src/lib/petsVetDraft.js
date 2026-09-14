import { CARE_KINDS, RECURRENCE_KINDS } from './petsSchedule.js';
import { TITLE_MAX, DOSE_MAX, DOSE_UNIT_MAX } from './petsCare.js';
import { isRealCalendarDate } from './petsAge.js';
import { isTimeHHmm } from './petsCivilDate.js';

export const CARE_DRAFT_SOURCE = 'MEDI_VET_DRAFT';
export const DRAFT_PROVENANCE = Object.freeze(['owner_instruction', 'existing_plan']);

const FENCE_RE = /```care-draft\s*([\s\S]*?)```/i;

function fail(message, extra = {}) {
  const error = new Error(message);
  error.status = 400;
  Object.assign(error, extra);
  throw error;
}

export function parseCareDraftFence(text) {
  const match = String(text || '').match(FENCE_RE);
  if (!match) return { draft: null, content: String(text || '') };
  let parsed = null;
  try {
    parsed = JSON.parse(match[1]);
  } catch {
    parsed = null;
  }
  return {
    draft: parsed && typeof parsed === 'object' ? parsed : null,
    content: String(text || '').replace(FENCE_RE, '').trim(),
  };
}

export function extractUserProvidedDose({ userText, recordedPlan } = {}) {
  const fromUser = String(userText || '').match(/(\d+(?:[.,]\d+)?)\s*(მგ|მლ|mg|ml|გ|tablet|ტაბლეტ)/i);
  if (fromUser) {
    return { dose: fromUser[1].replace(',', '.'), doseUnit: fromUser[2], source: 'owner_instruction' };
  }
  if (recordedPlan?.dose) {
    return { dose: recordedPlan.dose, doseUnit: recordedPlan.doseUnit || null, source: 'existing_plan' };
  }
  return { dose: null, doseUnit: null, source: null };
}

export function validateCareDraft(input, { petId, todayYmd, ownedProductIds = new Set() } = {}) {
  if (!input || typeof input !== 'object') fail('გეგმის წინადადება არასწორია.');
  const draftPetId = input.petId ? String(input.petId) : petId;
  if (draftPetId !== petId) fail('გეგმა ამ ცხოველს არ ეკუთვნის.');

  const kind = input.kind ? String(input.kind) : null;
  if (kind && !CARE_KINDS.includes(kind)) fail('აირჩიეთ მოვლის კატეგორია.');

  const title = input.title == null ? null : String(input.title).trim();
  if (title && title.length > TITLE_MAX) fail('სათაური ძალიან გრძელია.');

  const productId = input.productId ? String(input.productId) : null;
  if (productId && !ownedProductIds.has(productId)) fail('პროდუქტი ამ ცხოველს არ ეკუთვნის.');

  const dose = input.dose == null || input.dose === '' ? null : String(input.dose).trim();
  const doseUnit = input.doseUnit == null || input.doseUnit === '' ? null : String(input.doseUnit).trim();
  if (dose && dose.length > DOSE_MAX) fail('დოზა ძალიან გრძელია.');
  if (doseUnit && doseUnit.length > DOSE_UNIT_MAX) fail('დოზის ერთეული ძალიან გრძელია.');

  const startOn = input.startOn ? String(input.startOn) : null;
  if (startOn && !isRealCalendarDate(startOn)) fail('თარიღი არასწორია.');
  if (startOn && todayYmd && startOn < '1900-01-01') fail('თარიღი არასწორია.');

  const dueTime = input.dueTime ? String(input.dueTime) : null;
  if (dueTime && !isTimeHHmm(dueTime)) fail('დრო არასწორია.');

  const recurrenceKind = input.recurrenceKind ? String(input.recurrenceKind) : null;
  if (recurrenceKind && !RECURRENCE_KINDS.includes(recurrenceKind)) fail('გამეორება არასწორია.');
  const intervalCount =
    input.intervalCount == null || input.intervalCount === '' ? null : Number(input.intervalCount);
  if (intervalCount != null && (!Number.isInteger(intervalCount) || intervalCount < 1)) {
    fail('გამეორების რიცხვი არასწორია.');
  }

  const provenance = DRAFT_PROVENANCE.includes(input.provenance) ? input.provenance : 'owner_instruction';

  const missingFields = [];
  if (!kind) missingFields.push('kind');
  if (!title) missingFields.push('title');
  if (!startOn) missingFields.push('startOn');
  if (recurrenceKind && recurrenceKind !== 'ONCE' && !intervalCount) missingFields.push('intervalCount');

  return {
    petId,
    kind,
    title,
    productId,
    dose,
    doseUnit,
    startOn,
    dueTime,
    recurrenceKind: recurrenceKind || 'ONCE',
    intervalCount,
    source: CARE_DRAFT_SOURCE,
    provenance,
    incomplete: missingFields.length > 0 || Boolean(input.incomplete),
    missingFields,
    reminderEnabled: false,
  };
}

/** Model output must never become a write. */
export function modelCannotMutateCare() {
  return {
    canCreateSchedule: false,
    canRecordAdministration: false,
    canCancelSchedule: false,
    canEnableReminders: false,
  };
}

export function shouldInventMissingDose(draft) {
  return false && Boolean(draft);
}
