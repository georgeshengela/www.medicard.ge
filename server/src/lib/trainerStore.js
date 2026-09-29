/**
 * MEDI COACH database layer (raw SQL over the tables in prisma/20260928-trainer.sql).
 * Every read of a client's data by a trainer goes through `requireClientAccess`, which checks the
 * ACTIVE link and the scope the client granted. docs/TRAINER.md.
 */
import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';
import { totals } from './nutrition.js';
import { generateCode, normalizeCode } from './referral.js';
import { gymsByIds, gymPublic } from './gyms.js';
import { avatarUrl, userByQr } from './identity.js';
import { assertTrainerMayInvite } from './coachSafety.js';
import {
  CONSENT_VERSION,
  DEFAULT_SCOPES,
  SPECIALTIES,
  addDaysYmd,
  adherenceScore,
  ageFrom,
  clientAlerts,
  coachError,
  dayAdherence,
  expandSeries,
  findConflict,
  formatClock,
  formatSessionTime,
  goalProgress,
  isLateCancel,
  linkAllows,
  normalizeScopes,
  sessionPublic,
  tbilisiDayStart,
  tbilisiYmd,
  cleanInstagram,
} from './trainer.js';
import { notifyCoach } from './trainerPush.js';

const DAY = 86400000;
const asArray = (v) => (Array.isArray(v) ? v : []);

// ——— people ———

/** Minimal identity for display: name, avatar, age, sex, height. */
export async function peopleByIds(ids, db = prisma) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await db.$queryRaw`SELECT u.id, u."fullName" AS name, u."birthDate", u.gender, u.status,
      hp."heightCm", hp."extraAnswers"->>'avatarId' AS "avatarId", ua."updatedAt" AS "avatarAt"
    FROM "User" u LEFT JOIN "HealthProfile" hp ON hp."userId" = u.id LEFT JOIN "UserAvatar" ua ON ua."userId" = u.id WHERE u.id = ANY(${list})`;
  return new Map(rows.map((r) => [r.id, { ...r, name: firstName(r.name), fullName: r.name, age: ageFrom(r.birthDate), avatarUrl: avatarUrl(r.id, r.avatarAt) }]));
}

function firstName(full) {
  const s = String(full ?? '').trim();
  return s || 'კლიენტი';
}

// ——— trainer profiles ———

export async function getTrainerProfile(userId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "TrainerProfile" WHERE "userId" = ${userId}`;
  return row ?? null;
}

export async function requireTrainer(userId, { verified = true } = {}, db = prisma) {
  const profile = await getTrainerProfile(userId, db);
  if (!profile) throw coachError(403, 'ეს განყოფილება მხოლოდ ტრენერებისთვისაა.', 'TRAINER_REQUIRED', 'This section is for trainers only.');
  if (verified && profile.status !== 'VERIFIED') {
    throw coachError(403, profile.status === 'PENDING'
      ? 'შენი ტრენერის პროფილი ჯერ განიხილება. დადასტურების შემდეგ შეძლებ კლიენტებთან მუშაობას.'
      : 'ტრენერის პროფილი არ არის აქტიური.', 'TRAINER_NOT_VERIFIED', profile.status === 'PENDING'
      ? 'Your trainer profile is still under review. Once it is verified, you can work with clients.'
      : 'Your trainer profile is not active.');
  }
  return profile;
}

async function uniqueCode(db) {
  for (let i = 0; i < 8; i += 1) {
    const code = generateCode();
    const [taken] = await db.$queryRaw`SELECT 1 AS x FROM "TrainerProfile" WHERE code = ${code}`;
    if (!taken) return code;
  }
  throw coachError(503, 'კოდი ვერ შეიქმნა. სცადე ხელახლა.', null, 'We could not create a code. Please try again.');
}

/** Create or update the application. Editing a rejected/pending profile re-submits it for review. */
export async function applyTrainer(user, body, db = prisma) {
  const gyms = await gymsByIds(body.gymIds, db);
  const gymIds = body.gymIds.filter((id) => {
    const g = gyms.get(id);
    return g && (g.status === 'ACTIVE' || (g.status === 'PROPOSED' && g.proposedBy === user.id));
  });
  if (!gymIds.length) throw coachError(400, 'აირჩიე მინიმუმ ერთი დარბაზი სიიდან.', null, 'Choose at least one gym from the list.');
  const existing = await getTrainerProfile(user.id, db);
  const instagram = cleanInstagram(body.instagram);
  if (!existing) {
    const code = await uniqueCode(db);
    const [row] = await db.$queryRaw`INSERT INTO "TrainerProfile"
      ("userId", "displayName", bio, specialties, "experienceYears", instagram, "gymIds", code, status)
      VALUES (${user.id}, ${body.displayName}, ${body.bio || null}, ${JSON.stringify(body.specialties)}::jsonb,
        ${body.experienceYears ?? null}, ${instagram}, ${JSON.stringify(gymIds)}::jsonb, ${code}, 'PENDING')
      RETURNING *`;
    return row;
  }
  if (existing.status === 'SUSPENDED') throw coachError(403, 'ტრენერის პროფილი შეჩერებულია. დაუკავშირდი მხარდაჭერას.', null, 'Your trainer profile is suspended. Please contact support.');
  const resubmit = existing.status === 'REJECTED';
  const [row] = await db.$queryRaw`UPDATE "TrainerProfile" SET
      "displayName" = ${body.displayName}, bio = ${body.bio || null}, specialties = ${JSON.stringify(body.specialties)}::jsonb,
      "experienceYears" = ${body.experienceYears ?? null}, instagram = ${instagram}, "gymIds" = ${JSON.stringify(gymIds)}::jsonb,
      status = CASE WHEN ${resubmit} THEN 'PENDING' ELSE status END,
      "submittedAt" = CASE WHEN ${resubmit} THEN CURRENT_TIMESTAMP ELSE "submittedAt" END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${user.id} RETURNING *`;
  return row;
}

export async function addCertificate(userId, meta, fileKey, db = prisma) {
  const profile = await getTrainerProfile(userId, db);
  if (!profile) throw coachError(404, 'ჯერ შეავსე ტრენერის განაცხადი.', null, 'Please fill in the trainer application first.');
  const certs = asArray(profile.certificates);
  if (certs.length >= 8) throw coachError(400, 'მაქსიმუმ 8 სერტიფიკატი.', null, 'You can add up to 8 certificates.');
  const cert = { id: randomUUID(), title: meta.title, issuer: meta.issuer || '', year: meta.year ?? null, fileKey, addedAt: new Date().toISOString() };
  const [row] = await db.$queryRaw`UPDATE "TrainerProfile" SET certificates = ${JSON.stringify([...certs, cert])}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} RETURNING *`;
  return { profile: row, certificate: cert };
}

export async function removeCertificate(userId, certId, db = prisma) {
  const profile = await getTrainerProfile(userId, db);
  if (!profile) throw coachError(404, 'პროფილი ვერ მოიძებნა.', null, 'Profile not found.');
  const certs = asArray(profile.certificates);
  const removed = certs.find((c) => c.id === certId);
  if (!removed) throw coachError(404, 'სერტიფიკატი ვერ მოიძებნა.', null, 'Certificate not found.');
  const [row] = await db.$queryRaw`UPDATE "TrainerProfile" SET certificates = ${JSON.stringify(certs.filter((c) => c.id !== certId))}::jsonb, "updatedAt" = CURRENT_TIMESTAMP
    WHERE "userId" = ${userId} RETURNING *`;
  return { profile: row, removed };
}

export function ownTrainerProfile(p, gyms = new Map()) {
  if (!p) return null;
  return {
    status: p.status,
    displayName: p.displayName,
    bio: p.bio || '',
    specialties: asArray(p.specialties),
    experienceYears: p.experienceYears ?? null,
    instagram: p.instagram || '',
    gyms: asArray(p.gymIds).map((id) => gyms.get(id)).filter(Boolean).map(gymPublic),
    gymIds: asArray(p.gymIds),
    certificates: asArray(p.certificates).map((c) => ({ id: c.id, title: c.title, issuer: c.issuer, year: c.year, addedAt: c.addedAt })),
    code: p.status === 'VERIFIED' ? p.code : null,
    link: p.status === 'VERIFIED' ? `https://medicard.ge/c/${p.code}` : null,
    reviewNote: p.status === 'REJECTED' ? p.reviewNote || '' : null,
    submittedAt: p.submittedAt,
    reviewedAt: p.reviewedAt,
  };
}

export async function trainerCards(profiles, db = prisma) {
  const gyms = await gymsByIds(profiles.flatMap((p) => asArray(p.gymIds)), db);
  const people = await peopleByIds(profiles.map((p) => p.userId), db);
  const ids = profiles.map((p) => p.userId);
  const counts = ids.length
    ? await db.$queryRaw`SELECT "trainerId", count(*)::int AS n FROM "TrainerLink" WHERE status = 'ACTIVE' AND "trainerId" = ANY(${ids}) GROUP BY "trainerId"`
    : [];
  const countMap = new Map(counts.map((c) => [c.trainerId, c.n]));
  return profiles.map((p) => ({
    id: p.userId,
    displayName: p.displayName,
    avatarId: people.get(p.userId)?.avatarId ?? null,
    avatarUrl: people.get(p.userId)?.avatarUrl ?? null,
    bio: p.bio || '',
    specialties: asArray(p.specialties).map((k) => ({ key: k, label: SPECIALTIES[k] || k })),
    experienceYears: p.experienceYears ?? null,
    instagram: p.instagram || null,
    verified: p.status === 'VERIFIED',
    certificates: asArray(p.certificates).map((c) => ({ title: c.title, issuer: c.issuer, year: c.year })),
    gyms: asArray(p.gymIds).map((id) => gyms.get(id)).filter(Boolean).map(gymPublic),
    clients: countMap.get(p.userId) ?? 0,
  }));
}

export async function searchTrainers({ q = '', gymId = '' } = {}, db = prisma) {
  const term = `%${String(q).trim().toLowerCase()}%`;
  const rows = await db.$queryRaw`SELECT * FROM "TrainerProfile" WHERE status = 'VERIFIED'
      AND (${term} = '%%' OR lower("displayName") LIKE ${term} OR lower(coalesce(bio, '')) LIKE ${term})
      AND (${gymId} = '' OR "gymIds" ? ${gymId})
    ORDER BY "reviewedAt" DESC NULLS LAST LIMIT 60`;
  return trainerCards(rows, db);
}

export async function trainerByCode(raw, db = prisma) {
  const code = normalizeCode(raw);
  if (!code) return null;
  const [row] = await db.$queryRaw`SELECT * FROM "TrainerProfile" WHERE code = ${code} AND status = 'VERIFIED'`;
  return row ?? null;
}

// ——— links ———

export async function openLinkForClient(clientId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "TrainerLink" WHERE "clientId" = ${clientId} AND status IN ('REQUESTED', 'ACTIVE')
    ORDER BY "createdAt" DESC LIMIT 1`;
  return row ?? null;
}

export async function activeLink(trainerId, clientId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "TrainerLink" WHERE "trainerId" = ${trainerId} AND "clientId" = ${clientId} AND status = 'ACTIVE' LIMIT 1`;
  return row ?? null;
}

/** Throws unless the trainer has an ACTIVE link with the client (and the scope, when given). */
export async function requireClientAccess(trainerId, clientId, scope = null, db = prisma) {
  const link = await activeLink(trainerId, clientId, db);
  if (!link) throw coachError(404, 'ეს კლიენტი შენთან აღარ არის დაკავშირებული.', 'LINK_NOT_ACTIVE', 'This client is no longer connected to you.');
  if (scope && !linkAllows(link, scope)) throw coachError(403, 'კლიენტს ეს მონაცემი არ გაუზიარებია.', 'SCOPE_NOT_SHARED', 'This client has not shared this data.');
  return link;
}

/**
 * Client connects to a trainer. A code shared by the trainer is the trainer's invitation, so the link
 * becomes ACTIVE at once; a request from search waits for the trainer (REQUESTED).
 */
export async function createLink(client, body, db = prisma) {
  if (body.consentVersion !== CONSENT_VERSION) throw coachError(409, 'თანხმობის ტექსტი განახლდა. გადახედე და დაადასტურე ხელახლა.', 'CONSENT_OUTDATED', 'The consent text has been updated. Please review it and confirm again.');
  const trainer = body.code ? await trainerByCode(body.code, db) : (await db.$queryRaw`SELECT * FROM "TrainerProfile" WHERE "userId" = ${body.trainerId} AND status = 'VERIFIED'`)[0];
  if (!trainer) throw coachError(404, 'ასეთი დადასტურებული ტრენერი ვერ მოიძებნა. შეამოწმე კოდი.', 'TRAINER_NOT_FOUND', 'No verified trainer was found. Please check the code.');
  if (trainer.userId === client.id) throw coachError(400, 'საკუთარ თავს კლიენტად ვერ დაამატებ.', 'OWN_TRAINER', 'You cannot add yourself as a client.');
  const open = await openLinkForClient(client.id, db);
  if (open) {
    // The trainer already invited this person by QR: entering the trainer's code is the acceptance.
    if (open.trainerId === trainer.userId && open.status === 'REQUESTED' && open.initiator === 'TRAINER') {
      return { link: await acceptInvite(client, { scopes: body.scopes, consentVersion: body.consentVersion }, db), trainer, created: true };
    }
    if (open.trainerId === trainer.userId) return { link: open, trainer, created: false };
    throw coachError(409, 'უკვე გყავს ტრენერი. ახალთან დასაკავშირებლად ჯერ დაასრულე მიმდინარე.', 'ALREADY_LINKED', 'You already have a trainer. To connect with a new one, end the current connection first.');
  }
  const status = body.code ? 'ACTIVE' : 'REQUESTED';
  const scopes = normalizeScopes(body.scopes, DEFAULT_SCOPES);
  const [link] = await db.$queryRaw`INSERT INTO "TrainerLink" (id, "trainerId", "clientId", status, initiator, scopes, "consentVersion", "clientNote", "acceptedAt")
    VALUES (${randomUUID()}, ${trainer.userId}, ${client.id}, ${status}, 'CLIENT', ${JSON.stringify(scopes)}::jsonb, ${CONSENT_VERSION}, ${body.note || null},
      ${status === 'ACTIVE' ? new Date() : null})
    RETURNING *`;
  const [who] = [...(await peopleByIds([client.id], db)).values()];
  void notifyCoach(trainer.userId, status === 'ACTIVE'
    ? { title: 'ახალი კლიენტი', body: `${who?.name ?? 'კლიენტი'} შემოგიერთდა MEDICARD-ში.`, route: `/coach/client/${client.id}`,
      en: { title: 'New client', body: `${who?.name ?? 'A client'} joined you on MEDICARD.` } }
    : { title: 'ახალი მოთხოვნა', body: `${who?.name ?? 'ვიღაცას'} სურს შენთან ვარჯიში.`, route: '/coach/clients',
      en: { title: 'New request', body: `${who?.name ?? 'Someone'} wants to train with you.` } }, db);
  return { link, trainer, created: true };
}

export async function updateScopes(clientId, scopes, db = prisma) {
  const open = await openLinkForClient(clientId, db);
  if (!open) throw coachError(404, 'ტრენერთან კავშირი არ გაქვს.', null, 'You are not connected to a trainer.');
  const next = normalizeScopes(scopes, normalizeScopes(open.scopes));
  const [row] = await db.$queryRaw`UPDATE "TrainerLink" SET scopes = ${JSON.stringify(next)}::jsonb, "consentVersion" = ${CONSENT_VERSION}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${open.id} RETURNING *`;
  return row;
}

/** Either side ends the link. Future sessions between them are cancelled; history stays. */
export async function endLink({ linkId, by, actorId }, db = prisma) {
  const [link] = await db.$queryRaw`UPDATE "TrainerLink" SET status = CASE WHEN status = 'REQUESTED' AND ${by} = 'TRAINER' THEN 'DECLINED' ELSE 'ENDED' END,
      "endedAt" = CURRENT_TIMESTAMP, "endedBy" = ${by}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${linkId} AND status IN ('REQUESTED', 'ACTIVE') AND (${actorId} = "trainerId" OR ${actorId} = "clientId") RETURNING *`;
  if (!link) throw coachError(404, 'კავშირი ვერ მოიძებნა.', null, 'Connection not found.');
  await db.$executeRaw`UPDATE "TrainerSession" SET status = 'CANCELLED', "cancelledBy" = ${by}, "cancelReason" = 'კავშირი დასრულდა', "updatedAt" = CURRENT_TIMESTAMP
    WHERE "trainerId" = ${link.trainerId} AND "clientId" = ${link.clientId} AND status = 'SCHEDULED' AND "startsAt" > now()`;
  await db.$executeRaw`UPDATE "TrainerMealPlan" SET active = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "trainerId" = ${link.trainerId} AND "clientId" = ${link.clientId} AND active`;
  return link;
}

export async function answerRequest(trainerId, linkId, accept, db = prisma) {
  if (!accept) return endLink({ linkId, by: 'TRAINER', actorId: trainerId }, db);
  const [link] = await db.$queryRaw`UPDATE "TrainerLink" SET status = 'ACTIVE', "acceptedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${linkId} AND "trainerId" = ${trainerId} AND status = 'REQUESTED' AND initiator = 'CLIENT' RETURNING *`;
  if (!link) throw coachError(404, 'მოთხოვნა ვერ მოიძებნა.', null, 'Request not found.');
  const trainer = await getTrainerProfile(trainerId, db);
  void notifyCoach(link.clientId, { title: 'ტრენერმა დაგიდასტურა', body: `${trainer?.displayName ?? 'ტრენერი'} ახლა შენი ტრენერია.`, route: '/trainer',
    en: { title: 'Your trainer accepted', body: `${trainer?.displayName ?? 'Your trainer'} is now your trainer.` } }, db);
  return link;
}

export async function proposeGoal(trainerId, clientId, goal, db = prisma) {
  const link = await requireClientAccess(trainerId, clientId, 'weight', db);
  const proposal = { ...goal, proposedAt: new Date().toISOString() };
  await db.$executeRaw`UPDATE "TrainerLink" SET "proposedGoal" = ${JSON.stringify(proposal)}::jsonb, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${link.id}`;
  const trainer = await getTrainerProfile(trainerId, db);
  void notifyCoach(clientId, { title: 'ახალი მიზანი', body: `${trainer?.displayName ?? 'ტრენერმა'} მიზანი შემოგთავაზა. ნახე და დაადასტურე.`, route: '/trainer',
    en: { title: 'New goal', body: `${trainer?.displayName ?? 'Your trainer'} proposed a goal. Take a look and confirm it.` } }, db);
  return proposal;
}

export async function clearGoalProposal(clientId, db = prisma) {
  await db.$executeRaw`UPDATE "TrainerLink" SET "proposedGoal" = NULL, "updatedAt" = CURRENT_TIMESTAMP WHERE "clientId" = ${clientId} AND status = 'ACTIVE'`;
}

// ——— QR: trainer scans a person's personal code ———

/** What a verified trainer sees after scanning: identity only (no health data) and the link state. */
export async function scanPreview(trainerId, token, db = prisma) {
  const userId = await userByQr(token, db);
  if (!userId) throw coachError(404, 'QR კოდი ვერ მოიძებნა ან განახლებულია. სთხოვე ადამიანს, გახსნას თავისი QR ხელახლა.', 'QR_NOT_FOUND', 'This QR code was not found or has been renewed. Ask the person to open their QR code again.');
  if (userId === trainerId) throw coachError(400, 'ეს შენი საკუთარი QR კოდია.', 'OWN_QR', 'This is your own QR code.');
  const person = (await peopleByIds([userId], db)).get(userId);
  if (!person || person.status !== 'ACTIVE') throw coachError(404, 'ანგარიში არ არის აქტიური.', 'QR_NOT_FOUND', 'This account is not active.');
  const open = await openLinkForClient(userId, db);
  const mine = open && open.trainerId === trainerId ? open : null;
  return {
    token,
    user: {
      id: userId,
      name: person.fullName,
      avatarId: person.avatarId ?? null,
      avatarUrl: person.avatarUrl ? `${person.avatarUrl}&qr=${encodeURIComponent(token)}` : null,
      age: person.age,
      gender: person.gender,
    },
    link: mine ? { id: mine.id, status: mine.status, initiator: mine.initiator || 'CLIENT' } : null,
    hasOtherTrainer: Boolean(open && !mine),
  };
}

/** Trainer invites the scanned person; nothing is shared until they accept in their app. */
export async function inviteByQr(trainerId, token, note = '', db = prisma) {
  const preview = await scanPreview(trainerId, token, db);
  if (preview.hasOtherTrainer) throw coachError(409, 'ამ ადამიანს უკვე ჰყავს სხვა ტრენერი.', 'ALREADY_LINKED', 'This person already has another trainer.');
  if (preview.link?.status === 'ACTIVE') throw coachError(409, 'უკვე შენი კლიენტია.', 'ALREADY_CLIENT', 'Already your client.');
  if (preview.link?.status === 'REQUESTED' && preview.link.initiator === 'CLIENT') {
    await answerRequest(trainerId, preview.link.id, true, db);
    return { status: 'ACTIVE', userId: preview.user.id };
  }
  if (preview.link) return { status: 'REQUESTED', userId: preview.user.id };
  await assertTrainerMayInvite(trainerId, preview.user.id, db);
  await db.$queryRaw`INSERT INTO "TrainerLink" (id, "trainerId", "clientId", status, initiator, scopes, "clientNote")
    VALUES (${randomUUID()}, ${trainerId}, ${preview.user.id}, 'REQUESTED', 'TRAINER', ${JSON.stringify(DEFAULT_SCOPES)}::jsonb, ${note || null})`;
  const trainer = await getTrainerProfile(trainerId, db);
  void notifyCoach(preview.user.id, { title: 'ტრენერი გიწვევს', body: `${trainer?.displayName ?? 'ტრენერი'} გთავაზობს ერთად ვარჯიშს. ნახე და გადაწყვიტე, რას გაუზიარებ.`, route: '/trainer',
    en: { title: 'A trainer invited you', body: `${trainer?.displayName ?? 'A trainer'} would like to train with you. Take a look and decide what to share.` } }, db);
  return { status: 'REQUESTED', userId: preview.user.id };
}

/** Client accepts a trainer's QR invitation with explicit scopes (consent). */
export async function acceptInvite(client, { scopes, consentVersion }, db = prisma) {
  if (consentVersion !== CONSENT_VERSION) throw coachError(409, 'თანხმობის ტექსტი განახლდა. გადახედე და დაადასტურე ხელახლა.', 'CONSENT_OUTDATED', 'The consent text has been updated. Please review it and confirm again.');
  const open = await openLinkForClient(client.id, db);
  if (!open || open.status !== 'REQUESTED' || open.initiator !== 'TRAINER') throw coachError(404, 'მოწვევა ვერ მოიძებნა.', 'INVITE_NOT_FOUND', 'Invitation not found.');
  const [link] = await db.$queryRaw`UPDATE "TrainerLink" SET status = 'ACTIVE', scopes = ${JSON.stringify(normalizeScopes(scopes, DEFAULT_SCOPES))}::jsonb,
      "consentVersion" = ${CONSENT_VERSION}, "acceptedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${open.id} RETURNING *`;
  const [who] = [...(await peopleByIds([client.id], db)).values()];
  void notifyCoach(link.trainerId, { title: 'მოწვევა მიიღეს ✅', body: `${who?.name ?? 'კლიენტი'} შემოგიერთდა.`, route: `/coach/client/${client.id}`,
    en: { title: 'Invitation accepted ✅', body: `${who?.name ?? 'Your client'} joined you.` } }, db);
  return link;
}

// ——— sessions ———

async function liveSessionsAround(trainerId, from, to, db) {
  return db.$queryRaw`SELECT * FROM "TrainerSession" WHERE "trainerId" = ${trainerId} AND status IN ('SCHEDULED', 'OPEN')
    AND "startsAt" > ${new Date(from.getTime() - 6 * 3600000)} AND "startsAt" < ${to}`;
}

export async function createSessions(trainerId, body, db = prisma) {
  if (body.clientId) await requireClientAccess(trainerId, body.clientId, null, db);
  if (body.gymId) {
    const gyms = await gymsByIds([body.gymId], db);
    if (!gyms.get(body.gymId)) throw coachError(400, 'დარბაზი ვერ მოიძებნა.', null, 'Gym not found.');
  }
  const times = expandSeries(body.startsAt, body.repeatWeeks);
  if (times[0].getTime() < Date.now() - 15 * 60000) throw coachError(400, 'წარსულ დროზე ვარჯიშს ვერ დანიშნავ.', null, 'You cannot schedule a session in the past.');
  const existing = await liveSessionsAround(trainerId, times[0], new Date(times.at(-1).getTime() + DAY), db);
  for (const t of times) {
    const clash = findConflict(existing, t, body.durationMin);
    if (clash) throw coachError(409, `ამ დროს უკვე გაქვს ვარჯიში (${formatClock(clash.startsAt)}).`, 'SESSION_CONFLICT', `You already have a session at this time (${formatClock(clash.startsAt)}).`);
  }
  const seriesId = times.length > 1 ? randomUUID() : null;
  const status = body.clientId ? 'SCHEDULED' : 'OPEN';
  const created = [];
  await db.$transaction(async (tx) => {
    for (const t of times) {
      const [row] = await tx.$queryRaw`INSERT INTO "TrainerSession" (id, "trainerId", "clientId", "gymId", "startsAt", "durationMin", kind, note, status, "seriesId")
        VALUES (${randomUUID()}, ${trainerId}, ${body.clientId || null}, ${body.gymId || null}, ${t}, ${body.durationMin}, ${body.kind}, ${body.note || null}, ${status}, ${seriesId})
        RETURNING *`;
      created.push(row);
    }
  });
  if (body.clientId) {
    const trainer = await getTrainerProfile(trainerId, db);
    const first = sessionPublic(created[0]);
    void notifyCoach(body.clientId, {
      title: 'ვარჯიში ჩაგენიშნა',
      body: `${trainer?.displayName ?? 'ტრენერმა'}: ${first.label}${created.length > 1 ? ` და კიდევ ${created.length - 1} კვირა` : ''}`,
      route: '/trainer/sessions',
      en: {
        title: 'Session booked for you',
        body: `${trainer?.displayName ?? 'Your trainer'}: ${formatSessionTime(created[0].startsAt, 'en')}${created.length > 1 ? ` and ${created.length - 1} more ${created.length - 1 === 1 ? 'week' : 'weeks'}` : ''}`,
      },
    }, db);
  }
  return created;
}

export async function getSession(id, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "TrainerSession" WHERE id = ${id}`;
  return row ?? null;
}

export async function listSessions({ trainerId = null, clientId = null, from, to, includeOpenFor = null }, db = prisma) {
  const rows = await db.$queryRaw`SELECT * FROM "TrainerSession"
    WHERE "startsAt" >= ${from} AND "startsAt" < ${to}
      AND (
        (${trainerId}::text IS NOT NULL AND "trainerId" = ${trainerId})
        OR (${clientId}::text IS NOT NULL AND "clientId" = ${clientId})
        OR (${includeOpenFor}::text IS NOT NULL AND "trainerId" = ${includeOpenFor} AND status = 'OPEN')
      )
    ORDER BY "startsAt" ASC LIMIT 500`;
  return rows;
}

export async function decorateSessions(rows, db = prisma) {
  const gyms = await gymsByIds(rows.map((r) => r.gymId), db);
  const people = await peopleByIds(rows.map((r) => r.clientId), db);
  return rows.map((r) => sessionPublic(r, { gyms, people }));
}

export async function patchSession(trainerId, id, patch, db = prisma) {
  const s = await getSession(id, db);
  if (!s || s.trainerId !== trainerId) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.', null, 'Session not found.');
  if (!['SCHEDULED', 'OPEN'].includes(s.status)) throw coachError(409, 'დასრულებულ ან გაუქმებულ ვარჯიშს ვერ შეცვლი.', null, 'You cannot change a finished or cancelled session.');
  const startsAt = patch.startsAt ?? s.startsAt;
  const durationMin = patch.durationMin ?? s.durationMin;
  const moved = patch.startsAt && new Date(patch.startsAt).getTime() !== new Date(s.startsAt).getTime();
  if (moved || patch.durationMin) {
    const existing = await liveSessionsAround(trainerId, new Date(startsAt), new Date(new Date(startsAt).getTime() + DAY), db);
    const clash = findConflict(existing, startsAt, durationMin, s.id);
    if (clash) throw coachError(409, `ამ დროს უკვე გაქვს ვარჯიში (${formatClock(clash.startsAt)}).`, 'SESSION_CONFLICT', `You already have a session at this time (${formatClock(clash.startsAt)}).`);
  }
  const [row] = await db.$queryRaw`UPDATE "TrainerSession" SET "startsAt" = ${new Date(startsAt)}, "durationMin" = ${durationMin},
      "gymId" = ${patch.gymId !== undefined ? patch.gymId : s.gymId}, kind = ${patch.kind ?? s.kind}, note = ${patch.note ?? s.note},
      "clientConfirmedAt" = CASE WHEN ${Boolean(moved)} THEN NULL ELSE "clientConfirmedAt" END,
      reminded24 = CASE WHEN ${Boolean(moved)} THEN false ELSE reminded24 END,
      reminded1 = CASE WHEN ${Boolean(moved)} THEN false ELSE reminded1 END,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id} RETURNING *`;
  if (moved && row.clientId) {
    void notifyCoach(row.clientId, { title: 'ვარჯიში გადაიტანეს', body: `ახალი დრო: ${sessionPublic(row).label}`, route: '/trainer/sessions',
      en: { title: 'Session moved', body: `New time: ${formatSessionTime(row.startsAt, 'en')}` } }, db);
  }
  return row;
}

export async function cancelSession({ id, actorId, by, reason }, db = prisma) {
  const s = await getSession(id, db);
  const allowed = s && (by === 'TRAINER' ? s.trainerId === actorId : s.clientId === actorId);
  if (!allowed) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.', null, 'Session not found.');
  if (!['SCHEDULED', 'OPEN'].includes(s.status)) throw coachError(409, 'ეს ვარჯიში უკვე დასრულებული ან გაუქმებულია.', null, 'This session is already finished or cancelled.');
  const late = by === 'CLIENT' && isLateCancel(s.startsAt);
  // A client cancelling an open-slot booking hands the slot back to the trainer.
  const reopen = by === 'CLIENT' && s.seriesId === 'slot';
  const [row] = reopen
    ? await db.$queryRaw`UPDATE "TrainerSession" SET status = 'OPEN', "clientId" = NULL, "clientConfirmedAt" = NULL, reminded24 = false, reminded1 = false, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`
    : await db.$queryRaw`UPDATE "TrainerSession" SET status = 'CANCELLED', "cancelledBy" = ${by}, "cancelReason" = ${reason || null}, "lateCancel" = ${late}, "updatedAt" = CURRENT_TIMESTAMP
      WHERE id = ${id} RETURNING *`;
  const label = sessionPublic(s).label;
  const labelEn = formatSessionTime(s.startsAt, 'en');
  if (by === 'TRAINER' && s.clientId) {
    void notifyCoach(s.clientId, { title: 'ვარჯიში გაუქმდა', body: `${label}${reason ? ` — ${reason}` : ''}`, route: '/trainer/sessions',
      en: { title: 'Session cancelled', body: `${labelEn}${reason ? ` — ${reason}` : ''}` } }, db);
  } else if (by === 'CLIENT') {
    const [who] = [...(await peopleByIds([actorId], db)).values()];
    void notifyCoach(s.trainerId, { title: late ? 'ბოლო წუთის გაუქმება' : 'ვარჯიში გაუქმდა', body: `${who?.name ?? 'კლიენტი'}: ${label}${reason ? ` — ${reason}` : ''}`, route: '/coach/calendar',
      en: { title: late ? 'Last-minute cancellation' : 'Session cancelled', body: `${who?.name ?? 'Your client'}: ${labelEn}${reason ? ` — ${reason}` : ''}` } }, db);
  }
  return row;
}

export async function completeSession(trainerId, id, body, db = prisma) {
  const s = await getSession(id, db);
  if (!s || s.trainerId !== trainerId || !s.clientId) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.', null, 'Session not found.');
  if (!['SCHEDULED', 'DONE', 'NO_SHOW'].includes(s.status)) throw coachError(409, 'გაუქმებულ ვარჯიშს ვერ დაასრულებ.', null, 'You cannot complete a cancelled session.');
  if (new Date(s.startsAt).getTime() > Date.now() + 15 * 60000) throw coachError(409, 'ვარჯიში ჯერ არ დაწყებულა.', null, 'This session has not started yet.');
  const [row] = await db.$queryRaw`UPDATE "TrainerSession" SET status = ${body.status}, exercises = ${JSON.stringify(body.exercises)}::jsonb,
      "trainerNote" = ${body.trainerNote || null}, "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`;
  if (body.status === 'DONE' && s.status !== 'DONE') {
    void notifyCoach(s.clientId, { title: 'ვარჯიში დასრულდა 💪', body: 'ტრენერმა ვარჯიშის შედეგები ჩაწერა. ნახე დეტალები.', route: `/trainer/session/${id}`,
      en: { title: 'Session complete 💪', body: 'Your trainer recorded the session results. Take a look at the details.' } }, db);
  }
  return row;
}

export async function confirmSession(clientId, id, db = prisma) {
  const [row] = await db.$queryRaw`UPDATE "TrainerSession" SET "clientConfirmedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id} AND "clientId" = ${clientId} AND status = 'SCHEDULED' RETURNING *`;
  if (!row) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.', null, 'Session not found.');
  return row;
}

/** Client takes one of their trainer's open slots. Atomic: two clients cannot take the same slot. */
export async function bookSlot(clientId, id, db = prisma) {
  const link = await openLinkForClient(clientId, db);
  if (!link || link.status !== 'ACTIVE') throw coachError(403, 'ჯავშნისთვის ტრენერთან აქტიური კავშირი გჭირდება.', null, 'To book, you need an active connection with a trainer.');
  const [row] = await db.$queryRaw`UPDATE "TrainerSession" SET status = 'SCHEDULED', "clientId" = ${clientId}, "clientConfirmedAt" = CURRENT_TIMESTAMP,
      "seriesId" = 'slot', "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id} AND "trainerId" = ${link.trainerId} AND status = 'OPEN' AND "clientId" IS NULL AND "startsAt" > now() RETURNING *`;
  if (!row) throw coachError(409, 'ეს დრო უკვე დაკავებულია. აირჩიე სხვა.', 'SLOT_TAKEN', 'This time is already taken. Please choose another.');
  const [who] = [...(await peopleByIds([clientId], db)).values()];
  void notifyCoach(link.trainerId, { title: 'ახალი ჯავშანი', body: `${who?.name ?? 'კლიენტმა'} დაჯავშნა ${sessionPublic(row).label}`, route: '/coach/calendar',
    en: { title: 'New booking', body: `${who?.name ?? 'A client'} booked ${formatSessionTime(row.startsAt, 'en')}` } }, db);
  return row;
}

export async function rateSession(clientId, id, rating, db = prisma) {
  const [row] = await db.$queryRaw`UPDATE "TrainerSession" SET "clientRating" = ${rating}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id} AND "clientId" = ${clientId} AND status = 'DONE' RETURNING *`;
  if (!row) throw coachError(404, 'ვარჯიში ვერ მოიძებნა.', null, 'Session not found.');
  return row;
}

// ——— meal plans ———

export async function createMealPlan(trainerId, clientId, body, db = prisma) {
  await requireClientAccess(trainerId, clientId, 'nutrition', db);
  const row = await db.$transaction(async (tx) => {
    await tx.$executeRaw`UPDATE "TrainerMealPlan" SET active = false, "updatedAt" = CURRENT_TIMESTAMP WHERE "trainerId" = ${trainerId} AND "clientId" = ${clientId} AND active`;
    const [created] = await tx.$queryRaw`INSERT INTO "TrainerMealPlan" (id, "trainerId", "clientId", title, targets, meals, note, active, "startsOn")
      VALUES (${randomUUID()}, ${trainerId}, ${clientId}, ${body.title}, ${JSON.stringify(body.targets)}::jsonb, ${JSON.stringify(body.meals)}::jsonb,
        ${body.note || null}, true, ${tbilisiYmd()}) RETURNING *`;
    return created;
  });
  const trainer = await getTrainerProfile(trainerId, db);
  void notifyCoach(clientId, { title: 'კვების ახალი გეგმა', body: `${trainer?.displayName ?? 'ტრენერმა'} კვების გეგმა გამოგიგზავნა.`, route: '/trainer/plan',
    en: { title: 'New meal plan', body: `${trainer?.displayName ?? 'Your trainer'} sent you a meal plan.` } }, db);
  return row;
}

export async function activeMealPlan(clientId, trainerId = null, db = prisma) {
  const [row] = await db.$queryRaw`SELECT * FROM "TrainerMealPlan" WHERE "clientId" = ${clientId} AND active
    AND (${trainerId}::text IS NULL OR "trainerId" = ${trainerId}) ORDER BY "updatedAt" DESC LIMIT 1`;
  return row ?? null;
}

export function mealPlanPublic(p) {
  if (!p) return null;
  return { id: p.id, title: p.title, targets: p.targets, meals: asArray(p.meals), note: p.note || '', startsOn: p.startsOn, updatedAt: p.updatedAt };
}

// ——— client data (read by the owner, or by a trainer after requireClientAccess) ———

export async function nutritionDays(userId, fromYmd, toYmd, targets, db = prisma) {
  const meals = await db.$queryRaw`SELECT date, items, type, title, "createdAt" FROM "NutritionMeal" WHERE "userId" = ${userId} AND date >= ${fromYmd} AND date <= ${toYmd}`;
  const byDay = new Map();
  for (const m of meals) {
    if (!byDay.has(m.date)) byDay.set(m.date, []);
    byDay.get(m.date).push(m);
  }
  const today = tbilisiYmd();
  const days = [];
  for (let d = fromYmd; d <= toYmd; d = addDaysYmd(d, 1)) {
    const list = byDay.get(d) || [];
    const eaten = totals(list.flatMap((m) => asArray(m.items)));
    const verdict = dayAdherence({ targets, eaten, meals: list.length, isToday: d === today });
    days.push({ date: d, meals: list.length, calories: Math.round(eaten.calories), protein: Math.round(eaten.protein), carbs: Math.round(eaten.carbs), fat: Math.round(eaten.fat), ...verdict });
  }
  const [last] = await db.$queryRaw`SELECT max(date) AS d FROM "NutritionMeal" WHERE "userId" = ${userId}`;
  return { days, lastMealYmd: last?.d ?? null };
}

export async function todayMeals(userId, ymd, db = prisma) {
  const rows = await db.$queryRaw`SELECT id, type, title, items, source, "createdAt" FROM "NutritionMeal" WHERE "userId" = ${userId} AND date = ${ymd} ORDER BY "createdAt" ASC`;
  return rows.map((m) => {
    const t = totals(asArray(m.items));
    return {
      id: m.id,
      type: m.type,
      title: m.title || asArray(m.items).map((i) => i.name).filter(Boolean).slice(0, 3).join(', '),
      calories: Math.round(t.calories),
      protein: Math.round(t.protein),
      time: formatClock(m.createdAt),
      source: m.source,
    };
  });
}

/** Weight series (device measurements + manual logs), the person's goal and current weight. */
export async function weightData(userId, db = prisma) {
  const [profile] = await db.$queryRaw`SELECT "weightKg", "heightCm", "extraAnswers"->'appState' AS state FROM "HealthProfile" WHERE "userId" = ${userId}`;
  const measured = await db.$queryRaw`SELECT date, "weightKg" FROM "HealthMetricDaily" WHERE "userId" = ${userId} AND "weightKg" IS NOT NULL ORDER BY date DESC LIMIT 120`;
  const state = profile?.state && typeof profile.state === 'object' ? profile.state : {};
  const byDate = new Map();
  for (const l of asArray(state.weightLogs)) {
    if (l?.date && Number.isFinite(l.kg) && l.kg >= 20 && l.kg <= 300) byDate.set(l.date, { date: l.date, kg: Math.round(l.kg * 10) / 10 });
  }
  for (const m of measured) if (!byDate.has(m.date)) byDate.set(m.date, { date: m.date, kg: Math.round(m.weightKg * 10) / 10 });
  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-120);
  const goal = state.weightGoal && Number.isFinite(state.weightGoal.targetKg) ? state.weightGoal : null;
  const currentKg = series.at(-1)?.kg ?? (Number.isFinite(profile?.weightKg) ? profile.weightKg : null);
  return {
    series,
    currentKg,
    lastWeighYmd: series.at(-1)?.date ?? null,
    heightCm: profile?.heightCm ?? null,
    goal: goal ? { targetKg: goal.targetKg, startKg: goal.startKg, startedYmd: goal.startedYmd, deadlineYmd: goal.deadlineYmd, paceKgPerWeek: goal.paceKgPerWeek } : null,
    progress: goal ? goalProgress(goal, currentKg) : null,
  };
}

export async function activityData(userId, fromYmd, toYmd, db = prisma) {
  const [metrics, activities, workouts] = await Promise.all([
    db.$queryRaw`SELECT date, steps, "activeMinutes", "heartRate", "sleepHours" FROM "HealthMetricDaily" WHERE "userId" = ${userId} AND date >= ${fromYmd} AND date <= ${toYmd} ORDER BY date`,
    db.$queryRaw`SELECT date, kind, minutes, kcal, source FROM "NutritionActivity" WHERE "userId" = ${userId} AND date >= ${fromYmd} AND date <= ${toYmd} ORDER BY date DESC`,
    listWorkouts(userId, tbilisiDayStart(fromYmd), new Date(tbilisiDayStart(toYmd).getTime() + DAY), db),
  ]);
  return {
    days: metrics.map((m) => ({ date: m.date, steps: m.steps ?? null, activeMinutes: m.activeMinutes ?? null, heartRate: m.heartRate ? Math.round(m.heartRate) : null, sleepHours: m.sleepHours ?? null })),
    activities: activities.map((a) => ({ date: a.date, kind: a.kind, minutes: a.minutes, kcal: a.kcal, source: a.source })),
    workouts,
  };
}

// ——— workouts from Health ———

export async function syncWorkouts(userId, workouts, db = prisma) {
  let saved = 0;
  for (const w of workouts) {
    const durationMin = Math.max(1, Math.round((new Date(w.endedAt) - new Date(w.startedAt)) / 60000));
    if (durationMin > 24 * 60) continue;
    saved += await db.$executeRaw`INSERT INTO "WorkoutLog" (id, "userId", "externalId", source, kind, "startedAt", "endedAt", "durationMin", kcal, "avgHeartRate", "distanceKm")
      VALUES (${randomUUID()}, ${userId}, ${w.externalId}, ${w.source}, ${w.kind}, ${w.startedAt}, ${w.endedAt}, ${durationMin},
        ${w.kcal != null ? Math.round(w.kcal) : null}, ${w.avgHeartRate != null ? Math.round(w.avgHeartRate) : null}, ${w.distanceKm ?? null})
      ON CONFLICT ("userId", "externalId") DO UPDATE SET kind = EXCLUDED.kind, "startedAt" = EXCLUDED."startedAt", "endedAt" = EXCLUDED."endedAt",
        "durationMin" = EXCLUDED."durationMin", kcal = EXCLUDED.kcal, "avgHeartRate" = EXCLUDED."avgHeartRate", "distanceKm" = EXCLUDED."distanceKm"`;
  }
  return saved;
}

export async function listWorkouts(userId, from, to, db = prisma) {
  const rows = await db.$queryRaw`SELECT id, source, kind, "startedAt", "endedAt", "durationMin", kcal, "avgHeartRate", "distanceKm"
    FROM "WorkoutLog" WHERE "userId" = ${userId} AND "startedAt" >= ${from} AND "startedAt" < ${to} ORDER BY "startedAt" DESC LIMIT 200`;
  return rows.map((w) => ({ ...w, startedAt: new Date(w.startedAt).toISOString(), endedAt: new Date(w.endedAt).toISOString(), date: tbilisiYmd(w.startedAt) }));
}

/** The phone workout that overlaps a session (same client, ±30 min), if any. */
export function matchWorkout(session, workouts) {
  const s0 = new Date(session.startsAt).getTime() - 30 * 60000;
  const s1 = new Date(session.startsAt).getTime() + (session.durationMin + 30) * 60000;
  return workouts.find((w) => new Date(w.startedAt).getTime() < s1 && new Date(w.endedAt).getTime() > s0) || null;
}

// ——— progress photos ———

export async function addPhoto(userId, meta, fileKey, db = prisma) {
  const [row] = await db.$queryRaw`INSERT INTO "ProgressPhoto" (id, "userId", "takenOn", pose, "fileKey", "weightKg", note)
    VALUES (${randomUUID()}, ${userId}, ${meta.takenOn || tbilisiYmd()}, ${meta.pose}, ${fileKey}, ${meta.weightKg ?? null}, ${meta.note || null}) RETURNING *`;
  return row;
}

export async function listPhotos(userId, db = prisma) {
  return db.$queryRaw`SELECT id, "takenOn", pose, "fileKey", "weightKg", note, "createdAt" FROM "ProgressPhoto" WHERE "userId" = ${userId} ORDER BY "takenOn" DESC, "createdAt" DESC LIMIT 300`;
}

export async function deletePhoto(userId, id, db = prisma) {
  const [row] = await db.$queryRaw`DELETE FROM "ProgressPhoto" WHERE id = ${id} AND "userId" = ${userId} RETURNING "fileKey"`;
  if (!row) throw coachError(404, 'ფოტო ვერ მოიძებნა.', null, 'Photo not found.');
  return row;
}

export function photoPublic(p, base = '/api/trainer/photos') {
  return { id: p.id, takenOn: p.takenOn, pose: p.pose, weightKg: p.weightKg ?? null, note: p.note || '', url: `${base}/${p.id}/file` };
}

/** Who may see a progress photo file: its owner, or their active trainer with the photos scope. */
export async function photoViewer(viewerId, photoId, db = prisma) {
  const [photo] = await db.$queryRaw`SELECT * FROM "ProgressPhoto" WHERE id = ${photoId}`;
  if (!photo) return null;
  if (photo.userId === viewerId) return photo;
  const link = await activeLink(viewerId, photo.userId, db);
  return linkAllows(link, 'photos') ? photo : null;
}

// ——— composed views ———

function scopedFlags(link) {
  const scopes = normalizeScopes(link?.scopes, {});
  return scopes;
}

/** Everything the trainer sees about one client, limited to what the client shared. */
export async function coachClientDashboard(trainerId, clientId, db = prisma) {
  const link = await requireClientAccess(trainerId, clientId, null, db);
  const scopes = scopedFlags(link);
  const today = tbilisiYmd();
  const from = addDaysYmd(today, -13);
  const [people, plan, sessions] = await Promise.all([
    peopleByIds([clientId], db),
    activeMealPlan(clientId, trainerId, db),
    db.$queryRaw`SELECT * FROM "TrainerSession" WHERE "trainerId" = ${trainerId} AND "clientId" = ${clientId} ORDER BY "startsAt" DESC LIMIT 40`,
  ]);
  const person = people.get(clientId);
  const out = {
    client: { id: clientId, name: person?.fullName ?? 'კლიენტი', firstName: person?.name, avatarId: person?.avatarId ?? null, avatarUrl: person?.avatarUrl ?? null, age: person?.age ?? null, gender: person?.gender ?? null, heightCm: person?.heightCm ?? null },
    link: { id: link.id, since: link.acceptedAt, scopes, proposedGoal: link.proposedGoal ?? null, note: link.clientNote || '' },
    plan: mealPlanPublic(plan),
    sessions: await decorateSessions(sessions, db),
    nutrition: null,
    weight: null,
    activity: null,
    photos: null,
  };
  if (scopes.nutrition) {
    const n = await nutritionDays(clientId, from, today, plan?.targets ?? null, db);
    out.nutrition = { ...n, score: adherenceScore(n.days), today: await todayMeals(clientId, today, db), targets: plan?.targets ?? null };
  }
  if (scopes.weight) out.weight = await weightData(clientId, db);
  if (scopes.workouts) {
    const a = await activityData(clientId, addDaysYmd(today, -29), today, db);
    out.activity = a;
    out.sessions = out.sessions.map((s) => ({ ...s, workout: s.status === 'DONE' || s.status === 'SCHEDULED' ? matchWorkout(s, a.workouts) : null }));
  }
  if (scopes.photos) out.photos = (await listPhotos(clientId, db)).map((p) => photoPublic(p, '/api/trainer/coach/photos'));
  await db.$executeRaw`UPDATE "TrainerLink" SET "trainerViewedAt" = CURRENT_TIMESTAMP WHERE id = ${link.id}`;
  return out;
}

/** Client list with at-a-glance chips, plus pending requests. */
export async function coachClients(trainerId, db = prisma, lang = 'ka') {
  const links = await db.$queryRaw`SELECT * FROM "TrainerLink" WHERE "trainerId" = ${trainerId} AND status IN ('ACTIVE', 'REQUESTED') ORDER BY "acceptedAt" DESC NULLS FIRST, "createdAt" DESC`;
  const ids = links.map((l) => l.clientId);
  const people = await peopleByIds(ids, db);
  const today = tbilisiYmd();
  const from = addDaysYmd(today, -6);
  const nextRows = ids.length
    ? await db.$queryRaw`SELECT DISTINCT ON ("clientId") "clientId", "startsAt" FROM "TrainerSession" WHERE "trainerId" = ${trainerId} AND "clientId" = ANY(${ids}) AND status = 'SCHEDULED' AND "startsAt" > now() ORDER BY "clientId", "startsAt"`
    : [];
  const next = new Map(nextRows.map((r) => [r.clientId, r.startsAt]));
  const clients = [];
  const requests = [];
  const invited = [];
  for (const l of links) {
    const p = people.get(l.clientId);
    const base = { linkId: l.id, id: l.clientId, name: p?.fullName ?? 'კლიენტი', avatarId: p?.avatarId ?? null, avatarUrl: p?.avatarUrl ?? null, age: p?.age ?? null, gender: p?.gender ?? null };
    if (l.status === 'REQUESTED') {
      if (l.initiator === 'TRAINER') invited.push({ ...base, createdAt: l.createdAt });
      else requests.push({ ...base, note: l.clientNote || '', createdAt: l.createdAt, scopes: normalizeScopes(l.scopes, {}) });
      continue;
    }
    const scopes = normalizeScopes(l.scopes, {});
    const alerts = [];
    let week = null;
    let kcalToday = null;
    let weight = null;
    if (scopes.nutrition) {
      const plan = await activeMealPlan(l.clientId, trainerId, db);
      const n = await nutritionDays(l.clientId, from, today, plan?.targets ?? null, db);
      week = n.days.map((d) => ({ date: d.date, status: d.status }));
      const t = n.days.at(-1);
      kcalToday = { eaten: t.calories, target: plan?.targets?.calories ?? null };
      alerts.push(...clientAlerts({ name: p?.name ?? 'კლიენტი', nutritionDays: n.days, lastMealYmd: n.lastMealYmd, today, lang }));
    }
    if (scopes.weight) {
      const w = await weightData(l.clientId, db);
      weight = { currentKg: w.currentKg, goalKg: w.goal?.targetKg ?? null, percent: w.progress?.percent ?? null };
      alerts.push(...clientAlerts({ name: p?.name ?? 'კლიენტი', lastWeighYmd: w.lastWeighYmd, goal: w.goal, currentKg: w.currentKg, today, lang }));
    }
    const [last] = await db.$queryRaw`SELECT status FROM "TrainerSession" WHERE "trainerId" = ${trainerId} AND "clientId" = ${l.clientId} AND "startsAt" < now() AND status IN ('DONE', 'NO_SHOW') ORDER BY "startsAt" DESC LIMIT 1`;
    alerts.push(...clientAlerts({ name: p?.name ?? 'კლიენტი', lastSession: last, today, lang }));
    clients.push({ ...base, since: l.acceptedAt, scopes, week, kcalToday, weight, nextSession: next.get(l.clientId) ?? null, alerts });
  }
  return { clients, requests, invited };
}

export async function coachToday(trainerId, db = prisma, lang = 'ka') {
  const today = tbilisiYmd();
  const from = tbilisiDayStart(today);
  const to = new Date(from.getTime() + DAY);
  const [sessions, roster, profile] = await Promise.all([
    listSessions({ trainerId, from, to }, db),
    coachClients(trainerId, db, lang),
    getTrainerProfile(trainerId, db),
  ]);
  const weekTo = new Date(from.getTime() + 7 * DAY);
  const [weekCount] = await db.$queryRaw`SELECT count(*)::int AS n FROM "TrainerSession" WHERE "trainerId" = ${trainerId} AND status = 'SCHEDULED' AND "startsAt" >= ${from} AND "startsAt" < ${weekTo}`;
  const [done30] = await db.$queryRaw`SELECT count(*) FILTER (WHERE status = 'DONE')::int AS done, count(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow"
    FROM "TrainerSession" WHERE "trainerId" = ${trainerId} AND "startsAt" >= ${new Date(Date.now() - 30 * DAY)} AND "startsAt" < now()`;
  const alerts = roster.clients.flatMap((c) => c.alerts.map((a) => ({ ...a, clientId: c.id, clientName: c.name, avatarId: c.avatarId, avatarUrl: c.avatarUrl })));
  const rank = { warn: 0, info: 1, good: 2 };
  alerts.sort((a, b) => rank[a.tone] - rank[b.tone]);
  return {
    today,
    trainer: { displayName: profile?.displayName, status: profile?.status },
    sessions: await decorateSessions(sessions, db),
    stats: { clients: roster.clients.length, requests: roster.requests.length, weekSessions: weekCount?.n ?? 0, done30: done30?.done ?? 0, noShow30: done30?.noShow ?? 0 },
    alerts: alerts.slice(0, 30),
    requests: roster.requests,
  };
}

/** The client's own "my trainer" screen. */
export async function clientOverview(client, db = prisma) {
  const link = await openLinkForClient(client.id, db);
  if (!link) return { link: null };
  const [trainerRow] = await db.$queryRaw`SELECT * FROM "TrainerProfile" WHERE "userId" = ${link.trainerId}`;
  const [card] = trainerRow ? await trainerCards([trainerRow], db) : [null];
  const now = new Date();
  const upcoming = await listSessions({ clientId: client.id, from: new Date(now.getTime() - 3 * 3600000), to: new Date(now.getTime() + 60 * DAY) }, db);
  const openSlots = link.status === 'ACTIVE'
    ? (await listSessions({ includeOpenFor: link.trainerId, from: now, to: new Date(now.getTime() + 21 * DAY) }, db)).filter((s) => s.status === 'OPEN')
    : [];
  const past = await db.$queryRaw`SELECT * FROM "TrainerSession" WHERE "clientId" = ${client.id} AND "trainerId" = ${link.trainerId} AND "startsAt" < now() AND status IN ('DONE', 'NO_SHOW') ORDER BY "startsAt" DESC LIMIT 20`;
  const plan = await activeMealPlan(client.id, link.trainerId, db);
  const today = tbilisiYmd();
  const nutrition = plan ? await nutritionDays(client.id, addDaysYmd(today, -6), today, plan.targets, db) : null;
  const [stats] = await db.$queryRaw`SELECT count(*) FILTER (WHERE status = 'DONE')::int AS done, count(*) FILTER (WHERE status = 'NO_SHOW')::int AS "noShow"
    FROM "TrainerSession" WHERE "clientId" = ${client.id} AND "trainerId" = ${link.trainerId}`;
  return {
    link: { id: link.id, status: link.status, initiator: link.initiator || 'CLIENT', scopes: normalizeScopes(link.scopes, {}), since: link.acceptedAt, createdAt: link.createdAt, proposedGoal: link.proposedGoal ?? null, trainerViewedAt: link.trainerViewedAt },
    trainer: card,
    upcoming: await decorateSessions(upcoming.filter((s) => ['SCHEDULED', 'CANCELLED'].includes(s.status) && new Date(s.startsAt).getTime() > now.getTime() - 3 * 3600000).slice(0, 30), db),
    openSlots: await decorateSessions(openSlots.slice(0, 40), db),
    past: await decorateSessions(past, db),
    plan: mealPlanPublic(plan),
    nutrition: nutrition ? { days: nutrition.days, score: adherenceScore(nutrition.days) } : null,
    stats: { done: stats?.done ?? 0, noShow: stats?.noShow ?? 0 },
    consentVersion: CONSENT_VERSION,
  };
}

// ——— admin ———

export async function adminTrainerList({ status = 'PENDING' } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT t.*, u."fullName", u.phone, u.email, u."createdAt" AS "accountCreatedAt", u.status AS "accountStatus",
      (SELECT count(*)::int FROM "TrainerLink" l WHERE l."trainerId" = t."userId" AND l.status = 'ACTIVE') AS clients
    FROM "TrainerProfile" t JOIN "User" u ON u.id = t."userId"
    WHERE (${status} = 'ALL' OR t.status = ${status})
    ORDER BY t."submittedAt" DESC LIMIT 300`;
  const gyms = await gymsByIds(rows.flatMap((r) => asArray(r.gymIds)), db);
  const [counts] = await db.$queryRaw`SELECT count(*) FILTER (WHERE status = 'PENDING')::int AS pending, count(*) FILTER (WHERE status = 'VERIFIED')::int AS verified,
      count(*) FILTER (WHERE status = 'REJECTED')::int AS rejected, count(*) FILTER (WHERE status = 'SUSPENDED')::int AS suspended FROM "TrainerProfile"`;
  const [linkCounts] = await db.$queryRaw`SELECT count(*) FILTER (WHERE status = 'ACTIVE')::int AS active FROM "TrainerLink"`;
  const [sessionCounts] = await db.$queryRaw`SELECT count(*) FILTER (WHERE status = 'SCHEDULED' AND "startsAt" > now())::int AS upcoming,
      count(*) FILTER (WHERE status = 'DONE')::int AS done FROM "TrainerSession"`;
  return {
    counts: { ...counts, activeLinks: linkCounts?.active ?? 0, upcomingSessions: sessionCounts?.upcoming ?? 0, doneSessions: sessionCounts?.done ?? 0 },
    trainers: rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      fullName: r.fullName,
      phone: r.phone ? `${String(r.phone).slice(0, 4)}•••${String(r.phone).slice(-2)}` : null,
      phoneVerified: Boolean(r.phone),
      email: r.email && !/@phone\.medicard\.ge$/.test(r.email) ? r.email : null,
      accountCreatedAt: r.accountCreatedAt,
      accountStatus: r.accountStatus,
      bio: r.bio || '',
      specialties: asArray(r.specialties).map((k) => SPECIALTIES[k] || k),
      experienceYears: r.experienceYears,
      instagram: r.instagram,
      gyms: asArray(r.gymIds).map((id) => gyms.get(id)).filter(Boolean).map(gymPublic),
      certificates: asArray(r.certificates).map((c) => ({ id: c.id, title: c.title, issuer: c.issuer, year: c.year, file: String(c.fileKey || '').split('/').pop() })),
      status: r.status,
      reviewNote: r.reviewNote,
      reviewedBy: r.reviewedBy,
      reviewedAt: r.reviewedAt,
      submittedAt: r.submittedAt,
      clients: r.clients,
    })),
  };
}

export async function adminReviewTrainer({ userId, action, note, admin }, db = prisma) {
  const next = { approve: 'VERIFIED', reject: 'REJECTED', suspend: 'SUSPENDED', restore: 'VERIFIED' }[action];
  if (!next) throw coachError(400, 'უცნობი მოქმედება.', null, 'Unknown action.');
  const [row] = await db.$queryRaw`UPDATE "TrainerProfile" SET status = ${next}, "reviewNote" = ${note || null}, "reviewedBy" = ${admin.email || admin.id},
      "reviewedAt" = CURRENT_TIMESTAMP, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = ${userId} RETURNING *`;
  if (!row) throw coachError(404, 'ტრენერი ვერ მოიძებნა.', null, 'Trainer not found.');
  if (next === 'SUSPENDED') {
    const links = await db.$queryRaw`SELECT id FROM "TrainerLink" WHERE "trainerId" = ${userId} AND status IN ('ACTIVE', 'REQUESTED')`;
    for (const l of links) await endLink({ linkId: l.id, by: 'ADMIN', actorId: userId }, db);
  }
  const copy = {
    VERIFIED: { title: 'ტრენერის პროფილი დადასტურდა ✅', body: 'გახსენი ტრენერის რეჟიმი და მოიწვიე პირველი კლიენტი.', route: '/coach',
      en: { title: 'Trainer profile verified ✅', body: 'Open trainer mode and invite your first client.' } },
    REJECTED: { title: 'ტრენერის განაცხადი', body: 'განაცხადს დაზუსტება სჭირდება. ნახე კომენტარი.', route: '/trainer/apply',
      en: { title: 'Trainer application', body: 'Your application needs a few changes. See the comment.' } },
    SUSPENDED: { title: 'ტრენერის პროფილი შეჩერდა', body: 'დეტალებისთვის დაუკავშირდი მხარდაჭერას.', route: '/trainer/apply',
      en: { title: 'Trainer profile suspended', body: 'Please contact support for details.' } },
  }[next];
  void notifyCoach(userId, copy, db);
  return row;
}

export async function adminGyms({ status = 'ALL' } = {}, db = prisma) {
  const rows = await db.$queryRaw`SELECT g.*, (SELECT count(*)::int FROM "TrainerProfile" t WHERE t."gymIds" ? g.id AND t.status = 'VERIFIED') AS trainers
    FROM "Gym" g WHERE (${status} = 'ALL' OR g.status = ${status}) ORDER BY (g.status = 'PROPOSED') DESC, g.brand, g.city, g.name LIMIT 1000`;
  return rows;
}

export async function adminSetGym(id, patch, db = prisma) {
  const [row] = await db.$queryRaw`UPDATE "Gym" SET
      status = coalesce(${patch.status ?? null}, status), brand = coalesce(${patch.brand ?? null}, brand), name = coalesce(${patch.name ?? null}, name),
      city = coalesce(${patch.city ?? null}, city), address = coalesce(${patch.address ?? null}, address), "brandKa" = coalesce(${patch.brandKa ?? null}, "brandKa"),
      "updatedAt" = CURRENT_TIMESTAMP WHERE id = ${id} RETURNING *`;
  if (!row) throw coachError(404, 'დარბაზი ვერ მოიძებნა.', null, 'Gym not found.');
  return row;
}

export async function adminAddGym(body, db = prisma) {
  const id = `gym-a-${randomUUID()}`;
  const [row] = await db.$queryRaw`INSERT INTO "Gym" (id, brand, "brandKa", name, city, district, address, source, status)
    VALUES (${id}, ${body.brand}, ${body.brandKa || null}, ${body.name || body.brand}, ${body.city}, ${body.district || null}, ${body.address || null}, 'admin', 'ACTIVE') RETURNING *`;
  return row;
}

/** Storage keys to remove when an account is deleted (rows cascade with the user). */
export async function coachFilesOf(userId, db = prisma) {
  const [probe] = await db.$queryRaw`SELECT to_regclass('"ProgressPhoto"') IS NOT NULL AS ok`;
  if (!probe?.ok) return [];
  const photos = await db.$queryRaw`SELECT "fileKey" FROM "ProgressPhoto" WHERE "userId" = ${userId}`;
  const [profile] = await db.$queryRaw`SELECT certificates FROM "TrainerProfile" WHERE "userId" = ${userId}`;
  const [avatar] = await db.$queryRaw`SELECT "fileKey" FROM "UserAvatar" WHERE "userId" = ${userId}`.catch(() => []);
  return [...photos.map((p) => p.fileKey), ...asArray(profile?.certificates).map((c) => c.fileKey), avatar?.fileKey].filter(Boolean);
}
