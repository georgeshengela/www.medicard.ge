import { assertStableCivilDate } from './cycleCivilDate.js';
import { isRealCalendarDate } from './petsAge.js';

export const WEIGHT_UNITS = Object.freeze(['kg', 'g', 'lb']);
export const ALLERGY_CATEGORIES = Object.freeze(['medication', 'food', 'environmental', 'other', 'unknown']);
export const ALLERGY_STATUSES = Object.freeze(['suspected', 'veterinarian_confirmed']);
export const CONDITION_STATUSES = Object.freeze(['active', 'resolved', 'unknown']);
export const CONDITION_BASES = Object.freeze(['owner_reported', 'veterinarian_confirmed']);

export const LB_TO_KG = 0.45359237;
export const KG_DECIMALS = 5;
export const MIN_WEIGHT_KG = 0.001;
export const MAX_WEIGHT_KG = 5000;
export const WEIGHT_NOTE_MAX = 280;
export const NAME_MAX = 80;
export const REACTION_MAX = 200;
export const NOTES_MAX = 500;
export const WEIGHT_LIST_MAX = 100;
export const WEIGHT_LIST_DEFAULT = 50;
export const WEIGHT_CAP_PER_PET = 200;
export const ALLERGY_CAP_PER_PET = 40;
export const CONDITION_CAP_PER_PET = 40;

export const PET_HEALTH_NOT_FOUND = { error: 'ჩანაწერი ვერ მოიძებნა.' };

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}

export function trimText(value, max, field) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > max) fail(`${field} მაქსიმუმ ${max} სიმბოლოა.`);
  return text;
}

export function requireName(value) {
  const name = trimText(value, NAME_MAX, 'სახელი');
  if (!name) fail('შეიყვანეთ სახელი.');
  return name;
}

export function optionalCivilDate(value, todayYmd, emptyOk = true) {
  if (value == null || value === '') {
    if (emptyOk) return null;
    fail('თარიღი სავალდებულოა.');
  }
  const ymd = typeof value === 'string' ? value.trim() : '';
  const stable = assertStableCivilDate(ymd);
  if (!stable || !isRealCalendarDate(stable)) fail('თარიღი არასწორია.');
  if (stable > todayYmd) fail('მომავალი თარიღი არ დაიშვება.');
  return stable;
}

export function roundKg(value) {
  const factor = 10 ** KG_DECIMALS;
  return Math.round(value * factor) / factor;
}

export function parsePositiveNumber(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) fail('წონა უნდა იყოს დადებითი რიცხვი.');
    return value;
  }
  const raw = String(value ?? '').trim().replace(',', '.');
  if (!raw) fail('შეიყვანეთ წონა.');
  const n = Number(raw);
  if (!Number.isFinite(n) || value === true || value === false) fail('წონა უნდა იყოს დადებითი რიცხვი.');
  if (n <= 0) fail('წონა უნდა იყოს დადებითი რიცხვი.');
  return n;
}

export function convertToKg(inputValue, inputUnit) {
  const unit = String(inputUnit || '').trim().toLowerCase();
  if (!WEIGHT_UNITS.includes(unit)) fail('აირჩიეთ ერთეული: კგ, გ ან ფუნტი.');
  const amount = parsePositiveNumber(inputValue);
  let kg;
  if (unit === 'kg') kg = amount;
  else if (unit === 'g') kg = amount / 1000;
  else kg = amount * LB_TO_KG;
  const rounded = roundKg(kg);
  if (rounded < MIN_WEIGHT_KG || rounded > MAX_WEIGHT_KG) {
    fail('წონა ამ დიაპაზონში ვერ ინახება.');
  }
  return { weightKg: rounded, inputValue: amount, inputUnit: unit };
}

export function kgFromStored(value) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function compareWeightRecency(a, b) {
  if (a.recordedOn !== b.recordedOn) return a.recordedOn < b.recordedOn ? -1 : 1;
  const ac = a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt || '');
  const bc = b.createdAt instanceof Date ? b.createdAt.toISOString() : String(b.createdAt || '');
  if (ac !== bc) return ac < bc ? -1 : 1;
  return String(a.id || '') < String(b.id || '') ? -1 : 1;
}

export function pickLatestWeight(logs) {
  if (!Array.isArray(logs) || logs.length === 0) return null;
  return [...logs].sort(compareWeightRecency).at(-1);
}

export function normalizeWeightInput(input, { todayYmd } = {}) {
  const recordedOn = optionalCivilDate(input.recordedOn, todayYmd, false);
  const converted = convertToKg(input.inputValue ?? input.kg ?? input.weightKg, input.inputUnit);
  return {
    recordedOn,
    weightKg: converted.weightKg,
    inputValue: converted.inputValue,
    inputUnit: converted.inputUnit,
    note: trimText(input.note, WEIGHT_NOTE_MAX, 'შენიშვნა'),
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
  };
}

export function mergeWeightUpdate(current, patch, todayYmd) {
  return normalizeWeightInput(
    {
      recordedOn: patch.recordedOn !== undefined ? patch.recordedOn : current.recordedOn,
      inputValue: patch.inputValue !== undefined ? patch.inputValue : kgFromStored(current.inputValue),
      inputUnit: patch.inputUnit !== undefined ? patch.inputUnit : current.inputUnit,
      note: patch.note !== undefined ? patch.note : current.note,
      clientRequestId: current.clientRequestId,
    },
    { todayYmd },
  );
}

export function normalizeAllergyInput(input, { todayYmd } = {}) {
  const category = String(input.category || 'unknown').trim();
  if (!ALLERGY_CATEGORIES.includes(category)) fail('აირჩიეთ ალერგიის კატეგორია.');
  const reportedStatus = String(input.reportedStatus || '').trim();
  if (!ALLERGY_STATUSES.includes(reportedStatus)) {
    fail('მიუთითეთ, სავარაუდოა თუ ვეტერინარის დადასტურებული.');
  }
  return {
    name: requireName(input.name),
    category,
    reaction: trimText(input.reaction, REACTION_MAX, 'რეაქცია'),
    reportedStatus,
    notedOn: optionalCivilDate(input.notedOn, todayYmd, true),
    notes: trimText(input.notes, NOTES_MAX, 'შენიშვნა'),
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
  };
}

export function mergeAllergyUpdate(current, patch, todayYmd) {
  return normalizeAllergyInput(
    {
      name: patch.name !== undefined ? patch.name : current.name,
      category: patch.category !== undefined ? patch.category : current.category,
      reaction: patch.reaction !== undefined ? patch.reaction : current.reaction,
      reportedStatus: patch.reportedStatus !== undefined ? patch.reportedStatus : current.reportedStatus,
      notedOn: patch.notedOn !== undefined ? patch.notedOn : current.notedOn,
      notes: patch.notes !== undefined ? patch.notes : current.notes,
      clientRequestId: current.clientRequestId,
    },
    { todayYmd },
  );
}

export function normalizeConditionInput(input, { todayYmd } = {}) {
  const status = String(input.status || '').trim();
  if (!CONDITION_STATUSES.includes(status)) fail('აირჩიეთ მდგომარეობის სტატუსი.');
  const reportedBasis = String(input.reportedBasis || '').trim();
  if (!CONDITION_BASES.includes(reportedBasis)) {
    fail('მიუთითეთ, მფლობელის ჩანაწერია თუ ვეტერინარის დადასტურებული.');
  }
  const onsetOn = optionalCivilDate(input.onsetOn, todayYmd, true);
  let resolvedOn = optionalCivilDate(input.resolvedOn, todayYmd, true);
  if (status !== 'resolved' && resolvedOn) {
    fail('დასრულების თარიღი მხოლოდ დასრულებული მდგომარეობისთვის ინახება.');
  }
  if (status === 'resolved' && onsetOn && resolvedOn && resolvedOn < onsetOn) {
    fail('დასრულების თარიღი დაწყების თარიღზე ადრე ვერ იქნება.');
  }
  if (status !== 'resolved') resolvedOn = null;
  return {
    name: requireName(input.name),
    status,
    reportedBasis,
    onsetOn,
    resolvedOn,
    notes: trimText(input.notes, NOTES_MAX, 'შენიშვნა'),
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
  };
}

export function mergeConditionUpdate(current, patch, todayYmd) {
  const nextStatus = patch.status !== undefined ? patch.status : current.status;
  return normalizeConditionInput(
    {
      name: patch.name !== undefined ? patch.name : current.name,
      status: nextStatus,
      reportedBasis: patch.reportedBasis !== undefined ? patch.reportedBasis : current.reportedBasis,
      onsetOn: patch.onsetOn !== undefined ? patch.onsetOn : current.onsetOn,
      resolvedOn:
        nextStatus !== 'resolved'
          ? null
          : patch.resolvedOn !== undefined
            ? patch.resolvedOn
            : current.resolvedOn,
      notes: patch.notes !== undefined ? patch.notes : current.notes,
      clientRequestId: current.clientRequestId,
    },
    { todayYmd },
  );
}

export function normalizeClientRequestId(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length < 8 || text.length > 64) fail('არასწორი მოთხოვნის იდენტიფიკატორი.');
  return text;
}

export function parseListBounds(query) {
  const limitRaw = Number(query?.limit);
  const offsetRaw = Number(query?.offset);
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), WEIGHT_LIST_MAX) : WEIGHT_LIST_DEFAULT;
  const offset = Number.isFinite(offsetRaw) && offsetRaw > 0 ? Math.floor(offsetRaw) : 0;
  return { limit, offset };
}

export function publicWeightLog(row) {
  return {
    id: row.id,
    petId: row.petId,
    recordedOn: row.recordedOn,
    weightKg: kgFromStored(row.weightKg),
    inputValue: kgFromStored(row.inputValue),
    inputUnit: row.inputUnit,
    note: row.note ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export function publicAllergy(row) {
  return {
    id: row.id,
    petId: row.petId,
    name: row.name,
    category: row.category,
    reaction: row.reaction ?? null,
    reportedStatus: row.reportedStatus,
    notedOn: row.notedOn ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export function publicCondition(row) {
  return {
    id: row.id,
    petId: row.petId,
    name: row.name,
    status: row.status,
    reportedBasis: row.reportedBasis,
    onsetOn: row.onsetOn ?? null,
    resolvedOn: row.resolvedOn ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export function weightWriteData(userId, petId, data) {
  return {
    userId,
    petId,
    recordedOn: data.recordedOn,
    weightKg: data.weightKg.toFixed(KG_DECIMALS),
    inputValue: String(data.inputValue),
    inputUnit: data.inputUnit,
    note: data.note,
    clientRequestId: data.clientRequestId,
  };
}

export function decideOwnedChild(record, petId, userId) {
  if (!record || record.userId !== userId || record.petId !== petId) {
    return { status: 404, body: null };
  }
  return { status: 200, body: record };
}
