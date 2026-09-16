import { randomUUID } from 'node:crypto';
import { prisma } from '../prisma.js';
import { MEMBERSHIP_STATUS } from './constants.js';
import { loadLiveConfig } from './config.js';
import { putObservation } from './ingest.js';
import { addDaysYmd, tbilisiMidnight, tbilisiYmd } from './time.js';

/** Stable install id when this user has no prior competition credit. */
export const HEALTH_DAILY_INSTALL_ID = 'medicard-health-metrics';

const SKIP_CODES = new Set([
  'NOT_ENROLLED',
  'FEATURE_DISABLED',
  'SCHEMA_NOT_READY',
  'INGESTION_PAUSED',
  'DATE_OUT_OF_WINDOW',
  'ROUND_CLOSED',
  'NO_DISTRICT_FOR_DATE',
  'INGESTION_HOLD_OVERLAP',
  'COMPETITION_PAUSED',
]);

function observationInterval(ymd, now) {
  const start = tbilisiMidnight(ymd);
  const dayEnd = tbilisiMidnight(addDaysYmd(ymd, 1));
  const endMs = Math.min(now.getTime(), dayEnd.getTime());
  return { start, end: new Date(Math.max(endMs, start.getTime() + 1000)) };
}

/**
 * Copy HealthMetricDaily.steps onto TbilisiMovesCredit for the same YYYY-MM-DD.
 * Reuses an existing credit's provider/install id so SOURCE_CONFLICT does not fire.
 */
export async function applyHealthDailyDatesToCompetition({ userId, dates, now = new Date() }) {
  const unique = [...new Set((dates || []).map((value) => String(value || '').slice(0, 10)).filter(Boolean))];
  if (!unique.length) return { applied: 0 };

  try {
    const live = await loadLiveConfig();
    if (!live?.featureEnabled || live.ingestionPaused) return { applied: 0 };
  } catch {
    return { applied: 0 };
  }

  const membership = await prisma.tbilisiMovesMembership.findUnique({ where: { userId } });
  if (!membership || membership.status !== MEMBERSHIP_STATUS.ACTIVE) return { applied: 0 };

  let applied = 0;
  for (const date of unique) {
    try {
      const daily = await prisma.healthMetricDaily.findUnique({
        where: { userId_date: { userId, date } },
      });
      if (daily?.steps == null) continue;
      const steps = Math.max(0, Math.trunc(Number(daily.steps) || 0));

      const credit = await prisma.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId, date } },
      });
      if (credit && credit.rawObservedSteps === steps) continue;

      const { start, end } = observationInterval(date, now);
      const provider = credit?.authoritativeProvider || 'HEALTH_CONNECT';
      const installId = credit?.sourceInstallationId || HEALTH_DAILY_INSTALL_ID;

      const result = await putObservation({
        userId,
        now,
        body: {
          clientObservationId: randomUUID(),
          provider,
          sourceInstallationId: installId,
          tbilisiDate: date,
          intervalStart: start.toISOString(),
          intervalEnd: end.toISOString(),
          cumulativeSteps: steps,
          recordedAt: now.toISOString(),
          clientSequence: Date.now() % 1_000_000_000,
        },
      });
      if (result?.accepted) applied += 1;
    } catch (error) {
      if (SKIP_CODES.has(error?.code)) continue;
    }
  }
  return { applied };
}

export async function applyRecentHealthDailyToCompetition(userId, now = new Date()) {
  const today = tbilisiYmd(now);
  return applyHealthDailyDatesToCompetition({
    userId,
    dates: [today, addDaysYmd(today, -1)],
    now,
  });
}

export async function applyHealthDailyQuiet(userId, dates, now = new Date()) {
  try {
    return await applyHealthDailyDatesToCompetition({ userId, dates, now });
  } catch {
    return { applied: 0 };
  }
}
