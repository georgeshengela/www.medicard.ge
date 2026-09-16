import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { ALLOWED_OBSERVATION_PROVIDERS, CLOCK_SKEW_MS } from './catalog.js';
import { MEMBERSHIP_STATUS } from './constants.js';
import { loadLiveConfig } from './config.js';
import { tbilisiMovesError } from './errors.js';
import { districtIdForDate, ensureFeature, lockUserTx, applyDuePendingForUser } from './membership.js';
import { assertDateIngestible, assertRoundAcceptsIngest, ensureRoundInTx, loadRound, lockRoundTx, refreshDistrictDay } from './rounds.js';
import { intervalsOverlap, tbilisiMidnight, tbilisiYmd, addDaysYmd } from './time.js';
import { notifyTbilisiMovesLive } from './liveSnapshot.js';

export function observationPayloadHash(input) {
  const canonical = JSON.stringify({
    provider: String(input.provider).toUpperCase(),
    sourceInstallationId: input.sourceInstallationId,
    tbilisiDate: input.tbilisiDate,
    intervalStart: new Date(input.intervalStart).toISOString(),
    intervalEnd: new Date(input.intervalEnd).toISOString(),
    cumulativeSteps: input.cumulativeSteps,
    recordedAt: new Date(input.recordedAt).toISOString(),
    clientSequence: input.clientSequence ?? 0,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

export function compareObservationOrder(a, b) {
  const recorded = new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
  if (recorded !== 0) return recorded;
  const seq = (a.clientSequence ?? 0) - (b.clientSequence ?? 0);
  if (seq !== 0) return seq;
  return new Date(a.receivedAt || 0).getTime() - new Date(b.receivedAt || 0).getTime();
}

export function eligibleFromRaw(raw, cap) {
  return Math.min(Math.max(0, raw), cap);
}

function parseInstant(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw tbilisiMovesError(400, 'INVALID_INTERVAL', `${field} არასწორია.`);
  }
  return date;
}

export function validateObservationWindow({ body, now, sanityMaxRawSteps }) {
  const provider = String(body.provider || '').toUpperCase();
  if (!ALLOWED_OBSERVATION_PROVIDERS.includes(provider)) {
    throw tbilisiMovesError(
      400,
      'PROVIDER_UNSUPPORTED',
      'ამ წყაროდან ნაბიჯები არ მიიღება. მხოლოდ Apple Health ან Health Connect.',
      {
        note: 'Pilot mode: a dishonest client can still spoof APPLE_HEALTH / HEALTH_CONNECT metadata.',
      },
    );
  }
  if (!Number.isInteger(body.cumulativeSteps) || body.cumulativeSteps < 0) {
    throw tbilisiMovesError(400, 'INVALID_STEPS', 'ნაბიჯები უნდა იყოს არაუარყოფითი მთელი რიცხვი.');
  }
  if (body.cumulativeSteps > sanityMaxRawSteps) {
    throw tbilisiMovesError(400, 'STEPS_SANITY', 'ნაბიჯების მნიშვნელობა დაუშვებელია.');
  }

  const tbilisiDate = body.tbilisiDate;
  const expectedStart = tbilisiMidnight(tbilisiDate);
  const dayEnd = tbilisiMidnight(addDaysYmd(tbilisiDate, 1));
  const intervalStart = parseInstant(body.intervalStart, 'intervalStart');
  const intervalEnd = parseInstant(body.intervalEnd, 'intervalEnd');
  const recordedAt = parseInstant(body.recordedAt, 'recordedAt');

  if (intervalStart.getTime() !== expectedStart.getTime()) {
    throw tbilisiMovesError(400, 'INTERVAL_START_MISMATCH', 'ინტერვალი უნდა იწყებოდეს თბილისის შუაღამით.');
  }
  if (intervalEnd.getTime() <= intervalStart.getTime()) {
    throw tbilisiMovesError(400, 'INVALID_INTERVAL', 'ინტერვალის დასასრული დასაწყისზე გვიან უნდა იყოს.');
  }
  if (intervalEnd.getTime() > dayEnd.getTime()) {
    throw tbilisiMovesError(400, 'INTERVAL_OUT_OF_DAY', 'ინტერვალი ამ თბილისის დღეს სცდება.');
  }
  if (intervalEnd.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    throw tbilisiMovesError(400, 'FUTURE_INTERVAL', 'ინტერვალი მომავალშია.');
  }
  if (recordedAt.getTime() > now.getTime() + CLOCK_SKEW_MS) {
    throw tbilisiMovesError(400, 'FUTURE_OBSERVATION', 'დაკვირვების დრო მომავალშია.');
  }
  if (recordedAt.getTime() < intervalStart.getTime() - CLOCK_SKEW_MS) {
    throw tbilisiMovesError(400, 'RECORDED_BEFORE_INTERVAL', 'დაკვირვების დრო ინტერვალამდეა.');
  }

  const today = tbilisiYmd(now);
  if (tbilisiDate > today) {
    throw tbilisiMovesError(400, 'FUTURE_DATE', 'მომავალი თბილისის დღე არ მიიღება.');
  }

  return { provider, intervalStart, intervalEnd, recordedAt };
}

async function assertNoHoldOverlap(tx, intervalStart, intervalEnd) {
  const holds = await tx.tbilisiMovesIngestHold.findMany({
    where: { startedAt: { lt: intervalEnd } },
  });
  for (const hold of holds) {
    if (intervalsOverlap(intervalStart, intervalEnd, hold.startedAt, hold.endedAt)) {
      throw tbilisiMovesError(
        409,
        'INGESTION_HOLD_OVERLAP',
        'ეს ინტერვალი შეჩერების პერიოდს ემთხვევა. დღის ჯამი პაუზის შემდეგ არ ითვლება.',
      );
    }
  }
}

function publicCredit(row) {
  if (!row) return null;
  return {
    date: row.date,
    districtId: row.districtId,
    rawObservedSteps: row.rawObservedSteps,
    eligibleSteps: row.eligibleSteps,
    capSnapshot: row.capSnapshot,
    provider: row.authoritativeProvider,
    lastRecordedAt: row.lastRecordedAt,
    flagged: Boolean(row.flaggedAt),
    flagReason: row.flagReason,
    excluded: Boolean(row.excludedAt),
    provisional: true,
  };
}

export async function putObservation({ userId, body, now = new Date() }) {
  const live = await loadLiveConfig();
  ensureFeature(live);
  if (live.ingestionPaused) {
    throw tbilisiMovesError(409, 'INGESTION_PAUSED', 'ნაბიჯების მიღება დროებით შეჩერებულია.');
  }

  const validated = validateObservationWindow({
    body,
    now,
    sanityMaxRawSteps: live.sanityMaxRawSteps,
  });

  const result = await prisma.$transaction(async (tx) => {
    await lockUserTx(tx, userId);
    await applyDuePendingForUser(tx, userId, now);

    const membership = await tx.tbilisiMovesMembership.findUnique({ where: { userId } });
    if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw tbilisiMovesError(409, 'NOT_ENROLLED', 'ჯერ აირჩიეთ რაიონი.');
    }

    const existingBeforeLock = await loadRound(tx, body.tbilisiDate);
    if (existingBeforeLock) {
      await lockRoundTx(tx, body.tbilisiDate);
    }
    const existingRound = existingBeforeLock ? await loadRound(tx, body.tbilisiDate) : null;
    assertDateIngestible(body.tbilisiDate, now, live.lateSyncGraceHours, existingRound);
    const round = existingRound
      ? existingRound
      : await ensureRoundInTx(tx, body.tbilisiDate, now);
    assertRoundAcceptsIngest(round, now);

    await assertNoHoldOverlap(tx, validated.intervalStart, validated.intervalEnd);

    const districtId = await districtIdForDate(tx, userId, body.tbilisiDate);
    if (!districtId) {
      throw tbilisiMovesError(409, 'NO_DISTRICT_FOR_DATE', 'ამ დღეს რაიონი არ გქონდათ.');
    }

    const hash = observationPayloadHash(body);
    const existingObs = await tx.tbilisiMovesObservation.findUnique({
      where: { userId_clientObservationId: { userId, clientObservationId: body.clientObservationId } },
    });
    if (existingObs) {
      if (existingObs.payloadHash === hash) {
        const credit = await tx.tbilisiMovesCredit.findUnique({
          where: { userId_date: { userId, date: body.tbilisiDate } },
        });
        return { accepted: true, idempotent: true, credit: publicCredit(credit) };
      }
      throw tbilisiMovesError(409, 'OBSERVATION_CONFLICT', 'იგივე დაკვირვება სხვა მონაცემებით უკვე არსებობს.');
    }

    const cap = Number(round.rulesSnapshot?.competitiveCap) || live.competitiveCap;
    const credit = await tx.tbilisiMovesCredit.findUnique({
      where: { userId_date: { userId, date: body.tbilisiDate } },
    });

    if (credit) {
      const dailyTakeover = body.sourceInstallationId === 'medicard-health-metrics';
      if (
        !dailyTakeover &&
        (credit.authoritativeProvider !== validated.provider ||
          credit.sourceInstallationId !== body.sourceInstallationId)
      ) {
        await tx.tbilisiMovesObservation.create({
          data: {
            id: randomUUID(),
            userId,
            clientObservationId: body.clientObservationId,
            roundId: round.id,
            date: body.tbilisiDate,
            provider: validated.provider,
            sourceInstallationId: body.sourceInstallationId,
            intervalStart: validated.intervalStart,
            intervalEnd: validated.intervalEnd,
            cumulativeSteps: body.cumulativeSteps,
            recordedAt: validated.recordedAt,
            clientSequence: body.clientSequence ?? 0,
            payloadHash: hash,
            receivedAt: now,
            applied: false,
            ignoreReason: 'SOURCE_CONFLICT',
          },
        });
        return {
          accepted: false,
          reason: 'SOURCE_CONFLICT',
          status: 409,
          credit: publicCredit(credit),
        };
      }

      const incoming = {
        recordedAt: validated.recordedAt,
        clientSequence: body.clientSequence ?? 0,
        receivedAt: now,
      };
      const current = {
        recordedAt: credit.lastRecordedAt,
        clientSequence: credit.lastClientSequence,
        receivedAt: credit.acceptedAt,
      };
      if (compareObservationOrder(incoming, current) <= 0) {
        await tx.tbilisiMovesObservation.create({
          data: {
            id: randomUUID(),
            userId,
            clientObservationId: body.clientObservationId,
            roundId: round.id,
            date: body.tbilisiDate,
            provider: validated.provider,
            sourceInstallationId: body.sourceInstallationId,
            intervalStart: validated.intervalStart,
            intervalEnd: validated.intervalEnd,
            cumulativeSteps: body.cumulativeSteps,
            recordedAt: validated.recordedAt,
            clientSequence: body.clientSequence ?? 0,
            payloadHash: hash,
            receivedAt: now,
            applied: false,
            ignoreReason: 'STALE',
          },
        });
        return { accepted: false, reason: 'STALE', credit: publicCredit(credit) };
      }
    }

    const previousRaw = credit?.rawObservedSteps ?? null;
    let flaggedAt = credit?.flaggedAt ?? null;
    let flagReason = credit?.flagReason ?? null;
    let correctionCount = credit?.correctionCount ?? 0;
    if (previousRaw != null && body.cumulativeSteps < previousRaw) {
      correctionCount += 1;
      const dropPct = previousRaw === 0 ? 100 : Math.round(((previousRaw - body.cumulativeSteps) / previousRaw) * 100);
      if (dropPct >= (live.correctionDropFlagPct || 40)) {
        flaggedAt = now;
        flagReason = 'DROP_CORRECTION';
      }
    }

    const observation = await tx.tbilisiMovesObservation.create({
      data: {
        id: randomUUID(),
        userId,
        clientObservationId: body.clientObservationId,
        roundId: round.id,
        date: body.tbilisiDate,
        provider: validated.provider,
        sourceInstallationId: body.sourceInstallationId,
        intervalStart: validated.intervalStart,
        intervalEnd: validated.intervalEnd,
        cumulativeSteps: body.cumulativeSteps,
        recordedAt: validated.recordedAt,
        clientSequence: body.clientSequence ?? 0,
        payloadHash: hash,
        receivedAt: now,
        applied: true,
      },
    });

    const eligibleSteps = eligibleFromRaw(body.cumulativeSteps, cap);
    const creditData = {
      roundId: round.id,
      districtId: credit?.districtId || districtId,
      rawObservedSteps: body.cumulativeSteps,
      eligibleSteps,
      capSnapshot: cap,
      authoritativeProvider: validated.provider,
      sourceInstallationId: body.sourceInstallationId,
      lastRecordedAt: validated.recordedAt,
      lastClientSequence: body.clientSequence ?? 0,
      lastObservationId: observation.id,
      flaggedAt,
      flagReason,
      correctionCount,
      acceptedAt: now,
    };

    const saved = credit
      ? await tx.tbilisiMovesCredit.update({
          where: { id: credit.id },
          data: creditData,
        })
      : await tx.tbilisiMovesCredit.create({
          data: {
            id: randomUUID(),
            userId,
            date: body.tbilisiDate,
            publicHandleSnapshot: membership.publicHandle,
            publicAvatarIdSnapshot: membership.publicAvatarId,
            ...creditData,
            districtId,
          },
        });

    await tx.tbilisiMovesRound.update({
      where: { id: round.id },
      data: { lastObservationAt: now },
    });
    await refreshDistrictDay(tx, round, saved.districtId, body.tbilisiDate);

    return { accepted: true, idempotent: false, credit: publicCredit(saved) };
  });
  notifyTbilisiMovesLive(userId);
  return result;
}
