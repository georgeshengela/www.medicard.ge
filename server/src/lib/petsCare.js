import { assertStableCivilDate } from './cycleCivilDate.js';
import { isRealCalendarDate } from './petsAge.js';
import { isTimeHHmm, parseYmd } from './petsCivilDate.js';
import { normalizeClientRequestId, trimText } from './petsHealth.js';
import {
  CARE_KINDS,
  CARE_ROUTES,
  CARE_SOURCES,
  EVENT_STATUSES,
  RECURRENCE_BASES,
  RECURRENCE_KINDS,
  SCHEDULE_STATUSES,
  TIME_MODES,
  completePayloadHash,
  eventPayloadHash,
  occurrenceKey,
  phase5ReminderIdentity,
  sortedTimes,
} from './petsSchedule.js';

export const PRODUCT_NAME_MAX = 80;
export const FORMULATION_MAX = 80;
export const BATCH_MAX = 40;
export const TITLE_MAX = 80;
export const DOSE_MAX = 40;
export const DOSE_UNIT_MAX = 24;
export const SOURCE_NOTE_MAX = 200;
export const NOTES_MAX = 500;
export const PRODUCT_CAP_PER_PET = 80;
export const SCHEDULE_CAP_PER_PET = 40;
export const EVENT_CAP_PER_PET = 400;
export const EVENT_LIST_DEFAULT = 50;
export const EVENT_LIST_MAX = 100;
export const MAX_COURSE_TIMES = 8;
export const MAX_INTERVAL_DAYS = 365;
export const MAX_INTERVAL_WEEKS = 52;
export const MAX_INTERVAL_MONTHS = 36;
export const MAX_OCCURRENCE_LIMIT = 366;

export const PET_CARE_NOT_FOUND = { error: 'ჩანაწერი ვერ მოიძებნა.' };

function fail(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

export function failCare(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  if (extra.code) error.code = extra.code;
  error.extra = extra;
  throw error;
}

export function careConflict(message, code, extra = {}) {
  failCare(message, 409, { code, ...extra });
}

function requireKind(value) {
  const kind = String(value || '').trim();
  if (!CARE_KINDS.includes(kind)) fail('აირჩიეთ მოვლის კატეგორია.');
  return kind;
}

function optionalText(value, max, field) {
  return trimText(value, max, field);
}

function requireTitle(value) {
  const title = optionalText(value, TITLE_MAX, 'სათაური');
  if (!title) fail('შეიყვანეთ სახელი.');
  return title;
}

export function requireCivilDate(value, { allowFuture = false, todayYmd, field = 'თარიღი' } = {}) {
  if (value == null || value === '') fail(`${field} სავალდებულოა.`);
  const ymd = typeof value === 'string' ? value.trim() : '';
  const stable = assertStableCivilDate(ymd);
  if (!stable || !isRealCalendarDate(stable)) fail(`${field} არასწორია.`);
  if (!allowFuture && todayYmd && stable > todayYmd) fail('მომავალი თარიღი არ დაიშვება.');
  return stable;
}

export function optionalCivilDateAny(value, { allowFuture = true, todayYmd, field = 'თარიღი' } = {}) {
  if (value == null || value === '') return null;
  return requireCivilDate(value, { allowFuture, todayYmd, field });
}

export function optionalTime(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim();
  if (!isTimeHHmm(text)) fail('დრო უნდა იყოს სთ:წთ ფორმატში.');
  return text;
}

function optionalRoute(value) {
  if (value == null || value === '') return null;
  const route = String(value).trim();
  if (!CARE_ROUTES.includes(route)) fail('აირჩიეთ მიღების გზა.');
  return route;
}

function optionalDosePair(dose, doseUnit) {
  const doseText = optionalText(dose, DOSE_MAX, 'დოზა');
  const unitText = optionalText(doseUnit, DOSE_UNIT_MAX, 'ერთეული');
  if (doseText && !unitText) fail('დოზის ერთეული სავალდებულოა.');
  if (unitText && !doseText) fail('დოზა სავალდებულოა ერთეულთან ერთად.');
  return { dose: doseText, doseUnit: unitText };
}

function requireSource(value) {
  const source = String(value || 'USER_ENTERED').trim();
  if (!CARE_SOURCES.includes(source)) fail('აირჩიეთ გეგმის წყარო.');
  return source;
}

export function normalizeProductInput(input, { todayYmd } = {}) {
  return {
    kind: requireKind(input.kind),
    name: requireTitle(input.name),
    formulation: optionalText(input.formulation, FORMULATION_MAX, 'ფორმა / სიძლიერე'),
    batchId: optionalText(input.batchId, BATCH_MAX, 'პარტია'),
    notes: optionalText(input.notes, NOTES_MAX, 'შენიშვნა'),
    expiresOn: optionalCivilDateAny(input.expiresOn, { allowFuture: true, todayYmd, field: 'ვადა' }),
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
  };
}

export function mergeProductUpdate(current, patch, todayYmd) {
  return normalizeProductInput(
    {
      kind: patch.kind !== undefined ? patch.kind : current.kind,
      name: patch.name !== undefined ? patch.name : current.name,
      formulation: patch.formulation !== undefined ? patch.formulation : current.formulation,
      batchId: patch.batchId !== undefined ? patch.batchId : current.batchId,
      notes: patch.notes !== undefined ? patch.notes : current.notes,
      expiresOn: patch.expiresOn !== undefined ? patch.expiresOn : current.expiresOn,
      clientRequestId: current.clientRequestId,
    },
    { todayYmd },
  );
}

function normalizeRecurrence(input) {
  const recurrenceKind = String(input.recurrenceKind || 'ONCE').trim();
  if (!RECURRENCE_KINDS.includes(recurrenceKind)) fail('აირჩიეთ გამეორება.');
  if (input.intervalUnit === 'YEAR' || recurrenceKind === 'EVERY_N_YEARS') {
    fail('წლიური ინტერვალი ამ ვერსიაში არ არის მხარდაჭერილი.');
  }

  let recurrenceBasis = String(input.recurrenceBasis || (recurrenceKind === 'ONCE' ? 'NONE' : '')).trim();
  if (recurrenceKind === 'ONCE') {
    if (recurrenceBasis && recurrenceBasis !== 'NONE') fail('ერთჯერადი მოვლა გამეორების საფუძველს არ იყენებს.');
    recurrenceBasis = 'NONE';
  } else if (recurrenceKind === 'DAILY_COURSE') {
    if (recurrenceBasis === 'FROM_ADMINISTRATION') {
      fail('ყოველდღიური კურსი მხოლოდ კალენდარულ თარიღებს მიჰყვება.');
    }
    recurrenceBasis = 'FIXED_CALENDAR';
  } else if (!RECURRENCE_BASES.includes(recurrenceBasis) || recurrenceBasis === 'NONE') {
    fail('აირჩიეთ, კალენდარს მიჰყვება თუ დადასტურებულ მიღებას.');
  }

  let intervalCount = input.intervalCount == null || input.intervalCount === '' ? null : Number(input.intervalCount);
  if (recurrenceKind === 'ONCE') {
    if (intervalCount != null) fail('ერთჯერად მოვლას ინტერვალი არ აქვს.');
    intervalCount = null;
  } else if (recurrenceKind === 'DAILY_COURSE') {
    intervalCount = 1;
  } else {
    if (!Number.isInteger(intervalCount) || intervalCount < 1) fail('მიუთითეთ ინტერვალი.');
    if (recurrenceKind === 'EVERY_N_DAYS' && intervalCount > MAX_INTERVAL_DAYS) fail('დღეების ინტერვალი ძალიან დიდია.');
    if (recurrenceKind === 'EVERY_N_WEEKS' && intervalCount > MAX_INTERVAL_WEEKS) fail('კვირების ინტერვალი ძალიან დიდია.');
    if (recurrenceKind === 'EVERY_N_MONTHS' && intervalCount > MAX_INTERVAL_MONTHS) fail('თვეების ინტერვალი ძალიან დიდია.');
  }

  let times = null;
  let dueTime = optionalTime(input.dueTime);
  if (recurrenceKind === 'DAILY_COURSE') {
    const raw = Array.isArray(input.times) ? input.times : [];
    times = sortedTimes(raw.map((item) => optionalTime(item)).filter(Boolean));
    if (!times.length) fail('ყოველდღიურ კურსს სჭირდება მინიმუმ ერთი დრო.');
    if (times.length > MAX_COURSE_TIMES) fail('დროების რაოდენობა ძალიან დიდია.');
    dueTime = times[0];
  } else if (Array.isArray(input.times) && input.times.length > 1) {
    fail('რამდენიმე დღიური დრო მხოლოდ ყოველდღიურ კურსზეა.');
  }

  const startOn = requireCivilDate(input.startOn, { allowFuture: true, field: 'დაწყების თარიღი' });
  const courseEndsOn = optionalCivilDateAny(input.courseEndsOn, { allowFuture: true, field: 'კურსის დასასრული' });
  if (courseEndsOn && courseEndsOn < startOn) fail('კურსის დასასრული დაწყებაზე ადრე ვერ იქნება.');

  let occurrenceLimit =
    input.occurrenceLimit == null || input.occurrenceLimit === '' ? null : Number(input.occurrenceLimit);
  if (occurrenceLimit != null) {
    if (!Number.isInteger(occurrenceLimit) || occurrenceLimit < 1 || occurrenceLimit > MAX_OCCURRENCE_LIMIT) {
      fail('გამეორებების ლიმიტი არასწორია.');
    }
  }
  if (recurrenceKind === 'DAILY_COURSE' && !courseEndsOn && occurrenceLimit == null) {
    fail('ყოველდღიურ კურსს სჭირდება დასასრული ან გამეორებების ლიმიტი.');
  }

  const parsedStart = parseYmd(startOn);
  const timeMode = dueTime || (times && times.length) ? 'EXACT_TIME' : 'DATE_BASED';
  if (input.timeMode && TIME_MODES.includes(input.timeMode) && input.timeMode === 'DATE_BASED') {
    if (recurrenceKind === 'DAILY_COURSE') fail('ყოველდღიური კურსი დროს მოითხოვს.');
  }

  return {
    recurrenceKind,
    recurrenceBasis,
    intervalCount,
    times,
    dueTime,
    startOn,
    courseEndsOn,
    occurrenceLimit,
    anchorDay: recurrenceKind === 'EVERY_N_MONTHS' ? parsedStart.day : null,
    timeMode: input.timeMode === 'EXACT_TIME' || timeMode === 'EXACT_TIME' ? 'EXACT_TIME' : 'DATE_BASED',
  };
}

export function normalizeScheduleInput(input, { todayYmd } = {}) {
  const kind = requireKind(input.kind);
  const recurrence = normalizeRecurrence(input);
  const dose = optionalDosePair(input.dose, input.doseUnit);
  return {
    kind,
    title: requireTitle(input.title),
    productId: input.productId ? String(input.productId) : null,
    ...dose,
    route: optionalRoute(input.route),
    ...recurrence,
    source: requireSource(input.source),
    sourceNote: optionalText(input.sourceNote, SOURCE_NOTE_MAX, 'წყაროს შენიშვნა'),
    timezone: optionalText(input.timezone, 80, 'საათობრივი სარტყელი'),
    reminderEnabled: false,
    reminderOffsetsDays: [0],
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
    todayYmd,
  };
}

export function mergeScheduleUpdate(current, patch, todayYmd) {
  return normalizeScheduleInput(
    {
      kind: patch.kind !== undefined ? patch.kind : current.kind,
      title: patch.title !== undefined ? patch.title : current.title,
      productId: patch.productId !== undefined ? patch.productId : current.productId,
      dose: patch.dose !== undefined ? patch.dose : current.dose,
      doseUnit: patch.doseUnit !== undefined ? patch.doseUnit : current.doseUnit,
      route: patch.route !== undefined ? patch.route : current.route,
      startOn: patch.startOn !== undefined ? patch.startOn : current.startOn,
      dueTime: patch.dueTime !== undefined ? patch.dueTime : current.dueTime,
      times: patch.times !== undefined ? patch.times : current.times,
      recurrenceKind: patch.recurrenceKind !== undefined ? patch.recurrenceKind : current.recurrenceKind,
      intervalCount: patch.intervalCount !== undefined ? patch.intervalCount : current.intervalCount,
      recurrenceBasis: patch.recurrenceBasis !== undefined ? patch.recurrenceBasis : current.recurrenceBasis,
      source: patch.source !== undefined ? patch.source : current.source,
      sourceNote: patch.sourceNote !== undefined ? patch.sourceNote : current.sourceNote,
      courseEndsOn: patch.courseEndsOn !== undefined ? patch.courseEndsOn : current.courseEndsOn,
      occurrenceLimit: patch.occurrenceLimit !== undefined ? patch.occurrenceLimit : current.occurrenceLimit,
      timeMode: patch.timeMode !== undefined ? patch.timeMode : current.timeMode,
      timezone: patch.timezone !== undefined ? patch.timezone : current.timezone,
      clientRequestId: current.clientRequestId,
    },
    { todayYmd },
  );
}

export function normalizeEventInput(input, { todayYmd, allowFuture = false } = {}) {
  const kind = requireKind(input.kind);
  const dose = optionalDosePair(input.dose, input.doseUnit);
  const administeredOn = requireCivilDate(input.administeredOn, {
    allowFuture,
    todayYmd,
    field: 'მიღების თარიღი',
  });
  return {
    kind,
    title: requireTitle(input.title),
    productId: input.productId ? String(input.productId) : null,
    scheduleId: input.scheduleId ? String(input.scheduleId) : null,
    ...dose,
    route: optionalRoute(input.route),
    administeredOn,
    administeredTime: optionalTime(input.administeredTime),
    timezone: optionalText(input.timezone, 80, 'საათობრივი სარტყელი'),
    utcOffsetMinutes:
      input.utcOffsetMinutes == null || input.utcOffsetMinutes === ''
        ? null
        : Number.isInteger(Number(input.utcOffsetMinutes))
          ? Number(input.utcOffsetMinutes)
          : fail('საათობრივი წანაცვლება არასწორია.'),
    notes: optionalText(input.notes, NOTES_MAX, 'შენიშვნა'),
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
  };
}

export function normalizeCompleteInput(input, { todayYmd } = {}) {
  const occurrence = String(input.occurrenceKey || '').trim();
  if (!occurrence) fail('მიუთითეთ მოვლის შემთხვევა.');
  const revision = Number(input.revision);
  if (!Number.isInteger(revision) || revision < 1) fail('გეგმის ვერსია არასწორია.');
  const dose = optionalDosePair(input.dose, input.doseUnit);
  return {
    occurrenceKey: occurrence,
    revision,
    administeredOn: requireCivilDate(input.administeredOn, {
      allowFuture: false,
      todayYmd,
      field: 'მიღების თარიღი',
    }),
    administeredTime: optionalTime(input.administeredTime),
    timezone: optionalText(input.timezone, 80, 'საათობრივი სარტყელი'),
    utcOffsetMinutes:
      input.utcOffsetMinutes == null || input.utcOffsetMinutes === ''
        ? null
        : Number.isInteger(Number(input.utcOffsetMinutes))
          ? Number(input.utcOffsetMinutes)
          : fail('საათობრივი წანაცვლება არასწორია.'),
    notes: optionalText(input.notes, NOTES_MAX, 'შენიშვნა'),
    ...dose,
    route: optionalRoute(input.route),
    clientRequestId: normalizeClientRequestId(input.clientRequestId),
  };
}

export function iso(value) {
  return value instanceof Date ? value.toISOString() : value;
}

export function publicProduct(row) {
  return {
    id: row.id,
    petId: row.petId,
    kind: row.kind,
    name: row.name,
    formulation: row.formulation ?? null,
    batchId: row.batchId ?? null,
    notes: row.notes ?? null,
    expiresOn: row.expiresOn ?? null,
    archivedAt: row.archivedAt ? iso(row.archivedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function publicSchedule(row) {
  const times = Array.isArray(row.times) ? row.times : row.times == null ? null : row.times;
  return {
    id: row.id,
    petId: row.petId,
    productId: row.productId ?? null,
    kind: row.kind,
    title: row.title,
    dose: row.dose ?? null,
    doseUnit: row.doseUnit ?? null,
    route: row.route ?? null,
    startOn: row.startOn,
    dueTime: row.dueTime ?? null,
    times,
    recurrenceKind: row.recurrenceKind,
    intervalCount: row.intervalCount ?? null,
    recurrenceBasis: row.recurrenceBasis,
    source: row.source,
    sourceNote: row.sourceNote ?? null,
    courseEndsOn: row.courseEndsOn ?? null,
    occurrenceLimit: row.occurrenceLimit ?? null,
    anchorDay: row.anchorDay ?? null,
    status: row.status,
    revision: row.revision,
    nextDueOn: row.nextDueOn ?? null,
    nextDueTime: row.nextDueTime ?? null,
    nextSequence: row.nextSequence ?? null,
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderOffsetsDays: Array.isArray(row.reminderOffsetsDays) ? row.reminderOffsetsDays : [0],
    timeMode: row.timeMode,
    timezone: row.timezone ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function publicOccurrence(row, schedule) {
  const key =
    row.occurrenceKey ||
    occurrenceKey({
      revision: row.revision,
      plannedOn: row.plannedOn,
      plannedTime: row.plannedTime,
      sequence: row.sequence,
    });
  return {
    scheduleId: row.scheduleId || schedule?.id || null,
    revision: row.revision,
    plannedOn: row.plannedOn,
    plannedTime: row.plannedTime ?? null,
    sequence: row.sequence,
    occurrenceKey: key,
    status: row.status || 'OPEN',
    eventId: row.eventId ?? null,
    reminderIdentity:
      row.reminderIdentity ||
      (schedule?.userId && schedule?.petId && (row.scheduleId || schedule?.id)
        ? phase5ReminderIdentity({
            userId: schedule.userId,
            petId: schedule.petId,
            scheduleId: row.scheduleId || schedule.id,
            occurrenceKey: key,
          })
        : null),
    reminderEnabled: Boolean(schedule?.reminderEnabled),
    kind: schedule?.kind || row.kind || null,
    title: schedule?.title || row.title || null,
  };
}

export function publicEvent(row) {
  return {
    id: row.id,
    petId: row.petId,
    kind: row.kind,
    productId: row.productId ?? null,
    scheduleId: row.scheduleId ?? null,
    occurrenceId: row.occurrenceId ?? row.occurrence?.id ?? null,
    occurrenceKey: row.occurrenceKey ?? row.occurrence?.occurrenceKey ?? null,
    titleSnapshot: row.titleSnapshot,
    productNameSnapshot: row.productNameSnapshot ?? null,
    doseSnapshot: row.doseSnapshot ?? null,
    doseUnitSnapshot: row.doseUnitSnapshot ?? null,
    routeSnapshot: row.routeSnapshot ?? null,
    administeredOn: row.administeredOn,
    administeredTime: row.administeredTime ?? null,
    timezone: row.timezone ?? null,
    utcOffsetMinutes: row.utcOffsetMinutes ?? null,
    notes: row.notes ?? null,
    status: row.status,
    voidedAt: row.voidedAt ? iso(row.voidedAt) : null,
    voidReason: row.voidReason ?? null,
    correctionMeta: row.correctionMeta ?? null,
    previousNextDueOn: row.previousNextDueOn ?? null,
    source: row.source,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  };
}

export function productWriteData(userId, petId, data) {
  return {
    userId,
    petId,
    kind: data.kind,
    name: data.name,
    formulation: data.formulation,
    batchId: data.batchId,
    notes: data.notes,
    expiresOn: data.expiresOn,
    clientRequestId: data.clientRequestId,
  };
}

export function scheduleWriteData(userId, petId, data, derived) {
  return {
    userId,
    petId,
    productId: data.productId,
    kind: data.kind,
    title: data.title,
    dose: data.dose,
    doseUnit: data.doseUnit,
    route: data.route,
    startOn: data.startOn,
    dueTime: data.dueTime,
    times: data.times,
    recurrenceKind: data.recurrenceKind,
    intervalCount: data.intervalCount,
    recurrenceBasis: data.recurrenceBasis,
    source: data.source,
    sourceNote: data.sourceNote,
    courseEndsOn: data.courseEndsOn,
    occurrenceLimit: data.occurrenceLimit,
    anchorDay: data.anchorDay,
    status: derived.status || 'ACTIVE',
    revision: derived.revision || 1,
    nextDueOn: derived.nextDueOn,
    nextDueTime: derived.nextDueTime,
    nextSequence: derived.nextSequence,
    reminderEnabled: data.reminderEnabled === true,
    reminderOffsetsDays: Array.isArray(data.reminderOffsetsDays) ? data.reminderOffsetsDays : [0],
    timeMode: data.timeMode,
    timezone: data.timezone,
    clientRequestId: data.clientRequestId,
  };
}

export function hashes() {
  return { completePayloadHash, eventPayloadHash };
}

export { CARE_KINDS, EVENT_STATUSES, SCHEDULE_STATUSES };
