/**
 * Phase 39 — Postpartum doctor-summary HTML artifacts.
 * Inspects rendered HTML (not string-unit tests only).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays, inferCycleStats } from '../../server/src/lib/cycle.js';
import { buildCycleDoctorSummaryData } from '../../server/src/lib/cycleDoctorSummary.js';
import { PREGNANCY_EPISODE_ACTIVE } from '../../server/src/lib/cyclePregnancy.js';
import { POSTPARTUM_EPISODE_ACTIVE } from '../../server/src/lib/cyclePostpartum.js';
import { buildCycleReportHtmlFromSummary } from '../../mobile/src/lib/cycleDoctorSummaryI18n.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-09-11';
const REF = '2026-08-19';
const STARTED = '2026-07-01';

function log(date, extra = {}) {
  return { date, flow: extra.flow ?? 'none', ...extra };
}
function bleed(start, days = 4, extra = {}) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push(log(addDays(start, i), { flow: i === 0 ? 'medium' : 'light', ...extra }));
  }
  return rows;
}

function periLogs() {
  const s4 = addDays(TODAY, -10);
  const s3 = addDays(s4, -29);
  const s2 = addDays(s3, -46);
  const s1 = addDays(s2, -31);
  const s0 = addDays(s1, -24);
  return [...bleed(s0, 4), ...bleed(s1, 3), ...bleed(s2, 5), ...bleed(s3, 4), ...bleed(s4, 3)];
}

const ppRef = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'POSTPARTUM', avgCycleLength: 28, avgPeriodLength: 5 },
  logs: [log(TODAY, { flow: 'heavy' })],
  postpartumEpisode: {
    id: 'pp-qa-ref',
    referenceDate: REF,
    status: POSTPARTUM_EPISODE_ACTIVE,
    startedAt: STARTED,
    endedAt: null,
  },
});
const ppNone = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'POSTPARTUM', avgCycleLength: 28, avgPeriodLength: 5 },
  logs: [log(TODAY, { flow: 'heavy' })],
  postpartumEpisode: {
    id: 'pp-qa-none',
    referenceDate: null,
    status: POSTPARTUM_EPISODE_ACTIVE,
    startedAt: STARTED,
    endedAt: null,
  },
});
const pregnancy = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'PREGNANCY' },
  logs: [...bleed('2026-06-17'), ...bleed('2026-07-13'), log(TODAY, { pregnancyTest: 'positive' })],
  pregnancyEpisode: {
    id: 'ep-qa',
    referenceDate: '2026-07-13',
    referenceType: 'LMP',
    status: PREGNANCY_EPISODE_ACTIVE,
  },
});
const periLogsRows = periLogs();
const peri = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'PERIMENOPAUSE', avgCycleLength: 28, avgPeriodLength: 5 },
  logs: periLogsRows,
  inferred: inferCycleStats(periLogsRows),
});
const track = buildCycleDoctorSummaryData({
  today: TODAY,
  profile: { mode: 'TRACK_PERIOD' },
  logs: bleed('2026-08-12'),
  postpartumEpisode: {
    id: 'pp-ended',
    referenceDate: REF,
    status: 'ENDED',
    startedAt: STARTED,
    endedAt: '2026-09-01',
  },
});

fs.writeFileSync(path.join(dir, '00-payload-postpartum-ref.json'), JSON.stringify(ppRef, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-postpartum-none.json'), JSON.stringify(ppNone, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-pregnancy.json'), JSON.stringify(pregnancy, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-perimenopause.json'), JSON.stringify(peri, null, 2));

for (const locale of ['ka', 'en', 'fr', 'ru']) {
  fs.writeFileSync(
    path.join(dir, `00-report-${locale}-postpartum.html`),
    buildCycleReportHtmlFromSummary(ppRef, locale),
  );
  fs.writeFileSync(
    path.join(dir, `00-report-${locale}-postpartum-none.html`),
    buildCycleReportHtmlFromSummary(ppNone, locale),
  );
}
fs.writeFileSync(path.join(dir, '00-report-en-pregnancy.html'), buildCycleReportHtmlFromSummary(pregnancy, 'en'));
fs.writeFileSync(path.join(dir, '00-report-en-perimenopause.html'), buildCycleReportHtmlFromSummary(peri, 'en'));
fs.writeFileSync(path.join(dir, '00-report-en-track.html'), buildCycleReportHtmlFromSummary(track, 'en'));

const leaks = [
  'POSTPARTUM',
  'days since birth',
  "date d'accouchement",
  'дата родов',
  'დაბადების თარიღი',
  'liveBirth',
  'birthDate',
  'deliveryDate',
  'deliveryType',
  'trackingContext',
  'plannedPlace',
  'plannedTime',
  'pp-qa-ref',
  'startedAt',
  'lochia',
];
for (const locale of ['ka', 'en', 'fr', 'ru']) {
  const html = fs.readFileSync(path.join(dir, `00-report-${locale}-postpartum.html`), 'utf8');
  for (const key of leaks) {
    if (html.includes(key)) throw new Error(`leak ${locale}: ${key}`);
  }
  if (!html.includes('report was generated') && locale === 'en') {
    throw new Error('EN missing generation-time vs range note');
  }
}
const noneEn = fs.readFileSync(path.join(dir, '00-report-en-postpartum-none.html'), 'utf8');
if (!noneEn.includes('Not provided')) throw new Error('null reference missing copy');
if (noneEn.includes('0 weeks')) throw new Error('fake zero elapsed');
if (noneEn.includes('1 July 2026')) throw new Error('startedAt reused as reference');

if (!ppRef.postpartumContext || ppRef.postpartumContext.referenceDate !== REF) {
  throw new Error('ref payload missing context');
}
if (ppRef.postpartumContext.elapsed.week !== 3 || ppRef.postpartumContext.elapsed.day !== 2) {
  throw new Error(`elapsed mismatch ${JSON.stringify(ppRef.postpartumContext.elapsed)}`);
}
if (Object.hasOwn(ppRef.postpartumContext.elapsed, 'days')) throw new Error('days field leaked');
if (ppNone.postpartumContext.referenceDate != null || ppNone.postpartumContext.elapsed != null) {
  throw new Error('no-reference payload not null');
}
if (pregnancy.postpartumContext) throw new Error('pregnancy has postpartum context');
if (!pregnancy.pregnancyContext) throw new Error('pregnancy header missing');
if (peri.postpartumContext) throw new Error('peri has postpartum context');
if (!peri.perimenopauseContext) throw new Error('peri header missing');
if (track.postpartumContext) throw new Error('TRACK has postpartum context');

const pregHtml = fs.readFileSync(path.join(dir, '00-report-en-pregnancy.html'), 'utf8');
if (!pregHtml.includes('Current pregnancy tracking context')) throw new Error('pregnancy HTML regression');
if (pregHtml.includes('Current postpartum tracking context')) throw new Error('pregnancy HTML has postpartum');

console.log(
  JSON.stringify(
    {
      postpartumRef: ppRef.postpartumContext,
      postpartumNone: ppNone.postpartumContext,
      pregnancyHasPostpartum: Boolean(pregnancy.postpartumContext),
      periHasPostpartum: Boolean(peri.postpartumContext),
      trackHasPostpartum: Boolean(track.postpartumContext),
      written: [
        '00-payload-postpartum-ref.json',
        '00-payload-postpartum-none.json',
        '00-payload-pregnancy.json',
        '00-payload-perimenopause.json',
        '00-report-ka-postpartum.html',
        '00-report-en-postpartum.html',
        '00-report-fr-postpartum.html',
        '00-report-ru-postpartum.html',
      ],
    },
    null,
    2,
  ),
);
