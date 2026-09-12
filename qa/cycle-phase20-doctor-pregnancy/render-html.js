/**
 * Phase 20 — pregnancy doctor-summary HTML artifacts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays } from '../../server/src/lib/cycle.js';
import { buildCycleDoctorSummaryData } from '../../server/src/lib/cycleDoctorSummary.js';
import { PREGNANCY_EPISODE_ACTIVE } from '../../server/src/lib/cyclePregnancy.js';
import { buildCycleReportHtmlFromSummary } from '../../mobile/src/lib/cycleDoctorSummaryI18n.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-09-09';
const LMP = '2026-07-13';

function log(date, extra = {}) {
  return { date, flow: extra.flow ?? 'none', ...extra };
}
function bleed(start, days = 4, extra = {}) {
  const rows = [];
  for (let i = 0; i < days; i += 1) {
    rows.push(
      log(addDays(start, i), {
        flow: i === 0 ? 'heavy' : i === 1 ? 'medium' : 'light',
        ...extra,
      }),
    );
  }
  return rows;
}

const logs = [
  ...bleed('2026-06-17', 4, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
  ...bleed(LMP, 4, { painEntries: [{ type: 'pelvic', severity: 'mild' }] }),
  log('2026-08-22', { flow: 'spotting' }),
  log('2026-09-01', {
    symptoms: ['bloating', 'fatigue'],
    observations: { energy: 'low' },
    ovulationTest: 'positive',
    bbt: 36.7,
    cervicalMucus: 'eggwhite',
    pregnancyTest: 'positive',
    sexualActivity: true,
    notes: 'private journal',
  }),
];

const episode = {
  id: 'ep-qa',
  referenceDate: LMP,
  referenceType: 'LMP',
  status: PREGNANCY_EPISODE_ACTIVE,
};

const profile = { mode: 'PREGNANCY', avgCycleLength: 28, avgPeriodLength: 5 };

const pregnancy = buildCycleDoctorSummaryData({
  today: TODAY,
  profile,
  logs,
  pregnancyEpisode: episode,
});
const fertility = buildCycleDoctorSummaryData({
  today: TODAY,
  profile,
  logs,
  pregnancyEpisode: episode,
  options: { includeFertility: true },
});
const review = buildCycleDoctorSummaryData({
  today: TODAY,
  profile,
  logs,
  pregnancyEpisode: {
    id: 'ep-review',
    referenceDate: addDays(TODAY, -320),
    referenceType: 'LMP',
    status: PREGNANCY_EPISODE_ACTIVE,
  },
});

fs.writeFileSync(path.join(dir, '00-payload-pregnancy.json'), JSON.stringify(pregnancy, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-review.json'), JSON.stringify(review, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-fr-fertility.json'), JSON.stringify(fertility, null, 2));

for (const locale of ['ka', 'en', 'fr', 'ru']) {
  fs.writeFileSync(path.join(dir, `00-report-${locale}-pregnancy.html`), buildCycleReportHtmlFromSummary(pregnancy, locale));
}
fs.writeFileSync(path.join(dir, '00-report-fr-review.html'), buildCycleReportHtmlFromSummary(review, 'fr'));
fs.writeFileSync(path.join(dir, '00-report-fr-fertility.html'), buildCycleReportHtmlFromSummary(fertility, 'fr'));

const fruit = ['weekDevelopment', 'comparisonKey', 'raspberry', 'lengthCm', 'illustrationKey'];
const htmlKa = fs.readFileSync(path.join(dir, '00-report-ka-pregnancy.html'), 'utf8');
for (const key of fruit) {
  if (htmlKa.includes(key) || JSON.stringify(pregnancy).includes(`"${key}"`)) {
    throw new Error(`fruit leak: ${key}`);
  }
}

console.log(
  JSON.stringify(
    {
      pregnancyContext: Boolean(pregnancy.pregnancyContext),
      reviewRequired: Boolean(review.pregnancyContext?.reviewRequired),
      fertilityDefault: Boolean(pregnancy.fertilityObservations),
      fertilityOptIn: Boolean(fertility.fertilityObservations),
      week: pregnancy.pregnancyContext?.estimatedGestationalAge,
      due: pregnancy.pregnancyContext?.estimatedDueDate,
      written: [
        '00-report-ka-pregnancy.html',
        '00-report-en-pregnancy.html',
        '00-report-fr-pregnancy.html',
        '00-report-ru-pregnancy.html',
        '00-report-fr-review.html',
        '00-report-fr-fertility.html',
      ],
    },
    null,
    2,
  ),
);
