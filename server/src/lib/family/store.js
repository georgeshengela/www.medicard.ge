// MEDIFAMILY data access (raw SQL on the tables from prisma/20261012-family.sql). Every read and write goes
// through "FamilyAccess": a person sees a child only while they hold a row there (OWNER today).
import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { toYmd } from './age.js';

export const MAX_CHILDREN = 12;
export const FAMILY_CONSENT_VERSION = 'family-2026-10-12';
export const FAMILY_NOT_FOUND = { error: 'ბავშვის პროფილი ვერ მოიძებნა.', errorEn: 'Child profile not found.', code: 'FAMILY_NOT_FOUND' };

export function isFamilySchemaMissing(error) {
  return error?.code === 'P2010' && /Family\w+.*does not exist|relation "Family/i.test(String(error?.meta?.message || error?.message || ''))
    || /relation "Family\w*" does not exist/i.test(String(error?.message || ''));
}

const num = (v) => (v == null ? null : Number(v));
/** Runs fn in a transaction, or inside the caller's one when db already is a transaction client. */
const inTx = (db, fn, opts) => (typeof db.$transaction === 'function' ? db.$transaction(fn, opts) : fn(db));

export function publicMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    birthDate: toYmd(row.birthDate),
    sex: row.sex,
    gestationWeeks: row.gestationWeeks == null ? null : Number(row.gestationWeeks),
    birthWeightG: row.birthWeightG == null ? null : Number(row.birthWeightG),
    birthLengthCm: num(row.birthLengthCm),
    bloodGroup: row.bloodGroup || null,
    color: row.color || null,
    feedingMode: row.feedingMode || null,
    notes: row.notes || null,
    role: row.role || 'OWNER',
    createdAt: row.createdAt,
  };
}

export async function listMembers(userId, db = prisma) {
  return db.$queryRaw`SELECT m.*, a.role FROM "FamilyMember" m JOIN "FamilyAccess" a ON a."memberId" = m.id
    WHERE a."userId" = ${userId} AND m."archivedAt" IS NULL ORDER BY m."birthDate" ASC, m."createdAt" ASC`;
}

export async function findMember(userId, memberId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT m.*, a.role FROM "FamilyMember" m JOIN "FamilyAccess" a ON a."memberId" = m.id
    WHERE a."userId" = ${userId} AND m.id = ${memberId} AND m."archivedAt" IS NULL LIMIT 1`;
  return row || null;
}

export async function countMembers(userId, db = prisma) {
  const [row] = await db.$queryRaw`SELECT count(*)::int AS n FROM "FamilyMember" WHERE "ownerId" = ${userId} AND "archivedAt" IS NULL`;
  return row?.n ?? 0;
}

export async function createMember(userId, input, db = prisma) {
  const id = randomUUID();
  return inTx(db, async (tx) => {
    const [row] = await tx.$queryRaw`INSERT INTO "FamilyMember" (id, "ownerId", kind, name, "birthDate", sex, "gestationWeeks", "birthWeightG", "birthLengthCm", "bloodGroup", color, "feedingMode", notes, "consentVersion")
      VALUES (${id}, ${userId}, 'CHILD', ${input.name}, ${input.birthDate}::date, ${input.sex}, ${input.gestationWeeks ?? null}, ${input.birthWeightG ?? null}, ${input.birthLengthCm ?? null},
        ${input.bloodGroup ?? null}, ${input.color ?? null}, ${input.feedingMode ?? null}, ${input.notes ?? null}, ${FAMILY_CONSENT_VERSION})
      RETURNING *`;
    await tx.$executeRaw`INSERT INTO "FamilyAccess" ("memberId", "userId", role) VALUES (${id}, ${userId}, 'OWNER')`;
    return { ...row, role: 'OWNER' };
  });
}

const MEMBER_FIELDS = ['name', 'birthDate', 'sex', 'gestationWeeks', 'birthWeightG', 'birthLengthCm', 'bloodGroup', 'color', 'feedingMode', 'notes'];

export async function updateMember(memberId, patch, db = prisma) {
  const current = await db.$queryRaw`SELECT * FROM "FamilyMember" WHERE id = ${memberId}`;
  if (!current[0]) return null;
  const next = { ...current[0] };
  for (const key of MEMBER_FIELDS) if (Object.prototype.hasOwnProperty.call(patch, key)) next[key] = patch[key];
  const [row] = await db.$queryRaw`UPDATE "FamilyMember" SET name = ${next.name}, "birthDate" = ${toYmd(next.birthDate)}::date, sex = ${next.sex},
      "gestationWeeks" = ${next.gestationWeeks ?? null}, "birthWeightG" = ${next.birthWeightG ?? null}, "birthLengthCm" = ${next.birthLengthCm ?? null},
      "bloodGroup" = ${next.bloodGroup ?? null}, color = ${next.color ?? null}, "feedingMode" = ${next.feedingMode ?? null}, notes = ${next.notes ?? null},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${memberId} RETURNING *`;
  return row;
}

/** Permanent: the child and every record about them (Law 3144 Art. 16 — erase on request). */
export async function deleteMember(memberId, db = prisma) {
  await db.$executeRaw`DELETE FROM "FamilyMember" WHERE id = ${memberId}`;
}

// ── Health items ─────────────────────────────────────────────────────────────────────────────
export function publicHealthItem(row) {
  return { id: row.id, kind: row.kind, name: row.name, detail: row.detail || null, severity: row.severity || null, active: row.active, createdAt: row.createdAt };
}

export async function listHealthItems(memberId, db = prisma) {
  return db.$queryRaw`SELECT * FROM "FamilyHealthItem" WHERE "memberId" = ${memberId} ORDER BY active DESC, "createdAt" DESC`;
}

export async function createHealthItem(memberId, userId, input, db = prisma) {
  const [row] = await db.$queryRaw`INSERT INTO "FamilyHealthItem" (id, "memberId", kind, name, detail, severity, "createdById")
    VALUES (${randomUUID()}, ${memberId}, ${input.kind}, ${input.name}, ${input.detail ?? null}, ${input.severity ?? null}, ${userId}) RETURNING *`;
  return row;
}

export async function updateHealthItem(memberId, itemId, input, db = prisma) {
  const [row] = await db.$queryRaw`UPDATE "FamilyHealthItem" SET name = COALESCE(${input.name ?? null}, name), detail = ${input.detail ?? null},
      severity = ${input.severity ?? null}, active = COALESCE(${input.active ?? null}::boolean, active), "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${itemId} AND "memberId" = ${memberId} RETURNING *`;
  return row || null;
}

export async function deleteHealthItem(memberId, itemId, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyHealthItem" WHERE id = ${itemId} AND "memberId" = ${memberId}`;
}

// ── Vaccines ────────────────────────────────────────────────────────────────────────────────
export function publicDose(row) {
  return {
    id: row.id, code: row.code, dose: Number(row.dose), status: row.status, givenOn: toYmd(row.givenOn), nextOn: toYmd(row.nextOn),
    place: row.place || null, lot: row.lot || null, reaction: row.reaction || null, note: row.note || null, updatedAt: row.updatedAt,
  };
}

export async function listDoses(memberId, db = prisma) {
  return db.$queryRaw`SELECT * FROM "FamilyVaccineDose" WHERE "memberId" = ${memberId} ORDER BY code, dose`;
}

export async function upsertDose(memberId, userId, { code, dose, status, givenOn, nextOn, place, lot, reaction, note }, db = prisma) {
  const [row] = await db.$queryRaw`INSERT INTO "FamilyVaccineDose" (id, "memberId", code, dose, status, "givenOn", "nextOn", place, lot, reaction, note, "createdById")
    VALUES (${randomUUID()}, ${memberId}, ${code}, ${dose}, ${status}, ${givenOn ?? null}::date, ${nextOn ?? null}::date, ${place ?? null}, ${lot ?? null}, ${reaction ?? null}, ${note ?? null}, ${userId})
    ON CONFLICT ("memberId", code, dose) DO UPDATE SET status = EXCLUDED.status, "givenOn" = EXCLUDED."givenOn", "nextOn" = EXCLUDED."nextOn",
      place = EXCLUDED.place, lot = EXCLUDED.lot, reaction = EXCLUDED.reaction, note = EXCLUDED.note, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *`;
  return row;
}

export async function deleteDose(memberId, code, dose, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyVaccineDose" WHERE "memberId" = ${memberId} AND code = ${code} AND dose = ${dose}`;
}

export async function deleteDoseById(memberId, id, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyVaccineDose" WHERE "memberId" = ${memberId} AND id = ${id}`;
}

/** Marks every listed calendar dose as given (date unknown) unless a record already exists. */
export async function markDosesGiven(memberId, userId, doses, db = prisma) {
  let added = 0;
  await inTx(db, async (tx) => {
    for (const { code, dose } of doses) {
      added += await tx.$executeRaw`INSERT INTO "FamilyVaccineDose" (id, "memberId", code, dose, status, "createdById")
        VALUES (${randomUUID()}, ${memberId}, ${code}, ${dose}, 'GIVEN_UNKNOWN_DATE', ${userId}) ON CONFLICT ("memberId", code, dose) DO NOTHING`;
    }
  });
  return added;
}

export async function nextExtraDoseNumber(memberId, code, db = prisma) {
  const [row] = await db.$queryRaw`SELECT COALESCE(max(dose), 0)::int AS n FROM "FamilyVaccineDose" WHERE "memberId" = ${memberId} AND code = ${code}`;
  return (row?.n ?? 0) + 1;
}

// ── Measurements ─────────────────────────────────────────────────────────────────────────────
export function publicMeasurement(row) {
  return {
    id: row.id, measuredOn: toYmd(row.measuredOn), weightKg: num(row.weightKg), heightCm: num(row.heightCm), headCm: num(row.headCm),
    position: row.position || null, note: row.note || null, createdAt: row.createdAt,
  };
}

export async function listMeasurements(memberId, db = prisma) {
  return db.$queryRaw`SELECT * FROM "FamilyMeasurement" WHERE "memberId" = ${memberId} ORDER BY "measuredOn" ASC, "createdAt" ASC`;
}

export async function createMeasurement(memberId, userId, m, db = prisma) {
  const [row] = await db.$queryRaw`INSERT INTO "FamilyMeasurement" (id, "memberId", "measuredOn", "weightKg", "heightCm", "headCm", position, note, "createdById")
    VALUES (${randomUUID()}, ${memberId}, ${m.measuredOn}::date, ${m.weightKg ?? null}, ${m.heightCm ?? null}, ${m.headCm ?? null}, ${m.position ?? null}, ${m.note ?? null}, ${userId})
    RETURNING *`;
  return row;
}

export async function updateMeasurement(memberId, id, m, db = prisma) {
  const [row] = await db.$queryRaw`UPDATE "FamilyMeasurement" SET "measuredOn" = ${m.measuredOn}::date, "weightKg" = ${m.weightKg ?? null}, "heightCm" = ${m.heightCm ?? null},
      "headCm" = ${m.headCm ?? null}, position = ${m.position ?? null}, note = ${m.note ?? null}
    WHERE id = ${id} AND "memberId" = ${memberId} RETURNING *`;
  return row || null;
}

export async function deleteMeasurement(memberId, id, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyMeasurement" WHERE id = ${id} AND "memberId" = ${memberId}`;
}

// ── Day log (feeds, temperature, symptoms, medicine, notes) ─────────────────────────────────
export function publicLog(row) {
  return { id: row.id, kind: row.kind, at: row.at, endAt: row.endAt || null, data: row.data || {}, createdAt: row.createdAt };
}

export async function listLogs(memberId, { kinds = null, from = null, to = null, limit = 200 } = {}, db = prisma) {
  const fromTs = from ? new Date(from) : new Date(Date.now() - 30 * 86400000);
  const toTs = to ? new Date(to) : new Date(Date.now() + 86400000);
  const rows = await db.$queryRaw`SELECT * FROM "FamilyLog" WHERE "memberId" = ${memberId} AND at >= ${fromTs} AND at < ${toTs}
    ORDER BY at DESC LIMIT ${Math.min(Math.max(1, limit), 500)}`;
  return kinds ? rows.filter((r) => kinds.includes(r.kind)) : rows;
}

export async function createLog(memberId, userId, { kind, at, endAt, data, clientRequestId }, db = prisma) {
  const [row] = await db.$queryRaw`INSERT INTO "FamilyLog" (id, "memberId", kind, at, "endAt", data, "clientRequestId", "createdById")
    VALUES (${randomUUID()}, ${memberId}, ${kind}, ${new Date(at)}, ${endAt ? new Date(endAt) : null}, ${JSON.stringify(data || {})}::jsonb, ${clientRequestId ?? null}, ${userId})
    ON CONFLICT ("memberId", "clientRequestId") DO UPDATE SET "updatedAt" = "FamilyLog"."updatedAt"
    RETURNING *`;
  return row;
}

export async function updateLog(memberId, id, { at, endAt, data }, db = prisma) {
  const [row] = await db.$queryRaw`UPDATE "FamilyLog" SET at = COALESCE(${at ? new Date(at) : null}, at), "endAt" = ${endAt ? new Date(endAt) : null},
      data = COALESCE(${data ? JSON.stringify(data) : null}::jsonb, data), "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = ${id} AND "memberId" = ${memberId} RETURNING *`;
  return row || null;
}

export async function deleteLog(memberId, id, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyLog" WHERE id = ${id} AND "memberId" = ${memberId}`;
}

// ── Foods and milestones ────────────────────────────────────────────────────────────────────
export async function listFoods(memberId, db = prisma) {
  return db.$queryRaw`SELECT * FROM "FamilyFoodIntro" WHERE "memberId" = ${memberId}`;
}

export async function upsertFood(memberId, foodKey, { status, firstOn, note }, db = prisma) {
  const [row] = await db.$queryRaw`INSERT INTO "FamilyFoodIntro" ("memberId", "foodKey", status, "firstOn", note)
    VALUES (${memberId}, ${foodKey}, ${status}, ${firstOn ?? null}::date, ${note ?? null})
    ON CONFLICT ("memberId", "foodKey") DO UPDATE SET status = EXCLUDED.status, "firstOn" = COALESCE(EXCLUDED."firstOn", "FamilyFoodIntro"."firstOn"),
      note = EXCLUDED.note, "updatedAt" = CURRENT_TIMESTAMP
    RETURNING *`;
  return row;
}

export async function deleteFood(memberId, foodKey, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyFoodIntro" WHERE "memberId" = ${memberId} AND "foodKey" = ${foodKey}`;
}

export async function listMilestones(memberId, db = prisma) {
  const rows = await db.$queryRaw`SELECT * FROM "FamilyMilestone" WHERE "memberId" = ${memberId}`;
  return Object.fromEntries(rows.map((r) => [r.key, { status: r.status, markedOn: toYmd(r.markedOn) }]));
}

export async function upsertMilestone(memberId, key, status, markedOn, db = prisma) {
  await db.$executeRaw`INSERT INTO "FamilyMilestone" ("memberId", key, status, "markedOn") VALUES (${memberId}, ${key}, ${status}, ${markedOn}::date)
    ON CONFLICT ("memberId", key) DO UPDATE SET status = EXCLUDED.status, "markedOn" = EXCLUDED."markedOn", "updatedAt" = CURRENT_TIMESTAMP`;
}

export async function deleteMilestone(memberId, key, db = prisma) {
  return db.$executeRaw`DELETE FROM "FamilyMilestone" WHERE "memberId" = ${memberId} AND key = ${key}`;
}
