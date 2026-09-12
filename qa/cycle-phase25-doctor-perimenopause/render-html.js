/**
 * Phase 25 — Perimenopause doctor-summary HTML artifacts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, inferCycleStats } from '../../server/src/lib/cycle.js';
import { buildCycleDoctorSummaryData } from '../../server/src/lib/cycleDoctorSummary.js';
import { PREGNANCY_EPISODE_ACTIVE } from '../../server/src/lib/cyclePregnancy.js';
import { buildCycleReportHtmlFromSummary } from '../../mobile/src/lib/cycleDoctorSummaryI18n.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-09-10';

function log(date, extra = {}) {
  return { date, flow: extra.flow ?? 'none', ...extra };
}
function bleed(start, days = 4, extra = {}) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push(
      log(addDays(start, i), {
        flow: i === 0 ? 'medium' : 'light',
        ...extra,
      }),
    );
  }
  return rows;
}

function periLogs() {
  const s4 = addDays(TODAY, -10);
  const s3 = addDays(s4, -29);
  const s2 = addDays(s3, -46);
  const s1 = addDays(s2, -31);
  const s0 = addDays(s1, -24);
  return [
    ...bleed(s0, 4),
    ...bleed(s1, 3),
    ...bleed(s2, 5),
    ...bleed(s3, 4),
    ...bleed(s4, 3),
    log(TODAY, {
      symptoms: ['hot_flashes', 'night_sweats', 'vaginal_dryness'],
      notes: 'private journal',
      sexualActivity: true,
    }),
  ];
}

const logs = periLogs();
const inferred = inferCycleStats(logs);

const peri = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'PERIMENOPAUSE', avgCycleLength: 28, avgPeriodLength: 5 },
  logs,
  inferred,
});
const track = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5 },
  logs,
  inferred,
});
const pregnancy = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'PREGNANCY' },
  logs: [
    ...bleed('2026-06-17'),
    ...bleed('2026-07-13'),
    log(TODAY, { pregnancyTest: 'positive' }),
  ],
  pregnancyEpisode: {
    id: 'ep-qa',
    referenceDate: '2026-07-13',
    referenceType: 'LMP',
    status: PREGNANCY_EPISODE_ACTIVE,
  },
});
const privateOff = peri;

fs.writeFileSync(path.join(dir, '00-payload-peri.json'), JSON.stringify(peri, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-track.json'), JSON.stringify(track, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-pregnancy.json'), JSON.stringify(pregnancy, null, 2));

for (const locale of ['ka', 'en', 'fr', 'ru']) {
  fs.writeFileSync(path.join(dir, `00-report-${locale}-peri.html`), buildCycleReportHtmlFromSummary(peri, locale));
}
fs.writeFileSync(path.join(dir, '00-report-en-track.html'), buildCycleReportHtmlFromSummary(track, 'en'));
fs.writeFileSync(path.join(dir, '00-report-en-pregnancy.html'), buildCycleReportHtmlFromSummary(pregnancy, 'en'));

const leaks = [
  'PERIMENOPAUSE',
  'patient is perimenopausal',
  'confirmed menopause',
  'diagnosed perimenopause',
  'Patiente en périménopause',
  'weekDevelopment',
  'nextPeriodStart',
  'fertileWindow',
  'vaginal_dryness',
];
for (const locale of ['ka', 'en', 'fr', 'ru']) {
  const html = fs.readFileSync(path.join(dir, `00-report-${locale}-peri.html`), 'utf8');
  for (const key of leaks) {
    if (html.includes(key)) throw new Error(`leak ${locale}: ${key}`);
  }
}
if (track.perimenopauseContext) throw new Error('TRACK has peri context');
if (pregnancy.perimenopauseContext) throw new Error('PREGNANCY has peri context');
if (!pregnancy.pregnancyContext) throw new Error('pregnancy header missing');
if (privateOff.privateObservations) throw new Error('private leaked');

console.log(
  JSON.stringify(
    {
      perimenopauseContext: Boolean(peri.perimenopauseContext),
      variability: peri.perimenopauseContext?.variability,
      trackHasPeri: Boolean(track.perimenopauseContext),
      pregnancyHasPeri: Boolean(pregnancy.perimenopauseContext),
      pregnancyContext: Boolean(pregnancy.pregnancyContext),
      privateDefault: Boolean(peri.privateObservations),
      written: [
        '00-report-ka-peri.html',
        '00-report-en-peri.html',
        '00-report-fr-peri.html',
        '00-report-ru-peri.html',
        '00-report-en-track.html',
        '00-report-en-pregnancy.html',
      ],
    },
    null,
    2,
  ),
);
