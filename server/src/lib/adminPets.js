/**
 * Admin #/pets (MEDIVET) — who uses „ჩემი ცხოველები“ and how.
 *
 * Everything is derived from the pets tables themselves (Pet + weight / allergies / conditions / products /
 * care plans / care events / reminder telemetry / Medi Vet chat) and the VET rows of AiInteraction; there is
 * no screen tracking for pets. Team accounts (exact `@medicard.ge` logins — the App Review demo lives there)
 * are left out unless `includeTeam`, because their seeded pets would otherwise be the only "real" usage.
 *
 * Privacy: the response carries pet names, species and counts, the owner's name and contact (as on the user
 * page) — never chat text, allergy / condition names or notes. Medi Vet questions are reduced to topic counts
 * and safety-flag counts here; the conversations themselves stay in Medi (#/ai), as before.
 */
import { prisma } from './prisma.js';
import { addDaysYmd, createdAtToTbilisiYmd, enumerateYmds, rateSafe, tbilisiMidnight, tbilisiYmd } from './adminAnalyticsRange.js';
import { getSpecies, isSentinelBreedId } from './petsCatalog.js';
import { displayAgeParts } from './petsAge.js';
import { classifyVetTurn } from './petsVetPolicy.js';
import { listFeatureFlags } from './featureFlags.js';

export const PETS_ADMIN_PERIODS = Object.freeze([7, 30, 90]);
/** The page lists at most this many pets (newest activity first); every count still covers all of them. */
export const PETS_ADMIN_LIST_MAX = 400;
/** Topics are read from at most this many recent questions. */
const TOPIC_SAMPLE = 2000;

/** Exact company logins (demo / review / staff). Synthetic `…@phone.medicard.ge` / `…@apple.medicard.ge` are real people. */
export function isTeamEmail(email) {
  return /^[^@\s]+@medicard\.ge$/i.test(String(email || '').trim());
}

/** Medi Vet question topics — keyword buckets (Georgian + English). One question may hit several; none = „other“. */
const TOPICS = [
  ['food', /საკვ|საჭმ|კვებ|ჭამ|მადა|წყალს? სვამ|food|feed|diet|eat|appetite|treat/i],
  ['digestion', /ღებინ|ფაღარათ|დიარე|კუჭ|ნაწლავ|განავალ|ყაბზ|vomit|diarr|stool|poop|constipat|stomach/i],
  ['skin', /კან|ბეწვ|ქავ|ქერც|ბალნ|ყურ|წითლ|skin|itch|fur|coat|scratch|rash|ear/i],
  ['parasites', /ვაქცინ|აცრ|რწყილ|ტკიპ|ჭიებ|ჭია|პარაზიტ|ანტიპარაზიტ|vaccin|flea|tick|worm|deworm|parasit/i],
  ['behavior', /ქცევ|აგრესი|ყეფ|კბენ|შიშ|ნერვიულ|სტრეს|behavio|aggress|bark|bite|anxi|stress|fear/i],
  ['weight', /წონ|მსუქ|გამხდარ|სეირნ|ვარჯიშ|აქტივობ|weight|fat|obes|thin|walk|exercise/i],
  ['visit', /ვიზიტ|ვეტერინარ|კლინიკ|ისტორი|შეაჯამ|შემაჯამ|ანალიზ|visit|vet\b|clinic|history|summar/i],
  ['medication', /წამალ|წამლ|ტაბლეტ|ანტიბიოტიკ|მკურნალ|დოზ|medic|pill|antibiotic|dose|treatment/i],
];
export const PET_TOPIC_KEYS = Object.freeze([...TOPICS.map(([key]) => key), 'other']);

export function vetTopics(text) {
  const body = String(text || '');
  const hits = TOPICS.filter(([, re]) => re.test(body)).map(([key]) => key);
  return hits.length ? hits : ['other'];
}

const SEX_KEYS = ['MALE', 'FEMALE', 'UNKNOWN'];
const PRODUCT_KINDS = ['VACCINATION', 'FLEA_TICK', 'DEWORMING', 'MEDICATION', 'OTHER'];
const RECURRENCE_KINDS = ['ONCE', 'EVERY_N_DAYS', 'EVERY_N_WEEKS', 'EVERY_N_MONTHS', 'DAILY_COURSE'];
const SCHEDULE_SOURCES = ['VETERINARIAN', 'PRODUCT_INSTRUCTIONS', 'USER_ENTERED'];
const ALLERGY_CATEGORIES = ['medication', 'food', 'environmental', 'other', 'unknown'];
const DELIVERY_STATUSES = ['SCHEDULED_LOCAL', 'SCHEDULE_FAILED', 'CANCELLED', 'RECEIVED_CALLBACK', 'USER_RESPONSE', 'COMPLETION_CONFIRMED'];

const zeroes = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const bump = (obj, key, by = 1) => {
  obj[key] = (obj[key] || 0) + by;
};
const ms = (value) => (value ? new Date(value).getTime() : 0);
const iso = (value) => (value ? new Date(value).toISOString() : null);

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function median(values) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** „+995 5xx xx xx xx“ / „Apple-ით შესული“ / the e-mail, the same way the rest of the admin shows a login. */
export function ownerContact(user) {
  const email = String(user?.email || '');
  const phone = String(user?.phone || '') || (/^\+?(\d{9,15})@phone\.medicard\.ge$/i.exec(email)?.[1] ?? '');
  if (phone) {
    const d = phone.replace(/\D/g, '');
    return d.length === 12 && d.startsWith('995') ? `+995 ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : `+${d}`;
  }
  if (/@apple\.medicard\.ge$/i.test(email)) return 'Apple-ით შესული';
  return email;
}

function breedLabel(pet) {
  if (pet.breedId === 'custom') return String(pet.customBreed || '').trim() || null;
  if (isSentinelBreedId(pet.breedId)) return null;
  return getSpecies(pet.speciesId)?.breeds.find((b) => b.id === pet.breedId)?.label || null;
}

function ageBucket(age) {
  if (age.kind === 'UNKNOWN' || age.years == null) return 'unknown';
  if (age.years < 1) return 'young';
  if (age.years < 8) return 'adult';
  return 'senior';
}

/**
 * Pure: raw rows (all accounts) → the page payload. `raw` comes from loadPetsAdminRaw (or a test fixture).
 * @param {object} raw
 * @param {{ days?: number, includeTeam?: boolean, now?: Date }} opts
 */
export function buildPetsOverview(raw, { days = 30, includeTeam = false, now = new Date() } = {}) {
  const period = PETS_ADMIN_PERIODS.includes(Number(days)) ? Number(days) : 30;
  const today = tbilisiYmd(now);
  const fromYmd = addDaysYmd(today, -(period - 1));
  const dayKeys = enumerateYmds(fromYmd, today);
  const inPeriod = (value) => {
    const ymd = createdAtToTbilisiYmd(value);
    return Boolean(ymd) && ymd >= fromYmd && ymd <= today;
  };

  const teamIds = new Set(raw.teamUserIds || []);
  const keep = (row) => includeTeam || !teamIds.has(row.userId);
  const allPets = raw.pets || [];
  const teamPets = allPets.filter((p) => teamIds.has(p.userId));
  const pets = allPets.filter(keep);
  const petIds = new Set(pets.map((p) => p.id));
  const mine = (rows) => (rows || []).filter((r) => keep(r) && (!r.petId || petIds.has(r.petId)));

  const weights = mine(raw.weights);
  const allergies = mine(raw.allergies);
  const conditions = mine(raw.conditions);
  const products = mine(raw.products);
  const schedules = mine(raw.schedules);
  const events = mine(raw.events);
  const skips = mine(raw.skips);
  const questions = mine(raw.questions);
  const vetSessions = mine(raw.vetSessions);
  const answers = (raw.answers || []).filter(keep);
  const drafts = (raw.drafts || []).filter(keep);
  const deliveries = (raw.deliveries || []).filter(keep);
  const aiRows = (raw.aiVet || []).filter(keep);
  const feedback = (raw.vetFeedback || []).filter(keep);
  const topicSample = (raw.questionTexts || []).filter(keep);
  const users = new Map((raw.owners || []).map((u) => [u.id, u]));

  // ── per pet ──────────────────────────────────────────────────────────────
  const perPet = new Map(pets.map((p) => [p.id, {
    weight: 0, health: 0, products: 0, plans: 0, events: 0, reminders: 0, questions: 0, lastAt: Math.max(ms(p.createdAt), ms(p.updatedAt)),
  }]));
  const touch = (petId, at) => {
    const row = perPet.get(petId);
    if (row) row.lastAt = Math.max(row.lastAt, ms(at));
  };
  for (const r of weights) { perPet.get(r.petId).weight += 1; touch(r.petId, r.createdAt); }
  for (const r of [...allergies, ...conditions]) { perPet.get(r.petId).health += 1; touch(r.petId, r.createdAt); }
  for (const r of products) { perPet.get(r.petId).products += 1; touch(r.petId, r.createdAt); }
  for (const r of schedules) {
    const row = perPet.get(r.petId);
    row.plans += 1;
    if (r.status === 'ACTIVE' && r.reminderEnabled) row.reminders += 1;
    touch(r.petId, r.createdAt);
  }
  for (const r of events) { if (r.status !== 'VOIDED') perPet.get(r.petId).events += 1; touch(r.petId, r.createdAt); }
  for (const r of skips) touch(r.petId, r.skippedAt || r.createdAt);
  for (const r of questions) { perPet.get(r.petId).questions += 1; touch(r.petId, r.createdAt); }

  // ── per owner ────────────────────────────────────────────────────────────
  const owners = new Map();
  const owner = (userId) => {
    if (!owners.has(userId)) {
      owners.set(userId, { userId, pets: 0, active: 0, firstPetAt: null, days: new Set(), recorded: false, planned: false, reminders: false, questions: 0 });
    }
    return owners.get(userId);
  };
  const activity = []; // { userId, at } — every pet action, for "active owners" per day
  const act = (userId, at) => {
    if (!at) return;
    owner(userId).days.add(createdAtToTbilisiYmd(at));
    activity.push({ userId, at });
  };
  for (const p of pets) {
    const o = owner(p.userId);
    o.pets += 1;
    if (!p.archivedAt) o.active += 1;
    if (!o.firstPetAt || ms(p.createdAt) < ms(o.firstPetAt)) o.firstPetAt = p.createdAt;
    act(p.userId, p.createdAt);
    // An edit (photo, details, archive) more than a minute after creating counts as a return.
    if (ms(p.updatedAt) - ms(p.createdAt) > 60_000) act(p.userId, p.updatedAt);
  }
  for (const r of [...weights, ...allergies, ...conditions, ...products, ...events]) {
    owner(r.userId).recorded = true;
    act(r.userId, r.createdAt);
  }
  for (const r of schedules) {
    const o = owner(r.userId);
    o.recorded = true;
    o.planned = true;
    if (r.reminderEnabled) o.reminders = true;
    act(r.userId, r.createdAt);
  }
  for (const r of skips) act(r.userId, r.skippedAt || r.createdAt);
  for (const r of questions) {
    owner(r.userId).questions += 1;
    act(r.userId, r.createdAt);
  }
  const ownerList = [...owners.values()];
  const ownersCount = ownerList.length;
  const count = (fn) => ownerList.filter(fn).length;
  const ladder = [
    { key: 'owners', count: ownersCount },
    { key: 'recorded', count: count((o) => o.recorded) },
    { key: 'planned', count: count((o) => o.planned) },
    { key: 'reminders', count: count((o) => o.reminders) },
    { key: 'vet', count: count((o) => o.questions > 0) },
    { key: 'returned', count: count((o) => o.days.size >= 2) },
  ].map((step) => ({ ...step, rate: rateSafe(step.count, ownersCount) }));

  const accounts = Math.max(0, (raw.accountsTotal || 0) - (includeTeam ? 0 : teamIds.size));
  const petsActive = pets.filter((p) => !p.archivedAt);

  // ── app return after the first pet (any screen, from AppActivity) ─────────
  const appDays = new Map();
  for (const a of raw.appActivity || []) {
    if (!appDays.has(a.userId)) appDays.set(a.userId, new Set());
    appDays.get(a.userId).add(String(a.date).slice(0, 10));
  }
  const appReturned = ownerList.filter((o) => {
    const first = createdAtToTbilisiYmd(o.firstPetAt);
    return [...(appDays.get(o.userId) || [])].some((d) => d > first);
  }).length;

  // ── first pet after sign-up ───────────────────────────────────────────────
  const timing = { sameDay: 0, week: 0, later: 0 };
  const hoursToPet = [];
  for (const o of ownerList) {
    const u = users.get(o.userId);
    if (!u?.createdAt || !o.firstPetAt) continue;
    const hours = Math.max(0, (ms(o.firstPetAt) - ms(u.createdAt)) / 3_600_000);
    hoursToPet.push(hours);
    if (hours < 24) timing.sameDay += 1;
    else if (hours < 24 * 7) timing.week += 1;
    else timing.later += 1;
  }

  // ── period ────────────────────────────────────────────────────────────────
  const series = (rows, at = (r) => r.createdAt) => {
    const map = new Map(dayKeys.map((d) => [d, 0]));
    for (const r of rows) {
      const d = createdAtToTbilisiYmd(at(r));
      if (map.has(d)) map.set(d, map.get(d) + 1);
    }
    return [...map].map(([day, n]) => ({ day, count: n }));
  };
  const activeByDay = new Map(dayKeys.map((d) => [d, new Set()]));
  for (const a of activity) activeByDay.get(createdAtToTbilisiYmd(a.at))?.add(a.userId);
  const periodActive = new Set(activity.filter((a) => inPeriod(a.at)).map((a) => a.userId));
  const periodQuestions = questions.filter((q) => inPeriod(q.createdAt));
  const signups = (raw.signups || []).filter((u) => (includeTeam || !teamIds.has(u.id)) && inPeriod(u.createdAt));
  const signupsWithPet = signups.filter((u) => owners.has(u.id));
  const newPets = pets.filter((p) => inPeriod(p.createdAt));

  // ── composition (active pets) ─────────────────────────────────────────────
  const species = {};
  const breeds = {};
  const sex = zeroes(SEX_KEYS);
  const neutered = { yes: 0, no: 0, unknown: 0 };
  const ages = { young: 0, adult: 0, senior: 0, unknown: 0 };
  const breedKind = { known: 0, mixed: 0, custom: 0, unknown: 0 };
  const profile = { photo: 0, breed: 0, age: 0, sex: 0, neutered: 0, vet: 0 };
  const shaped = new Map();
  for (const p of pets) {
    const age = displayAgeParts({ ...p, birthDate: p.birthDate ? new Date(p.birthDate) : null }, today);
    const breed = breedLabel(p);
    const checks = {
      photo: Boolean(p.hasPhoto),
      breed: p.breedId !== 'unknown',
      age: p.ageKind !== 'UNKNOWN',
      sex: p.sex === 'MALE' || p.sex === 'FEMALE',
      neutered: p.neutered === true || p.neutered === false,
      vet: Boolean(p.hasVet),
    };
    shaped.set(p.id, { age, breed, checks });
    if (p.archivedAt) continue;
    bump(species, p.speciesId);
    if (breed && p.breedId !== 'custom') bump(breeds, `${p.speciesId}|${breed}`);
    bump(sex, SEX_KEYS.includes(p.sex) ? p.sex : 'UNKNOWN');
    bump(neutered, p.neutered === true ? 'yes' : p.neutered === false ? 'no' : 'unknown');
    bump(ages, ageBucket(age));
    bump(breedKind, p.breedId === 'mixed' ? 'mixed' : p.breedId === 'custom' ? 'custom' : p.breedId === 'unknown' ? 'unknown' : 'known');
    for (const [k, v] of Object.entries(checks)) if (v) profile[k] += 1;
  }
  const breedRows = Object.entries(breeds)
    .map(([key, n]) => {
      const [speciesId, label] = key.split('|');
      return { speciesId, label, count: n };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const perOwner = { one: 0, two: 0, more: 0 };
  for (const o of ownerList) {
    if (!o.active) continue;
    bump(perOwner, o.active === 1 ? 'one' : o.active === 2 ? 'two' : 'more');
  }

  // ── care ─────────────────────────────────────────────────────────────────
  const productKinds = zeroes(PRODUCT_KINDS);
  for (const r of products) if (!r.archivedAt) bump(productKinds, PRODUCT_KINDS.includes(r.kind) ? r.kind : 'OTHER');
  const planKinds = zeroes(PRODUCT_KINDS);
  const recurrence = zeroes(RECURRENCE_KINDS);
  const planSources = zeroes(SCHEDULE_SOURCES);
  const planStatus = { ACTIVE: 0, COMPLETED: 0, CANCELLED: 0 };
  let overdue = 0;
  let dueSoon = 0;
  let remindersOn = 0;
  const soon = addDaysYmd(today, 7);
  for (const r of schedules) {
    bump(planStatus, planStatus[r.status] == null ? 'ACTIVE' : r.status);
    if (r.status !== 'ACTIVE') continue;
    bump(planKinds, PRODUCT_KINDS.includes(r.kind) ? r.kind : 'OTHER');
    bump(recurrence, RECURRENCE_KINDS.includes(r.recurrenceKind) ? r.recurrenceKind : 'ONCE');
    bump(planSources, SCHEDULE_SOURCES.includes(r.source) ? r.source : 'USER_ENTERED');
    if (r.reminderEnabled) remindersOn += 1;
    if (r.nextDueOn && r.nextDueOn < today) overdue += 1;
    else if (r.nextDueOn && r.nextDueOn <= soon) dueSoon += 1;
  }
  const recorded = events.filter((e) => e.status !== 'VOIDED');
  const allergyCats = zeroes(ALLERGY_CATEGORIES);
  for (const a of allergies) bump(allergyCats, ALLERGY_CATEGORIES.includes(a.category) ? a.category : 'unknown');
  const weightPets = new Map();
  for (const w of weights) weightPets.set(w.petId, (weightPets.get(w.petId) || 0) + 1);
  const delivery = zeroes(DELIVERY_STATUSES);
  const deliveryUsers = new Set();
  for (const d of deliveries) {
    if (DELIVERY_STATUSES.includes(d.status)) bump(delivery, d.status, d.count || 1);
    if (d.status === 'SCHEDULED_LOCAL') deliveryUsers.add(d.userId);
  }

  // ── Medi Vet ─────────────────────────────────────────────────────────────
  const answerStatus = { COMPLETE: 0, FAILED: 0, CANCELLED: 0, PENDING: 0, PARTIAL: 0 };
  for (const a of answers) bump(answerStatus, answerStatus[a.status] == null ? 'PENDING' : a.status, a.count || 1);
  const ok = aiRows.filter((r) => r.status === 'OK');
  const latencies = ok.map((r) => Number(r.latencyMs)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  let costUsd = 0;
  for (const r of aiRows) {
    const c = Number(r.tokenUsage?.cost);
    if (Number.isFinite(c)) costUsd += c;
  }
  const topics = zeroes(PET_TOPIC_KEYS);
  const safety = { emergency: 0, dose: 0, injection: 0 };
  for (const q of topicSample) {
    for (const t of vetTopics(q.content)) bump(topics, t);
    const flags = classifyVetTurn({ text: q.content });
    if (flags.emergency) safety.emergency += 1;
    if (flags.doseRequest) safety.dose += 1;
    if (flags.promptInjection) safety.injection += 1;
  }
  const sessionsWithQuestion = new Set(questions.map((q) => q.sessionId));
  const lastQuestion = questions.reduce((max, q) => Math.max(max, ms(q.createdAt)), 0);

  // ── pet list ─────────────────────────────────────────────────────────────
  const list = pets
    .map((p) => {
      const u = users.get(p.userId) || {};
      const usage = perPet.get(p.id);
      const { age, breed, checks } = shaped.get(p.id);
      const o = owners.get(p.userId);
      return {
        id: p.id,
        name: p.name,
        speciesId: p.speciesId,
        breed,
        breedKind: p.breedId === 'mixed' ? 'mixed' : p.breedId === 'unknown' ? 'unknown' : p.breedId === 'custom' ? 'custom' : 'known',
        sex: p.sex,
        neutered: p.neutered,
        age: { kind: age.kind, years: age.years, months: age.months },
        profile: checks,
        archived: Boolean(p.archivedAt),
        createdAt: iso(p.createdAt),
        lastAt: usage.lastAt ? new Date(usage.lastAt).toISOString() : iso(p.createdAt),
        usage: {
          weight: usage.weight,
          health: usage.health,
          care: usage.products + usage.plans + usage.events,
          events: usage.events,
          reminders: usage.reminders,
          vet: usage.questions,
        },
        owner: {
          id: p.userId,
          name: u.fullName || '',
          contact: ownerContact(u),
          team: teamIds.has(p.userId),
          signupAt: iso(u.createdAt),
          lastSeenAt: iso(u.lastSeenAt),
          pets: o?.active || 0,
          petDays: o?.days.size || 0,
        },
      };
    })
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt));

  const flag = (key) => {
    const f = (raw.flags || []).find((row) => row.key === key);
    return f ? { enabled: f.enabled !== false, effective: f.effective !== false, blockedBy: f.blockedBy || null } : { enabled: true, effective: true, blockedBy: null };
  };

  return {
    installed: true,
    generatedAt: now.toISOString(),
    includeTeam,
    team: { accounts: teamIds.size, pets: teamPets.length, owners: new Set(teamPets.map((p) => p.userId)).size },
    flags: { pets: flag('pets'), mediVet: flag('mediVet') },
    totals: {
      accounts,
      owners: ownersCount,
      ownersActive: count((o) => o.active > 0),
      ownerRate: rateSafe(ownersCount, accounts),
      pets: pets.length,
      petsActive: petsActive.length,
      petsArchived: pets.length - petsActive.length,
      onlyProfile: count((o) => !o.recorded && o.questions === 0),
      appReturned,
    },
    ladder,
    firstPet: { ...timing, medianHours: median(hoursToPet) },
    period: {
      days: period,
      from: fromYmd,
      to: today,
      newPets: newPets.length,
      newOwners: ownerList.filter((o) => inPeriod(o.firstPetAt)).length,
      activeOwners: periodActive.size,
      questions: periodQuestions.length,
      questionUsers: new Set(periodQuestions.map((q) => q.userId)).size,
      records: [...weights, ...allergies, ...conditions, ...products, ...schedules, ...events].filter((r) => inPeriod(r.createdAt)).length,
      signups: signups.length,
      signupsWithPet: signupsWithPet.length,
      signupPetRate: rateSafe(signupsWithPet.length, signups.length),
      trend: {
        pets: series(pets),
        active: [...activeByDay].map(([day, set]) => ({ day, count: set.size })),
        questions: series(questions),
      },
    },
    composition: {
      species: Object.entries(species).map(([id, n]) => ({ id, count: n })).sort((a, b) => b.count - a.count),
      breeds: breedRows.slice(0, 12),
      breedKind,
      sex,
      neutered,
      ages,
      profile,
      perOwner,
    },
    care: {
      weight: { logs: weights.length, pets: weightPets.size, trackedPets: [...weightPets.values()].filter((n) => n >= 2).length },
      allergies: { total: allergies.length, pets: new Set(allergies.map((a) => a.petId)).size, confirmed: allergies.filter((a) => a.reportedStatus === 'veterinarian_confirmed').length, categories: allergyCats },
      conditions: { total: conditions.length, pets: new Set(conditions.map((c) => c.petId)).size, active: conditions.filter((c) => c.status === 'active').length, confirmed: conditions.filter((c) => c.reportedBasis === 'veterinarian_confirmed').length },
      products: { total: products.filter((r) => !r.archivedAt).length, kinds: productKinds },
      plans: { total: schedules.length, status: planStatus, kinds: planKinds, recurrence, sources: planSources, remindersOn, overdue, dueSoon, pets: new Set(schedules.map((s) => s.petId)).size },
      events: { recorded: recorded.length, voided: events.length - recorded.length, fromReminder: recorded.filter((e) => e.source === 'notification').length, skipped: skips.length },
      delivery: { ...delivery, users: deliveryUsers.size },
    },
    vet: {
      users: new Set(questions.map((q) => q.userId)).size,
      pets: new Set(questions.map((q) => q.petId)).size,
      sessions: sessionsWithQuestion.size,
      openedSessions: vetSessions.length,
      questions: questions.length,
      perSession: sessionsWithQuestion.size ? Math.round((questions.length / sessionsWithQuestion.size) * 10) / 10 : null,
      answers: answerStatus,
      drafts: drafts.reduce((sum, d) => sum + (d.count || 1), 0),
      ai: {
        ok: ok.length,
        errors: aiRows.filter((r) => r.status === 'ERROR').length,
        reviewed: aiRows.filter((r) => r.status === 'ERROR_REVIEWED').length,
        avgMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
        p95Ms: percentile(latencies, 95),
        costUsd: Math.round(costUsd * 10000) / 10000,
      },
      feedback: { up: feedback.filter((f) => f.rating > 0).length, down: feedback.filter((f) => f.rating < 0).length },
      topics: PET_TOPIC_KEYS.map((key) => ({ key, count: topics[key] })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count),
      topicSample: topicSample.length,
      safety,
      lastAt: lastQuestion ? new Date(lastQuestion).toISOString() : null,
    },
    pets: list.slice(0, PETS_ADMIN_LIST_MAX),
    petsTotal: list.length,
  };
}

const missingTable = (error) => error?.code === 'P2021' || /does not exist|42P01/.test(String(error?.message || ''));

/** Every row the page needs, for all accounts (the builder drops team accounts). Read-only. */
export async function loadPetsAdminRaw(db = prisma, { now = new Date() } = {}) {
  const since = tbilisiMidnight(addDaysYmd(tbilisiYmd(now), -(Math.max(...PETS_ADMIN_PERIODS) - 1)));
  const [teamUsers, accountsTotal, pets, weights, allergies, conditions, products, schedules, events, skips, vetSessions, questions, questionTexts, answers, drafts, deliveries, aiVet, vetFeedback, signups, flags] = await Promise.all([
    db.user.findMany({ where: { email: { endsWith: '@medicard.ge', mode: 'insensitive' } }, select: { id: true, email: true } }),
    db.user.count(),
    db.pet.findMany({
      select: {
        id: true, userId: true, name: true, speciesId: true, breedId: true, customBreed: true, sex: true, neutered: true,
        ageKind: true, birthDate: true, approxAgeYears: true, approxAgeMonths: true, approxAgeRecordedOn: true, photoUrl: true,
        vetClinicName: true, vetName: true, vetPhone: true, vetAddress: true, archivedAt: true, createdAt: true, updatedAt: true,
      },
    }),
    db.petWeightLog.findMany({ select: { petId: true, userId: true, createdAt: true } }),
    db.petAllergy.findMany({ select: { petId: true, userId: true, createdAt: true, category: true, reportedStatus: true } }),
    db.petCondition.findMany({ select: { petId: true, userId: true, createdAt: true, status: true, reportedBasis: true } }),
    db.petProduct.findMany({ select: { petId: true, userId: true, createdAt: true, kind: true, archivedAt: true } }),
    db.petCareSchedule.findMany({ select: { petId: true, userId: true, createdAt: true, kind: true, recurrenceKind: true, status: true, reminderEnabled: true, nextDueOn: true, source: true } }),
    db.petCareEvent.findMany({ select: { petId: true, userId: true, createdAt: true, status: true, source: true } }),
    db.petCareOccurrence.findMany({ where: { status: 'SKIPPED' }, select: { petId: true, userId: true, createdAt: true, skippedAt: true } }),
    db.petChatSession.findMany({ select: { petId: true, userId: true, createdAt: true } }),
    db.petChatMessage.findMany({ where: { role: 'user' }, select: { petId: true, userId: true, sessionId: true, createdAt: true } }),
    db.petChatMessage.findMany({ where: { role: 'user' }, orderBy: { createdAt: 'desc' }, take: TOPIC_SAMPLE, select: { userId: true, content: true } }),
    db.petChatMessage.groupBy({ by: ['userId', 'status'], where: { role: 'assistant' }, _count: { _all: true } }),
    db.$queryRaw`SELECT "userId", count(*)::int AS count FROM "PetChatMessage" WHERE role = 'assistant' AND draft IS NOT NULL AND draft::text <> 'null' GROUP BY 1`,
    db.petReminderDelivery.groupBy({ by: ['userId', 'status'], _count: { _all: true } }),
    db.aiInteraction.findMany({ where: { mode: 'VET' }, select: { userId: true, status: true, latencyMs: true, tokenUsage: true, createdAt: true } }),
    db.aiFeedback.findMany({ where: { interaction: { mode: 'VET' } }, select: { userId: true, rating: true } }),
    db.user.findMany({ where: { createdAt: { gte: since } }, select: { id: true, createdAt: true } }),
    listFeatureFlags(db).catch(() => []),
  ]);
  const ownerIds = [...new Set(pets.map((p) => p.userId))];
  const [owners, lastSeen, appActivity] = ownerIds.length
    ? await Promise.all([
      db.user.findMany({ where: { id: { in: ownerIds } }, select: { id: true, fullName: true, email: true, phone: true, createdAt: true } }),
      db.appActivity.groupBy({ by: ['userId'], where: { userId: { in: ownerIds } }, _max: { lastAt: true } }),
      db.appActivity.findMany({ where: { userId: { in: ownerIds } }, select: { userId: true, date: true } }),
    ])
    : [[], [], []];
  const seen = new Map(lastSeen.map((r) => [r.userId, r._max?.lastAt || null]));
  return {
    teamUserIds: teamUsers.filter((u) => isTeamEmail(u.email)).map((u) => u.id),
    accountsTotal,
    // Never ship the private photo key or the vet's details: only whether they are there.
    pets: pets.map(({ photoUrl, vetClinicName, vetName, vetPhone, vetAddress, ...p }) => ({
      ...p,
      hasPhoto: Boolean(photoUrl),
      hasVet: Boolean(vetClinicName || vetName || vetPhone || vetAddress),
    })),
    weights,
    allergies,
    conditions,
    products,
    schedules,
    events,
    skips,
    vetSessions,
    questions,
    questionTexts,
    answers: answers.map((r) => ({ userId: r.userId, status: r.status, count: r._count?._all || 0 })),
    drafts: drafts.map((r) => ({ userId: r.userId, count: Number(r.count) || 0 })),
    deliveries: deliveries.map((r) => ({ userId: r.userId, status: r.status, count: r._count?._all || 0 })),
    aiVet,
    vetFeedback,
    signups,
    owners: owners.map((u) => ({ ...u, lastSeenAt: seen.get(u.id) || null })),
    // AppActivity.date is a calendar date (Tbilisi day) stored as UTC midnight.
    appActivity: appActivity.map((a) => ({ userId: a.userId, date: new Date(a.date).toISOString().slice(0, 10) })),
    flags,
  };
}

export async function loadPetsOverview({ days = 30, includeTeam = false, db = prisma, now = new Date() } = {}) {
  try {
    const raw = await loadPetsAdminRaw(db, { now });
    return buildPetsOverview(raw, { days, includeTeam, now });
  } catch (error) {
    if (missingTable(error)) return { installed: false, generatedAt: now.toISOString() };
    throw error;
  }
}
