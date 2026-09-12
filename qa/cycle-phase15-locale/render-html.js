/**
 * Phase 15 — localized doctor-summary HTML artifacts from one structured payload.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays } from '../../server/src/lib/cycle.js';
import { buildCycleDoctorSummaryData } from '../../server/src/lib/cycleDoctorSummary.js';
import { buildCycleReportHtmlFromSummary } from '../../mobile/src/lib/cycleDoctorSummaryI18n.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-09-09';

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
  ...bleed('2026-07-15', 4, { painEntries: [{ type: 'pelvic', severity: 'mild' }] }),
  ...bleed('2026-08-12', 4, {
    painEntries: [
      { type: 'cramps', severity: 'severe' },
      { type: 'pelvic', severity: 'moderate' },
    ],
  }),
  log('2026-08-22', { flow: 'spotting' }),
  log('2026-09-01', {
    symptoms: ['bloating', 'fatigue', 'migraine', 'hair_loss'],
    observations: { energy: 'low' },
    sleepQuality: 'poor',
    stressLevel: 'high',
    ovulationTest: 'positive',
    bbt: 36.7,
    cervicalMucus: 'eggwhite',
    pregnancyTest: 'negative',
    sexualActivity: true,
    notes: 'private journal <script>alert(1)</script>',
  }),
];

const profile = {
  mode: 'TRACK_PERIOD',
  avgCycleLength: 28,
  avgPeriodLength: 5,
  contraceptionMethod: 'BARRIER',
};

const def = buildCycleDoctorSummaryData({ today: TODAY, profile, logs });
const fertility = buildCycleDoctorSummaryData({
  today: TODAY,
  profile,
  logs,
  options: { includeFertility: true },
});
const priv = buildCycleDoctorSummaryData({
  today: TODAY,
  profile,
  logs,
  options: { includeSexual: true, includeNotes: true },
});

fs.writeFileSync(path.join(dir, '00-payload-default.json'), JSON.stringify(def, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-fertility.json'), JSON.stringify(fertility, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-private.json'), JSON.stringify(priv, null, 2));

for (const locale of ['ka', 'en', 'fr', 'ru']) {
  fs.writeFileSync(path.join(dir, `00-report-${locale}-default.html`), buildCycleReportHtmlFromSummary(def, locale));
}
fs.writeFileSync(path.join(dir, '00-report-fr-fertility.html'), buildCycleReportHtmlFromSummary(fertility, 'fr'));
fs.writeFileSync(path.join(dir, '00-report-fr-private.html'), buildCycleReportHtmlFromSummary(priv, 'fr'));

console.log(
  JSON.stringify(
    {
      defaultHasFertility: Boolean(def.fertilityObservations),
      defaultHasPrivate: Boolean(def.privateObservations),
      fertilityHasBbt: Boolean(fertility.fertilityObservations?.bbt?.length),
      privateHasNotes: Boolean(priv.privateObservations?.notes?.length),
      written: [
        '00-report-ka-default.html',
        '00-report-en-default.html',
        '00-report-fr-default.html',
        '00-report-ru-default.html',
        '00-report-fr-fertility.html',
        '00-report-fr-private.html',
      ],
    },
    null,
    2,
  ),
);
