/**
 * Phase 36 Brain/scheduler traces. Canonical fire math only — not a fake send.
 *
 *   node scripts/cycle-phase36-brain-qa.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PREGNANCY_CARE_REMINDER_SUPPRESSION,
  REMINDER_MODE,
  buildPregnancyCareReminderCandidates,
  revalidatePregnancyCareReminder,
  resolvePrenatalCareReminderSchedule,
  wallClockInstant,
} from '../../mobile/src/lib/pregnancyCareReminderContract.js';

const TZ = 'Europe/Brussels';
const USER = 'user-a';
const EPISODE = 'ep-a';
const TODAY = '2026-09-10';

function item(extra = {}) {
  return {
    id: 'anatomy_ultrasound',
    timing: { relation: 'IN_WINDOW', startWeek: 18, endWeek: 22 },
    userState: {
      status: extra.status || 'PLANNED',
      plannedDate: extra.plannedDate ?? '2026-09-22',
      plannedTime: extra.plannedTime ?? null,
      reminderEnabled: extra.reminderEnabled !== false,
      reminderOffset: extra.offset ?? 1,
      reminderMode: extra.reminderMode,
      exactReminderOffsetMinutes: extra.exactMinutes ?? null,
    },
  };
}

function candidates(extra = {}) {
  return buildPregnancyCareReminderCandidates({
    userId: extra.userId || USER,
    episodeId: extra.episodeId || EPISODE,
    mode: extra.mode || 'PREGNANCY',
    pregnancyActive: extra.pregnancyActive !== false,
    episodeStatus: extra.episodeStatus || 'ACTIVE',
    items: extra.items || [item(extra)],
    today: extra.today || TODAY,
    now: extra.now || new Date(2026, 8, 10, 8, 0, 0),
    timeZone: extra.timeZone || TZ,
  });
}

const traces = {
  generatedAt: '2026-09-11',
  timezone: TZ,
  cases: {
    legacyDateBased: {
      schedule: resolvePrenatalCareReminderSchedule({
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        reminderEnabled: true,
        reminderOffset: 1,
        reminderMode: REMINDER_MODE.DATE_BASED,
      }, { timeZone: TZ }),
      candidates: candidates({ plannedTime: '14:30', reminderMode: REMINDER_MODE.DATE_BASED, offset: 1 }),
    },
    atTime: resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderEnabled: true,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactReminderOffsetMinutes: 0,
    }, { timeZone: TZ }),
    min30: resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderEnabled: true,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactReminderOffsetMinutes: 30,
    }, { timeZone: TZ }),
    hour1: resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderEnabled: true,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactReminderOffsetMinutes: 60,
    }, { timeZone: TZ }),
    hour2: resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '14:30',
      reminderEnabled: true,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactReminderOffsetMinutes: 120,
    }, { timeZone: TZ }),
    midnightCrossover: resolvePrenatalCareReminderSchedule({
      plannedDate: '2026-09-22',
      plannedTime: '00:00',
      reminderEnabled: true,
      reminderMode: REMINDER_MODE.EXACT_TIME,
      exactReminderOffsetMinutes: 60,
    }, { timeZone: TZ }),
    dstGap: wallClockInstant('2026-03-29', '02:30', TZ),
    dstOverlapFirst: wallClockInstant('2026-10-25', '02:30', TZ),
  },
};

const exactCandidate = candidates({
  plannedTime: '14:30',
  reminderMode: REMINDER_MODE.EXACT_TIME,
  exactMinutes: 60,
})[0];

traces.suppression = {
  changedTime: revalidatePregnancyCareReminder(
    exactCandidate,
    {
      userId: USER,
      mode: 'PREGNANCY',
      pregnancyActive: true,
      episodeStatus: 'ACTIVE',
      episodeId: EPISODE,
      today: TODAY,
      now: new Date(2026, 8, 10, 8, 0, 0),
      timeZone: TZ,
      items: [item({ plannedTime: '16:00', reminderMode: REMINDER_MODE.EXACT_TIME, exactMinutes: 60 })],
    },
  ),
  removedTime: candidates({
    plannedTime: null,
    reminderMode: REMINDER_MODE.EXACT_TIME,
    exactMinutes: 60,
  }).length,
  completed: candidates({
    status: 'COMPLETED',
    plannedTime: '14:30',
    reminderMode: REMINDER_MODE.EXACT_TIME,
    exactMinutes: 60,
  }).length,
  episodeEnded: candidates({
    plannedTime: '14:30',
    reminderMode: REMINDER_MODE.EXACT_TIME,
    exactMinutes: 60,
    episodeStatus: 'ENDED',
    pregnancyActive: false,
  }).length,
  permissionPrefDistinct: 'preference stored even if OS denied; Brain does not send without grant',
  dedupe: {
    dateBased: candidates({ plannedTime: '14:30', reminderMode: REMINDER_MODE.DATE_BASED })[0]?.candidateId,
    exact: exactCandidate?.candidateId,
  },
  pastFire: candidates({
    plannedDate: TODAY,
    plannedTime: '14:30',
    reminderMode: REMINDER_MODE.EXACT_TIME,
    exactMinutes: 60,
    now: new Date(2026, 8, 10, 14, 0, 0),
  }).length,
};

traces.reasons = PREGNANCY_CARE_REMINDER_SUPPRESSION;

const dest = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../qa/cycle-phase36-exact-time-reminder/brain-traces.json',
);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, `${JSON.stringify(traces, null, 2)}\n`);
console.log('WROTE', dest);
