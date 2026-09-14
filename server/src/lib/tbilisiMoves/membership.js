import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { writeAdminAudit } from '../adminAudit.js';
import { DISTRICT_STATUS, MEMBERSHIP_STATUS } from './constants.js';
import { featureDisabled, tbilisiMovesError } from './errors.js';
import { loadLiveConfig, publicConfig, requireSchema, resolvedDistrictTarget, scoringSnapshot } from './config.js';
import { addDaysYmd, dateInPeriod, tbilisiClock, tbilisiMidnight, tbilisiYmd } from './time.js';

export async function lockUserTx(tx, userId) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`tbilisi-moves:${userId}`}))`;
}

async function lockPendingApply(tx) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'tbilisi-moves:pending-apply'}))`;
}

function publicDistrict(row, config) {
  return {
    id: row.id,
    slug: row.slug,
    nameKa: row.nameKa,
    sortOrder: row.sortOrder,
    status: row.status,
    dailyTargetOverride: row.dailyTargetOverride,
    target: resolvedDistrictTarget(row, config),
    targetSource: row.dailyTargetOverride == null ? 'default' : 'override',
    revision: row.revision,
  };
}

export async function listDistricts(db = prisma) {
  const config = await loadLiveConfig(db);
  const rows = await db.tbilisiMovesDistrict.findMany({ orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] });
  return { config, districts: rows.map((row) => publicDistrict(row, config)) };
}

export async function requireActiveDistrict(db, districtId) {
  const district = await db.tbilisiMovesDistrict.findUnique({ where: { id: districtId } });
  if (!district || district.status !== DISTRICT_STATUS.ACTIVE) {
    throw tbilisiMovesError(400, 'DISTRICT_UNAVAILABLE', 'რაიონი მიუწვდომელია.');
  }
  return district;
}

function serializeMembership(row, now = new Date()) {
  if (!row) {
    return {
      enrolled: false,
      status: null,
      districtId: null,
      pendingDistrictId: null,
      pendingEffectiveDate: null,
      pendingActivationAt: null,
      lockUntilDate: null,
      nextChangeEligibleOn: null,
      changeLocked: false,
      publicHandle: null,
      publicAvatarId: null,
    };
  }
  const today = tbilisiYmd(now);
  const pendingActivationAt = row.pendingEffectiveDate ? tbilisiMidnight(row.pendingEffectiveDate).toISOString() : null;
  return {
    enrolled: row.status === MEMBERSHIP_STATUS.ACTIVE,
    status: row.status,
    districtId: row.districtId,
    district: row.district
      ? { id: row.district.id, slug: row.district.slug, nameKa: row.district.nameKa }
      : null,
    pendingDistrictId: row.pendingDistrictId,
    pendingDistrict: row.pendingDistrict
      ? { id: row.pendingDistrict.id, slug: row.pendingDistrict.slug, nameKa: row.pendingDistrict.nameKa }
      : null,
    pendingEffectiveDate: row.pendingEffectiveDate,
    pendingActivationAt,
    lockUntilDate: row.lockUntilDate,
    nextChangeEligibleOn: row.lockUntilDate,
    changeLocked: today < row.lockUntilDate,
    publicHandle: row.publicHandle,
    publicAvatarId: row.publicAvatarId,
    enrolledAt: row.enrolledAt,
    optedInAt: row.optedInAt,
  };
}

async function applyOnePending(tx, row, today, cooldownDays) {
  if (!row.pendingDistrictId || !row.pendingEffectiveDate || row.pendingEffectiveDate > today) return row;
  if (row.status !== MEMBERSHIP_STATUS.ACTIVE) {
    return tx.tbilisiMovesMembership.update({
      where: { userId: row.userId },
      data: { pendingDistrictId: null, pendingEffectiveDate: null, pendingRequestedAt: null },
    });
  }

  const open = await tx.tbilisiMovesMembershipPeriod.findFirst({
    where: { userId: row.userId, endDate: null },
  });
  if (open?.startDate === row.pendingEffectiveDate) {
    return tx.tbilisiMovesMembership.update({
      where: { userId: row.userId },
      data: { pendingDistrictId: null, pendingEffectiveDate: null, pendingRequestedAt: null },
      include: { district: true, pendingDistrict: true },
    });
  }
  if (open) {
    await tx.tbilisiMovesMembershipPeriod.update({
      where: { id: open.id },
      data: { endDate: row.pendingEffectiveDate },
    });
  }
  await tx.tbilisiMovesMembershipPeriod.create({
    data: {
      id: randomUUID(),
      userId: row.userId,
      districtId: row.pendingDistrictId,
      startDate: row.pendingEffectiveDate,
      endDate: null,
    },
  });

  return tx.tbilisiMovesMembership.update({
    where: { userId: row.userId },
    data: {
      districtId: row.pendingDistrictId,
      pendingDistrictId: null,
      pendingEffectiveDate: null,
      pendingRequestedAt: null,
      lockUntilDate: addDaysYmd(row.pendingEffectiveDate, cooldownDays),
    },
    include: { district: true, pendingDistrict: true },
  });
}

export async function applyDuePendingForUser(tx, userId, now = new Date()) {
  const today = tbilisiYmd(now);
  const config = await loadLiveConfig(tx);
  const row = await tx.tbilisiMovesMembership.findUnique({
    where: { userId },
    include: { district: true, pendingDistrict: true },
  });
  if (!row) return null;
  return applyOnePending(tx, row, today, config.cooldownDays);
}

export async function applyAllDuePending(db = prisma, now = new Date()) {
  const today = tbilisiYmd(now);
  await db.$transaction(async (tx) => {
    await lockPendingApply(tx);
    const config = await loadLiveConfig(tx);
    const due = await tx.tbilisiMovesMembership.findMany({
      where: {
        status: MEMBERSHIP_STATUS.ACTIVE,
        pendingDistrictId: { not: null },
        pendingEffectiveDate: { lte: today },
      },
    });
    for (const row of due) {
      await applyOnePending(tx, row, today, config.cooldownDays);
    }
  });
}

export async function districtIdForDate(db, userId, ymd) {
  const period = await db.tbilisiMovesMembershipPeriod.findFirst({
    where: {
      userId,
      startDate: { lte: ymd },
      OR: [{ endDate: null }, { endDate: { gt: ymd } }],
    },
    orderBy: { startDate: 'desc' },
  });
  return period?.districtId ?? null;
}

export function ensureFeature(config) {
  if (!config.featureEnabled) throw featureDisabled();
}

export function ensureEnrollmentOpen(config) {
  if (!config.enrollmentOpen) {
    throw tbilisiMovesError(409, 'ENROLLMENT_CLOSED', 'რეგისტრაცია ამჟამად დახურულია.');
  }
}

/**
 * Leave/rejoin must not bypass cooldown, and a civil day must never switch districts
 * by rewriting an existing period's districtId.
 */
export function evaluateRejoin({
  today,
  lockUntilDate,
  currentDistrictId,
  requestedDistrictId,
  todayPeriodDistrictId = null,
}) {
  const sameDistrict = currentDistrictId === requestedDistrictId;
  const locked = Boolean(lockUntilDate && today < lockUntilDate);
  if (locked && !sameDistrict) {
    return { ok: false, code: 'DISTRICT_LOCKED', lockUntilDate, preserveLock: true };
  }
  if (todayPeriodDistrictId && todayPeriodDistrictId !== requestedDistrictId) {
    return {
      ok: false,
      code: 'SAME_DAY_DISTRICT_CHANGE',
      lockUntilDate: addDaysYmd(today, 1),
      preserveLock: locked,
    };
  }
  return { ok: true, preserveLock: locked, lockUntilDate: locked ? lockUntilDate : null };
}

export async function getMembershipView(userId, now = new Date()) {
  const config = await loadLiveConfig();
  ensureFeature(config);
  const row = await prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    return applyDuePendingForUser(tx, userId, now);
  });
  const membership = await prisma.tbilisiMovesMembership.findUnique({
    where: { userId },
    include: { district: true, pendingDistrict: true },
  });
  const view = serializeMembership(membership || row, now);
  return {
    date: tbilisiYmd(now),
    clock: tbilisiClock(now),
    config: {
      enrollmentOpen: config.enrollmentOpen,
      ingestionPaused: config.ingestionPaused,
      competitionPaused: config.competitionPaused,
      pilotMode: true,
      cooldownDays: config.cooldownDays,
      competitiveCap: config.competitiveCap,
      defaultDailyTarget: config.defaultDailyTarget,
      minParticipantsForRank: config.minParticipantsForRank,
      lateSyncGraceHours: config.lateSyncGraceHours,
    },
    sync: {
      schemaReady: true,
      featureEnabled: true,
      enrollmentOpen: config.enrollmentOpen,
      ingestionPaused: config.ingestionPaused,
      competitionPaused: config.competitionPaused,
      ingestEligible: Boolean(view.enrolled) && !config.ingestionPaused,
    },
    membership: view,
  };
}

export async function enrollUser({ userId, districtId, publicHandle, publicAvatarId, now = new Date() }) {
  const config = await loadLiveConfig();
  ensureFeature(config);
  ensureEnrollmentOpen(config);
  if (config.competitionPaused) {
    throw tbilisiMovesError(409, 'COMPETITION_PAUSED', 'შეჯიბრი დროებით შეჩერებულია.');
  }

  return prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    await requireActiveDistrict(tx, districtId);
    const today = tbilisiYmd(now);
    let row = await tx.tbilisiMovesMembership.findUnique({ where: { userId } });
    if (row?.status === MEMBERSHIP_STATUS.ACTIVE) {
      throw tbilisiMovesError(409, 'ALREADY_ENROLLED', 'უკვე ხართ რეგისტრირებული.');
    }

    if (row) {
      const covering = await tx.tbilisiMovesMembershipPeriod.findMany({
        where: {
          userId,
          startDate: { lte: today },
          OR: [{ endDate: null }, { endDate: { gt: today } }],
        },
        orderBy: { startDate: 'desc' },
      });
      const todayPeriod = covering.find((period) => period.startDate === today) || null;
      const decision = evaluateRejoin({
        today,
        lockUntilDate: row.lockUntilDate,
        currentDistrictId: row.districtId,
        requestedDistrictId: districtId,
        todayPeriodDistrictId: todayPeriod?.districtId ?? null,
      });
      if (!decision.ok) {
        const message =
          decision.code === 'SAME_DAY_DISTRICT_CHANGE'
            ? 'დღეს რაიონის შეცვლა შეუძლებელია. სცადეთ ხვალ.'
            : 'რაიონის შეცვლა ჯერ დაბლოკილია.';
        throw tbilisiMovesError(409, decision.code, message, { lockUntilDate: decision.lockUntilDate });
      }

      const lockUntilDate = decision.preserveLock
        ? row.lockUntilDate
        : addDaysYmd(today, config.cooldownDays);
      const data = {
        userId,
        status: MEMBERSHIP_STATUS.ACTIVE,
        optedInAt: now,
        publicBoardConsentAt: now,
        districtId,
        publicHandle,
        publicAvatarId: publicAvatarId || null,
        enrolledAt: now,
        lockUntilDate,
        pendingDistrictId: null,
        pendingEffectiveDate: null,
        pendingRequestedAt: null,
        leftAt: null,
      };

      for (const period of covering) {
        if (period.startDate === today) {
          await tx.tbilisiMovesMembershipPeriod.update({
            where: { id: period.id },
            data: { endDate: null },
          });
        } else {
          await tx.tbilisiMovesMembershipPeriod.update({
            where: { id: period.id },
            data: { endDate: today },
          });
        }
      }
      const hasToday = Boolean(todayPeriod);
      row = await tx.tbilisiMovesMembership.update({
        where: { userId },
        data,
        include: { district: true, pendingDistrict: true },
      });
      if (!hasToday) {
        await tx.tbilisiMovesMembershipPeriod.create({
          data: { id: randomUUID(), userId, districtId, startDate: today, endDate: null },
        });
      }
      return serializeMembership(row, now);
    }

    const lockUntilDate = addDaysYmd(today, config.cooldownDays);
    const data = {
      userId,
      status: MEMBERSHIP_STATUS.ACTIVE,
      optedInAt: now,
      publicBoardConsentAt: now,
      districtId,
      publicHandle,
      publicAvatarId: publicAvatarId || null,
      enrolledAt: now,
      lockUntilDate,
      pendingDistrictId: null,
      pendingEffectiveDate: null,
      pendingRequestedAt: null,
      leftAt: null,
    };

    row = await tx.tbilisiMovesMembership.create({ data, include: { district: true, pendingDistrict: true } });
    await tx.tbilisiMovesMembershipPeriod.create({
      data: { id: randomUUID(), userId, districtId, startDate: today, endDate: null },
    });
    return serializeMembership(row, now);
  });
}

export async function requestDistrictChange({ userId, districtId, now = new Date() }) {
  const config = await loadLiveConfig();
  ensureFeature(config);
  ensureEnrollmentOpen(config);
  if (config.competitionPaused) {
    throw tbilisiMovesError(409, 'COMPETITION_PAUSED', 'შეჯიბრი დროებით შეჩერებულია.');
  }

  return prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    await applyDuePendingForUser(tx, userId, now);
    await requireActiveDistrict(tx, districtId);
    const today = tbilisiYmd(now);
    const row = await tx.tbilisiMovesMembership.findUnique({
      where: { userId },
      include: { district: true, pendingDistrict: true },
    });
    if (!row || row.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw tbilisiMovesError(409, 'NOT_ENROLLED', 'ჯერ აირჩიეთ რაიონი.');
    }
    if (today < row.lockUntilDate) {
      throw tbilisiMovesError(409, 'DISTRICT_LOCKED', 'რაიონის შეცვლა ჯერ დაბლოკილია.', {
        lockUntilDate: row.lockUntilDate,
      });
    }
    if (row.pendingDistrictId) {
      throw tbilisiMovesError(409, 'CHANGE_PENDING', 'უკვე გაქვთ მოლოდინში რაიონის შეცვლა.');
    }
    if (districtId === row.districtId) {
      throw tbilisiMovesError(400, 'SAME_DISTRICT', 'ეს რაიონი უკვე არჩეულია.');
    }

    const pendingEffectiveDate = addDaysYmd(today, 1);
    const updated = await tx.tbilisiMovesMembership.update({
      where: { userId },
      data: {
        pendingDistrictId: districtId,
        pendingEffectiveDate,
        pendingRequestedAt: now,
      },
      include: { district: true, pendingDistrict: true },
    });
    return serializeMembership(updated, now);
  });
}

export async function cancelDistrictChange({ userId, now = new Date() }) {
  const config = await loadLiveConfig();
  ensureFeature(config);

  return prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    await applyDuePendingForUser(tx, userId, now);
    const row = await tx.tbilisiMovesMembership.findUnique({
      where: { userId },
      include: { district: true, pendingDistrict: true },
    });
    if (!row?.pendingDistrictId || !row.pendingEffectiveDate) {
      throw tbilisiMovesError(409, 'NO_PENDING_CHANGE', 'მოლოდინში შეცვლა არ არის.');
    }
    if (now.getTime() >= tbilisiMidnight(row.pendingEffectiveDate).getTime()) {
      throw tbilisiMovesError(409, 'CHANGE_ALREADY_EFFECTIVE', 'შეცვლა უკვე ძალაშია.');
    }
    const lockUntilDate = row.lockUntilDate;
    const updated = await tx.tbilisiMovesMembership.update({
      where: { userId },
      data: {
        pendingDistrictId: null,
        pendingEffectiveDate: null,
        pendingRequestedAt: null,
      },
      include: { district: true, pendingDistrict: true },
    });
    const view = serializeMembership(updated, now);
    view.lockUntilDate = lockUntilDate;
    return view;
  });
}

export async function leaveCompetition({ userId, now = new Date() }) {
  const config = await loadLiveConfig();
  ensureFeature(config);

  return prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    await applyDuePendingForUser(tx, userId, now);
    const row = await tx.tbilisiMovesMembership.findUnique({ where: { userId } });
    if (!row || row.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw tbilisiMovesError(409, 'NOT_ENROLLED', 'ჯერ აირჩიეთ რაიონი.');
    }
    const today = tbilisiYmd(now);
    const open = await tx.tbilisiMovesMembershipPeriod.findFirst({
      where: { userId, endDate: null },
    });
    if (open) {
      const endDate = addDaysYmd(today, 1);
      if (endDate > open.startDate) {
        await tx.tbilisiMovesMembershipPeriod.update({ where: { id: open.id }, data: { endDate } });
      }
    }
    const updated = await tx.tbilisiMovesMembership.update({
      where: { userId },
      data: {
        status: MEMBERSHIP_STATUS.LEFT,
        leftAt: now,
        pendingDistrictId: null,
        pendingEffectiveDate: null,
        pendingRequestedAt: null,
      },
      include: { district: true, pendingDistrict: true },
    });
    return serializeMembership(updated, now);
  });
}

export async function patchMembershipIdentity({ userId, publicHandle, publicAvatarId, now = new Date() }) {
  const config = await loadLiveConfig();
  ensureFeature(config);

  return prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    const row = await tx.tbilisiMovesMembership.findUnique({
      where: { userId },
      include: { district: true, pendingDistrict: true },
    });
    if (!row || row.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw tbilisiMovesError(409, 'NOT_ENROLLED', 'ჯერ აირჩიეთ რაიონი.');
    }
    const data = {};
    if (publicHandle != null) data.publicHandle = publicHandle;
    if (publicAvatarId !== undefined) data.publicAvatarId = publicAvatarId;
    const updated = await tx.tbilisiMovesMembership.update({
      where: { userId },
      data,
      include: { district: true, pendingDistrict: true },
    });
    return serializeMembership(updated, now);
  });
}

export async function patchDistrict({ admin, districtId, body, now = new Date() }) {
  await requireSchema();
  const reason = String(body.reason || 'district_update').slice(0, 400);
  const revision = body.revision;
  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.tbilisiMovesDistrict.findUnique({ where: { id: districtId } });
    if (!current) throw tbilisiMovesError(404, 'DISTRICT_NOT_FOUND', 'რაიონი ვერ მოიძებნა.');
    if (current.revision !== revision) {
      throw tbilisiMovesError(409, 'DISTRICT_STALE', 'რაიონი შეიცვალა. განაახლეთ გვერდი.');
    }
    const data = { revision: { increment: 1 } };
    if (body.sortOrder != null) data.sortOrder = body.sortOrder;
    if (body.status != null) data.status = body.status;
    if (body.dailyTargetOverride !== undefined) data.dailyTargetOverride = body.dailyTargetOverride;
    const updated = await tx.tbilisiMovesDistrict.update({ where: { id: districtId }, data });
    return { previous: current, updated };
  });

  await writeAdminAudit({
    admin,
    action: 'tbilisi_moves.district.patch',
    targetType: 'tbilisi_moves_district',
    targetId: districtId,
    previousValue: {
      slug: result.previous.slug,
      status: result.previous.status,
      sortOrder: result.previous.sortOrder,
      dailyTargetOverride: result.previous.dailyTargetOverride,
      revision: result.previous.revision,
    },
    newValue: {
      slug: result.updated.slug,
      status: result.updated.status,
      sortOrder: result.updated.sortOrder,
      dailyTargetOverride: result.updated.dailyTargetOverride,
      revision: result.updated.revision,
      reason,
      effectiveAt: now.toISOString(),
      effective: 'next_unopened_round_for_targets',
    },
  });

  const config = await loadLiveConfig();
  return publicDistrict(result.updated, config);
}

export async function archiveDistrict({ admin, districtId, reason, revision, now = new Date() }) {
  return patchDistrict({
    admin,
    districtId,
    body: {
      revision,
      status: DISTRICT_STATUS.ARCHIVED,
      reason: reason || 'archive',
    },
    now,
  });
}

export { dateInPeriod, publicConfig, scoringSnapshot, serializeMembership };
