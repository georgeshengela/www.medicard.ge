// MEDICOACH fixtures (/api/trainer/*). Sorts before engage.mjs, so these routes win over its client stub.
//
//   persona man   (გიორგი მაისურაძე) = a VERIFIED trainer: Aspria Vake + Snap Fitness Chavchavadze 29, code GM7K3P,
//                 5 active clients, 1 request, 1 open invite, a Mon–Sat timetable (sessions from 6 weeks back to
//                 4 weeks ahead; past ones DONE with exercises, one NO_SHOW, one client cancellation, open slots).
//                 Screens: /coach, /coach/clients, /coach/calendar, /coach/client/<id>, /coach/session/<id>, /coach/profile.
//   persona women (ნინო ბერიძე) = a client with an ACTIVE link to „ლევან ჩხეიძე“ (Oktopus Vake · Ramishvili),
//                 scopes workouts/nutrition/weight on, photos off; Tue/Thu 19:00 + Sat 11:00 sessions, open slots,
//                 a trainer meal plan (adherence computed from her diary in state.nutrition when present).
//                 Screens: /trainer, /trainer/sessions, /trainer/plan, /trainer/sharing, /trainer/session/<id>.
//   COACH_ROLE=off  → no routes here (engage.mjs' "no trainer, no link" stub answers instead).
//
//   Client ids for URLs (trainer persona): CLIENT_IDS.ana = 'mock-client-ana-0001' (13-day on-plan streak),
//   luka 'mock-client-luka-0001' (2 days over calories), mariam 'mock-client-mariam-0001' (no weigh-in 9 days),
//   davit 'mock-client-davit-0001' (missed last session), tamar 'mock-client-tamar-0001' (workouts only).
//   Session ids are uuidFrom(`coach:<trainer|levan>:<YYYY-MM-DD>:<HH:MM>`); GET /__state shows them (state.coach).
//
// Shapes: server/src/routes/trainer.routes.js, lib/trainerStore.js (ownTrainerProfile, trainerCards, clientOverview,
// coachToday, coachClients, coachClientDashboard, weightData, nutritionDays, photoPublic), lib/trainer.js
// (sessionPublic, formatSessionTime, dayAdherence, adherenceScore, clientAlerts, goalProgress, labels, CONSENT_VERSION,
// localizeCoachPayload), lib/gyms.js (gymId, gymPublic, groupByBrand) + server/src/data/gyms-ge.json (read-only).
// No avatars/photos with URLs (avatarUrl null → the app's avatar art).
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDays, isoAt, mondayOf, seeded } from '../lib.mjs';

const REPO = process.env.MEDICARD_REPO || 'C:/Users/User/Desktop/www.medicard';
const ROLE = String(process.env.COACH_ROLE || 'auto').toLowerCase() === 'off' ? 'off' : 'auto';

export const CONSENT_VERSION = 'coach-2026-09-28b';
export const TRAINER_CODE = 'GM7K3P';
export const CLIENT_IDS = {
  ana: 'mock-client-ana-0001',
  luka: 'mock-client-luka-0001',
  mariam: 'mock-client-mariam-0001',
  davit: 'mock-client-davit-0001',
  tamar: 'mock-client-tamar-0001',
  nika: 'mock-client-nika-0001', // request (REQUESTED, initiator CLIENT)
  salome: 'mock-client-salome-0001', // invited by QR (REQUESTED, initiator TRAINER)
};
const MAN_ID = 'mock-user-man-0001';
const WOMEN_ID = 'mock-user-women-0001';
const LEVAN_ID = 'mock-trainer-levan-0001';
const EKA_ID = 'mock-trainer-eka-0001';
const IRAKLI_ID = 'mock-trainer-irakli-0001';

const DAY = 86400000;

// ───────────────────────── helpers ─────────────────────────

const isEn = (rq) => String(rq?.lang || '').toLowerCase().startsWith('en');
const t = (rq, ka, en) => (isEn(rq) ? en : ka);

function uuidFrom(seed) {
  const h = createHash('sha1').update(String(seed)).digest('hex');
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function unauthorized(rq) {
  if (/^Bearer\s+\S{8,}/.test(rq.auth || '')) return null;
  return rq.reply(401, { error: t(rq, 'ავტორიზაცია საჭიროა. შედი ანგარიშში.', 'Please sign in to continue.') });
}

const coachError = (rq, status, ka, en, code) => rq.reply(status, { error: t(rq, ka, en), ...(code ? { code } : {}) });
const tbilisiYmd = (date = new Date()) => new Date(new Date(date).getTime() + 4 * 3600000).toISOString().slice(0, 10);
const tbilisiDayStart = (ymd) => new Date(Date.parse(`${ymd}T00:00:00Z`) - 4 * 3600000);
const round1 = (n) => Math.round(n * 10) / 10;
const weekdayOf = (ymd) => new Date(`${ymd}T12:00:00Z`).getUTCDay();

// ───────────────────────── labels (lib/trainer.js) ─────────────────────────

const SPECIALTIES = {
  weight_loss: 'წონის კლება', muscle: 'კუნთის მატება', strength: 'ძალა', functional: 'ფუნქციური ვარჯიში', crossfit: 'კროსფიტი',
  cardio: 'კარდიო / გამძლეობა', mobility: 'მოქნილობა და მობილობა', rehab: 'რეაბილიტაცია და ტრავმის შემდეგ', boxing: 'ბოქსი / საბრძოლო',
  yoga: 'იოგა / პილატესი', women: 'ქალის ფიტნესი', seniors: 'ხანდაზმულები', nutrition: 'კვების დაგეგმვა', sport: 'სპორტული მომზადება',
};
const SPECIALTIES_EN = {
  weight_loss: 'Weight loss', muscle: 'Muscle gain', strength: 'Strength', functional: 'Functional training', crossfit: 'CrossFit',
  cardio: 'Cardio / endurance', mobility: 'Flexibility and mobility', rehab: 'Rehab and post-injury', boxing: 'Boxing / combat sports',
  yoga: 'Yoga / Pilates', women: "Women's fitness", seniors: 'Older adults', nutrition: 'Nutrition planning', sport: 'Sports preparation',
};
const SESSION_KINDS = { STRENGTH: 'ძალოვანი', CARDIO: 'კარდიო', HIIT: 'HIIT', FUNCTIONAL: 'ფუნქციური', MOBILITY: 'მობილობა', ASSESSMENT: 'შეფასება / გაზომვა', ONLINE: 'ონლაინ' };
const SESSION_KINDS_EN = { STRENGTH: 'Strength', CARDIO: 'Cardio', HIIT: 'HIIT', FUNCTIONAL: 'Functional', MOBILITY: 'Mobility', ASSESSMENT: 'Assessment / measurements', ONLINE: 'Online' };
const MEAL_SLOTS = { breakfast: 'საუზმე', snack1: 'წახემსება', lunch: 'სადილი', snack2: 'მეორე წახემსება', dinner: 'ვახშამი', preworkout: 'ვარჯიშამდე', postworkout: 'ვარჯიშის შემდეგ' };
const MEAL_SLOTS_EN = { breakfast: 'Breakfast', snack1: 'Snack', lunch: 'Lunch', snack2: 'Second snack', dinner: 'Dinner', preworkout: 'Pre-workout', postworkout: 'Post-workout' };
const TRAINER_STATUS_KA = { PENDING: 'განიხილება', VERIFIED: 'დადასტურებული', REJECTED: 'უარყოფილი', SUSPENDED: 'შეჩერებული' };
const TRAINER_STATUS_EN = { PENDING: 'Under review', VERIFIED: 'Verified', REJECTED: 'Rejected', SUSPENDED: 'Suspended' };

const WEEKDAYS = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ'];
const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "ხუთ, 2 ოქტ · 19:00" (lib/trainer.js formatSessionTime). */
function formatSessionTime(date, en = false) {
  const x = new Date(new Date(date).getTime() + 4 * 3600000);
  const hh = String(x.getUTCHours()).padStart(2, '0');
  const mm = String(x.getUTCMinutes()).padStart(2, '0');
  return `${(en ? WEEKDAYS_EN : WEEKDAYS)[x.getUTCDay()]}, ${x.getUTCDate()} ${(en ? MONTHS_EN : MONTHS)[x.getUTCMonth()]} · ${hh}:${mm}`;
}

// ───────────────────────── gyms (lib/gyms.js) ─────────────────────────

const slug = (s) => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 48);
const gymIdOf = (brand, name, city) => `gym-${slug(brand) || 'x'}-${createHash('sha1').update(`${brand}|${name}|${city}`.toLowerCase()).digest('hex').slice(0, 8)}`;
const clean = (v, max = 200) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

let GYMS = null;
function gyms() {
  if (GYMS) return GYMS;
  let directory = [];
  try {
    directory = JSON.parse(readFileSync(join(REPO, 'server', 'src', 'data', 'gyms-ge.json'), 'utf8'));
  } catch {
    directory = [
      { brand: 'Oktopus', brandKa: 'ოქტოპუსი', branches: [{ name: 'Vake · Ramishvili', city: 'თბილისი', district: 'ვაკე', address: '20 Nino Ramishvili St' }] },
      { brand: 'Aspria', brandKa: 'ასპრია', branches: [{ name: 'Vake', city: 'თბილისი', district: 'ვაკე', address: '4 Archil Mishveladze St' }] },
      { brand: 'Snap Fitness', branches: [{ name: 'Chavchavadze 29', city: 'თბილისი', district: 'ვაკე', address: '29 Ilia Chavchavadze Ave' }] },
    ];
  }
  const rows = [];
  const seen = new Set();
  for (const brand of Array.isArray(directory) ? directory : []) {
    const brandName = clean(brand.brand, 80);
    if (!brandName) continue;
    const brandStatus = brand.confidence === 'low' ? 'HIDDEN' : 'ACTIVE';
    const branches = Array.isArray(brand.branches) && brand.branches.length ? brand.branches : [{ name: brandName, city: 'თბილისი' }];
    for (const b of branches) {
      const name = clean(b.name, 80) || brandName;
      const city = clean(b.city, 40) || 'თბილისი';
      const id = gymIdOf(brandName, name, city);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({ id, brand: brandName, brandKa: clean(brand.brandKa, 80), name, nameKa: clean(b.nameKa, 80), city, district: clean(b.district, 60), address: clean(b.address, 160), status: b.confidence === 'low' ? 'HIDDEN' : b.confidence ? 'ACTIVE' : brandStatus });
    }
  }
  // Poster rule: no real business names or addresses on screen — every gym gets a neutral label (ids unchanged).
  const NEUTRAL = new Map([
    [gymIdOf('Aspria', 'Vake', 'თბილისი'), ['ფიტნეს-კლუბი', 'ვაკე']],
    [gymIdOf('Snap Fitness', 'Chavchavadze 29', 'თბილისი'), ['სპორტ-დარბაზი', 'ჭავჭავაძე']],
    [gymIdOf('Oktopus', 'Vake · Ramishvili', 'თბილისი'), ['ფიტნეს-დარბაზი', 'ვაკე']],
    [gymIdOf('Oktopus', 'Sandro Euli', 'თბილისი'), ['ფიტნეს-დარბაზი', 'საბურთალო']],
    [gymIdOf('Reform Sport Club', 'Nutsubidze', 'თბილისი'), ['სპორტ-კლუბი', 'ნუცუბიძე']],
  ]);
  for (const g of rows) {
    const [brand, name] = NEUTRAL.get(g.id) || ['ფიტნეს-დარბაზი', g.district || g.city];
    Object.assign(g, { brand, brandKa: brand, name, nameKa: name, address: null });
  }
  GYMS = new Map(rows.map((g) => [g.id, g]));
  return GYMS;
}
const gymPublic = (g) => ({ id: g.id, brand: g.brand, brandKa: g.brandKa ?? null, name: g.name, nameKa: g.nameKa ?? null, city: g.city, district: g.district ?? null, address: g.address ?? null, status: g.status });
const GYM = {
  aspriaVake: gymIdOf('Aspria', 'Vake', 'თბილისი'),
  snapChav: gymIdOf('Snap Fitness', 'Chavchavadze 29', 'თბილისი'),
  oktopusVake: gymIdOf('Oktopus', 'Vake · Ramishvili', 'თბილისი'),
  oktopusEuli: gymIdOf('Oktopus', 'Sandro Euli', 'თბილისი'),
  reformNutsubidze: gymIdOf('Reform Sport Club', 'Nutsubidze', 'თბილისი'),
};

// ───────────────────────── people + trainer profiles ─────────────────────────

const CLIENTS = {
  ana: { id: CLIENT_IDS.ana, name: 'ანა კაპანაძე', avatarId: 'avatar-1', gender: 'FEMALE', age: 29, heightCm: 167, sinceDays: 63, scopes: { workouts: true, nutrition: true, weight: true, photos: false }, note: 'მინდა 68 კგ-მდე ჩამოვიდე და ძალა შევინარჩუნო.', mult: 0.55 },
  luka: { id: CLIENT_IDS.luka, name: 'ლუკა ღლონტი', avatarId: 'avatar-2', gender: 'MALE', age: 34, heightCm: 181, sinceDays: 48, scopes: { workouts: true, nutrition: true, weight: true, photos: false }, note: 'კუნთის მასა მინდა მოვიმატო.', mult: 1.1 },
  mariam: { id: CLIENT_IDS.mariam, name: 'მარიამ ჯავახიშვილი', avatarId: 'avatar-9', gender: 'FEMALE', age: 41, heightCm: 164, sinceDays: 90, scopes: { workouts: false, nutrition: true, weight: true, photos: false }, note: '', mult: 0.6 },
  davit: { id: CLIENT_IDS.davit, name: 'დავით ბერიძე', avatarId: 'avatar-8', gender: 'MALE', age: 27, heightCm: 186, sinceDays: 35, scopes: { workouts: true, nutrition: false, weight: true, photos: false }, note: 'ძალოვანი პროგრამა და სწორი ტექნიკა.', mult: 1.25 },
  tamar: { id: CLIENT_IDS.tamar, name: 'თამარ ლომიძე', avatarId: 'avatar-12', gender: 'FEMALE', age: 36, heightCm: 170, sinceDays: 21, scopes: { workouts: true, nutrition: false, weight: false, photos: false }, note: 'მუხლის ოპერაციის შემდეგ — რბილად და თანდათან.', mult: 0.5 },
};
const REQUEST = { id: CLIENT_IDS.nika, name: 'ნიკა ხარაზიშვილი', avatarId: 'avatar-10', gender: 'MALE', age: 31, note: 'ნახევარმარათონისთვის ვემზადები — ძალოვანი ნაწილი მჭირდება.', scopes: { workouts: true, nutrition: false, weight: true, photos: false } };
const INVITE = { id: CLIENT_IDS.salome, name: 'სალომე წიკლაური', avatarId: 'avatar-6', gender: 'FEMALE', age: 26 };

function trainerProfiles(today) {
  return {
    [MAN_ID]: {
      userId: MAN_ID,
      displayName: 'გიორგი მაისურაძე',
      avatarId: 'avatar-5',
      bio: 'ძალოვანი და ფუნქციური ვარჯიში 9 წელია. ვმუშაობ წონის კლებასა და კუნთის მატებაზე — გეგმით, გაზომვებით და კვების მკაფიო წესებით, სასტიკი დიეტების გარეშე.',
      specialties: ['strength', 'muscle', 'functional', 'weight_loss'],
      experienceYears: 9,
      instagram: 'giorgi.trains',
      gymIds: [GYM.aspriaVake, GYM.snapChav],
      certificates: [
        { id: uuidFrom('cert:man:1'), title: 'Certified Personal Trainer', issuer: 'ACE', year: 2017, addedAt: isoAt(addDays(today, -120), '11:02') },
        { id: uuidFrom('cert:man:2'), title: 'Kettlebell Instructor', issuer: 'StrongFirst', year: 2021, addedAt: isoAt(addDays(today, -120), '11:04') },
      ],
      code: TRAINER_CODE,
      status: 'VERIFIED',
      reviewNote: null,
      submittedAt: isoAt(addDays(today, -120), '11:06'),
      reviewedAt: isoAt(addDays(today, -118), '15:40'),
      clients: 5,
    },
    [LEVAN_ID]: {
      userId: LEVAN_ID,
      displayName: 'ლევან ჩხეიძე',
      avatarId: 'avatar-3',
      bio: 'პერსონალური ტრენერი, 8 წლის გამოცდილება. ძალა, სწორი ტექნიკა და მობილობა — ქალებთან და დამწყებებთან ბევრს ვმუშაობ.',
      specialties: ['strength', 'weight_loss', 'mobility', 'women'],
      experienceYears: 8,
      instagram: 'levan.coach',
      gymIds: [GYM.oktopusVake],
      certificates: [{ id: uuidFrom('cert:levan:1'), title: 'Personal Trainer, Level 3', issuer: 'EREPS', year: 2018, addedAt: isoAt(addDays(today, -300), '10:00') }],
      code: 'LV4R8T',
      status: 'VERIFIED',
      reviewNote: null,
      submittedAt: isoAt(addDays(today, -300), '10:05'),
      reviewedAt: isoAt(addDays(today, -298), '12:30'),
      clients: 12,
    },
    [EKA_ID]: {
      userId: EKA_ID,
      displayName: 'ეკა ნოზაძე',
      avatarId: 'avatar-7',
      bio: 'იოგა, პილატესი და მობილობა. ზურგის კომფორტი და სწორი სუნთქვა ყოველ ვარჯიშში.',
      specialties: ['yoga', 'mobility', 'women'],
      experienceYears: 6,
      instagram: 'eka.moves',
      gymIds: [GYM.oktopusEuli],
      certificates: [{ id: uuidFrom('cert:eka:1'), title: 'Pilates Mat Instructor', issuer: 'STOTT', year: 2020, addedAt: isoAt(addDays(today, -200), '10:00') }],
      code: 'EK6N2Z',
      status: 'VERIFIED',
      reviewNote: null,
      submittedAt: isoAt(addDays(today, -200), '10:05'),
      reviewedAt: isoAt(addDays(today, -199), '12:30'),
      clients: 9,
    },
    [IRAKLI_ID]: {
      userId: IRAKLI_ID,
      displayName: 'ირაკლი წერეთელი',
      avatarId: 'avatar-11',
      bio: 'კროსფიტი და გამძლეობა. ვამზადებ სირბილისა და ტრიატლონის მოყვარულებს.',
      specialties: ['crossfit', 'cardio', 'sport'],
      experienceYears: 11,
      instagram: 'irakli.wod',
      gymIds: [GYM.reformNutsubidze],
      certificates: [],
      code: 'IR9W3D',
      status: 'VERIFIED',
      reviewNote: null,
      submittedAt: isoAt(addDays(today, -400), '10:05'),
      reviewedAt: isoAt(addDays(today, -398), '12:30'),
      clients: 17,
    },
  };
}

function ownTrainerProfile(p) {
  if (!p) return null;
  const g = gyms();
  return {
    status: p.status,
    displayName: p.displayName,
    bio: p.bio || '',
    specialties: [...p.specialties],
    experienceYears: p.experienceYears ?? null,
    instagram: p.instagram || '',
    gyms: p.gymIds.map((id) => g.get(id)).filter(Boolean).map(gymPublic),
    gymIds: [...p.gymIds],
    certificates: p.certificates.map((c) => ({ id: c.id, title: c.title, issuer: c.issuer, year: c.year, addedAt: c.addedAt })),
    code: p.status === 'VERIFIED' ? p.code : null,
    link: p.status === 'VERIFIED' ? `https://medicard.ge/c/${p.code}` : null,
    reviewNote: p.status === 'REJECTED' ? p.reviewNote || '' : null,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt,
  };
}

function trainerCard(p, rq) {
  const g = gyms();
  const labels = isEn(rq) ? SPECIALTIES_EN : SPECIALTIES;
  return {
    id: p.userId,
    displayName: p.displayName,
    avatarId: p.avatarId ?? null,
    avatarUrl: null,
    bio: p.bio || '',
    specialties: p.specialties.map((k) => ({ key: k, label: labels[k] || k })),
    experienceYears: p.experienceYears ?? null,
    instagram: p.instagram || null,
    verified: p.status === 'VERIFIED',
    certificates: p.certificates.map((c) => ({ title: c.title, issuer: c.issuer, year: c.year })),
    gyms: p.gymIds.map((id) => g.get(id)).filter(Boolean).map(gymPublic),
    clients: p.clients ?? 0,
  };
}

// ───────────────────────── sessions ─────────────────────────

const EXERCISES = {
  STRENGTH: [['ჩაჯდომა შტანგით', 4, 8, 60], ['მკერდით წნევა', 4, 8, 50], ['რუმინული წევა', 3, 10, 55], ['ზედა ბლოკის წევა', 3, 12, 40]],
  FUNCTIONAL: [['გირის ქნევა', 4, 15, 16], ['გობლეტ ჩაჯდომა', 3, 12, 20], ['ბოქსზე ხტომა', 3, 10, null], ['ფერმერის სიარული', 3, null, 24, 1]],
  HIIT: [['ველოერგომეტრი — ინტერვალები', null, null, null, 20], ['ბერპი', 4, 12, null], ['ბაგირით ტალღები', 4, null, null, 1]],
  MOBILITY: [['თეძოს მობილობა', null, null, null, 10], ['გლუტეუსის ხიდი', 3, 15, null], ['გულმკერდის როტაცია', 3, 10, null]],
  CARDIO: [['სარბენი ბილიკი', null, null, null, 25], ['ნიჩბოსნობის ტრენაჟორი', null, null, null, 15]],
  ASSESSMENT: [['წონა და გაზომვები', null, null, null, 15], ['ჩაჯდომა — ტესტი', 1, 5, 60]],
};
const NOTES = ['ტექნიკა კარგად გამოდის — შემდეგზე წონას ოდნავ ავწევთ.', 'კარგი ტემპი. სახლში 10 წუთი გაჭიმვა.', 'ბოლო სეტი მძიმე იყო, დასვენება კარგად გამოიყენე.', ''];

function exercisesFor(kind, mult, seed) {
  return (EXERCISES[kind] || EXERCISES.STRENGTH).map(([name, sets, reps, kg, minutes]) => {
    const e = { name };
    if (sets != null) e.sets = sets;
    if (reps != null) e.reps = reps;
    if (kg != null) e.kg = Math.max(2, Math.round((kg * mult * (0.95 + seeded(`${seed}:${name}`) * 0.1)) / 2.5) * 2.5);
    if (minutes != null) e.minutes = minutes;
    return e;
  });
}

/** Mon(1)…Sat(6) timetable of the trainer persona. c = client key, null = open slot. */
const TRAINER_WEEK = {
  1: [['08:00', 'ana', 'STRENGTH', 'aspriaVake'], ['09:30', 'davit', 'STRENGTH', 'aspriaVake'], ['11:00', 'tamar', 'MOBILITY', 'aspriaVake'], ['13:00', null, 'FUNCTIONAL', 'aspriaVake'], ['18:00', 'luka', 'STRENGTH', 'snapChav'], ['19:30', 'mariam', 'FUNCTIONAL', 'snapChav']],
  2: [['07:30', 'mariam', 'CARDIO', 'aspriaVake'], ['10:00', 'tamar', 'MOBILITY', 'aspriaVake'], ['18:00', 'ana', 'HIIT', 'snapChav'], ['19:30', 'luka', 'STRENGTH', 'snapChav'], ['21:00', null, 'STRENGTH', 'snapChav']],
  3: [['08:00', 'ana', 'STRENGTH', 'aspriaVake'], ['09:30', 'davit', 'STRENGTH', 'aspriaVake'], ['12:00', null, 'FUNCTIONAL', 'aspriaVake'], ['18:00', 'luka', 'STRENGTH', 'snapChav'], ['19:30', 'mariam', 'FUNCTIONAL', 'snapChav']],
  4: [['07:30', 'mariam', 'CARDIO', 'aspriaVake'], ['10:00', 'tamar', 'MOBILITY', 'aspriaVake'], ['18:00', 'ana', 'STRENGTH', 'snapChav'], ['19:30', 'davit', 'HIIT', 'snapChav']],
  5: [['08:00', 'ana', 'FUNCTIONAL', 'aspriaVake'], ['09:30', 'davit', 'STRENGTH', 'aspriaVake'], ['11:00', 'tamar', 'MOBILITY', 'aspriaVake'], ['18:00', 'luka', 'STRENGTH', 'snapChav'], ['19:30', null, 'STRENGTH', 'snapChav']],
  6: [['10:00', 'mariam', 'ASSESSMENT', 'aspriaVake'], ['11:30', 'luka', 'STRENGTH', 'aspriaVake'], ['13:00', null, 'FUNCTIONAL', 'aspriaVake']],
};
/** ლევანი's timetable with the women persona (19:00 Tue/Thu, Sat 11:00) and his open slots. */
const LEVAN_WEEK = {
  1: [['08:00', null, 'STRENGTH']],
  2: [['19:00', 'me', 'STRENGTH']],
  3: [['07:30', null, 'FUNCTIONAL']],
  4: [['19:00', 'me', 'STRENGTH']],
  5: [['18:00', null, 'MOBILITY']],
  6: [['11:00', 'me', 'FUNCTIONAL']],
};

function baseSession({ id, trainerId, clientId, gymId, startsAt, durationMin, kind, status }) {
  return { id, trainerId, clientId, gymId, startsAt, durationMin, kind, note: '', status, seriesId: null, clientConfirmedAt: null, cancelledBy: null, cancelReason: null, lateCancel: false, exercises: [], trainerNote: '', clientRating: null };
}

/** Trainer persona sessions over [from, to] (YYYY-MM-DD), statuses relative to `now`. */
function buildTrainerSessions(fromYmd, toYmd, today, now) {
  const out = [];
  for (let day = fromYmd; day <= toYmd; day = addDays(day, 1)) {
    for (const [hhmm, key, kind, gymKey] of TRAINER_WEEK[weekdayOf(day)] || []) {
      const client = key ? CLIENTS[key] : null;
      if (client && day < addDays(today, -client.sinceDays)) continue;
      const startsAt = isoAt(day, hhmm);
      const start = Date.parse(startsAt);
      const durationMin = kind === 'ASSESSMENT' ? 45 : 60;
      const end = start + durationMin * 60000;
      if (!client && start < now) continue; // an unbooked slot that passed is gone
      const id = uuidFrom(`coach:trainer:${day}:${hhmm}`);
      const s = baseSession({ id, trainerId: MAN_ID, clientId: client?.id ?? null, gymId: GYM[gymKey], startsAt, durationMin, kind, status: client ? (end <= now ? 'DONE' : 'SCHEDULED') : 'OPEN' });
      if (client && s.status === 'DONE') {
        s.exercises = exercisesFor(kind, client.mult, id);
        s.trainerNote = NOTES[Math.floor(seeded(`note:${id}`) * NOTES.length)];
        s.clientConfirmedAt = new Date(start - 20 * 3600000).toISOString();
        if (seeded(`rate:${id}`) < 0.55) s.clientRating = seeded(`stars:${id}`) < 0.8 ? 5 : 4;
      } else if (client) {
        // Most clients confirm within a day; the next one today is always confirmed.
        const soon = start - now < 30 * 3600000;
        if (day === today || (soon && seeded(`confirm:${id}`) < 0.75)) s.clientConfirmedAt = new Date(Math.min(now - 3600000, start - 18 * 3600000)).toISOString();
      }
      out.push(s);
    }
  }
  return out;
}

/** Sessions of the women persona with ლევანი, plus his open slots (next 21 days). */
function buildLevanSessions(fromYmd, toYmd, today, now, sinceYmd) {
  const out = [];
  for (let day = fromYmd; day <= toYmd; day = addDays(day, 1)) {
    for (const [hhmm, who, kind] of LEVAN_WEEK[weekdayOf(day)] || []) {
      const startsAt = isoAt(day, hhmm);
      const start = Date.parse(startsAt);
      const id = uuidFrom(`coach:levan:${day}:${hhmm}`);
      if (!who) {
        if (start > now && start < now + 21 * DAY) out.push(baseSession({ id, trainerId: LEVAN_ID, clientId: null, gymId: GYM.oktopusVake, startsAt, durationMin: 60, kind, status: 'OPEN' }));
        continue;
      }
      if (day < sinceYmd) continue;
      const end = start + 60 * 60000;
      const s = baseSession({ id, trainerId: LEVAN_ID, clientId: WOMEN_ID, gymId: GYM.oktopusVake, startsAt, durationMin: 60, kind, status: end <= now ? 'DONE' : 'SCHEDULED' });
      if (s.status === 'DONE') {
        s.exercises = exercisesFor(kind, 0.55, id);
        s.trainerNote = NOTES[Math.floor(seeded(`note:${id}`) * NOTES.length)];
        s.clientConfirmedAt = new Date(start - 22 * 3600000).toISOString();
        s.clientRating = seeded(`stars:${id}`) < 0.85 ? 5 : 4;
      }
      if (kind === 'FUNCTIONAL' && s.status === 'SCHEDULED') s.note = 'წყალი და პირსახოცი წამოიღე 🙂';
      out.push(s);
    }
  }
  return out;
}

const HEALTH_KIND = { STRENGTH: 'traditionalStrengthTraining', FUNCTIONAL: 'functionalStrengthTraining', HIIT: 'highIntensityIntervalTraining', MOBILITY: 'flexibility', CARDIO: 'mixedCardio', ASSESSMENT: 'other' };
/** The phone workout recorded during a DONE session (Apple Health), as store.listWorkouts returns it. */
function workoutFor(s, ownerSeed) {
  if (s.status !== 'DONE') return null;
  const start = Date.parse(s.startsAt) + 4 * 60000;
  const durationMin = s.durationMin - 7;
  const kcalPerMin = { STRENGTH: 6.2, FUNCTIONAL: 7.4, HIIT: 9.1, MOBILITY: 3.4, CARDIO: 8.0, ASSESSMENT: 3.0 }[s.kind] ?? 6;
  const r = seeded(`wo:${ownerSeed}:${s.id}`);
  return {
    id: uuidFrom(`workout:${s.id}`),
    source: 'apple_health',
    kind: HEALTH_KIND[s.kind] || 'other',
    startedAt: new Date(start).toISOString(),
    endedAt: new Date(start + durationMin * 60000).toISOString(),
    durationMin,
    kcal: Math.round(durationMin * kcalPerMin * (0.9 + r * 0.2)),
    avgHeartRate: Math.round({ HIIT: 148, CARDIO: 141, FUNCTIONAL: 132, STRENGTH: 121, MOBILITY: 98, ASSESSMENT: 95 }[s.kind] + r * 8),
    distanceKm: s.kind === 'CARDIO' ? round1(3 + r * 1.5) : null,
    date: tbilisiYmd(start),
  };
}

function sessionPublic(s, rq, people) {
  const g = s.gymId ? gyms().get(s.gymId) : null;
  const person = s.clientId ? people.get(s.clientId) : null;
  const en = isEn(rq);
  return {
    id: s.id,
    trainerId: s.trainerId,
    clientId: s.clientId ?? null,
    clientName: person?.name ?? null,
    clientAvatarId: person?.avatarId ?? null,
    clientAvatarUrl: null,
    startsAt: new Date(s.startsAt).toISOString(),
    durationMin: s.durationMin,
    kind: s.kind,
    kindLabel: (en ? SESSION_KINDS_EN : SESSION_KINDS)[s.kind] || s.kind,
    note: s.note || '',
    status: s.status,
    gym: g ? { id: g.id, brand: g.brand, name: g.name, city: g.city } : null,
    seriesId: s.seriesId ?? null,
    clientConfirmedAt: s.clientConfirmedAt ? new Date(s.clientConfirmedAt).toISOString() : null,
    cancelledBy: s.cancelledBy ?? null,
    cancelReason: en && s.cancelReason === 'კავშირი დასრულდა' ? 'The connection ended' : s.cancelReason ?? null,
    lateCancel: Boolean(s.lateCancel),
    exercises: Array.isArray(s.exercises) ? s.exercises : [],
    trainerNote: s.trainerNote || '',
    clientRating: s.clientRating ?? null,
    label: formatSessionTime(s.startsAt, en),
  };
}

// ───────────────────────── nutrition / weight / activity (pure rules from lib/trainer.js) ─────────────────────────

function dayAdherence({ targets, eaten, meals = 0, isToday = false }) {
  const kcalTarget = Number(targets?.calories) || 0;
  const kcal = Number(eaten?.calories) || 0;
  if (!meals || kcal <= 0) return { status: isToday ? 'PENDING' : 'NONE', ratio: 0 };
  if (!kcalTarget) return { status: 'ON', ratio: null };
  const ratio = kcal / kcalTarget;
  if (ratio > 1.1) return { status: 'OVER', ratio: Math.round(ratio * 100) / 100 };
  if (ratio < 0.9) return { status: isToday ? 'PENDING' : 'UNDER', ratio: Math.round(ratio * 100) / 100 };
  const proteinTarget = Number(targets?.protein) || 0;
  if (!isToday && proteinTarget && (Number(eaten?.protein) || 0) < proteinTarget * 0.85) return { status: 'LOW_PROTEIN', ratio: Math.round(ratio * 100) / 100 };
  return { status: 'ON', ratio: Math.round(ratio * 100) / 100 };
}
function adherenceScore(days) {
  const judged = days.filter((d) => !['PENDING', 'NONE'].includes(d.status));
  if (!judged.length) return null;
  return Math.round((judged.filter((d) => d.status === 'ON').length / judged.length) * 100);
}
function trailingRun(days, pred) {
  let n = 0;
  for (const d of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    if (d.status === 'PENDING') continue;
    if (!pred(d)) break;
    n += 1;
  }
  return n;
}
function goalProgress(goal, currentKg) {
  if (!goal || !Number.isFinite(goal.startKg) || !Number.isFinite(goal.targetKg) || !Number.isFinite(currentKg)) return null;
  const total = goal.targetKg - goal.startKg;
  if (Math.abs(total) < 0.05) return { percent: 100, remainingKg: 0, direction: 'keep' };
  const percent = Math.max(0, Math.min(100, Math.round(((currentKg - goal.startKg) / total) * 100)));
  return { percent, remainingKg: round1(goal.targetKg - currentKg), direction: total < 0 ? 'lose' : 'gain' };
}
function expectedWeight(goal, ymd) {
  if (!goal?.startedYmd || !goal?.deadlineYmd) return null;
  const span = Date.parse(goal.deadlineYmd) - Date.parse(goal.startedYmd);
  if (!(span > 0)) return null;
  const x = Math.max(0, Math.min(1, (Date.parse(ymd) - Date.parse(goal.startedYmd)) / span));
  return round1(goal.startKg + (goal.targetKg - goal.startKg) * x);
}
/** lib/trainer.js clientAlerts. */
function clientAlerts({ name, nutritionDays, lastWeighYmd, lastMealYmd, lastSession, goal, currentKg, today, en }) {
  const out = [];
  const days = (n) => `${n} ${n === 1 ? 'day' : 'days'}`;
  if (nutritionDays?.length) {
    const over = trailingRun(nutritionDays, (d) => d.status === 'OVER');
    if (over >= 2) out.push({ kind: 'OVER_STREAK', tone: 'warn', text: en ? `${name}: over the calorie target ${days(over)} in a row` : `${name}: ${over} დღე ზედიზედ გადააჭარბა კალორიებს` });
    const under = trailingRun(nutritionDays, (d) => d.status === 'UNDER');
    if (under >= 3) out.push({ kind: 'UNDER_STREAK', tone: 'warn', text: en ? `${name}: eating far too little for ${days(under)}` : `${name}: ${under} დღეა ძალიან ცოტას ჭამს` });
    const onRun = trailingRun(nutritionDays, (d) => d.status === 'ON');
    if (onRun >= 5) out.push({ kind: 'ON_STREAK', tone: 'good', text: en ? `${name}: on plan ${days(onRun)} in a row 🔥` : `${name}: ${onRun} დღე ზედიზედ გეგმაშია 🔥` });
  }
  if (lastMealYmd !== undefined) {
    const gap = lastMealYmd ? Math.round((Date.parse(today) - Date.parse(lastMealYmd)) / DAY) : null;
    if (gap == null || gap >= 3) out.push({ kind: 'NO_FOOD_LOG', tone: 'info', text: en ? (gap == null ? `${name}: has not logged any food yet` : `${name}: no food logged for ${days(gap)}`) : gap == null ? `${name}: კვებას ჯერ არ იწერს` : `${name}: ${gap} დღეა კვება არ ჩაუწერია` });
  }
  if (lastWeighYmd !== undefined) {
    const gap = lastWeighYmd ? Math.round((Date.parse(today) - Date.parse(lastWeighYmd)) / DAY) : null;
    if (gap == null || gap >= 7) out.push({ kind: 'NO_WEIGH_IN', tone: 'info', text: en ? (gap == null ? `${name}: has not logged weight yet` : `${name}: no weigh-in for ${days(gap)}`) : gap == null ? `${name}: წონა ჯერ არ ჩაუწერია` : `${name}: ${gap} დღეა არ აწონილა` });
  }
  if (lastSession?.status === 'NO_SHOW') out.push({ kind: 'NO_SHOW', tone: 'warn', text: en ? `${name}: missed the last session` : `${name}: ბოლო ვარჯიშზე არ მოვიდა` });
  if (goal && Number.isFinite(currentKg)) {
    const expected = expectedWeight(goal, today);
    if (expected != null) {
      const behind = goal.targetKg < goal.startKg ? currentKg - expected : expected - currentKg;
      if (behind >= 1.5) out.push({ kind: 'BEHIND_GOAL', tone: 'warn', text: en ? `${name}: ${round1(behind)} kg behind the goal` : `${name}: მიზანს ${round1(behind)} კგ-ით ჩამორჩება` });
      else if (behind <= -1) out.push({ kind: 'AHEAD_GOAL', tone: 'good', text: en ? `${name}: ahead of the goal` : `${name}: მიზანს უსწრებს` });
    }
  }
  return out;
}

/** Trainer meal plans per client (TrainerMealPlan rows). */
function plans(today) {
  const plan = (key, title, targets, meals, note, startsOffset) => ({ id: uuidFrom(`plan:${key}`), title, targets, meals, note, startsOn: addDays(today, startsOffset), updatedAt: isoAt(addDays(today, startsOffset), '21:10') });
  return {
    ana: plan('ana', 'წონის კლება · 1 650 კკალ', { calories: 1650, protein: 115, carbs: 160, fat: 55 }, [
      { slot: 'breakfast', time: '08:30', items: [{ name: 'შვრიის ფაფა რძეზე', grams: 60, calories: 230, protein: 9 }, { name: 'ბერძნული იოგურტი', grams: 150, calories: 140, protein: 15 }] },
      { slot: 'lunch', time: '13:30', items: [{ name: 'ქათმის მკერდი', grams: 150, calories: 248, protein: 46 }, { name: 'წიწიბურა', grams: 150, calories: 165, protein: 6 }, { name: 'სალათი ზეითუნის ზეთით', grams: 200, calories: 110, protein: 2 }] },
      { slot: 'snack2', time: '17:00', items: [{ name: 'ხაჭო', grams: 150, calories: 150, protein: 24 }] },
      { slot: 'dinner', time: '20:30', items: [{ name: 'კალმახი ღუმელში', grams: 180, calories: 270, protein: 36 }, { name: 'ბოსტნეული ორთქლზე', grams: 250, calories: 100, protein: 5 }] },
    ], 'წყალი — დღეში 2 ლიტრი. ვარჯიშის დღეებში ვარჯიშამდე 1,5 საათით ადრე მცირე კვება.', -55),
    luka: plan('luka', 'კუნთის მატება · 2 900 კკალ', { calories: 2900, protein: 170, carbs: 360, fat: 85 }, [
      { slot: 'breakfast', time: '08:00', items: [{ name: 'კვერცხი', grams: 180, calories: 260, protein: 22 }, { name: 'შვრიის ფაფა ბანანით', grams: 100, calories: 480, protein: 14 }] },
      { slot: 'lunch', time: '13:00', items: [{ name: 'საქონლის ხორცი', grams: 200, calories: 500, protein: 52 }, { name: 'ბრინჯი', grams: 250, calories: 325, protein: 7 }] },
      { slot: 'preworkout', time: '16:30', items: [{ name: 'პური არაქისის კარაქით', grams: 90, calories: 330, protein: 12 }] },
      { slot: 'postworkout', time: '20:00', items: [{ name: 'ქათამი და კარტოფილი', grams: 450, calories: 640, protein: 52 }] },
    ], 'ყოველ კვებაში ცილა. შაბათს — თავისუფალი ვახშამი.', -40),
    mariam: plan('mariam', 'დაბალანსებული · 1 700 კკალ', { calories: 1700, protein: 100, carbs: 180, fat: 60 }, [
      { slot: 'breakfast', time: '09:00', items: [{ name: 'ხაჭო თაფლით', grams: 180, calories: 260, protein: 28 }] },
      { slot: 'lunch', time: '14:00', items: [{ name: 'ლობიო', grams: 250, calories: 330, protein: 16 }, { name: 'მჭადი', grams: 80, calories: 180, protein: 4 }] },
      { slot: 'dinner', time: '19:30', items: [{ name: 'ქათმის სალათი', grams: 300, calories: 380, protein: 35 }] },
    ], '', -80),
    me: plan('me', 'ძალა და ფორმა · 1 850 კკალ', { calories: 1850, protein: 110, carbs: 190, fat: 62 }, [
      { slot: 'breakfast', time: '08:30', items: [{ name: 'ერბოკვერცხი შოთის პურით', grams: 200, calories: 380, protein: 20 }, { name: 'პომიდვრისა და კიტრის სალათი', grams: 250, calories: 60, protein: 2 }] },
      { slot: 'lunch', time: '13:30', items: [{ name: 'ქათმის მკერდი', grams: 160, calories: 265, protein: 49 }, { name: 'ბრინჯი', grams: 180, calories: 235, protein: 5 }, { name: 'ბროკოლი', grams: 150, calories: 50, protein: 4 }] },
      { slot: 'preworkout', time: '17:30', items: [{ name: 'ბანანი', grams: 120, calories: 105, protein: 1 }, { name: 'ბერძნული იოგურტი', grams: 150, calories: 140, protein: 15 }, { name: 'ნიგოზი', grams: 25, calories: 165, protein: 4 }] },
      { slot: 'dinner', time: '20:45', items: [{ name: 'კალმახი', grams: 180, calories: 270, protein: 36 }, { name: 'ბოსტნეული ზეითუნის ზეთით', grams: 250, calories: 150, protein: 4 }] },
    ], 'ვარჯიშის დღეებში (სამ, ხუთ, შაბ) ვარჯიშამდე 1,5 საათით ადრე — ბანანი და იოგურტი. დანარჩენ დღეებში იგივე, უბრალოდ წახემსება გამოტოვე, თუ არ გშია.', -20),
  };
}

/** kcal ratios vs plan, oldest (today-13) → yesterday; null = nothing logged. Today comes from TODAY_MEALS. */
const RATIOS = {
  ana: [0.97, 1.02, 0.95, 1.04, 0.98, 0.93, 1.01, 0.99, 1.03, 0.96, 1.0, 0.97, 1.02],
  luka: [1.0, 0.96, 1.05, 0.92, 1.0, 1.08, 0.98, 1.03, 0.95, 1.0, 1.06, 1.18, 1.14],
  mariam: [0.94, null, 1.0, 0.86, 1.02, null, 0.97, 1.12, 0.95, 0.99, null, 1.01, 0.96],
};
const LOW_PROTEIN = { luka: [3], mariam: [8] };
const TODAY_MEALS = {
  ana: [['breakfast', '08:40', 'შვრიის ფაფა კენკრით', 380, 18, 'photo'], ['lunch', '13:20', 'ქათმის მკერდი, წიწიბურა, სალათი', 530, 46, 'photo']],
  luka: [['breakfast', '08:10', 'კვერცხი, შვრიის ფაფა ბანანით', 760, 36, 'saved'], ['lunch', '13:05', 'საქონლის ხორცი ბრინჯით', 640, 55, 'search']],
  mariam: [],
};

function synthNutrition(key, plan, today, fromYmd) {
  const days = [];
  for (let i = 0; i < 14; i += 1) {
    const date = addDays(today, i - 13);
    if (date < fromYmd) continue;
    if (i === 13) {
      const meals = TODAY_MEALS[key] || [];
      const calories = meals.reduce((s, m) => s + m[3], 0);
      const protein = meals.reduce((s, m) => s + m[4], 0);
      const carbs = Math.round((calories * 0.45) / 4);
      const fat = Math.round((calories * 0.28) / 9);
      days.push({ date, meals: meals.length, calories, protein, carbs, fat, ...dayAdherence({ targets: plan.targets, eaten: { calories, protein }, meals: meals.length, isToday: true }) });
      continue;
    }
    const r = RATIOS[key][i];
    if (r == null) {
      days.push({ date, meals: 0, calories: 0, protein: 0, carbs: 0, fat: 0, ...dayAdherence({ targets: plan.targets, eaten: { calories: 0 }, meals: 0 }) });
      continue;
    }
    const calories = Math.round(plan.targets.calories * r);
    const protein = Math.round(plan.targets.protein * ((LOW_PROTEIN[key] || []).includes(i) ? 0.74 : 0.92 + seeded(`p:${key}:${date}`) * 0.12));
    const carbs = Math.round((calories * 0.44) / 4);
    const fat = Math.round((calories * 0.29) / 9);
    const meals = 3 + (seeded(`m:${key}:${date}`) < 0.4 ? 1 : 0);
    days.push({ date, meals, calories, protein, carbs, fat, ...dayAdherence({ targets: plan.targets, eaten: { calories, protein }, meals }) });
  }
  const logged = days.filter((d) => d.meals > 0);
  return { days, lastMealYmd: logged.at(-1)?.date ?? null };
}

function todayMealsOut(key, today) {
  return (TODAY_MEALS[key] || []).map(([type, time, title, calories, protein, source]) => ({ id: uuidFrom(`meal:${key}:${today}:${type}`), type, title, calories, protein, time, source }));
}

/** The women persona's own diary (state.nutrition from nutrition.mjs) against the trainer's plan, like store.nutritionDays. */
function diaryNutrition(rq, plan, fromYmd, toYmd) {
  const meals = Array.isArray(rq.state.nutrition?.meals) ? rq.state.nutrition.meals : null;
  const days = [];
  for (let d = fromYmd; d <= toYmd; d = addDays(d, 1)) {
    if (!meals) {
      // Fallback when the nutrition fixture is absent: a believable week (1 240 kcal so far today).
      const i = Math.round((Date.parse(d) - Date.parse(fromYmd)) / DAY);
      const ratio = [0.98, 1.03, 1.14, 0.97, 0.95, 1.01][i];
      const calories = d === toYmd ? 1240 : Math.round(plan.targets.calories * ratio);
      const protein = d === toYmd ? 62 : Math.round(plan.targets.protein * (i === 4 ? 0.78 : 0.95));
      const count = d === toYmd ? 3 : 3 + (i % 2);
      days.push({ date: d, meals: count, calories, protein, carbs: Math.round((calories * 0.45) / 4), fat: Math.round((calories * 0.3) / 9), ...dayAdherence({ targets: plan.targets, eaten: { calories, protein }, meals: count, isToday: d === toYmd }) });
      continue;
    }
    const list = meals.filter((m) => m.date === d);
    const items = list.flatMap((m) => (Array.isArray(m.items) ? m.items : []));
    const sum = (k) => Math.round(items.reduce((s, it) => s + (Number(it[k]) || 0), 0));
    const eaten = { calories: sum('calories'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
    days.push({ date: d, meals: list.length, ...eaten, ...dayAdherence({ targets: plan.targets, eaten, meals: list.length, isToday: d === toYmd }) });
  }
  return days;
}

const WEIGHT_PLAN = {
  ana: { startKg: 77.5, targetKg: 68, startedOffset: -60, deadlineOffset: 120, currentKg: 74.1, lastOffset: -2, pace: 0.5 },
  luka: { startKg: 72.0, targetKg: 78.0, startedOffset: -45, deadlineOffset: 135, currentKg: 74.6, lastOffset: -1, pace: 0.35 },
  mariam: { startKg: 82.0, targetKg: 74.0, startedOffset: -88, deadlineOffset: 92, currentKg: 78.6, lastOffset: -9, pace: 0.4 },
  davit: { startKg: 91.0, targetKg: 84.0, startedOffset: -35, deadlineOffset: 105, currentKg: 88.4, lastOffset: -3, pace: 0.5 },
};

function weightData(key, today) {
  const w = WEIGHT_PLAN[key];
  const c = CLIENTS[key];
  const series = [];
  const start = w.startedOffset;
  const span = w.lastOffset - start;
  for (let off = start, i = 0; off <= w.lastOffset; off += 4 + (i % 2), i += 1) {
    const x = span ? (off - start) / span : 1;
    const noise = (seeded(`w:${key}:${off}`) - 0.5) * 0.5;
    series.push({ date: addDays(today, off), kg: round1(w.startKg + (w.currentKg - w.startKg) * x + (off === w.lastOffset || off === start ? 0 : noise)) });
  }
  if (series.at(-1).date !== addDays(today, w.lastOffset)) series.push({ date: addDays(today, w.lastOffset), kg: w.currentKg });
  else series[series.length - 1].kg = w.currentKg;
  const goal = { targetKg: w.targetKg, startKg: w.startKg, startedYmd: addDays(today, start), deadlineYmd: addDays(today, w.deadlineOffset), paceKgPerWeek: w.pace };
  return { series, currentKg: w.currentKg, lastWeighYmd: addDays(today, w.lastOffset), heightCm: c.heightCm, goal, progress: goalProgress(goal, w.currentKg) };
}

function activityData(key, today, sessions) {
  const days = [];
  const base = { ana: 9200, luka: 7600, davit: 8400, tamar: 6200 }[key] ?? 7000;
  for (let i = 29; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    const r = seeded(`steps:${key}:${date}`);
    const steps = i === 0 ? Math.round(base * 0.45) : Math.round(base * (0.7 + r * 0.6));
    days.push({ date, steps, activeMinutes: Math.round(steps / 160), heartRate: Math.round(62 + r * 10), sleepHours: round1(6.4 + seeded(`sleep:${key}:${date}`) * 1.6) });
  }
  const from = Date.parse(isoAt(addDays(today, -29), '00:00'));
  const workouts = sessions
    .filter((s) => s.clientId === CLIENTS[key].id && s.status === 'DONE' && Date.parse(s.startsAt) >= from)
    .map((s) => workoutFor(s, key))
    .filter(Boolean)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return { days, activities: [], workouts };
}

function matchWorkout(s, workouts) {
  const s0 = Date.parse(s.startsAt) - 30 * 60000;
  const s1 = Date.parse(s.startsAt) + (s.durationMin + 30) * 60000;
  return workouts.find((w) => Date.parse(w.startedAt) < s1 && Date.parse(w.endedAt) > s0) || null;
}

// ───────────────────────── state ─────────────────────────

function seed(state, persona, today) {
  const now = Date.now();
  const profiles = trainerProfiles(today);
  const c = { seededFor: today, persona, profiles };
  if (persona === 'man') {
    const sessions = buildTrainerSessions(addDays(today, -42), addDays(today, 28), today, now);
    // დავითი missed his most recent finished session (alert „ბოლო ვარჯიშზე არ მოვიდა“).
    const lastDavit = sessions.filter((s) => s.clientId === CLIENT_IDS.davit && s.status === 'DONE').at(-1);
    if (lastDavit) Object.assign(lastDavit, { status: 'NO_SHOW', exercises: [], trainerNote: '', clientRating: null });
    // მარიამმა this week's Tuesday cardio cancelled in time (calendar shows it as cancelled).
    const tue = addDays(mondayOf(today), 1);
    const cancelled = sessions.find((s) => s.id === uuidFrom(`coach:trainer:${tue}:07:30`));
    if (cancelled) Object.assign(cancelled, { status: 'CANCELLED', cancelledBy: 'CLIENT', cancelReason: 'მივლინებაში ვარ, შემდეგ კვირას გავაგრძელებ.', lateCancel: false, exercises: [], trainerNote: '', clientRating: null, clientConfirmedAt: null });
    const linkFor = (k) => ({
      id: uuidFrom(`link:${k}`),
      trainerId: MAN_ID,
      clientId: CLIENTS[k].id,
      status: 'ACTIVE',
      initiator: k === 'tamar' ? 'TRAINER' : 'CLIENT',
      scopes: { ...CLIENTS[k].scopes },
      clientNote: CLIENTS[k].note || null,
      acceptedAt: isoAt(addDays(today, -CLIENTS[k].sinceDays), '19:12'),
      createdAt: isoAt(addDays(today, -CLIENTS[k].sinceDays), '18:50'),
      proposedGoal: null,
      trainerViewedAt: null,
    });
    c.trainer = {
      links: [
        { id: uuidFrom('link:nika'), trainerId: MAN_ID, clientId: REQUEST.id, status: 'REQUESTED', initiator: 'CLIENT', scopes: { ...REQUEST.scopes }, clientNote: REQUEST.note, acceptedAt: null, createdAt: new Date(now - 17 * 3600000).toISOString(), proposedGoal: null, trainerViewedAt: null },
        { id: uuidFrom('link:salome'), trainerId: MAN_ID, clientId: INVITE.id, status: 'REQUESTED', initiator: 'TRAINER', scopes: { workouts: false, nutrition: false, weight: false, photos: false }, clientNote: null, acceptedAt: null, createdAt: isoAt(addDays(today, -2), '11:40'), proposedGoal: null, trainerViewedAt: null },
        ...['tamar', 'davit', 'luka', 'ana', 'mariam'].map(linkFor),
      ],
      sessions,
      plans: plans(today),
    };
  } else {
    const sinceYmd = addDays(today, -41);
    const sessions = buildLevanSessions(addDays(today, -42), addDays(today, 28), today, now, sinceYmd);
    // One missed session about three weeks ago.
    const missed = sessions.filter((s) => s.clientId === WOMEN_ID && s.status === 'DONE' && s.startsAt < isoAt(addDays(today, -17), '00:00')).at(-1);
    if (missed) Object.assign(missed, { status: 'NO_SHOW', exercises: [], trainerNote: '', clientRating: null, clientConfirmedAt: null });
    c.client = {
      link: {
        id: uuidFrom('link:women:levan'),
        trainerId: LEVAN_ID,
        clientId: WOMEN_ID,
        status: 'ACTIVE',
        initiator: 'CLIENT',
        scopes: { workouts: true, nutrition: true, weight: true, photos: false },
        clientNote: 'მინდა ძალა მოვიმატო და ზურგი აღარ მტკიოდეს.',
        acceptedAt: isoAt(sinceYmd, '19:12'),
        createdAt: isoAt(sinceYmd, '18:57'),
        proposedGoal: null,
        trainerViewedAt: new Date(now - 5 * 3600000).toISOString(),
      },
      sessions,
      plan: plans(today).me,
      photos: [],
      workoutsSaved: 0,
    };
  }
  state.coach = c;
}

export function init(state, ctx) {
  seed(state, ctx.persona, ctx.today);
}

function slice(rq) {
  if (!rq.state.coach || rq.state.coach.seededFor !== rq.today || rq.state.coach.persona !== rq.persona) seed(rq.state, rq.persona, rq.today);
  return rq.state.coach;
}

/** Display identity for decorated sessions / rosters (store.peopleByIds: name = the full name). */
function people(rq) {
  const map = new Map();
  for (const c of [...Object.values(CLIENTS), REQUEST, INVITE]) map.set(c.id, { name: c.name, avatarId: c.avatarId, age: c.age, gender: c.gender, heightCm: c.heightCm ?? null });
  const u = rq.state.user;
  map.set(WOMEN_ID, { name: u?.id === WOMEN_ID ? u.fullName : 'ნინო ბერიძე', avatarId: rq.state.healthProfile?.extraAnswers?.avatarId || 'avatar-4', age: u?.age ?? 31, gender: 'FEMALE', heightCm: rq.state.healthProfile?.heightCm ?? 168 });
  return map;
}

// ───────────────────────── composed views ─────────────────────────

function clientOverview(rq) {
  const c = slice(rq);
  const link = c.client?.link;
  if (!link) return { link: null };
  const now = Date.now();
  const ppl = people(rq);
  const trainer = trainerCard(c.profiles[link.trainerId], rq);
  const mine = c.client.sessions.filter((s) => s.clientId === WOMEN_ID);
  const upcoming = mine
    .filter((s) => ['SCHEDULED', 'CANCELLED'].includes(s.status) && Date.parse(s.startsAt) > now - 3 * 3600000 && Date.parse(s.startsAt) < now + 60 * DAY)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 30);
  const openSlots = link.status === 'ACTIVE' ? c.client.sessions.filter((s) => s.status === 'OPEN' && Date.parse(s.startsAt) > now && Date.parse(s.startsAt) < now + 21 * DAY).sort((a, b) => a.startsAt.localeCompare(b.startsAt)).slice(0, 40) : [];
  const past = mine.filter((s) => Date.parse(s.startsAt) < now && ['DONE', 'NO_SHOW'].includes(s.status)).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 20);
  const plan = link.status === 'ACTIVE' ? c.client.plan : null;
  const today = rq.today;
  const days = plan ? diaryNutrition(rq, plan, addDays(today, -6), today) : null;
  return {
    link: { id: link.id, status: link.status, initiator: link.initiator, scopes: { ...link.scopes }, since: link.acceptedAt, createdAt: link.createdAt, proposedGoal: link.proposedGoal ?? null, trainerViewedAt: link.trainerViewedAt },
    trainer,
    upcoming: upcoming.map((s) => sessionPublic(s, rq, ppl)),
    openSlots: openSlots.map((s) => sessionPublic(s, rq, ppl)),
    past: past.map((s) => sessionPublic(s, rq, ppl)),
    plan: plan ? { ...plan, meals: plan.meals } : null,
    nutrition: days ? { days, score: adherenceScore(days) } : null,
    stats: { done: mine.filter((s) => s.status === 'DONE').length, noShow: mine.filter((s) => s.status === 'NO_SHOW').length },
    consentVersion: CONSENT_VERSION,
  };
}

function rosterClient(rq, link) {
  const c = slice(rq);
  const key = Object.keys(CLIENTS).find((k) => CLIENTS[k].id === link.clientId);
  const p = people(rq).get(link.clientId);
  const today = rq.today;
  const now = Date.now();
  const en = isEn(rq);
  const name = p?.name ?? (en ? 'Client' : 'კლიენტი');
  const base = { linkId: link.id, id: link.clientId, name, avatarId: p?.avatarId ?? null, avatarUrl: null, age: p?.age ?? null, gender: p?.gender ?? null };
  const scopes = { ...link.scopes };
  const alerts = [];
  let week = null;
  let kcalToday = null;
  let weight = null;
  const plan = key ? c.trainer.plans[key] : null;
  if (scopes.nutrition && key && RATIOS[key]) {
    const n = synthNutrition(key, plan, today, addDays(today, -6));
    week = n.days.map((d) => ({ date: d.date, status: d.status }));
    kcalToday = { eaten: n.days.at(-1).calories, target: plan?.targets?.calories ?? null };
    alerts.push(...clientAlerts({ name, nutritionDays: n.days, lastMealYmd: n.lastMealYmd, today, en }));
  }
  if (scopes.weight && key && WEIGHT_PLAN[key]) {
    const w = weightData(key, today);
    weight = { currentKg: w.currentKg, goalKg: w.goal?.targetKg ?? null, percent: w.progress?.percent ?? null };
    alerts.push(...clientAlerts({ name, lastWeighYmd: w.lastWeighYmd, goal: w.goal, currentKg: w.currentKg, today, en }));
  }
  const mine = c.trainer.sessions.filter((s) => s.clientId === link.clientId);
  const last = mine.filter((s) => Date.parse(s.startsAt) < now && ['DONE', 'NO_SHOW'].includes(s.status)).sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
  alerts.push(...clientAlerts({ name, lastSession: last, today, en }));
  const next = mine.filter((s) => s.status === 'SCHEDULED' && Date.parse(s.startsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return { ...base, since: link.acceptedAt, scopes, week, kcalToday, weight, nextSession: next ? new Date(next.startsAt).toISOString() : null, alerts };
}

function coachClients(rq) {
  const c = slice(rq);
  const ppl = people(rq);
  const clients = [];
  const requests = [];
  const invited = [];
  const links = c.trainer.links
    .filter((l) => ['ACTIVE', 'REQUESTED'].includes(l.status))
    .sort((a, b) => (a.acceptedAt ? 1 : 0) - (b.acceptedAt ? 1 : 0) || String(b.acceptedAt || '').localeCompare(String(a.acceptedAt || '')) || b.createdAt.localeCompare(a.createdAt));
  for (const l of links) {
    const p = ppl.get(l.clientId);
    const base = { linkId: l.id, id: l.clientId, name: p?.name ?? t(rq, 'კლიენტი', 'Client'), avatarId: p?.avatarId ?? null, avatarUrl: null, age: p?.age ?? null, gender: p?.gender ?? null };
    if (l.status === 'REQUESTED') {
      if (l.initiator === 'TRAINER') invited.push({ ...base, createdAt: l.createdAt });
      else requests.push({ ...base, note: l.clientNote || '', createdAt: l.createdAt, scopes: { ...l.scopes } });
      continue;
    }
    clients.push(rosterClient(rq, l));
  }
  return { clients, requests, invited };
}

function coachToday(rq) {
  const c = slice(rq);
  const today = rq.today;
  const from = tbilisiDayStart(today).getTime();
  const to = from + DAY;
  const now = Date.now();
  const roster = coachClients(rq);
  const ppl = people(rq);
  const sessions = c.trainer.sessions.filter((s) => Date.parse(s.startsAt) >= from && Date.parse(s.startsAt) < to).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const weekSessions = c.trainer.sessions.filter((s) => s.status === 'SCHEDULED' && Date.parse(s.startsAt) >= from && Date.parse(s.startsAt) < from + 7 * DAY).length;
  const last30 = c.trainer.sessions.filter((s) => Date.parse(s.startsAt) >= now - 30 * DAY && Date.parse(s.startsAt) < now);
  const alerts = roster.clients.flatMap((x) => x.alerts.map((a) => ({ ...a, clientId: x.id, clientName: x.name, avatarId: x.avatarId, avatarUrl: null })));
  const rank = { warn: 0, info: 1, good: 2 };
  alerts.sort((a, b) => rank[a.tone] - rank[b.tone]);
  const profile = c.profiles[MAN_ID];
  return {
    today,
    trainer: { displayName: profile.displayName, status: profile.status },
    sessions: sessions.map((s) => sessionPublic(s, rq, ppl)),
    stats: { clients: roster.clients.length, requests: roster.requests.length, weekSessions, done30: last30.filter((s) => s.status === 'DONE').length, noShow30: last30.filter((s) => s.status === 'NO_SHOW').length },
    alerts: alerts.slice(0, 30),
    requests: roster.requests,
  };
}

function coachClientDashboard(rq, clientId) {
  const c = slice(rq);
  const link = c.trainer.links.find((l) => l.clientId === clientId && l.status === 'ACTIVE');
  if (!link) return null;
  const key = Object.keys(CLIENTS).find((k) => CLIENTS[k].id === clientId);
  const client = CLIENTS[key];
  const ppl = people(rq);
  const today = rq.today;
  const scopes = { ...link.scopes };
  const plan = c.trainer.plans[key] ?? null;
  const mine = c.trainer.sessions.filter((s) => s.clientId === clientId).sort((a, b) => b.startsAt.localeCompare(a.startsAt)).slice(0, 40);
  const out = {
    client: { id: clientId, name: client.name, firstName: client.name, avatarId: client.avatarId, avatarUrl: null, age: client.age, gender: client.gender, heightCm: client.heightCm },
    link: { id: link.id, since: link.acceptedAt, scopes, proposedGoal: link.proposedGoal ?? null, note: link.clientNote || '' },
    plan: plan ? { ...plan } : null,
    sessions: mine.map((s) => sessionPublic(s, rq, ppl)),
    nutrition: null,
    weight: null,
    activity: null,
    photos: null,
  };
  if (scopes.nutrition) {
    if (RATIOS[key] && plan) {
      const n = synthNutrition(key, plan, today, addDays(today, -13));
      out.nutrition = { ...n, score: adherenceScore(n.days), today: todayMealsOut(key, today), targets: plan.targets };
    } else {
      out.nutrition = { days: [], lastMealYmd: null, score: null, today: [], targets: plan?.targets ?? null };
    }
  }
  if (scopes.weight && WEIGHT_PLAN[key]) out.weight = weightData(key, today);
  if (scopes.workouts) {
    const a = activityData(key, today, c.trainer.sessions);
    out.activity = a;
    out.sessions = out.sessions.map((s) => ({ ...s, workout: s.status === 'DONE' || s.status === 'SCHEDULED' ? matchWorkout(s, a.workouts) : null }));
  }
  if (scopes.photos) out.photos = [];
  link.trainerViewedAt = new Date().toISOString();
  return out;
}

// ───────────────────────── route guards ─────────────────────────

function trainerOnly(rq) {
  const denied = unauthorized(rq);
  if (denied) return denied;
  const c = slice(rq);
  if (!c.trainer) return coachError(rq, 403, 'ეს განყოფილება მხოლოდ ტრენერებისთვისაა.', 'This section is for trainers only.', 'TRAINER_REQUIRED');
  return null;
}

function allSessions(c) {
  return c.trainer ? c.trainer.sessions : c.client ? c.client.sessions : [];
}

/** Sessions for a window outside the seeded one (calendar paging far away): plain generated rows. */
function trainerSessionsIn(rq, from, to) {
  const c = slice(rq);
  const today = rq.today;
  const inWindow = c.trainer.sessions.filter((s) => Date.parse(s.startsAt) >= from && Date.parse(s.startsAt) < to);
  const seededFrom = Date.parse(isoAt(addDays(today, -42), '00:00'));
  const seededTo = Date.parse(isoAt(addDays(today, 29), '00:00'));
  if (from >= seededFrom && to <= seededTo) return inWindow;
  const extra = buildTrainerSessions(tbilisiYmd(from), tbilisiYmd(to - 1), today, Date.now()).filter((s) => {
    const at = Date.parse(s.startsAt);
    return at >= from && at < to && (at < seededFrom || at >= seededTo);
  });
  return [...inWindow, ...extra].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// ───────────────────────── routes ─────────────────────────

const ROUTES = [
  // Catalogues
  {
    method: 'GET',
    path: '/api/trainer/catalog',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const en = isEn(rq);
      return {
        specialties: Object.entries(en ? SPECIALTIES_EN : SPECIALTIES).map(([key, label]) => ({ key, label })),
        sessionKinds: Object.entries(en ? SESSION_KINDS_EN : SESSION_KINDS).map(([key, label]) => ({ key, label })),
        mealSlots: Object.entries(en ? MEAL_SLOTS_EN : MEAL_SLOTS).map(([key, label]) => ({ key, label })),
        statuses: en ? TRAINER_STATUS_EN : TRAINER_STATUS_KA,
        consentVersion: CONSENT_VERSION,
      };
    },
  },
  {
    method: 'GET',
    path: '/api/trainer/gyms',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const q = String(rq.query.q || '').trim().toLowerCase();
      const city = String(rq.query.city || '').trim();
      const rows = [...gyms().values()]
        .filter((g) => g.status === 'ACTIVE')
        .filter((g) => !city || g.city === city)
        .filter((g) => !q || [g.brand, g.brandKa, g.name, g.nameKa, g.district, g.address].some((v) => String(v || '').toLowerCase().includes(q)));
      const map = new Map();
      for (const g of rows) {
        if (!map.has(g.brand)) map.set(g.brand, { brand: g.brand, brandKa: g.brandKa ?? null, branches: [] });
        map.get(g.brand).branches.push(gymPublic(g));
      }
      return { brands: [...map.values()], cities: [...new Set(rows.map((g) => g.city))], total: rows.length };
    },
  },

  // My status
  {
    method: 'GET',
    path: '/api/trainer/me',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const link = c.client?.link && ['REQUESTED', 'ACTIVE'].includes(c.client.link.status) ? c.client.link : null;
      return {
        trainerProfile: c.trainer ? ownTrainerProfile(c.profiles[MAN_ID]) : null,
        clientLink: link ? { id: link.id, status: link.status, trainerId: link.trainerId } : null,
        consentVersion: CONSENT_VERSION,
      };
    },
  },

  // Finding a trainer
  {
    method: 'GET',
    path: '/api/trainer/search',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const q = String(rq.query.q || '').trim().toLowerCase();
      const gymId = String(rq.query.gymId || '');
      const rows = Object.values(c.profiles)
        .filter((p) => p.status === 'VERIFIED' && p.userId !== (rq.state.user?.id ?? ''))
        .filter((p) => !q || p.displayName.toLowerCase().includes(q) || p.bio.toLowerCase().includes(q))
        .filter((p) => !gymId || p.gymIds.includes(gymId));
      return { trainers: rows.map((p) => trainerCard(p, rq)) };
    },
  },
  {
    method: 'GET',
    path: '/api/trainer/card/:id',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const p = slice(rq).profiles[rq.params.id];
      if (!p || p.status !== 'VERIFIED') return coachError(rq, 404, 'ტრენერი ვერ მოიძებნა.', 'Trainer not found.', 'TRAINER_NOT_FOUND');
      return { trainer: trainerCard(p, rq), consentVersion: CONSENT_VERSION };
    },
  },
  {
    method: 'GET',
    path: '/api/trainer/code/:code',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const code = String(rq.params.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const p = Object.values(slice(rq).profiles).find((x) => x.code === code && x.status === 'VERIFIED');
      if (!p) return coachError(rq, 404, 'ასეთი კოდით დადასტურებული ტრენერი ვერ მოიძებნა.', 'No verified trainer has this code.', 'TRAINER_NOT_FOUND');
      return { trainer: trainerCard(p, rq), consentVersion: CONSENT_VERSION };
    },
  },

  // Client: overview, sessions, link
  { method: 'GET', path: '/api/trainer/overview', handler: (rq) => unauthorized(rq) || clientOverview(rq) },
  {
    method: 'GET',
    path: '/api/trainer/session/:id',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const s = (c.client?.sessions ?? []).find((x) => x.id === rq.params.id && x.clientId === WOMEN_ID);
      if (!s) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
      return { session: { ...sessionPublic(s, rq, people(rq)), workout: c.client.link.scopes.workouts ? workoutFor(s, 'me') : null } };
    },
  },
  ...['confirm', 'cancel', 'book', 'rate'].map((action) => ({
    method: 'POST',
    path: `/api/trainer/sessions/:id/${action}`,
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const s = (c.client?.sessions ?? []).find((x) => x.id === rq.params.id);
      const now = Date.now();
      if (!s) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
      if (action === 'confirm') {
        if (s.status !== 'SCHEDULED' || s.clientId !== WOMEN_ID) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
        s.clientConfirmedAt = new Date(now).toISOString();
      } else if (action === 'cancel') {
        if (!['SCHEDULED', 'OPEN'].includes(s.status) || s.clientId !== WOMEN_ID) return coachError(rq, 409, 'ეს ვარჯიში უკვე დასრულებული ან გაუქმებულია.', 'This session is already finished or cancelled.');
        if (s.seriesId === 'slot') Object.assign(s, { status: 'OPEN', clientId: null, clientConfirmedAt: null, seriesId: null });
        else Object.assign(s, { status: 'CANCELLED', cancelledBy: 'CLIENT', cancelReason: rq.body?.reason || null, lateCancel: Date.parse(s.startsAt) - now < 12 * 3600000 });
      } else if (action === 'book') {
        if (s.status !== 'OPEN' || s.clientId || Date.parse(s.startsAt) <= now) return coachError(rq, 409, 'ეს დრო უკვე დაკავებულია. აირჩიე სხვა.', 'This time is already taken. Please choose another.', 'SLOT_TAKEN');
        Object.assign(s, { status: 'SCHEDULED', clientId: WOMEN_ID, clientConfirmedAt: new Date(now).toISOString(), seriesId: 'slot' });
        return rq.reply(201, { session: sessionPublic(s, rq, people(rq)) });
      } else if (action === 'rate') {
        const rating = Math.round(Number(rq.body?.rating));
        if (s.status !== 'DONE' || !(rating >= 1 && rating <= 5)) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
        s.clientRating = rating;
      }
      return { session: sessionPublic(s, rq, people(rq)) };
    },
  })),
  {
    method: 'POST',
    path: '/api/trainer/link',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      if (rq.body?.consentVersion !== CONSENT_VERSION) return coachError(rq, 409, 'თანხმობის ტექსტი განახლდა. გადახედე და დაადასტურე ხელახლა.', 'The consent text has been updated. Please review it and confirm again.', 'CONSENT_OUTDATED');
      const code = String(rq.body?.code || '').toUpperCase();
      const p = Object.values(c.profiles).find((x) => (code ? x.code === code : x.userId === rq.body?.trainerId) && x.status === 'VERIFIED');
      if (!p) return coachError(rq, 404, 'ასეთი დადასტურებული ტრენერი ვერ მოიძებნა. შეამოწმე კოდი.', 'No verified trainer was found. Please check the code.', 'TRAINER_NOT_FOUND');
      if (c.client?.link && ['ACTIVE', 'REQUESTED'].includes(c.client.link.status)) {
        if (c.client.link.trainerId !== p.userId) return coachError(rq, 409, 'უკვე გყავს ტრენერი. ახალთან დასაკავშირებლად ჯერ დაასრულე მიმდინარე.', 'You already have a trainer. To connect with a new one, end the current connection first.', 'ALREADY_LINKED');
        return { link: { id: c.client.link.id, status: c.client.link.status }, overview: clientOverview(rq) };
      }
      const at = new Date().toISOString();
      const status = code ? 'ACTIVE' : 'REQUESTED';
      const scopes = { workouts: false, nutrition: false, weight: false, photos: false, ...(rq.body?.scopes || {}) };
      c.client = c.client || { sessions: [], plan: null, photos: [], workoutsSaved: 0 };
      c.client.link = { id: uuidFrom(`link:new:${at}`), trainerId: p.userId, clientId: rq.state.user?.id || WOMEN_ID, status, initiator: 'CLIENT', scopes, clientNote: rq.body?.note || null, acceptedAt: status === 'ACTIVE' ? at : null, createdAt: at, proposedGoal: null, trainerViewedAt: null };
      return rq.reply(201, { link: { id: c.client.link.id, status }, overview: clientOverview(rq) });
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/link/accept',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const link = slice(rq).client?.link;
      if (!link || link.status !== 'REQUESTED' || link.initiator !== 'TRAINER') return coachError(rq, 404, 'მოწვევა ვერ მოიძებნა.', 'Invitation not found.', 'INVITE_NOT_FOUND');
      Object.assign(link, { status: 'ACTIVE', scopes: { ...link.scopes, ...(rq.body?.scopes || {}) }, acceptedAt: new Date().toISOString() });
      return clientOverview(rq);
    },
  },
  {
    method: 'PATCH',
    path: '/api/trainer/link',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const link = slice(rq).client?.link;
      if (!link || !['ACTIVE', 'REQUESTED'].includes(link.status)) return coachError(rq, 404, 'ტრენერთან კავშირი არ გაქვს.', 'You are not connected to a trainer.');
      for (const [k, v] of Object.entries(rq.body?.scopes || {})) if (k in link.scopes && typeof v === 'boolean') link.scopes[k] = v;
      return clientOverview(rq);
    },
  },
  {
    method: 'DELETE',
    path: '/api/trainer/link',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const link = c.client?.link;
      if (!link || !['ACTIVE', 'REQUESTED'].includes(link.status)) return coachError(rq, 404, 'ტრენერთან კავშირი არ გაქვს.', 'You are not connected to a trainer.');
      link.status = 'ENDED';
      const now = Date.now();
      for (const s of c.client.sessions) if (s.clientId === WOMEN_ID && s.status === 'SCHEDULED' && Date.parse(s.startsAt) > now) Object.assign(s, { status: 'CANCELLED', cancelledBy: 'CLIENT', cancelReason: 'კავშირი დასრულდა' });
      c.client.link = null;
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/link/goal',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const link = c.client?.link;
      if (!link?.proposedGoal) return coachError(rq, 404, 'შემოთავაზებული მიზანი არ არის.', 'There is no proposed goal.');
      link.proposedGoal = null;
      return { ok: true, decision: rq.body?.decision === 'accepted' ? 'accepted' : 'dismissed', trainerName: c.profiles[link.trainerId]?.displayName ?? null };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/report',
    handler: (rq) => unauthorized(rq) || rq.reply(201, { ok: true, id: uuidFrom(`report:${Date.now()}`), blocked: Boolean(rq.body?.block) }),
  },

  // Own progress photos (none — the app shows its empty state; uploads are not mocked)
  { method: 'GET', path: '/api/trainer/photos', handler: (rq) => unauthorized(rq) || { photos: (slice(rq).client?.photos ?? []).slice() } },
  {
    method: 'POST',
    path: '/api/trainer/workouts/sync',
    handler: (rq) => {
      const denied = unauthorized(rq);
      if (denied) return denied;
      const c = slice(rq);
      const link = c.client?.link;
      if (!link || link.status !== 'ACTIVE' || !link.scopes?.workouts) return { saved: 0, skipped: 'not_shared' };
      const n = Array.isArray(rq.body?.workouts) ? rq.body.workouts.length : 0;
      c.client.workoutsSaved += n;
      return { saved: n };
    },
  },

  // ——— trainer workspace ———
  { method: 'GET', path: '/api/trainer/coach/today', handler: (rq) => trainerOnly(rq) || coachToday(rq) },
  { method: 'GET', path: '/api/trainer/coach/clients', handler: (rq) => trainerOnly(rq) || coachClients(rq) },
  {
    method: 'GET',
    path: '/api/trainer/coach/clients/:clientId',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const d = coachClientDashboard(rq, rq.params.clientId);
      return d || coachError(rq, 404, 'ეს კლიენტი შენთან აღარ არის დაკავშირებული.', 'This client is no longer connected to you.', 'LINK_NOT_ACTIVE');
    },
  },
  {
    method: 'DELETE',
    path: '/api/trainer/coach/clients/:clientId',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const c = slice(rq);
      const link = c.trainer.links.find((l) => l.clientId === rq.params.clientId && l.status === 'ACTIVE');
      if (!link) return coachError(rq, 404, 'ეს კლიენტი შენთან აღარ არის დაკავშირებული.', 'This client is no longer connected to you.', 'LINK_NOT_ACTIVE');
      link.status = 'ENDED';
      const now = Date.now();
      for (const s of c.trainer.sessions) if (s.clientId === link.clientId && s.status === 'SCHEDULED' && Date.parse(s.startsAt) > now) Object.assign(s, { status: 'CANCELLED', cancelledBy: 'TRAINER', cancelReason: 'კავშირი დასრულდა' });
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/coach/requests/:linkId',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const link = slice(rq).trainer.links.find((l) => l.id === rq.params.linkId && l.status === 'REQUESTED' && l.initiator === 'CLIENT');
      if (!link) return coachError(rq, 404, 'მოთხოვნა ვერ მოიძებნა.', 'Request not found.');
      if (rq.body?.accept) Object.assign(link, { status: 'ACTIVE', acceptedAt: new Date().toISOString() });
      else link.status = 'DECLINED';
      return { link: { id: link.id, status: link.status } };
    },
  },
  {
    method: 'DELETE',
    path: '/api/trainer/coach/invites/:clientId',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const link = slice(rq).trainer.links.find((l) => l.clientId === rq.params.clientId && l.status === 'REQUESTED' && l.initiator === 'TRAINER');
      if (!link) return coachError(rq, 404, 'მოწვევა ვერ მოიძებნა.', 'Invitation not found.');
      link.status = 'DECLINED';
      return { ok: true };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/coach/clients/:clientId/goal',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const link = slice(rq).trainer.links.find((l) => l.clientId === rq.params.clientId && l.status === 'ACTIVE');
      if (!link) return coachError(rq, 404, 'ეს კლიენტი შენთან აღარ არის დაკავშირებული.', 'This client is no longer connected to you.', 'LINK_NOT_ACTIVE');
      if (!link.scopes.weight) return coachError(rq, 403, 'კლიენტს ეს მონაცემი არ გაუზიარებია.', 'This client has not shared this data.', 'SCOPE_NOT_SHARED');
      const b = rq.body || {};
      link.proposedGoal = { type: b.type || 'lose', targetKg: Number(b.targetKg), deadlineYmd: b.deadlineYmd, note: b.note || '', proposedAt: new Date().toISOString() };
      return rq.reply(201, { proposedGoal: link.proposedGoal });
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/coach/clients/:clientId/plan',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const c = slice(rq);
      const link = c.trainer.links.find((l) => l.clientId === rq.params.clientId && l.status === 'ACTIVE');
      if (!link) return coachError(rq, 404, 'ეს კლიენტი შენთან აღარ არის დაკავშირებული.', 'This client is no longer connected to you.', 'LINK_NOT_ACTIVE');
      if (!link.scopes.nutrition) return coachError(rq, 403, 'კლიენტს ეს მონაცემი არ გაუზიარებია.', 'This client has not shared this data.', 'SCOPE_NOT_SHARED');
      const key = Object.keys(CLIENTS).find((k) => CLIENTS[k].id === link.clientId);
      const b = rq.body || {};
      const at = new Date().toISOString();
      const plan = { id: uuidFrom(`plan:new:${at}`), title: b.title || 'კვების გეგმა', targets: b.targets || { calories: 2000 }, meals: Array.isArray(b.meals) ? b.meals : [], note: b.note || '', startsOn: rq.today, updatedAt: at };
      c.trainer.plans[key] = plan;
      return rq.reply(201, { plan });
    },
  },
  {
    method: 'GET',
    path: '/api/trainer/coach/sessions',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const c = slice(rq);
      const from = rq.query.from ? Date.parse(rq.query.from) : tbilisiDayStart(rq.today).getTime();
      const to = rq.query.to ? Date.parse(rq.query.to) : from + 7 * DAY;
      if (!Number.isFinite(from) || !Number.isFinite(to) || to - from > 62 * DAY || to <= from) return coachError(rq, 400, 'არასწორი პერიოდი.', 'Invalid period.');
      const ppl = people(rq);
      const g = gyms();
      return {
        sessions: trainerSessionsIn(rq, from, to).map((s) => sessionPublic(s, rq, ppl)),
        gyms: c.profiles[MAN_ID].gymIds.map((id) => g.get(id)).filter(Boolean).map(gymPublic),
      };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/coach/sessions',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const c = slice(rq);
      const b = rq.body || {};
      const first = Date.parse(b.startsAt);
      if (!Number.isFinite(first)) return coachError(rq, 400, 'შევსებული მონაცემები არასწორია.', 'Some of the details you entered are not valid.');
      if (first < Date.now() - 15 * 60000) return coachError(rq, 400, 'წარსულ დროზე ვარჯიშს ვერ დანიშნავ.', 'You cannot schedule a session in the past.');
      const n = Math.max(1, Math.min(12, Math.floor(Number(b.repeatWeeks) || 1)));
      const seriesId = n > 1 ? uuidFrom(`series:${first}:${Date.now()}`) : null;
      const created = [];
      for (let i = 0; i < n; i += 1) {
        const startsAt = new Date(first + i * 7 * DAY).toISOString();
        const s = baseSession({ id: uuidFrom(`coach:new:${startsAt}:${Date.now()}:${i}`), trainerId: MAN_ID, clientId: b.clientId || null, gymId: b.gymId || null, startsAt, durationMin: Number(b.durationMin) || 60, kind: SESSION_KINDS[b.kind] ? b.kind : 'STRENGTH', status: b.clientId ? 'SCHEDULED' : 'OPEN' });
        s.note = b.note || '';
        s.seriesId = seriesId;
        c.trainer.sessions.push(s);
        created.push(s);
      }
      c.trainer.sessions.sort((a, z) => a.startsAt.localeCompare(z.startsAt));
      const ppl = people(rq);
      return rq.reply(201, { sessions: created.map((s) => sessionPublic(s, rq, ppl)) });
    },
  },
  {
    method: 'GET',
    path: '/api/trainer/coach/sessions/:id',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const c = slice(rq);
      const s = c.trainer.sessions.find((x) => x.id === rq.params.id);
      if (!s) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
      const key = Object.keys(CLIENTS).find((k) => CLIENTS[k].id === s.clientId);
      const link = c.trainer.links.find((l) => l.clientId === s.clientId && l.status === 'ACTIVE');
      const workout = key && link?.scopes.workouts ? workoutFor(s, key) : null;
      return { session: { ...sessionPublic(s, rq, people(rq)), workout } };
    },
  },
  {
    method: 'PATCH',
    path: '/api/trainer/coach/sessions/:id',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const s = slice(rq).trainer.sessions.find((x) => x.id === rq.params.id);
      if (!s) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
      if (!['SCHEDULED', 'OPEN'].includes(s.status)) return coachError(rq, 409, 'დასრულებულ ან გაუქმებულ ვარჯიშს ვერ შეცვლი.', 'You cannot change a finished or cancelled session.');
      const b = rq.body || {};
      const moved = b.startsAt && Date.parse(b.startsAt) !== Date.parse(s.startsAt);
      if (b.startsAt) s.startsAt = new Date(b.startsAt).toISOString();
      if (b.durationMin) s.durationMin = Number(b.durationMin);
      if (b.gymId !== undefined) s.gymId = b.gymId;
      if (b.kind) s.kind = b.kind;
      if (b.note !== undefined) s.note = b.note;
      if (moved) s.clientConfirmedAt = null;
      return { session: sessionPublic(s, rq, people(rq)) };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/coach/sessions/:id/cancel',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const s = slice(rq).trainer.sessions.find((x) => x.id === rq.params.id);
      if (!s) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
      if (!['SCHEDULED', 'OPEN'].includes(s.status)) return coachError(rq, 409, 'ეს ვარჯიში უკვე დასრულებული ან გაუქმებულია.', 'This session is already finished or cancelled.');
      Object.assign(s, { status: 'CANCELLED', cancelledBy: 'TRAINER', cancelReason: rq.body?.reason || null, lateCancel: false });
      return { session: sessionPublic(s, rq, people(rq)) };
    },
  },
  {
    method: 'POST',
    path: '/api/trainer/coach/sessions/:id/complete',
    handler: (rq) => {
      const denied = trainerOnly(rq);
      if (denied) return denied;
      const s = slice(rq).trainer.sessions.find((x) => x.id === rq.params.id);
      if (!s || !s.clientId) return coachError(rq, 404, 'ვარჯიში ვერ მოიძებნა.', 'Session not found.');
      if (!['SCHEDULED', 'DONE', 'NO_SHOW'].includes(s.status)) return coachError(rq, 409, 'გაუქმებულ ვარჯიშს ვერ დაასრულებ.', 'You cannot complete a cancelled session.');
      if (Date.parse(s.startsAt) > Date.now() + 15 * 60000) return coachError(rq, 409, 'ვარჯიში ჯერ არ დაწყებულა.', 'This session has not started yet.');
      const b = rq.body || {};
      Object.assign(s, { status: b.status === 'NO_SHOW' ? 'NO_SHOW' : 'DONE', exercises: Array.isArray(b.exercises) ? b.exercises : [], trainerNote: b.trainerNote || '' });
      return { session: sessionPublic(s, rq, people(rq)) };
    },
  },
  // QR scanning needs the camera; any token is "not found" here (identity preview is not mocked).
  ...['scan', 'invite'].map((action) => ({
    method: 'POST',
    path: `/api/trainer/coach/${action}`,
    handler: (rq) => trainerOnly(rq) || coachError(rq, 404, 'QR კოდი ვერ მოიძებნა ან განახლებულია. სთხოვე ადამიანს, გახსნას თავისი QR ხელახლა.', 'This QR code was not found or has been renewed. Ask the person to open their QR code again.', 'QR_NOT_FOUND'),
  })),
];

export const routes = ROLE === 'off' ? [] : ROUTES;
