// MEDIVET fixtures: the /pets hub, the pet page and its sub-pages (weight, allergies, conditions, care
// calendar / plan / history / products, MEDIVET chat list), plus the small writes those pages send.
//
//   Pet ids (fixed, the same for both personas):
//     ბონი — dog, Golden Retriever, featured (first by createdAt):  BONI_ID = 'b0a1e7d2-5c4f-4e8a-9b13-2f6d8c0a4b71'
//     მია  — cat, British Shorthair:                                 MIA_ID  = 'c4d2a9f0-7b3e-4c51-8a06-9e1f3b5d7c28'
//   Screenshot URLs: /pets, /pets/<BONI_ID>, /pets/<BONI_ID>/care, /care/plan, /care/history, /care/products,
//                    /pets/<BONI_ID>/weight, /allergies, /conditions, /chat (empty conversation).
//
// Shapes: server/src/routes/pets.routes.js, petsHealth.routes.js, petsCare.routes.js, petsChat.routes.js and their
// serializers (lib/petsAge.js publicPet, lib/petsHealth.js publicWeightLog/publicAllergy/publicCondition,
// lib/petsCare.js publicProduct/publicSchedule/publicOccurrence/publicEvent, lib/petsSchedule.js generateOccurrences,
// lib/petsChat.js publicChatSession). Occurrence generation is a port of generateOccurrences for the two recurrence
// shapes used here (FROM_ADMINISTRATION and FIXED_CALENDAR every N months). The catalog and the clinic open-state come
// from the pure server modules lib/petsCatalog.js / lib/petsClinics.js (imported read-only, lazily); the clinic list is
// the app's own bundled mobile/src/lib/petsClinicsFallback.json. No photos (photoUrl null → the app's species art).
//
// Must sort before profile.mjs (its GET /api/pets returns an empty list). State lives in state.medivet because
// profile.mjs' init runs after this one and resets state.pets.
// Not mocked: POST /api/pets/:id/chat/query (MEDIVET AI answer, streamed), photo upload/delete.
// PETS_FIXTURE=off → this module serves nothing (profile.mjs' empty list wins again).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addDays, isoAt } from '../lib.mjs';

const REPO = process.env.MEDICARD_REPO || 'C:/Users/User/Desktop/www.medicard';

export const BONI_ID = 'b0a1e7d2-5c4f-4e8a-9b13-2f6d8c0a4b71';
export const MIA_ID = 'c4d2a9f0-7b3e-4c51-8a06-9e1f3b5d7c28';

// ───────────────────────── helpers ─────────────────────────

const en = (rq) => String(rq.lang || '').toLowerCase().startsWith('en');
const t = (rq, ka, english) => (en(rq) ? english : ka);

/** RFC 4122 v4-shaped id, stable per seed (the server validates :petId etc. as uuid). */
function uuidFrom(seed) {
  const h = createHash('sha1').update(String(seed)).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function unauthorized(rq) {
  if (/^Bearer\s+\S{8,}/.test(rq.auth || '')) return null;
  return rq.reply(401, { error: t(rq, 'ავტორიზაცია საჭიროა. შედი ანგარიშში.', 'Please sign in to continue.') });
}

const PET_NOT_FOUND = (rq) => ({ error: t(rq, 'ცხოველი ვერ მოიძებნა.', 'Pet not found.') });
const CARE_NOT_FOUND = (rq) => ({ error: t(rq, 'ჩანაწერი ვერ მოიძებნა.', 'Record not found.') });

const daysIn = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** lib/petsCivilDate.js addCalendarMonths. */
function addCalendarMonths(ymd, count, anchorDay) {
  const [y, m, d] = ymd.split('-').map(Number);
  const anchor = Number.isInteger(anchorDay) ? anchorDay : d;
  const total = y * 12 + (m - 1) + count;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(anchor, daysIn(year, month))).padStart(2, '0')}`;
}

/** lib/petsAge.js exactAgeParts. */
function exactAgeParts(birthYmd, todayYmd) {
  if (!birthYmd || todayYmd < birthYmd) return null;
  const [by, bm, bd] = birthYmd.split('-').map(Number);
  const [ty, tm, td] = todayYmd.split('-').map(Number);
  let years = ty - by;
  let months = tm - bm;
  if (td < bd) months -= 1;
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return years < 0 ? null : { years, months };
}

/** Birth date `months` months before today, on a fixed day of the month. */
function bornMonthsAgo(today, months, day) {
  const shifted = addCalendarMonths(today, -months);
  return `${shifted.slice(0, 8)}${String(Math.min(day, daysIn(Number(shifted.slice(0, 4)), Number(shifted.slice(5, 7))))).padStart(2, '0')}`;
}

// ───────────────────────── seed ─────────────────────────

function seedPets(today) {
  const boni = {
    id: BONI_ID,
    name: 'ბონი',
    speciesId: 'dog',
    breedId: 'golden-retriever',
    customBreed: null,
    sex: 'MALE',
    neutered: true,
    ageKind: 'EXACT',
    birthDate: bornMonthsAgo(today, 51, 12), // 4 years 3 months
    approxAgeYears: null,
    approxAgeMonths: null,
    approxAgeRecordedOn: null,
    photoUrl: null,
    vetClinicName: 'ვაკის ვეტკლინიკა',
    vetName: 'ნათია გელაშვილი',
    vetPhone: null,
    vetAddress: 'ვაკე, თბილისი',
    vetNotes: 'წლიური შემოწმება — შემოდგომაზე, ვაქცინასთან ერთად.',
    archivedAt: null,
    createdAt: isoAt(addDays(today, -214), '19:42'),
    updatedAt: isoAt(addDays(today, -13), '20:06'),
  };
  const mia = {
    id: MIA_ID,
    name: 'მია',
    speciesId: 'cat',
    breedId: 'british-shorthair',
    customBreed: null,
    sex: 'FEMALE',
    neutered: true,
    ageKind: 'EXACT',
    birthDate: bornMonthsAgo(today, 26, 3), // 2 years 2 months
    approxAgeYears: null,
    approxAgeMonths: null,
    approxAgeRecordedOn: null,
    photoUrl: null,
    vetClinicName: null,
    vetName: null,
    vetPhone: null,
    vetAddress: null,
    vetNotes: null,
    archivedAt: null,
    createdAt: isoAt(addDays(today, -201), '21:15'),
    updatedAt: isoAt(addDays(today, -9), '19:30'),
  };

  const weightRows = (petId, list) =>
    list.map(([offset, kg, note], i) => {
      const recordedOn = addDays(today, offset);
      const at = isoAt(recordedOn, '20:10');
      return { id: uuidFrom(`pet-weight:${petId}:${i}`), petId, recordedOn, weightKg: kg, inputValue: kg, inputUnit: 'kg', note: note ?? null, createdAt: at, updatedAt: at };
    });
  // ბონი: a gentle climb, the vet's advice to trim the portion, then a slow return to ~31.5 kg.
  const weights = [
    ...weightRows(BONI_ID, [
      [-290, 31.8],
      [-245, 32.4],
      [-200, 32.9],
      [-158, 33.1, 'ვეტერინარმა ულუფის ოდნავ შემცირება გვირჩია.'],
      [-116, 32.6],
      [-74, 32.2],
      [-42, 31.9],
      [-13, 31.6],
    ]),
    ...weightRows(MIA_ID, [
      [-180, 3.9],
      [-120, 4.1],
      [-75, 4.2],
      [-35, 4.2],
      [-9, 4.3],
    ]),
  ];

  const allergies = [
    {
      id: uuidFrom(`pet-allergy:${BONI_ID}:0`),
      petId: BONI_ID,
      name: 'ქათმის ცილა',
      category: 'food',
      reaction: 'ქავილი და ყურების სიწითლე',
      reportedStatus: 'suspected',
      notedOn: addDays(today, -150),
      notes: 'ქათმის გარეშე საკვებზე გადასვლის შემდეგ ქავილი შემცირდა.',
      createdAt: isoAt(addDays(today, -150), '21:02'),
      updatedAt: isoAt(addDays(today, -150), '21:02'),
    },
  ];

  const conditions = [
    {
      id: uuidFrom(`pet-condition:${BONI_ID}:0`),
      petId: BONI_ID,
      name: 'ყურის ანთება (ოტიტი)',
      status: 'resolved',
      reportedBasis: 'veterinarian_confirmed',
      onsetOn: addDays(today, -162),
      resolvedOn: addDays(today, -141),
      notes: 'ყურის წვეთები 10 დღე, საკონტროლო ვიზიტზე სუფთა იყო.',
      createdAt: isoAt(addDays(today, -162), '18:40'),
      updatedAt: isoAt(addDays(today, -141), '12:15'),
    },
  ];

  const product = (petId, key, kind, name, formulation, notes, createdOffset) => ({
    id: uuidFrom(`pet-product:${petId}:${key}`),
    petId,
    kind,
    name,
    formulation,
    batchId: null,
    notes,
    expiresOn: addDays(today, 420),
    archivedAt: null,
    createdAt: isoAt(addDays(today, createdOffset), '20:00'),
    updatedAt: isoAt(addDays(today, createdOffset), '20:00'),
  });
  const products = [
    product(BONI_ID, 'flea', 'FLEA_TICK', 'ტაბლეტი რწყილისა და ტკიპისგან', 'ღეჭვადი ტაბლეტი, 20–40 კგ', 'საჭმელთან ერთად.', -122),
    product(BONI_ID, 'worm', 'DEWORMING', 'ჭიის საწინააღმდეგო ტაბლეტი', 'ტაბლეტი, 1 ცალი 10 კგ-ზე', null, -172),
    product(MIA_ID, 'worm', 'DEWORMING', 'ჭიის საწინააღმდეგო პასტა კატებისთვის', 'პასტა, 1 დოზა', null, -95),
  ];
  const productId = (petId, key) => uuidFrom(`pet-product:${petId}:${key}`);

  // Schedules. FROM_ADMINISTRATION: the next date counts from the last real administration (nextDueOn).
  // FIXED_CALENDAR yearly vaccines: the first dose (startOn) is recorded; the next one is a year later.
  const schedule = (petId, key, fields) => {
    const createdAt = isoAt(addDays(today, fields.createdOffset), '20:05');
    const row = {
      id: uuidFrom(`pet-schedule:${petId}:${key}`),
      petId,
      productId: null,
      dose: null,
      doseUnit: null,
      route: null,
      dueTime: null,
      times: null,
      intervalCount: null,
      source: 'USER_ENTERED',
      sourceNote: null,
      courseEndsOn: null,
      occurrenceLimit: null,
      anchorDay: null,
      status: 'ACTIVE',
      revision: 1,
      nextDueTime: null,
      reminderEnabled: true,
      reminderOffsetsDays: [1, 0],
      timeMode: 'DATE_BASED',
      timezone: 'Asia/Tbilisi',
      createdAt,
      updatedAt: createdAt,
      ...fields,
    };
    delete row.createdOffset;
    if (row.recurrenceKind === 'EVERY_N_MONTHS' && row.anchorDay == null) row.anchorDay = Number(row.startOn.slice(8, 10));
    return row;
  };
  const rabiesStart = addDays(today, -342);
  const dhppStart = addDays(today, -310);
  const fvrcpStart = addDays(today, -200);
  const schedules = [
    schedule(BONI_ID, 'flea', {
      kind: 'FLEA_TICK',
      title: 'რწყილისა და ტკიპის დაცვა',
      productId: productId(BONI_ID, 'flea'),
      dose: '1',
      doseUnit: 'ტაბლეტი',
      route: 'oral',
      startOn: addDays(today, -120),
      recurrenceKind: 'EVERY_N_MONTHS',
      intervalCount: 1,
      recurrenceBasis: 'FROM_ADMINISTRATION',
      source: 'PRODUCT_INSTRUCTIONS',
      nextDueOn: addCalendarMonths(addDays(today, -27), 1, Number(addDays(today, -27).slice(8, 10))),
      nextSequence: 4,
      createdOffset: -122,
    }),
    schedule(BONI_ID, 'worm', {
      kind: 'DEWORMING',
      title: 'ჭიის საწინააღმდეგო',
      productId: productId(BONI_ID, 'worm'),
      dose: '3',
      doseUnit: 'ტაბლეტი',
      route: 'oral',
      startOn: addDays(today, -170),
      recurrenceKind: 'EVERY_N_MONTHS',
      intervalCount: 3,
      recurrenceBasis: 'FROM_ADMINISTRATION',
      source: 'VETERINARIAN',
      sourceNote: 'ნათია გელაშვილი',
      nextDueOn: addCalendarMonths(addDays(today, -79), 3, Number(addDays(today, -79).slice(8, 10))),
      nextSequence: 2,
      createdOffset: -172,
    }),
    schedule(BONI_ID, 'rabies', {
      kind: 'VACCINATION',
      title: 'ცოფის ვაქცინა',
      route: 'injection',
      startOn: rabiesStart,
      recurrenceKind: 'EVERY_N_MONTHS',
      intervalCount: 12,
      recurrenceBasis: 'FIXED_CALENDAR',
      source: 'VETERINARIAN',
      sourceNote: 'ვაქცინაციის პასპორტი',
      nextDueOn: addCalendarMonths(rabiesStart, 12),
      nextSequence: 1,
      createdOffset: -212,
    }),
    schedule(BONI_ID, 'dhpp', {
      kind: 'VACCINATION',
      title: 'კომპლექსური ვაქცინა (DHPPi+L)',
      route: 'injection',
      startOn: dhppStart,
      recurrenceKind: 'EVERY_N_MONTHS',
      intervalCount: 12,
      recurrenceBasis: 'FIXED_CALENDAR',
      source: 'VETERINARIAN',
      sourceNote: 'ვაქცინაციის პასპორტი',
      nextDueOn: addCalendarMonths(dhppStart, 12),
      nextSequence: 1,
      createdOffset: -212,
    }),
    schedule(MIA_ID, 'claws', {
      kind: 'OTHER',
      title: 'კლანჭების მოჭრა',
      startOn: addDays(today, -60),
      recurrenceKind: 'EVERY_N_WEEKS',
      intervalCount: 3,
      recurrenceBasis: 'FROM_ADMINISTRATION',
      nextDueOn: addDays(today, 6),
      nextSequence: 3,
      createdOffset: -62,
    }),
    schedule(MIA_ID, 'worm', {
      kind: 'DEWORMING',
      title: 'ჭიის საწინააღმდეგო',
      productId: productId(MIA_ID, 'worm'),
      dose: '1',
      doseUnit: 'დოზა',
      route: 'oral',
      startOn: addDays(today, -165),
      recurrenceKind: 'EVERY_N_MONTHS',
      intervalCount: 3,
      recurrenceBasis: 'FROM_ADMINISTRATION',
      source: 'PRODUCT_INSTRUCTIONS',
      nextDueOn: addCalendarMonths(addDays(today, -73), 3, Number(addDays(today, -73).slice(8, 10))),
      nextSequence: 2,
      createdOffset: -95,
    }),
    schedule(MIA_ID, 'fvrcp', {
      kind: 'VACCINATION',
      title: 'კომპლექსური ვაქცინა (FVRCP)',
      route: 'injection',
      startOn: fvrcpStart,
      recurrenceKind: 'EVERY_N_MONTHS',
      intervalCount: 12,
      recurrenceBasis: 'FIXED_CALENDAR',
      source: 'VETERINARIAN',
      nextDueOn: addCalendarMonths(fvrcpStart, 12),
      nextSequence: 1,
      createdOffset: -199,
    }),
  ];
  const sched = (petId, key) => schedules.find((s) => s.id === uuidFrom(`pet-schedule:${petId}:${key}`));

  // History (newest first when listed). Each completed occurrence keeps its key r1|plannedOn|date|seq.
  const events = [];
  const record = (petId, key, offset, sequence, extra = {}) => {
    const s = sched(petId, key);
    const administeredOn = addDays(today, offset);
    const plannedOn = extra.plannedOn ?? administeredOn;
    const product = s.productId ? products.find((p) => p.id === s.productId) : null;
    const at = isoAt(administeredOn, extra.time ?? '19:20');
    events.push({
      id: uuidFrom(`pet-event:${petId}:${key}:${sequence}`),
      petId,
      kind: s.kind,
      productId: s.productId,
      scheduleId: s.id,
      occurrenceId: uuidFrom(`pet-occurrence:${petId}:${key}:${sequence}`),
      occurrenceKey: `r1|${plannedOn}|date|${sequence}`,
      titleSnapshot: s.title,
      productNameSnapshot: product?.name ?? null,
      doseSnapshot: s.dose,
      doseUnitSnapshot: s.doseUnit,
      routeSnapshot: s.route,
      administeredOn,
      administeredTime: null,
      timezone: 'Asia/Tbilisi',
      utcOffsetMinutes: 240,
      notes: extra.notes ?? null,
      status: 'RECORDED',
      voidedAt: null,
      voidReason: null,
      correctionMeta: null,
      previousNextDueOn: plannedOn,
      source: 'app',
      createdAt: at,
      updatedAt: at,
    });
  };
  record(BONI_ID, 'flea', -27, 3);
  record(BONI_ID, 'flea', -58, 2);
  record(BONI_ID, 'flea', -89, 1);
  record(BONI_ID, 'flea', -120, 0);
  record(BONI_ID, 'worm', -79, 1);
  record(BONI_ID, 'worm', -170, 0);
  record(BONI_ID, 'rabies', -342, 0, { plannedOn: rabiesStart, notes: 'ვაქცინაციის პასპორტში ჩაიწერა.', time: '11:30' });
  record(BONI_ID, 'dhpp', -310, 0, { plannedOn: dhppStart, time: '11:10' });
  record(MIA_ID, 'claws', -15, 2);
  record(MIA_ID, 'claws', -37, 1);
  record(MIA_ID, 'worm', -73, 1);
  record(MIA_ID, 'worm', -165, 0);
  record(MIA_ID, 'fvrcp', -200, 0, { plannedOn: fvrcpStart, time: '12:00' });

  const chats = [
    { id: uuidFrom(`pet-chat:${BONI_ID}:0`), petId: BONI_ID, title: 'ახალი საუბარი', createdAt: isoAt(addDays(today, -6), '21:04'), updatedAt: isoAt(addDays(today, -6), '21:04') },
    { id: uuidFrom(`pet-chat:${MIA_ID}:0`), petId: MIA_ID, title: 'ახალი საუბარი', createdAt: isoAt(addDays(today, -20), '22:11'), updatedAt: isoAt(addDays(today, -20), '22:11') },
  ];

  return { seededFor: today, pets: [boni, mia], weights, allergies, conditions, products, schedules, events, chats, messages: [], occurrences: [] };
}

export function init(state, ctx) {
  state.medivet = seedPets(ctx.today);
}

function slice(rq) {
  if (!rq.state.medivet || rq.state.medivet.seededFor !== rq.today) rq.state.medivet = seedPets(rq.today);
  return rq.state.medivet;
}

const userIdOf = (rq) => rq.state.user?.id || (rq.persona === 'man' ? 'mock-user-man-0001' : 'mock-user-women-0001');

// ───────────────────────── serializers ─────────────────────────

function publicPet(row, today) {
  const age =
    row.ageKind === 'EXACT'
      ? { kind: 'EXACT', ...(exactAgeParts(row.birthDate, today) ?? { years: null, months: null }) }
      : row.ageKind === 'APPROXIMATE'
        ? { kind: 'APPROXIMATE', years: row.approxAgeYears ?? 0, months: row.approxAgeMonths ?? 0 }
        : { kind: 'UNKNOWN', years: null, months: null };
  return { ...row, age };
}

const READY = { schemaReady: true };
const HEALTH = { schemaReady: true, healthSchemaReady: true };
const CARE = { schemaReady: true, careSchemaReady: true };

function occurrenceOf(s, plannedOn, sequence, userId) {
  const key = `r${s.revision}|${plannedOn}|${s.dueTime || 'date'}|${sequence}`;
  return {
    scheduleId: s.id,
    revision: s.revision,
    plannedOn,
    plannedTime: s.dueTime || null,
    sequence,
    occurrenceKey: key,
    status: 'OPEN',
    eventId: null,
    reminderIdentity: `pets:${userId}:${s.petId}:${s.id}:${key}:due`,
    reminderEnabled: Boolean(s.reminderEnabled),
    kind: s.kind,
    title: s.title,
  };
}

function intervalDate(s, sequence) {
  const n = s.intervalCount || 1;
  if (s.recurrenceKind === 'ONCE') return s.startOn;
  if (s.recurrenceKind === 'EVERY_N_DAYS') return addDays(s.startOn, n * sequence);
  if (s.recurrenceKind === 'EVERY_N_WEEKS') return addDays(s.startOn, n * 7 * sequence);
  if (s.recurrenceKind === 'EVERY_N_MONTHS') return addCalendarMonths(s.startOn, n * sequence, s.anchorDay);
  return null;
}

/** lib/petsSchedule.js generateOccurrences (60-day horizon, 14-day overdue look-back, ≤ 3 overdue). */
function generate(m, s, today, userId) {
  const empty = { overdue: [], due: [], upcoming: [] };
  if (s.status !== 'ACTIVE') return empty;
  const horizon = addDays(today, 60);
  const lookback = addDays(today, -14);
  const overdueFrom = s.startOn > lookback ? s.startOn : lookback;
  const resolved = new Set(m.events.filter((e) => e.scheduleId === s.id && e.status === 'RECORDED').map((e) => e.occurrenceKey));
  for (const o of m.occurrences) if (o.scheduleId === s.id) resolved.add(o.occurrenceKey);
  let series = [];
  if (s.recurrenceBasis === 'FROM_ADMINISTRATION' || s.recurrenceKind === 'DAILY_COURSE') {
    if (s.nextDueOn) series = [occurrenceOf(s, s.nextDueOn, s.nextSequence ?? 0, userId)];
  } else {
    for (let seq = 0; seq < 200; seq += 1) {
      if (s.occurrenceLimit != null && seq >= s.occurrenceLimit) break;
      const plannedOn = intervalDate(s, seq);
      if (!plannedOn || plannedOn > horizon) break;
      if (s.courseEndsOn && plannedOn > s.courseEndsOn) break;
      series.push(occurrenceOf(s, plannedOn, seq, userId));
      if (s.recurrenceKind === 'ONCE') break;
    }
  }
  const out = { overdue: [], due: [], upcoming: [] };
  for (const o of series) {
    if (resolved.has(o.occurrenceKey)) continue;
    if (o.plannedOn < today) {
      if (o.plannedOn >= overdueFrom) out.overdue.push(o);
    } else if (o.plannedOn === today) out.due.push(o);
    else if (o.plannedOn <= horizon) out.upcoming.push(o);
  }
  out.overdue = out.overdue.slice(-3);
  out.upcoming = out.upcoming.slice(0, 40);
  return out;
}

const byPlanned = (a, b) => a.plannedOn.localeCompare(b.plannedOn) || String(a.plannedTime || '').localeCompare(String(b.plannedTime || ''));

/** Next due fields after a completion (FROM_ADMINISTRATION counts from the administration date). */
function advance(s, planned, administeredOn) {
  if (s.recurrenceKind === 'ONCE') return { nextDueOn: null, nextDueTime: null, nextSequence: null, status: 'COMPLETED' };
  const nextSeq = planned.sequence + 1;
  let nextOn;
  if (s.recurrenceBasis === 'FROM_ADMINISTRATION') {
    const n = s.intervalCount || 1;
    nextOn =
      s.recurrenceKind === 'EVERY_N_DAYS'
        ? addDays(administeredOn, n)
        : s.recurrenceKind === 'EVERY_N_WEEKS'
          ? addDays(administeredOn, n * 7)
          : addCalendarMonths(administeredOn, n, Number(administeredOn.slice(8, 10)));
  } else {
    nextOn = intervalDate(s, nextSeq);
  }
  return { nextDueOn: nextOn, nextDueTime: s.dueTime || null, nextSequence: nextSeq, status: 'ACTIVE' };
}

// ───────────────────────── lookups ─────────────────────────

function activePet(rq) {
  const m = slice(rq);
  const pet = m.pets.find((p) => p.id === rq.params.petId && !p.archivedAt);
  return pet ? { m, pet } : null;
}

/** Wraps a pet-scoped handler: auth, then 404 PET_NOT_FOUND for an unknown/archived pet. */
const petRoute = (fn) => (rq) => {
  const denied = unauthorized(rq);
  if (denied) return denied;
  const found = activePet(rq);
  if (!found) return rq.reply(404, PET_NOT_FOUND(rq));
  return fn(rq, found.m, found.pet);
};

function listBounds(query, def = 50, max = 100) {
  const l = Number(query?.limit);
  const o = Number(query?.offset);
  return { limit: Number.isFinite(l) && l > 0 ? Math.min(Math.floor(l), max) : def, offset: Number.isFinite(o) && o > 0 ? Math.floor(o) : 0 };
}

const weightDesc = (a, b) => b.recordedOn.localeCompare(a.recordedOn) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
const nowIso = () => new Date().toISOString();
const pick = (body, keys) => Object.fromEntries(keys.filter((k) => body && Object.prototype.hasOwnProperty.call(body, k)).map((k) => [k, body[k]]));
const toKg = (value, unit) => {
  const v = Number(value);
  if (!(v > 0)) return null;
  const kg = unit === 'g' ? v / 1000 : unit === 'lb' ? v * 0.45359237 : v;
  return Math.round(kg * 100000) / 100000;
};

// Clinics: the bundled directory with the server's open-state rule.
let CLINICS = null;
let clinicOpenState = null;
async function clinicsDirectory() {
  if (!CLINICS) {
    try {
      CLINICS = JSON.parse(readFileSync(join(REPO, 'mobile', 'src', 'lib', 'petsClinicsFallback.json'), 'utf8'));
    } catch {
      CLINICS = [];
    }
  }
  if (!clinicOpenState) {
    try {
      clinicOpenState = (await import(pathToFileURL(join(REPO, 'server', 'src', 'lib', 'petsClinics.js')).href)).clinicOpenState;
    } catch {
      clinicOpenState = () => ({ known: false, open: false });
    }
  }
  const now = new Date();
  return {
    source: { name: 'Dogdog.ge', url: 'https://dogdog.ge/index.php?m=315' },
    timezone: 'Asia/Tbilisi',
    fetchedAt: new Date(now.getTime() - 47 * 60000).toISOString(),
    stale: false,
    clinics: CLINICS.map((clinic) => {
      let status = { known: false, open: false };
      try {
        status = clinicOpenState(clinic, now);
      } catch {}
      return { ...clinic, openNow: status.known ? status.open : null, hoursKnown: status.known };
    }),
  };
}

let catalogFn = null;
async function petsCatalog(lang) {
  if (!catalogFn) {
    try {
      catalogFn = (await import(pathToFileURL(join(REPO, 'server', 'src', 'lib', 'petsCatalog.js')).href)).publicPetsCatalog;
    } catch {
      catalogFn = () => ({ version: 'pets-species-v1', coverageNotes: {}, species: [] });
    }
  }
  return catalogFn(lang);
}

// ───────────────────────── routes ─────────────────────────

const PET_KEYS = ['name', 'speciesId', 'breedId', 'customBreed', 'sex', 'neutered', 'ageKind', 'birthDate', 'approxAgeYears', 'approxAgeMonths', 'approxAgeRecordedOn', 'vetClinicName', 'vetName', 'vetPhone', 'vetAddress', 'vetNotes'];

const ROUTES = [
  // Static paths first (they would otherwise match /api/pets/:petId).
  { method: 'GET', path: '/api/pets/catalog', handler: async (rq) => unauthorized(rq) || (await petsCatalog(en(rq) ? 'en' : 'ka')) },
  { method: 'GET', path: '/api/pets/clinics', handler: async (rq) => unauthorized(rq) || (await clinicsDirectory()) },
  {
    method: 'GET',
    path: '/api/pets/reminders/feed',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const m = slice(rq);
      const userId = userIdOf(rq);
      const items = [];
      for (const pet of m.pets.filter((p) => !p.archivedAt)) {
        for (const s of m.schedules.filter((x) => x.petId === pet.id && x.status === 'ACTIVE' && x.reminderEnabled)) {
          const g = generate(m, s, rq.today, userId);
          for (const o of [...g.overdue, ...g.due, ...g.upcoming]) items.push({ petId: pet.id, petName: pet.name, petArchived: false, schedule: s, occurrence: o });
        }
      }
      return { ...CARE, items: items.slice(0, 80), fetchedAt: nowIso() };
    },
  },

  // Pets
  {
    method: 'GET',
    path: '/api/pets',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const m = slice(rq);
      const pets = m.pets.filter((p) => !p.archivedAt).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { ...READY, pets: pets.map((p) => publicPet(p, rq.today)) };
    },
  },
  {
    method: 'POST',
    path: '/api/pets',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const m = slice(rq);
      const body = pick(rq.body, PET_KEYS);
      if (!String(body.name || '').trim() || !body.speciesId) return rq.reply(400, { error: t(rq, 'მიუთითე სახელი და სახეობა.', 'Enter a name and species.') });
      const at = nowIso();
      const row = {
        id: uuidFrom(`pet:new:${at}:${body.name}`),
        name: String(body.name).trim(),
        speciesId: body.speciesId,
        breedId: body.breedId || 'unknown',
        customBreed: body.customBreed ?? null,
        sex: body.sex || 'UNKNOWN',
        neutered: body.neutered ?? null,
        ageKind: body.ageKind || 'UNKNOWN',
        birthDate: body.ageKind === 'EXACT' ? body.birthDate ?? null : null,
        approxAgeYears: body.ageKind === 'APPROXIMATE' ? body.approxAgeYears ?? null : null,
        approxAgeMonths: body.ageKind === 'APPROXIMATE' ? body.approxAgeMonths ?? null : null,
        approxAgeRecordedOn: body.ageKind === 'APPROXIMATE' ? body.approxAgeRecordedOn || rq.today : null,
        photoUrl: null,
        vetClinicName: body.vetClinicName ?? null,
        vetName: body.vetName ?? null,
        vetPhone: body.vetPhone ?? null,
        vetAddress: body.vetAddress ?? null,
        vetNotes: body.vetNotes ?? null,
        archivedAt: null,
        createdAt: at,
        updatedAt: at,
      };
      m.pets.push(row);
      return rq.reply(201, { ...READY, pet: publicPet(row, rq.today) });
    },
  },
  { method: 'GET', path: '/api/pets/:petId', handler: petRoute((rq, m, pet) => ({ ...READY, pet: publicPet(pet, rq.today) })) },
  {
    method: 'PATCH',
    path: '/api/pets/:petId',
    handler: petRoute((rq, m, pet) => {
      Object.assign(pet, pick(rq.body, PET_KEYS), { updatedAt: nowIso() });
      if (pet.ageKind !== 'EXACT') pet.birthDate = null;
      return { ...READY, pet: publicPet(pet, rq.today) };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/archive',
    handler: petRoute((rq, m, pet) => {
      pet.archivedAt = nowIso();
      return { ...READY, archived: true };
    }),
  },

  // Weight
  {
    method: 'GET',
    path: '/api/pets/:petId/weight',
    handler: petRoute((rq, m, pet) => {
      const { limit, offset } = listBounds(rq.query);
      const all = m.weights.filter((w) => w.petId === pet.id).sort(weightDesc);
      return { ...HEALTH, latest: all[0] ?? null, items: all.slice(offset, offset + limit), total: all.length, limit, offset };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/weight',
    handler: petRoute((rq, m, pet) => {
      const b = rq.body || {};
      const kg = toKg(b.inputValue, b.inputUnit);
      if (!kg || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.recordedOn || ''))) return rq.reply(400, { error: t(rq, 'წონა ან თარიღი არასწორია.', 'The weight or date is not valid.') });
      const at = nowIso();
      const log = { id: uuidFrom(`pet-weight:new:${at}`), petId: pet.id, recordedOn: b.recordedOn, weightKg: kg, inputValue: Number(b.inputValue), inputUnit: b.inputUnit || 'kg', note: b.note ?? null, createdAt: at, updatedAt: at };
      m.weights.push(log);
      return rq.reply(201, { ...HEALTH, log });
    }),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/weight/:logId',
    handler: petRoute((rq, m, pet) => {
      const log = m.weights.find((w) => w.id === rq.params.logId && w.petId === pet.id);
      return log ? { ...HEALTH, log } : rq.reply(404, CARE_NOT_FOUND(rq));
    }),
  },
  {
    method: 'PATCH',
    path: '/api/pets/:petId/weight/:logId',
    handler: petRoute((rq, m, pet) => {
      const log = m.weights.find((w) => w.id === rq.params.logId && w.petId === pet.id);
      if (!log) return rq.reply(404, CARE_NOT_FOUND(rq));
      const b = rq.body || {};
      if (b.recordedOn) log.recordedOn = b.recordedOn;
      if (b.inputValue != null) {
        log.inputValue = Number(b.inputValue);
        log.inputUnit = b.inputUnit || log.inputUnit;
        log.weightKg = toKg(log.inputValue, log.inputUnit) ?? log.weightKg;
      }
      if (b.note !== undefined) log.note = b.note;
      log.updatedAt = nowIso();
      return { ...HEALTH, log };
    }),
  },
  {
    method: 'DELETE',
    path: '/api/pets/:petId/weight/:logId',
    handler: petRoute((rq, m, pet) => {
      const before = m.weights.length;
      m.weights = m.weights.filter((w) => !(w.id === rq.params.logId && w.petId === pet.id));
      if (m.weights.length === before) return rq.reply(404, CARE_NOT_FOUND(rq));
      return { ...HEALTH, deleted: true, latest: m.weights.filter((w) => w.petId === pet.id).sort(weightDesc)[0] ?? null };
    }),
  },

  // Allergies + conditions (same CRUD shape)
  ...healthCrud('allergies', 'allergies', 'allergy', ['name', 'category', 'reaction', 'reportedStatus', 'notedOn', 'notes'], (b) => ({ category: b.category || 'unknown', reaction: b.reaction ?? null, reportedStatus: b.reportedStatus || 'suspected', notedOn: b.notedOn ?? null, notes: b.notes ?? null })),
  ...healthCrud('conditions', 'conditions', 'condition', ['name', 'status', 'reportedBasis', 'onsetOn', 'resolvedOn', 'notes'], (b) => ({ status: b.status || 'active', reportedBasis: b.reportedBasis || 'owner_reported', onsetOn: b.onsetOn ?? null, resolvedOn: b.resolvedOn ?? null, notes: b.notes ?? null })),

  // Care: products
  {
    method: 'GET',
    path: '/api/pets/:petId/products',
    handler: petRoute((rq, m, pet) => ({ ...CARE, items: m.products.filter((p) => p.petId === pet.id && !p.archivedAt).sort((a, b) => a.name.localeCompare(b.name, 'ka')) })),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/products',
    handler: petRoute((rq, m, pet) => {
      const b = rq.body || {};
      if (!String(b.name || '').trim() || !b.kind) return rq.reply(400, { error: t(rq, 'მიუთითე სახელი და ტიპი.', 'Enter a name and type.') });
      const at = nowIso();
      const product = { id: uuidFrom(`pet-product:new:${at}`), petId: pet.id, kind: b.kind, name: String(b.name).trim(), formulation: b.formulation ?? null, batchId: b.batchId ?? null, notes: b.notes ?? null, expiresOn: b.expiresOn ?? null, archivedAt: null, createdAt: at, updatedAt: at };
      m.products.push(product);
      return rq.reply(201, { ...CARE, product });
    }),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/products/:productId',
    handler: petRoute((rq, m, pet) => {
      const product = m.products.find((p) => p.id === rq.params.productId && p.petId === pet.id);
      return product ? { ...CARE, product } : rq.reply(404, CARE_NOT_FOUND(rq));
    }),
  },
  {
    method: 'PATCH',
    path: '/api/pets/:petId/products/:productId',
    handler: petRoute((rq, m, pet) => {
      const product = m.products.find((p) => p.id === rq.params.productId && p.petId === pet.id);
      if (!product) return rq.reply(404, CARE_NOT_FOUND(rq));
      Object.assign(product, pick(rq.body, ['kind', 'name', 'formulation', 'batchId', 'notes', 'expiresOn']), { updatedAt: nowIso() });
      return { ...CARE, product };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/products/:productId/archive',
    handler: petRoute((rq, m, pet) => {
      const product = m.products.find((p) => p.id === rq.params.productId && p.petId === pet.id);
      if (!product) return rq.reply(404, CARE_NOT_FOUND(rq));
      product.archivedAt = product.updatedAt = nowIso();
      return { ...CARE, archived: true, product };
    }),
  },

  // Care: schedules
  {
    method: 'GET',
    path: '/api/pets/:petId/schedules',
    handler: petRoute((rq, m, pet) => {
      const items = m.schedules
        .filter((s) => s.petId === pet.id)
        .sort((a, b) => a.status.localeCompare(b.status) || String(a.nextDueOn || '9999').localeCompare(String(b.nextDueOn || '9999')) || b.createdAt.localeCompare(a.createdAt));
      return { ...CARE, items };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/schedules',
    handler: petRoute((rq, m, pet) => {
      const b = rq.body || {};
      if (!b.kind || !String(b.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(b.startOn || ''))) {
        return rq.reply(400, { error: t(rq, 'შეავსე ტიპი, სახელი და პირველი თარიღი.', 'Fill in the type, name and first date.') });
      }
      const at = nowIso();
      const recurrenceKind = b.recurrenceKind || 'ONCE';
      const s = {
        id: uuidFrom(`pet-schedule:new:${at}`),
        petId: pet.id,
        productId: b.productId ?? null,
        kind: b.kind,
        title: String(b.title).trim(),
        dose: b.dose ?? null,
        doseUnit: b.doseUnit ?? null,
        route: b.route ?? null,
        startOn: b.startOn,
        dueTime: b.dueTime ?? null,
        times: Array.isArray(b.times) ? b.times : null,
        recurrenceKind,
        intervalCount: recurrenceKind === 'ONCE' || recurrenceKind === 'DAILY_COURSE' ? null : Number(b.intervalCount) || 1,
        recurrenceBasis: recurrenceKind === 'ONCE' ? 'NONE' : b.recurrenceBasis || 'FIXED_CALENDAR',
        source: b.source || 'USER_ENTERED',
        sourceNote: b.sourceNote ?? null,
        courseEndsOn: b.courseEndsOn ?? null,
        occurrenceLimit: b.occurrenceLimit ?? null,
        anchorDay: recurrenceKind === 'EVERY_N_MONTHS' ? Number(String(b.startOn).slice(8, 10)) : null,
        status: 'ACTIVE',
        revision: 1,
        nextDueOn: b.startOn,
        nextDueTime: b.dueTime ?? null,
        nextSequence: 0,
        reminderEnabled: true,
        reminderOffsetsDays: [1, 0],
        timeMode: b.dueTime || (Array.isArray(b.times) && b.times.length) ? 'EXACT_TIME' : 'DATE_BASED',
        timezone: b.timezone ?? 'Asia/Tbilisi',
        createdAt: at,
        updatedAt: at,
      };
      m.schedules.push(s);
      return rq.reply(201, { ...CARE, schedule: s });
    }),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/schedules/:scheduleId',
    handler: petRoute((rq, m, pet) => {
      const schedule = m.schedules.find((s) => s.id === rq.params.scheduleId && s.petId === pet.id);
      return schedule ? { ...CARE, schedule } : rq.reply(404, CARE_NOT_FOUND(rq));
    }),
  },
  {
    method: 'PATCH',
    path: '/api/pets/:petId/schedules/:scheduleId',
    handler: petRoute((rq, m, pet) => {
      const schedule = m.schedules.find((s) => s.id === rq.params.scheduleId && s.petId === pet.id);
      if (!schedule) return rq.reply(404, CARE_NOT_FOUND(rq));
      Object.assign(schedule, pick(rq.body, ['kind', 'title', 'productId', 'dose', 'doseUnit', 'route', 'startOn', 'dueTime', 'times', 'recurrenceKind', 'intervalCount', 'recurrenceBasis', 'source', 'sourceNote', 'courseEndsOn', 'occurrenceLimit']));
      schedule.revision += 1;
      schedule.updatedAt = nowIso();
      return { ...CARE, schedule };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/schedules/:scheduleId/cancel',
    handler: petRoute((rq, m, pet) => {
      const schedule = m.schedules.find((s) => s.id === rq.params.scheduleId && s.petId === pet.id);
      if (!schedule) return rq.reply(404, CARE_NOT_FOUND(rq));
      Object.assign(schedule, { status: 'CANCELLED', nextDueOn: null, nextDueTime: null, nextSequence: null, updatedAt: nowIso() });
      return { ...CARE, schedule };
    }),
  },
  {
    method: 'PATCH',
    path: '/api/pets/:petId/schedules/:scheduleId/reminders',
    handler: petRoute((rq, m, pet) => {
      const schedule = m.schedules.find((s) => s.id === rq.params.scheduleId && s.petId === pet.id);
      if (!schedule) return rq.reply(404, CARE_NOT_FOUND(rq));
      const b = rq.body || {};
      if (typeof b.reminderEnabled === 'boolean') schedule.reminderEnabled = b.reminderEnabled;
      if (Array.isArray(b.reminderOffsetsDays)) schedule.reminderOffsetsDays = b.reminderOffsetsDays;
      schedule.updatedAt = nowIso();
      return { ...CARE, revisionUnchanged: true, schedule };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/schedules/:scheduleId/complete',
    handler: petRoute((rq, m, pet) => {
      const s = m.schedules.find((x) => x.id === rq.params.scheduleId && x.petId === pet.id);
      if (!s) return rq.reply(404, CARE_NOT_FOUND(rq));
      const b = rq.body || {};
      const [rev, plannedOn, time, seq] = String(b.occurrenceKey || '').split('|');
      if (!plannedOn || Number(rev?.slice(1)) !== s.revision) {
        return rq.reply(409, { error: t(rq, 'გეგმა შეიცვალა. განაახლე სია და სცადე ხელახლა.', 'The plan changed. Refresh the list and try again.'), code: 'PET_CARE_REVISION_CONFLICT', ...CARE });
      }
      const at = nowIso();
      const administeredOn = b.administeredOn || rq.today;
      const product = s.productId ? m.products.find((p) => p.id === s.productId) : null;
      const event = {
        id: uuidFrom(`pet-event:new:${at}`),
        petId: pet.id,
        kind: s.kind,
        productId: s.productId,
        scheduleId: s.id,
        occurrenceId: uuidFrom(`pet-occurrence:new:${at}`),
        occurrenceKey: b.occurrenceKey,
        titleSnapshot: s.title,
        productNameSnapshot: product?.name ?? null,
        doseSnapshot: b.dose || s.dose,
        doseUnitSnapshot: b.doseUnit || s.doseUnit,
        routeSnapshot: b.route || s.route,
        administeredOn,
        administeredTime: b.administeredTime ?? null,
        timezone: b.timezone ?? 'Asia/Tbilisi',
        utcOffsetMinutes: b.utcOffsetMinutes ?? 240,
        notes: b.notes ?? null,
        status: 'RECORDED',
        voidedAt: null,
        voidReason: null,
        correctionMeta: null,
        previousNextDueOn: s.nextDueOn,
        source: 'app',
        createdAt: at,
        updatedAt: at,
      };
      m.events.push(event);
      const planned = { plannedOn, plannedTime: time === 'date' ? null : time, sequence: Number(seq) || 0 };
      m.occurrences.push({ scheduleId: s.id, occurrenceKey: b.occurrenceKey, status: 'ADMINISTERED', eventId: event.id });
      Object.assign(s, advance(s, planned, administeredOn), { updatedAt: at });
      const occurrence = { ...occurrenceOf({ ...s, revision: Number(rev.slice(1)) }, plannedOn, planned.sequence, userIdOf(rq)), status: 'ADMINISTERED', eventId: event.id };
      return rq.reply(201, { ...CARE, replayed: false, event, schedule: s, occurrence });
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/schedules/:scheduleId/skip',
    handler: petRoute((rq, m, pet) => {
      const s = m.schedules.find((x) => x.id === rq.params.scheduleId && x.petId === pet.id);
      if (!s) return rq.reply(404, CARE_NOT_FOUND(rq));
      const [, plannedOn, time, seq] = String(rq.body?.occurrenceKey || '').split('|');
      if (!plannedOn) return rq.reply(400, { error: t(rq, 'არასწორი შემთხვევა.', 'Invalid occurrence.') });
      const planned = { plannedOn, plannedTime: time === 'date' ? null : time, sequence: Number(seq) || 0 };
      m.occurrences.push({ scheduleId: s.id, occurrenceKey: rq.body.occurrenceKey, status: 'SKIPPED', eventId: null });
      const occurrence = { ...occurrenceOf(s, plannedOn, planned.sequence, userIdOf(rq)), status: 'SKIPPED' };
      Object.assign(s, advance(s, planned, plannedOn), { updatedAt: nowIso() });
      return { ...CARE, replayed: false, occurrence, schedule: s };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/schedules/:scheduleId/reminder-delivery',
    handler: petRoute(() => ({ ...CARE, reminderSchemaReady: true, accepted: true })),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/care/upcoming',
    handler: petRoute((rq, m, pet) => {
      const userId = userIdOf(rq);
      const out = { overdue: [], due: [], upcoming: [] };
      for (const s of m.schedules.filter((x) => x.petId === pet.id && x.status === 'ACTIVE')) {
        const g = generate(m, s, rq.today, userId);
        out.overdue.push(...g.overdue);
        out.due.push(...g.due);
        out.upcoming.push(...g.upcoming);
      }
      return { ...CARE, overdue: out.overdue.sort(byPlanned), due: out.due.sort(byPlanned), upcoming: out.upcoming.sort(byPlanned), plannedDisclaimer: true };
    }),
  },

  // Care: events (history)
  {
    method: 'GET',
    path: '/api/pets/:petId/events',
    handler: petRoute((rq, m, pet) => {
      const { limit, offset } = listBounds(rq.query);
      const all = m.events.filter((e) => e.petId === pet.id).sort((a, b) => b.administeredOn.localeCompare(a.administeredOn) || b.createdAt.localeCompare(a.createdAt));
      return { ...CARE, items: all.slice(offset, offset + limit), total: all.length, limit, offset };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/events',
    handler: petRoute((rq, m, pet) => {
      const b = rq.body || {};
      if (!b.kind || !String(b.title || '').trim() || !b.administeredOn) return rq.reply(400, { error: t(rq, 'შეავსე ტიპი, სახელი და თარიღი.', 'Fill in the type, name and date.') });
      const at = nowIso();
      const product = b.productId ? m.products.find((p) => p.id === b.productId) : null;
      const event = {
        id: uuidFrom(`pet-event:manual:${at}`),
        petId: pet.id,
        kind: b.kind,
        productId: b.productId ?? null,
        scheduleId: b.scheduleId ?? null,
        occurrenceId: null,
        occurrenceKey: null,
        titleSnapshot: String(b.title).trim(),
        productNameSnapshot: product?.name ?? null,
        doseSnapshot: b.dose ?? null,
        doseUnitSnapshot: b.doseUnit ?? null,
        routeSnapshot: b.route ?? null,
        administeredOn: b.administeredOn,
        administeredTime: b.administeredTime ?? null,
        timezone: b.timezone ?? 'Asia/Tbilisi',
        utcOffsetMinutes: b.utcOffsetMinutes ?? 240,
        notes: b.notes ?? null,
        status: 'RECORDED',
        voidedAt: null,
        voidReason: null,
        correctionMeta: null,
        previousNextDueOn: null,
        source: 'app',
        createdAt: at,
        updatedAt: at,
      };
      m.events.push(event);
      return rq.reply(201, { ...CARE, replayed: false, event });
    }),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/events/:eventId',
    handler: petRoute((rq, m, pet) => {
      const event = m.events.find((e) => e.id === rq.params.eventId && e.petId === pet.id);
      return event ? { ...CARE, event } : rq.reply(404, CARE_NOT_FOUND(rq));
    }),
  },
  {
    method: 'PATCH',
    path: '/api/pets/:petId/events/:eventId',
    handler: petRoute((rq, m, pet) => {
      const event = m.events.find((e) => e.id === rq.params.eventId && e.petId === pet.id);
      if (!event) return rq.reply(404, CARE_NOT_FOUND(rq));
      const b = rq.body || {};
      if (b.title) event.titleSnapshot = String(b.title).trim();
      for (const [from, to] of [['administeredOn', 'administeredOn'], ['administeredTime', 'administeredTime'], ['notes', 'notes'], ['dose', 'doseSnapshot'], ['doseUnit', 'doseUnitSnapshot'], ['route', 'routeSnapshot']]) {
        if (b[from] !== undefined) event[to] = b[from];
      }
      event.updatedAt = nowIso();
      return { ...CARE, event };
    }),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/events/:eventId/void',
    handler: petRoute((rq, m, pet) => {
      const event = m.events.find((e) => e.id === rq.params.eventId && e.petId === pet.id);
      if (!event) return rq.reply(404, CARE_NOT_FOUND(rq));
      Object.assign(event, { status: 'VOIDED', voidedAt: nowIso(), voidReason: rq.body?.reason ?? null, updatedAt: nowIso() });
      return { ...CARE, event };
    }),
  },

  // MEDIVET chat: one empty conversation per pet (the answer itself is not mocked).
  {
    method: 'GET',
    path: '/api/pets/:petId/chats',
    handler: petRoute((rq, m, pet) => ({ schemaReady: true, chatSchemaReady: true, sessions: m.chats.filter((c) => c.petId === pet.id).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((c) => chatOut(c, rq)) })),
  },
  {
    method: 'POST',
    path: '/api/pets/:petId/chats',
    handler: petRoute((rq, m, pet) => {
      const at = nowIso();
      const session = { id: uuidFrom(`pet-chat:new:${at}`), petId: pet.id, title: 'ახალი საუბარი', createdAt: at, updatedAt: at };
      m.chats.push(session);
      return rq.reply(201, { schemaReady: true, chatSchemaReady: true, session: chatOut(session, rq) });
    }),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/chats/:sessionId',
    handler: petRoute((rq, m, pet) => {
      const session = m.chats.find((c) => c.id === rq.params.sessionId && c.petId === pet.id);
      return session ? { schemaReady: true, chatSchemaReady: true, session: chatOut(session, rq) } : rq.reply(404, { error: t(rq, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
    }),
  },
  {
    method: 'GET',
    path: '/api/pets/:petId/chats/:sessionId/messages',
    handler: petRoute((rq, m, pet) => {
      const session = m.chats.find((c) => c.id === rq.params.sessionId && c.petId === pet.id);
      if (!session) return rq.reply(404, { error: t(rq, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
      return { schemaReady: true, chatSchemaReady: true, messages: m.messages.filter((x) => x.sessionId === session.id) };
    }),
  },
  {
    method: 'DELETE',
    path: '/api/pets/:petId/chats/:sessionId',
    handler: petRoute((rq, m, pet) => {
      const before = m.chats.length;
      m.chats = m.chats.filter((c) => !(c.id === rq.params.sessionId && c.petId === pet.id));
      if (m.chats.length === before) return rq.reply(404, { error: t(rq, 'საუბარი ვერ მოიძებნა.', 'Conversation not found.') });
      m.messages = m.messages.filter((x) => x.sessionId !== rq.params.sessionId);
      return { schemaReady: true, chatSchemaReady: true, deleted: true };
    }),
  },
];

/** PETS_FIXTURE=off → no routes here (profile.mjs' empty pet list answers instead). */
export const routes = String(process.env.PETS_FIXTURE || '').toLowerCase() === 'off' ? [] : ROUTES;

function chatOut(c, rq) {
  return { ...c, title: en(rq) && c.title === 'ახალი საუბარი' ? 'New conversation' : c.title };
}

/** GET list / POST / GET one / PATCH / DELETE for allergies and conditions (lib/petsHealth.js shapes). */
function healthCrud(segment, key, single, keys, defaults) {
  const base = `/api/pets/:petId/${segment}`;
  const find = (m, pet, id) => m[key].find((x) => x.id === id && x.petId === pet.id);
  const sort = key === 'conditions' ? (a, b) => a.status.localeCompare(b.status) || b.createdAt.localeCompare(a.createdAt) : (a, b) => b.createdAt.localeCompare(a.createdAt);
  return [
    { method: 'GET', path: base, handler: petRoute((rq, m, pet) => ({ ...HEALTH, items: m[key].filter((x) => x.petId === pet.id).sort(sort) })) },
    {
      method: 'POST',
      path: base,
      handler: petRoute((rq, m, pet) => {
        const b = rq.body || {};
        if (!String(b.name || '').trim()) return rq.reply(400, { error: t(rq, 'მიუთითე სახელი.', 'Enter a name.') });
        const at = nowIso();
        const row = { id: uuidFrom(`pet-${single}:new:${at}`), petId: pet.id, name: String(b.name).trim(), ...defaults(b), createdAt: at, updatedAt: at };
        m[key].push(row);
        return rq.reply(201, { ...HEALTH, replayed: false, [single]: row });
      }),
    },
    {
      method: 'GET',
      path: `${base}/:itemId`,
      handler: petRoute((rq, m, pet) => {
        const row = find(m, pet, rq.params.itemId);
        return row ? { ...HEALTH, [single]: row } : rq.reply(404, CARE_NOT_FOUND(rq));
      }),
    },
    {
      method: 'PATCH',
      path: `${base}/:itemId`,
      handler: petRoute((rq, m, pet) => {
        const row = find(m, pet, rq.params.itemId);
        if (!row) return rq.reply(404, CARE_NOT_FOUND(rq));
        Object.assign(row, pick(rq.body, keys), { updatedAt: nowIso() });
        return { ...HEALTH, [single]: row };
      }),
    },
    {
      method: 'DELETE',
      path: `${base}/:itemId`,
      handler: petRoute((rq, m, pet) => {
        const before = m[key].length;
        m[key] = m[key].filter((x) => !(x.id === rq.params.itemId && x.petId === pet.id));
        return m[key].length === before ? rq.reply(404, CARE_NOT_FOUND(rq)) : { ...HEALTH, deleted: true };
      }),
    },
  ];
}
