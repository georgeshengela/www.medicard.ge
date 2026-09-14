import { prisma } from '../prisma.js';
import { PEOPLE_PAGE_DEFAULT, PEOPLE_PAGE_MAX } from './catalog.js';
import { loadLiveConfig, publicConfig, roundIngestOpen } from './config.js';
import { isTbilisiMovesSchemaMissing, tbilisiMovesError } from './errors.js';
import { requireResultsSchema } from './finalize.js';
import { roundLifecycle } from './lifecycle.js';
import { applyAllDuePending, districtIdForDate, ensureFeature, listDistricts } from './membership.js';
import { rankDistricts, rankPeople, ownPeopleRow } from './ranking.js';
import { ensureRound, loadRound } from './rounds.js';
import { assertYmd, tbilisiClock, tbilisiYmd } from './time.js';

function publicRules(snapshot, live) {
  const rules = snapshot || {};
  return {
    competitiveCap: rules.competitiveCap ?? live.competitiveCap,
    defaultDailyTarget: rules.defaultDailyTarget ?? live.defaultDailyTarget,
    minParticipantsForRank: rules.minParticipantsForRank ?? live.minParticipantsForRank,
    lateSyncGraceHours: rules.lateSyncGraceHours ?? live.lateSyncGraceHours,
    pilotMode: true,
    rewardsEnabled: rules.rewardsEnabled ?? live.rewardsEnabled,
  };
}

function roundPublic(round, live, now, extra = {}) {
  const life = roundLifecycle(round, now);
  if (!round) {
    return {
      date: null,
      status: 'NOT_OPENED',
      provisional: true,
      ingestOpen: false,
      openedAt: null,
      graceEndsAt: null,
      lastObservationAt: null,
      lastAggregatedAt: null,
      finalizedAt: null,
      lifecycle: life.phase,
      resultRevision: 0,
      source: 'live',
      corrected: false,
      rules: publicRules(null, live),
    };
  }
  return {
    date: round.date,
    status: round.status,
    provisional: round.status !== 'FINALIZED',
    ingestOpen: roundIngestOpen(round, now) && !live.ingestionPaused,
    openedAt: round.openedAt,
    graceEndsAt: round.graceEndsAt,
    lastObservationAt: round.lastObservationAt,
    lastAggregatedAt: round.lastAggregatedAt,
    finalizedAt: round.finalizedAt,
    lifecycle: life.phase,
    resultRevision: round.resultRevision || 0,
    source: extra.source || (round.status === 'FINALIZED' ? 'published' : 'live'),
    corrected: Boolean(extra.corrected),
    rules: publicRules(round.rulesSnapshot, live),
  };
}

async function loadPublishedRevision(round) {
  if (!round || round.status !== 'FINALIZED') return null;
  try {
    if (round.latestResultId) {
      const byId = await prisma.tbilisiMovesResultRevision.findUnique({ where: { id: round.latestResultId } });
      if (byId) return byId;
    }
    return prisma.tbilisiMovesResultRevision.findFirst({
      where: { roundId: round.id },
      orderBy: { revision: 'desc' },
    });
  } catch (error) {
    if (isTbilisiMovesSchemaMissing(error)) {
      throw tbilisiMovesError(503, 'SCHEMA_NOT_READY', 'შედეგების ცხრილები ჯერ არ არის გამოყენებული.');
    }
    throw error;
  }
}

function stripPerson(row) {
  return {
    publicHandle: row.publicHandle,
    publicAvatarId: row.publicAvatarId ?? null,
    eligibleSteps: row.eligibleSteps,
    rank: row.rank,
  };
}

function publishedDistrictBoard(round, published, live, now) {
  const districts = Array.isArray(published.districtResults) ? published.districtResults : [];
  const eligibleTotal = districts.reduce((sum, row) => sum + (Number(row.eligibleSteps) || 0), 0);
  const participants = districts.reduce((sum, row) => sum + (Number(row.participantCount) || 0), 0);
  return {
    date: round.date,
    ...roundPublic(round, live, now, {
      source: 'published',
      corrected: published.revision > 1 || published.kind === 'CORRECTION',
    }),
    targetDefault: Number(round.rulesSnapshot?.defaultDailyTarget) || live.defaultDailyTarget,
    eligibleTotal,
    participantCount: participants,
    lastObservationAt: round.lastObservationAt,
    lastAggregatedAt: round.lastAggregatedAt,
    districts,
  };
}


export async function getCatalog(now = new Date()) {
  const { config, districts } = await listDistricts();
  ensureFeature(config);
  return {
    date: tbilisiYmd(now),
    pilotMode: true,
    enrollmentOpen: config.enrollmentOpen,
    competitionPaused: config.competitionPaused,
    cooldownDays: config.cooldownDays,
    defaultDailyTarget: config.defaultDailyTarget,
    competitiveCap: config.competitiveCap,
    districts: districts.filter((row) => row.status === 'ACTIVE'),
  };
}

export async function getRoundView(date, now = new Date()) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  const ymd = assertYmd(date);
  const today = tbilisiYmd(now);
  let round = await loadRound(prisma, ymd);
  if (!round && ymd === today) {
    round = await ensureRound(ymd, now);
  }
  if (!round) {
    throw tbilisiMovesError(404, 'ROUND_NOT_FOUND', 'ამ დღის რაუნდი არ არის გახსნილი.');
  }
  return { live: publicConfig(live), round: roundPublic(round, live, now) };
}

export async function getDistrictBoard(date, now = new Date()) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  const ymd = assertYmd(date);
  await applyAllDuePending(prisma, now);
  const today = tbilisiYmd(now);
  let round = await loadRound(prisma, ymd);
  if (!round && ymd === today) round = await ensureRound(ymd, now);
  if (!round) throw tbilisiMovesError(404, 'ROUND_NOT_FOUND', 'ამ დღის რაუნდი არ არის გახსნილი.');

  const published = await loadPublishedRevision(round);
  if (published) return publishedDistrictBoard(round, published, live, now);

  const [days, districts] = await Promise.all([
    prisma.tbilisiMovesDistrictDay.findMany({ where: { roundId: round.id } }),
    prisma.tbilisiMovesDistrict.findMany(),
  ]);
  const byId = new Map(districts.map((row) => [row.id, row]));
  const rows = days.map((day) => {
    const district = byId.get(day.districtId);
    return {
      id: day.districtId,
      districtId: day.districtId,
      slug: district?.slug,
      nameKa: district?.nameKa,
      sortOrder: district?.sortOrder ?? 0,
      status: district?.status,
      target: day.target,
      eligibleStepsSum: day.eligibleStepsSum,
      contributorCount: day.contributorCount,
      enrolledCount: day.enrolledCount,
    };
  });

  const minParticipants = Number(round.rulesSnapshot?.minParticipantsForRank) || live.minParticipantsForRank;
  const ranked = rankDistricts(rows, {
    minParticipantsForRank: minParticipants,
    competitionPaused: live.competitionPaused,
  });

  const eligibleTotal = ranked.reduce((sum, row) => sum + (Number(row.eligibleStepsSum) || 0), 0);
  const participants = ranked.reduce((sum, row) => sum + (Number(row.contributorCount) || 0), 0);

  return {
    date: ymd,
    ...roundPublic(round, live, now),
    targetDefault: Number(round.rulesSnapshot?.defaultDailyTarget) || live.defaultDailyTarget,
    eligibleTotal,
    participantCount: participants,
    lastObservationAt: round.lastObservationAt,
    lastAggregatedAt: round.lastAggregatedAt,
    districts: ranked.map((row) => ({
      id: row.districtId,
      slug: row.slug,
      nameKa: row.nameKa,
      target: row.target,
      eligibleSteps: row.eligibleStepsSum,
      goalRatio: row.goalRatio,
      participantCount: row.contributorCount,
      enrolledCount: row.enrolledCount,
      rank: row.rank,
      unranked: row.unranked,
      goalReached: row.goalReached,
      contestActive: row.contestActive,
    })),
  };
}

export async function getDistrictDetail(date, districtId, userId, now = new Date()) {
  const board = await getDistrictBoard(date, now);
  const district = board.districts.find((row) => row.id === districtId);
  if (!district) throw tbilisiMovesError(404, 'DISTRICT_NOT_FOUND', 'რაიონი ვერ მოიძებნა.');
  const credit = await prisma.tbilisiMovesCredit.findUnique({
    where: { userId_date: { userId, date: board.date } },
  });
  const creditedHere = credit?.districtId === districtId;
  return {
    ...board,
    district,
    you: credit
      ? {
          districtId: credit.districtId,
          inThisDistrict: creditedHere,
          eligibleSteps: creditedHere ? credit.eligibleSteps : 0,
          rawObservedSteps: creditedHere ? credit.rawObservedSteps : null,
          capSnapshot: credit.capSnapshot,
        }
      : { districtId: await districtIdForDate(prisma, userId, board.date), inThisDistrict: false, eligibleSteps: 0 },
  };
}

export async function getPeopleBoard(date, districtId, userId, query = {}, now = new Date()) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  const ymd = assertYmd(date);
  await applyAllDuePending(prisma, now);
  const today = tbilisiYmd(now);
  let round = await loadRound(prisma, ymd);
  if (!round && ymd === today) round = await ensureRound(ymd, now);
  if (!round) throw tbilisiMovesError(404, 'ROUND_NOT_FOUND', 'ამ დღის რაუნდი არ არის გახსნილი.');

  const district = await prisma.tbilisiMovesDistrict.findUnique({ where: { id: districtId } });
  if (!district) throw tbilisiMovesError(404, 'DISTRICT_NOT_FOUND', 'რაიონი ვერ მოიძებნა.');

  const limit = Math.min(PEOPLE_PAGE_MAX, Number(query.limit) || PEOPLE_PAGE_DEFAULT);
  const offset = Math.max(0, Number(query.offset) || 0);
  const published = await loadPublishedRevision(round);
  if (published) {
    const people = Array.isArray(published.peopleResults?.[districtId]) ? published.peopleResults[districtId] : [];
    const packed = ownPeopleRow(people, { userId }, { offset, limit });
    const districtRow = (published.districtResults || []).find((row) => row.id === districtId);
    return {
      date: ymd,
      ...roundPublic(round, live, now, {
        source: 'published',
        corrected: published.revision > 1 || published.kind === 'CORRECTION',
      }),
      district: {
        id: district.id,
        slug: district.slug,
        nameKa: district.nameKa,
        target: districtRow?.target ?? (round.districtTargetsSnapshot || {})[districtId],
        eligibleSteps: districtRow?.eligibleSteps || 0,
        participantCount: districtRow?.participantCount || 0,
      },
      offset,
      limit,
      total: packed.total,
      people: packed.page.map(stripPerson),
      you: packed.you
        ? {
            publicHandle: packed.you.publicHandle,
            publicAvatarId: packed.you.publicAvatarId,
            eligibleSteps: packed.you.eligibleSteps,
            rank: packed.you.rank,
            onPage: packed.you.onPage,
            unranked: packed.you.unranked || packed.you.eligibleSteps <= 0,
          }
        : null,
    };
  }

  const day = await prisma.tbilisiMovesDistrictDay.findUnique({
    where: { roundId_districtId: { roundId: round.id, districtId } },
  });

  const credits = await prisma.tbilisiMovesCredit.findMany({
    where: {
      date: ymd,
      districtId,
      excludedAt: null,
      eligibleSteps: { gt: 0 },
    },
    select: {
      userId: true,
      eligibleSteps: true,
      publicHandleSnapshot: true,
      publicAvatarIdSnapshot: true,
      excludedAt: true,
    },
  });

  const ranked = rankPeople(
    credits.map((row) => ({
      userId: row.userId,
      eligibleSteps: row.eligibleSteps,
      publicHandle: row.publicHandleSnapshot,
      publicAvatarId: row.publicAvatarIdSnapshot,
      excludedAt: row.excludedAt,
    })),
    { competitionPaused: live.competitionPaused },
  );

  const youCredit = await prisma.tbilisiMovesCredit.findUnique({
    where: { userId_date: { userId, date: ymd } },
    select: {
      userId: true,
      districtId: true,
      eligibleSteps: true,
      publicHandleSnapshot: true,
      publicAvatarIdSnapshot: true,
    },
  });
  const membership = await prisma.tbilisiMovesMembership.findUnique({
    where: { userId },
    select: { publicHandle: true, publicAvatarId: true },
  });

  const youInput =
    youCredit?.districtId === districtId
      ? {
          userId,
          eligibleSteps: youCredit.eligibleSteps,
          publicHandle: youCredit.publicHandleSnapshot,
          publicAvatarId: youCredit.publicAvatarIdSnapshot,
        }
      : {
          userId,
          eligibleSteps: 0,
          publicHandle: membership?.publicHandle,
          publicAvatarId: membership?.publicAvatarId,
        };

  const packed = ownPeopleRow(ranked, youInput, { offset, limit });

  return {
    date: ymd,
    ...roundPublic(round, live, now),
    district: {
      id: district.id,
      slug: district.slug,
      nameKa: district.nameKa,
      target: day?.target ?? (round.districtTargetsSnapshot || {})[districtId],
      eligibleSteps: day?.eligibleStepsSum || 0,
      participantCount: day?.contributorCount || 0,
    },
    offset,
    limit,
    total: packed.total,
    people: packed.page.map((row) => ({
      publicHandle: row.publicHandle,
      publicAvatarId: row.publicAvatarId,
      eligibleSteps: row.eligibleSteps,
      rank: row.rank,
    })),
    you: packed.you
      ? {
          publicHandle: packed.you.publicHandle,
          publicAvatarId: packed.you.publicAvatarId,
          eligibleSteps: packed.you.eligibleSteps,
          rank: packed.you.rank,
          onPage: packed.you.onPage,
          unranked: packed.you.unranked || packed.you.eligibleSteps <= 0,
        }
      : null,
  };
}

export async function getTodayOverview(userId, now = new Date()) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  const ymd = tbilisiYmd(now);
  await applyAllDuePending(prisma, now);
  const membership = await prisma.tbilisiMovesMembership.findUnique({
    where: { userId },
    include: { district: true, pendingDistrict: true },
  });
  const credit = await prisma.tbilisiMovesCredit.findUnique({
    where: { userId_date: { userId, date: ymd } },
  });
  const round = await loadRound(prisma, ymd);
  const board = round ? await getDistrictBoard(ymd, now) : null;
  const yourDistrictId = credit?.districtId || membership?.districtId;
  const yourDistrict = board?.districts.find((row) => row.id === yourDistrictId) || null;

  return {
    date: ymd,
    pilotMode: true,
    competitionPaused: live.competitionPaused,
    ingestionPaused: live.ingestionPaused,
    round: roundPublic(round, live, now),
    membership: membership
      ? {
          enrolled: membership.status === 'ACTIVE',
          districtId: membership.districtId,
          districtNameKa: membership.district?.nameKa,
          pendingDistrictId: membership.pendingDistrictId,
          pendingDistrictNameKa: membership.pendingDistrict?.nameKa,
          pendingEffectiveDate: membership.pendingEffectiveDate,
          lockUntilDate: membership.lockUntilDate,
          publicHandle: membership.publicHandle,
          publicAvatarId: membership.publicAvatarId,
        }
      : { enrolled: false },
    you: credit
      ? {
          districtId: credit.districtId,
          eligibleSteps: credit.eligibleSteps,
          rawObservedSteps: credit.rawObservedSteps,
          capSnapshot: credit.capSnapshot,
          lastRecordedAt: credit.lastRecordedAt,
        }
      : null,
    yourDistrict,
    lastObservationAt: round?.lastObservationAt ?? null,
    clock: tbilisiClock(now),
  };
}

function publicAward(row) {
  return {
    id: row.id,
    date: row.date,
    districtId: row.districtId,
    districtNameKa: row.district?.nameKa || row.districtNameKa || null,
    awardKey: row.awardKey,
    rank: row.rank,
    status: row.status,
    titleKa: row.titleKa,
    reasonKa: row.reasonKa,
    entitledAt: row.entitledAt,
    revokedAt: row.revokedAt,
  };
}

export async function getHistory(userId, query = {}, now = new Date()) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  await requireResultsSchema();
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const where = {};
  if (query.before) where.date = { lt: assertYmd(query.before) };
  const rows = await prisma.tbilisiMovesRound.findMany({
    where,
    orderBy: { date: 'desc' },
    take: limit + 1,
    select: {
      date: true,
      status: true,
      resultRevision: true,
      graceEndsAt: true,
      finalizedAt: true,
      latestResultId: true,
    },
  });
  const page = rows.slice(0, limit);
  const dates = page.map((row) => row.date);
  const [credits, awards] = await Promise.all([
    dates.length
      ? prisma.tbilisiMovesCredit.findMany({
          where: { userId, date: { in: dates } },
          select: { date: true, districtId: true, eligibleSteps: true },
        })
      : [],
    dates.length
      ? prisma.tbilisiMovesAward.findMany({
          where: { userId, date: { in: dates }, status: 'ACTIVE' },
          select: { date: true, awardKey: true },
        })
      : [],
  ]);
  const creditByDate = new Map(credits.map((row) => [row.date, row]));
  const awardCountByDate = new Map();
  for (const row of awards) {
    awardCountByDate.set(row.date, (awardCountByDate.get(row.date) || 0) + 1);
  }

  return {
    date: tbilisiYmd(now),
    items: page.map((row) => {
      const life = roundLifecycle(row, now);
      const credit = creditByDate.get(row.date);
      return {
        date: row.date,
        status: row.status,
        lifecycle: life.phase,
        provisional: row.status !== 'FINALIZED',
        resultRevision: row.resultRevision || 0,
        corrected: (row.resultRevision || 0) > 1,
        graceEndsAt: row.graceEndsAt,
        finalizedAt: row.finalizedAt,
        yourEligibleSteps: credit?.eligibleSteps ?? null,
        awardCount: awardCountByDate.get(row.date) || 0,
      };
    }),
    nextCursor: rows.length > limit ? page[page.length - 1].date : null,
  };
}

export async function getDayResults(date, userId, now = new Date()) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  const board = await getDistrictBoard(date, now);
  const credit = await prisma.tbilisiMovesCredit.findUnique({
    where: { userId_date: { userId, date: board.date } },
    select: { districtId: true, eligibleSteps: true, rawObservedSteps: true, capSnapshot: true },
  });
  const membership = await prisma.tbilisiMovesMembership.findUnique({
    where: { userId },
    select: { districtId: true },
  });
  const districtId = credit?.districtId || membership?.districtId;
  const people = districtId ? await getPeopleBoard(date, districtId, userId, { limit: 50, offset: 0 }, now) : null;
  let awards = [];
  if (board.source === 'published') {
    await requireResultsSchema();
    const rows = await prisma.tbilisiMovesAward.findMany({
      where: { userId, date: board.date },
      include: { district: { select: { nameKa: true } }, round: { select: { status: true, resultRevision: true } } },
      orderBy: [{ awardKey: 'asc' }, { rank: 'asc' }],
    });
    awards = rows
      .filter((row) => row.round?.status === 'FINALIZED' && row.resultRevision <= (row.round.resultRevision || 0))
      .map(publicAward);
  }
  return {
    ...board,
    you: credit
      ? {
          districtId: credit.districtId,
          eligibleSteps: people?.you?.eligibleSteps ?? credit.eligibleSteps,
          rank: people?.you?.rank ?? null,
          rawObservedSteps: board.source === 'published' ? null : credit.rawObservedSteps,
          capSnapshot: credit.capSnapshot,
        }
      : people?.you
        ? {
            districtId,
            eligibleSteps: people.you.eligibleSteps,
            rank: people.you.rank,
            rawObservedSteps: null,
            capSnapshot: null,
          }
        : null,
    people,
    awards,
  };
}

export async function getMyAwards(userId, query = {}) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  await requireResultsSchema();
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const offset = Math.max(0, Number(query.offset) || 0);
  const [total, rows] = await Promise.all([
    prisma.tbilisiMovesAward.count({ where: { userId } }),
    prisma.tbilisiMovesAward.findMany({
      where: { userId },
      include: {
        district: { select: { nameKa: true, slug: true } },
        round: { select: { status: true, resultRevision: true } },
      },
      orderBy: [{ date: 'desc' }, { awardKey: 'asc' }],
      take: limit,
      skip: offset,
    }),
  ]);
  const awards = rows
    .filter((row) => row.round?.status === 'FINALIZED' && row.resultRevision <= (row.round.resultRevision || 0))
    .map(publicAward);
  return { total, limit, offset, awards };
}
