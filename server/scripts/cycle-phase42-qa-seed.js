/**
 * Cycle Phase 42 — postpartum return to TRACK QA seed.
 *
 *   node scripts/cycle-phase42-qa-seed.js postpartum|zero|one|two|three|ttc|custom|ordinary
 *
 * Account: cycle.qa.phase6@medicard.ge / CycleQaPhase6a
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';
import { estimatedDueDateFromReference } from '../src/lib/cyclePregnancy.js';
import { POSTPARTUM_TRACKING_CONTEXT } from '../src/lib/cyclePostpartum.js';
import { FORECAST_GATE_KIND_POSTPARTUM_RETURN } from '../src/lib/cyclePostpartumReturnForecast.js';

const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';
const PHONE = '+995500000016';
const NAME = 'Cycle QA Phase6';
const FIXTURE = process.argv[2] || 'postpartum';

const STARTS = {
  one: ['2026-08-14'],
  two: ['2026-07-17', '2026-08-14'],
  three: ['2026-06-19', '2026-07-17', '2026-08-14'],
  ordinary: ['2026-06-19', '2026-07-17', '2026-08-14'],
};

function bleedDays(start) {
  return [0, 1, 2, 3].map((i) => addDays(start, i));
}

async function main() {
  const today = todayInTimeZone();
  const referenceDate = addDays(today, -90);
  const pregnancyRef = addDays(today, -(20 * 7 + 2));
  const free = await prisma.package.findUnique({ where: { code: 'FREE' } });
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    create: {
      email: EMAIL,
      passwordHash,
      fullName: NAME,
      phone: PHONE,
      gender: 'FEMALE',
      birthDate: new Date('1996-03-12T00:00:00.000Z'),
      status: 'ACTIVE',
      packageId: free?.id ?? null,
    },
    update: {
      passwordHash,
      fullName: NAME,
      phone: PHONE,
      gender: 'FEMALE',
      status: 'ACTIVE',
    },
  });

  await prisma.cycleLog.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePostpartumBleedClassification.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePredictionSnapshot.deleteMany({ where: { userId: user.id } });
  await prisma.pregnancyCarePlanItemState.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePostpartumEpisode.deleteMany({ where: { userId: user.id } });
  await prisma.cyclePregnancyEpisode.deleteMany({ where: { userId: user.id } });

  const stayPostpartum = FIXTURE === 'postpartum';
  const ttc = FIXTURE === 'ttc';
  const ordinary = FIXTURE === 'ordinary';
  const custom = FIXTURE === 'custom';
  const mode = stayPostpartum ? 'POSTPARTUM' : ttc ? 'TRY_TO_CONCEIVE' : 'TRACK_PERIOD';
  const startKeys = STARTS[FIXTURE] || (FIXTURE === 'ttc' || FIXTURE === 'zero' || FIXTURE === 'postpartum' || FIXTURE === 'custom' ? [] : []);
  const avgCycleLength = custom ? 31 : 28;
  const gateKind = stayPostpartum || ordinary ? null : FORECAST_GATE_KIND_POSTPARTUM_RETURN;

  await prisma.cycleProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      mode,
      avgCycleLength,
      avgPeriodLength: 5,
      lastPeriodStart: new Date(`${pregnancyRef}T00:00:00.000Z`),
      isIrregular: false,
      conditions: [],
      forecastGateKind: gateKind,
      forecastGateEpisodeId: null,
    },
    update: {
      mode,
      avgCycleLength,
      avgPeriodLength: 5,
      lastPeriodStart: new Date(`${pregnancyRef}T00:00:00.000Z`),
      dueDate: null,
      forecastGateKind: gateKind,
      forecastGateEpisodeId: null,
    },
  });

  await prisma.cyclePregnancyEpisode.create({
    data: {
      userId: user.id,
      referenceDate: pregnancyRef,
      referenceType: 'LMP',
      status: 'ENDED',
      endedAt: new Date(),
    },
  });

  const episode = ordinary
    ? null
    : await prisma.cyclePostpartumEpisode.create({
        data: {
          userId: user.id,
          referenceDate,
          status: stayPostpartum ? 'ACTIVE' : 'ENDED',
          endedAt: stayPostpartum ? null : new Date(),
        },
      });

  if (stayPostpartum) {
    const start = addDays(today, -4);
    for (let i = 0; i < 5; i += 1) {
      const flow = i === 2 ? 'heavy' : i === 0 || i === 4 ? 'light' : 'medium';
      await prisma.cycleLog.create({
        data: {
          userId: user.id,
          date: addDays(start, i),
          flow,
          trackingContext: POSTPARTUM_TRACKING_CONTEXT,
          postpartumEpisodeId: episode.id,
        },
      });
    }
  } else if (ordinary) {
    for (const start of startKeys) {
      for (const date of bleedDays(start)) {
        await prisma.cycleLog.create({
          data: {
            userId: user.id,
            date,
            flow: date === start ? 'medium' : 'light',
          },
        });
      }
    }
    await prisma.cycleProfile.update({
      where: { userId: user.id },
      data: { lastPeriodStart: new Date('2026-08-14T00:00:00.000Z') },
    });
  } else {
    if (FIXTURE === 'zero' || FIXTURE === 'ttc' || FIXTURE === 'custom') {
      for (const start of ['2025-11-01', '2025-11-29', '2025-12-27', '2026-01-24']) {
        for (const date of bleedDays(start)) {
          await prisma.cycleLog.create({
            data: {
              userId: user.id,
              date,
              flow: 'medium',
            },
          });
        }
      }
    }
    for (const start of startKeys) {
      for (const date of bleedDays(start)) {
        await prisma.cycleLog.create({
          data: {
            userId: user.id,
            date,
            flow: date === start ? 'medium' : 'light',
            trackingContext: POSTPARTUM_TRACKING_CONTEXT,
            postpartumEpisodeId: episode.id,
          },
        });
      }
      await prisma.cyclePostpartumBleedClassification.create({
        data: {
          userId: user.id,
          postpartumEpisodeId: episode.id,
          bleedStart: start,
          bleedEnd: addDays(start, 3),
          classification: 'MENSTRUAL_PERIOD',
          source: 'OWNER',
        },
      });
    }
  }

  if (!stayPostpartum && !ordinary) {
    await prisma.cycleProfile.update({
      where: { userId: user.id },
      data: {
        forecastGateKind: FORECAST_GATE_KIND_POSTPARTUM_RETURN,
        forecastGateEpisodeId: episode.id,
      },
    });
  }

  console.log(
    JSON.stringify({
      ok: true,
      fixture: FIXTURE,
      userId: user.id,
      mode,
      today,
      episodeId: episode?.id ?? null,
      classifiedStarts: startKeys,
      dueDateWas: estimatedDueDateFromReference(pregnancyRef),
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
