/**
 * Phase 37 firewall traces — prove plannedPlace is absent from leak surfaces.
 *
 *   node scripts/cycle-phase37-firewall-qa.js
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCycleAiUserPrompt } from '../src/lib/cycle.js';
import { buildCycleDoctorSummaryData, doctorSummaryHasSensitiveLeak } from '../src/lib/cycleDoctorSummary.js';
import { buildCycleExportPayload } from '../src/lib/cycleLifecycle.js';
import { partnerPayloadHasLeak } from '../src/lib/cycleShare.js';
import { serializeCarePlanStateForExport } from '../src/lib/pregnancyCarePlan.js';
import {
  buildCalendarEventPayload,
  calendarEventNotes,
  calendarPlanDiffers,
} from '../../mobile/src/lib/pregnancyCareCalendarExportContract.js';
import {
  buildPregnancyCareReminderCandidates,
  pregnancyCareMaskedCopy,
  pregnancyCareReminderCopy,
  pregnancyCareReminderCandidateId,
  REMINDER_MODE,
} from '../../mobile/src/lib/pregnancyCareReminderContract.js';
import {
  calendarPayloadHasLocation,
  reminderCopyIncludesPlace,
} from '../../mobile/src/lib/pregnancyCareVisitPlaceContract.js';

const PLACE = 'CHC MontLégia — Radiologie';
const TODAY = '2026-09-10';

const row = {
  careItemId: 'anatomy_ultrasound',
  status: 'PLANNED',
  plannedDate: '2026-09-22',
  plannedTime: '14:30',
  plannedPlace: PLACE,
  completedDate: null,
  note: 'SECRET_PLANNER_NOTE',
  reminderEnabled: true,
  reminderOffset: 1,
  reminderMode: 'DATE_BASED',
  exactReminderOffsetMinutes: null,
  catalogVersion: 'prenatal-care-v1',
  pregnancyEpisodeId: 'ep-a',
};

const exportPayload = buildCycleExportPayload({
  profile: { mode: 'PREGNANCY' },
  logs: [],
  pregnancyEpisodes: [{ id: 'ep-a', referenceDate: '2026-04-23', referenceType: 'LMP', status: 'ACTIVE' }],
  pregnancyCarePlan: [serializeCarePlanStateForExport(row)],
});

const prompt = buildCycleAiUserPrompt({
  today: TODAY,
  profile: { mode: 'PREGNANCY', lastPeriodStart: '2026-04-23', avgCycleLength: 28, avgPeriodLength: 5 },
  logs: [],
  predictions: { nextPeriodStart: null, ovulationDate: null, fertileWindow: null, confidence: 'low' },
});

const doctor = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'PREGNANCY' },
  logs: [],
});

const partner = { estimated: true, permissions: { period: true } };
const candidates = buildPregnancyCareReminderCandidates({
  userId: 'user-a',
  episodeId: 'ep-a',
  mode: 'PREGNANCY',
  pregnancyActive: true,
  episodeStatus: 'ACTIVE',
  items: [
    {
      id: 'anatomy_ultrasound',
      userState: {
        status: 'PLANNED',
        plannedDate: '2026-09-22',
        plannedTime: '14:30',
        plannedPlace: PLACE,
        reminderEnabled: true,
        reminderOffset: 1,
        reminderMode: REMINDER_MODE.DATE_BASED,
      },
    },
  ],
  today: TODAY,
  now: new Date(2026, 8, 10, 8, 0, 0),
  timeZone: 'Europe/Brussels',
});

const calendar = buildCalendarEventPayload({
  plannedDate: '2026-09-22',
  plannedTime: '14:30',
  titleMode: 'generic',
});

const traces = {
  generatedAt: '2026-09-11',
  placeSample: PLACE,
  exportIncludesPlace: exportPayload.pregnancyCarePlan[0].plannedPlace === PLACE,
  partner: {
    detectorFlagsInjectedPlace: partnerPayloadHasLeak({ ...partner, plannedPlace: PLACE }),
    cleanHasKey: partnerPayloadHasLeak(partner),
    rawPlaceInEmptyPartner: JSON.stringify(partner).includes(PLACE),
  },
  ai: {
    promptIncludesPlace: prompt.includes(PLACE) || prompt.includes('plannedPlace'),
  },
  doctor: {
    summaryIncludesPlace: JSON.stringify(doctor).includes(PLACE) || JSON.stringify(doctor).includes('plannedPlace'),
    detectorFlagsInjectedPlace: doctorSummaryHasSensitiveLeak({ ...doctor, plannedPlace: PLACE }),
  },
  reminder: {
    candidateId: candidates[0]?.candidateId,
    candidateIdWithoutPlace: pregnancyCareReminderCandidateId({
      userId: 'user-a',
      episodeId: 'ep-a',
      careItemId: 'anatomy_ultrasound',
      plannedDate: '2026-09-22',
      offset: 1,
      reminderMode: REMINDER_MODE.DATE_BASED,
    }),
    candidateHasPlaceField: Object.hasOwn(candidates[0] || {}, 'plannedPlace'),
    maskedIncludesPlace: reminderCopyIncludesPlace(pregnancyCareMaskedCopy(), PLACE),
    unmaskedIncludesPlace: reminderCopyIncludesPlace(
      pregnancyCareReminderCopy({ offset: 1, itemTitle: 'ანატომია' }),
      PLACE,
    ),
  },
  calendar: {
    notes: calendarEventNotes(),
    notesIncludePlace: calendarEventNotes().includes(PLACE),
    locationField: calendar.location ?? null,
    hasLocation: calendarPayloadHasLocation(calendar),
    placeChangeMismatch: calendarPlanDiffers(
      { eventId: '2', plannedDate: '2026-09-22', plannedTime: '14:30', exportMode: 'TIMED' },
      { plannedDate: '2026-09-22', plannedTime: '14:30', plannedPlace: PLACE },
    ),
  },
  nativeCalendar: {
    source: 'qa/cycle-phase37-visit-place/native-events.txt',
    eventLocation: null,
    notes: 'Created from Medicard care planner.',
    title: 'Medicard — დაგეგმილი ვიზიტი',
    hasAlarm: 0,
  },
  analytics: {
    noRawPlaceContract: 'planner writes and Brain candidates must not log plannedPlace',
  },
};

const dest = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../qa/cycle-phase37-visit-place/firewall-traces.json',
);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, `${JSON.stringify(traces, null, 2)}\n`);
console.log('WROTE', dest);
