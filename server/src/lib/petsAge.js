import { toDateKey, todayInTimeZone } from './cycle.js';
import { clientTimezoneFromReq, CYCLE_TIMEZONE_FALLBACK, assertStableCivilDate } from './cycleCivilDate.js';
import { getSpecies, isBreedAllowedForSpecies } from './petsCatalog.js';

export const AGE_KINDS = Object.freeze(['EXACT', 'APPROXIMATE', 'UNKNOWN']);
export const SEX_VALUES = Object.freeze(['MALE', 'FEMALE', 'UNKNOWN']);
export const MAX_PETS_PER_USER = 20;
export const PET_NAME_MAX = 40;
export const PET_MAX_YEARS = 80;
export const CUSTOM_BREED_MAX = 80;

export function petTodayYmd(req, now = new Date()) {
  const tz = clientTimezoneFromReq(req) || CYCLE_TIMEZONE_FALLBACK;
  return todayInTimeZone(tz, now);
}

export function isRealCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function civilYmdToUtcDate(ymd) {
  const key = assertStableCivilDate(ymd);
  if (!key || !isRealCalendarDate(key)) return null;
  return new Date(`${key}T00:00:00.000Z`);
}

export function birthDateToYmd(birthDate) {
  return toDateKey(birthDate);
}

export function monthsBetweenCivil(fromYmd, toYmd) {
  const from = assertStableCivilDate(fromYmd);
  const to = assertStableCivilDate(toYmd);
  if (!from || !to) return null;
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function addMonthsToAge(years, months, extraMonths) {
  const start = Math.max(0, (Number(years) || 0) * 12 + (Number(months) || 0));
  const total = start + extraMonths;
  if (!Number.isFinite(total) || total < 0) return { years: 0, months: 0 };
  return { years: Math.floor(total / 12), months: total % 12 };
}

export function exactAgeParts(birthYmd, todayYmd) {
  const born = assertStableCivilDate(birthYmd);
  const today = assertStableCivilDate(todayYmd);
  if (!born || !today || today < born) return null;
  const [by, bm, bd] = born.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  let years = ty - by;
  let months = tm - bm;
  if (td < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 0) return null;
  return { years, months };
}

export function displayAgeParts(pet, todayYmd) {
  const kind = pet?.ageKind;
  if (kind === 'UNKNOWN') return { kind: 'UNKNOWN', years: null, months: null };
  if (kind === 'EXACT') {
    const ymd = birthDateToYmd(pet.birthDate);
    const parts = exactAgeParts(ymd, todayYmd);
    if (!parts) return { kind: 'EXACT', years: null, months: null };
    return { kind: 'EXACT', ...parts };
  }
  if (kind === 'APPROXIMATE') {
    const recorded = assertStableCivilDate(pet.approxAgeRecordedOn);
    const extra = recorded ? monthsBetweenCivil(recorded, todayYmd) : 0;
    const elapsed = extra == null ? 0 : Math.max(0, extra);
    const parts = addMonthsToAge(pet.approxAgeYears, pet.approxAgeMonths, elapsed);
    return { kind: 'APPROXIMATE', ...parts };
  }
  return { kind: 'UNKNOWN', years: null, months: null };
}

function fail(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

export function normalizePetIdentity(input, { todayYmd, partial = false } = {}) {
  const name = input.name == null ? undefined : String(input.name).trim();
  if (!partial && (name == null || name.length < 1)) throw fail('შეიყვანეთ ცხოველის სახელი.');
  if (name != null && (name.length < 1 || name.length > PET_NAME_MAX)) {
    throw fail(`სახელი უნდა იყოს 1–${PET_NAME_MAX} სიმბოლო.`);
  }

  const speciesId = input.speciesId == null ? undefined : String(input.speciesId);
  if (!partial && !getSpecies(speciesId)) throw fail('აირჩიეთ სახეობა.');
  if (speciesId != null && !getSpecies(speciesId)) throw fail('აირჩიეთ სახეობა.');

  let breedId = input.breedId == null ? undefined : String(input.breedId);
  if (!partial && breedId == null) breedId = 'unknown';
  if (speciesId && breedId && !isBreedAllowedForSpecies(speciesId, breedId)) {
    throw fail('ეს ჯიში ამ სახეობას არ ერგება.');
  }
  if (breedId === 'custom') {
    const custom = String(input.customBreed || '').trim();
    if (!custom) throw fail('ჩაწერეთ ჯიში.');
    if (custom.length > CUSTOM_BREED_MAX) throw fail('ჯიშის სახელი ძალიან გრძელია.');
  }
  if (breedId && breedId !== 'custom' && input.customBreed != null && String(input.customBreed).trim()) {
    // Ignore leftover custom text unless custom is selected.
  }

  const sex = input.sex == null ? (partial ? undefined : 'UNKNOWN') : String(input.sex);
  if (sex != null && !SEX_VALUES.includes(sex)) throw fail('აირჩიეთ სქესი.');

  let neutered = input.neutered;
  if (neutered === undefined && !partial) neutered = null;
  if (neutered !== undefined && neutered !== null && typeof neutered !== 'boolean') {
    throw fail('სტერილიზაციის სტატუსი არასწორია.');
  }

  const ageKind = input.ageKind == null ? (partial ? undefined : 'UNKNOWN') : String(input.ageKind);
  if (ageKind != null && !AGE_KINDS.includes(ageKind)) throw fail('აირჩიეთ ასაკის ტიპი.');

  const age = normalizeAgeFields(
    {
      ageKind: ageKind ?? 'UNKNOWN',
      birthDate: input.birthDate,
      approxAgeYears: input.approxAgeYears,
      approxAgeMonths: input.approxAgeMonths,
      approxAgeRecordedOn: input.approxAgeRecordedOn,
    },
    { todayYmd, required: !partial || ageKind != null },
  );

  const vet = {
    vetClinicName: emptyToNull(input.vetClinicName, 160),
    vetName: emptyToNull(input.vetName, 80),
    vetPhone: emptyToNull(input.vetPhone, 40),
    vetAddress: emptyToNull(input.vetAddress, 300),
    vetNotes: emptyToNull(input.vetNotes, 500),
  };

  const customBreed =
    breedId === 'custom' ? String(input.customBreed).trim() : breedId != null ? null : undefined;

  return {
    ...(name !== undefined ? { name } : {}),
    ...(speciesId !== undefined ? { speciesId } : {}),
    ...(breedId !== undefined ? { breedId, customBreed } : {}),
    ...(sex !== undefined ? { sex } : {}),
    ...(neutered !== undefined ? { neutered } : {}),
    ...age,
    ...vetIfPresent(input, vet),
  };
}

function emptyToNull(value, max) {
  if (value === undefined) return undefined;
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw fail('ტექსტი ძალიან გრძელია.');
  return trimmed;
}

function vetIfPresent(input, vet) {
  const keys = ['vetClinicName', 'vetName', 'vetPhone', 'vetAddress', 'vetNotes'];
  if (!keys.some((key) => input[key] !== undefined)) return {};
  return vet;
}

export function normalizeAgeFields(input, { todayYmd, required = true } = {}) {
  const kind = input.ageKind;
  if (!required && (kind == null || kind === undefined)) {
    return {};
  }
  if (kind === 'UNKNOWN') {
    if (input.birthDate) throw fail('უცნობი ასაკისთვის დაბადების თარიღი არ ინახება.');
    if (input.approxAgeYears != null || input.approxAgeMonths != null || input.approxAgeRecordedOn) {
      throw fail('უცნობი ასაკისთვის მიახლოებითი ასაკი არ ინახება.');
    }
    return {
      ageKind: 'UNKNOWN',
      birthDate: null,
      approxAgeYears: null,
      approxAgeMonths: null,
      approxAgeRecordedOn: null,
    };
  }

  if (kind === 'EXACT') {
    const ymd = typeof input.birthDate === 'string' ? input.birthDate : birthDateToYmd(input.birthDate);
    if (!ymd || !isRealCalendarDate(ymd)) throw fail('ასეთი თარიღი არ არსებობს.');
    if (ymd > todayYmd) throw fail('დაბადების თარიღი მომავალში ვერ იქნება.');
    const parts = exactAgeParts(ymd, todayYmd);
    if (!parts) throw fail('დაბადების თარიღი მომავალში ვერ იქნება.');
    if (parts.years > PET_MAX_YEARS) throw fail('შეამოწმეთ დაბადების თარიღი.');
    if (input.approxAgeYears != null || input.approxAgeMonths != null || input.approxAgeRecordedOn) {
      throw fail('ზუსტი თარიღისთვის მიახლოებითი ასაკი არ ინახება.');
    }
    return {
      ageKind: 'EXACT',
      birthDate: civilYmdToUtcDate(ymd),
      approxAgeYears: null,
      approxAgeMonths: null,
      approxAgeRecordedOn: null,
    };
  }

  if (kind === 'APPROXIMATE') {
    if (input.birthDate) throw fail('მიახლოებითი ასაკისთვის დაბადების თარიღი არ იწერება.');
    const years = input.approxAgeYears == null || input.approxAgeYears === '' ? null : Number(input.approxAgeYears);
    const months = input.approxAgeMonths == null || input.approxAgeMonths === '' ? null : Number(input.approxAgeMonths);
    if (years == null && months == null) throw fail('მიუთითეთ წლები ან თვეები.');
    if (years != null && (!Number.isInteger(years) || years < 0 || years > PET_MAX_YEARS)) {
      throw fail('ასაკი არასწორია.');
    }
    if (months != null && (!Number.isInteger(months) || months < 0 || months > 11)) {
      throw fail('თვეები უნდა იყოს 0–11.');
    }
    if ((years ?? 0) === 0 && (months ?? 0) === 0) throw fail('მიუთითეთ ასაკი, ან აირჩიეთ უცნობი.');
    let recorded = input.approxAgeRecordedOn == null || input.approxAgeRecordedOn === ''
      ? todayYmd
      : String(input.approxAgeRecordedOn);
    recorded = assertStableCivilDate(recorded);
    if (!recorded || !isRealCalendarDate(recorded)) throw fail('ასაკის ჩაწერის თარიღი არასწორია.');
    if (recorded > todayYmd) throw fail('ასაკის ჩაწერის თარიღი მომავალში ვერ იქნება.');
    return {
      ageKind: 'APPROXIMATE',
      birthDate: null,
      approxAgeYears: years,
      approxAgeMonths: months,
      approxAgeRecordedOn: recorded,
    };
  }

  throw fail('აირჩიეთ ასაკის ტიპი.');
}

export function mergePetUpdate(current, patch, todayYmd) {
  const next = {
    name: patch.name !== undefined ? patch.name : current.name,
    speciesId: patch.speciesId !== undefined ? patch.speciesId : current.speciesId,
    breedId: patch.breedId !== undefined ? patch.breedId : current.breedId,
    customBreed: patch.customBreed !== undefined ? patch.customBreed : current.customBreed,
    sex: patch.sex !== undefined ? patch.sex : current.sex,
    neutered: patch.neutered !== undefined ? patch.neutered : current.neutered,
    ageKind: patch.ageKind !== undefined ? patch.ageKind : current.ageKind,
    birthDate: patch.birthDate !== undefined ? patch.birthDate : birthDateToYmd(current.birthDate),
    approxAgeYears: patch.approxAgeYears !== undefined ? patch.approxAgeYears : current.approxAgeYears,
    approxAgeMonths: patch.approxAgeMonths !== undefined ? patch.approxAgeMonths : current.approxAgeMonths,
    approxAgeRecordedOn: patch.approxAgeRecordedOn !== undefined ? patch.approxAgeRecordedOn : current.approxAgeRecordedOn,
    vetClinicName: patch.vetClinicName !== undefined ? patch.vetClinicName : current.vetClinicName,
    vetName: patch.vetName !== undefined ? patch.vetName : current.vetName,
    vetPhone: patch.vetPhone !== undefined ? patch.vetPhone : current.vetPhone,
    vetAddress: patch.vetAddress !== undefined ? patch.vetAddress : current.vetAddress,
    vetNotes: patch.vetNotes !== undefined ? patch.vetNotes : current.vetNotes,
  };

  if (patch.speciesId && patch.speciesId !== current.speciesId && patch.breedId == null) {
    next.breedId = 'unknown';
    next.customBreed = null;
  }

  return normalizePetIdentity(next, { todayYmd, partial: false });
}

export function publicPet(row, { todayYmd } = {}) {
  const today = todayYmd || todayInTimeZone(CYCLE_TIMEZONE_FALLBACK);
  const birthYmd = birthDateToYmd(row.birthDate);
  const age = displayAgeParts(
    {
      ageKind: row.ageKind,
      birthDate: birthYmd,
      approxAgeYears: row.approxAgeYears,
      approxAgeMonths: row.approxAgeMonths,
      approxAgeRecordedOn: row.approxAgeRecordedOn,
    },
    today,
  );
  return {
    id: row.id,
    name: row.name,
    speciesId: row.speciesId,
    breedId: row.breedId,
    customBreed: row.customBreed,
    sex: row.sex,
    neutered: row.neutered,
    ageKind: row.ageKind,
    birthDate: birthYmd,
    approxAgeYears: row.approxAgeYears,
    approxAgeMonths: row.approxAgeMonths,
    approxAgeRecordedOn: row.approxAgeRecordedOn,
    age,
    photoUrl: row.photoUrl,
    vetClinicName: row.vetClinicName,
    vetName: row.vetName,
    vetPhone: row.vetPhone,
    vetAddress: row.vetAddress,
    vetNotes: row.vetNotes,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
