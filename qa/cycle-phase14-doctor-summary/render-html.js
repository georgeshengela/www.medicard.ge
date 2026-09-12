/**
 * Build PDF-source HTML from the dedicated doctor-summary serializer.
 * Native PDF uses the same payload via cycleReport.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { addDays } from '../../server/src/lib/cycle.js';
import { buildCycleDoctorSummaryData } from '../../server/src/lib/cycleDoctorSummary.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TODAY = '2026-09-09';

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

const logs = [
  ...bleed('2026-05-20', 4, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
  ...bleed('2026-06-17', 4, { painEntries: [{ type: 'cramps', severity: 'mild' }] }),
  ...bleed('2026-07-15', 4, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
  ...bleed('2026-08-12', 4, { painEntries: [{ type: 'cramps', severity: 'severe' }] }),
  log('2026-08-22', { flow: 'spotting' }),
  log('2026-08-28', { symptoms: ['acne'] }),
  log('2026-09-01', {
    symptoms: ['bloating', 'nausea', 'gas', 'migraine'],
    observations: { energy: 'low' },
    sleepQuality: 'poor',
    stressLevel: 'high',
    painEntries: [{ type: 'headache', severity: 'mild' }],
  }),
  log('2026-09-04', {
    symptoms: ['bloating', 'fatigue'],
    observations: { energy: 'low' },
    ovulationTest: 'positive',
    bbt: 36.7,
    cervicalMucus: 'eggwhite',
    pregnancyTest: 'negative',
    sexualActivity: true,
    notes: 'private journal <script>alert(1)</script>',
  }),
  log('2026-09-08', {
    symptoms: ['bloating', 'acne', 'pain_sex'],
    painEntries: [{ type: 'cramps', severity: 'moderate' }],
  }),
];

function section(title, rows) {
  if (!rows.length) return '';
  return `<h2>${title}</h2><ul>${rows.map((r) => `<li>${r}</li>`).join('')}</ul>`;
}

function html(summary) {
  const m = summary.menstrualHistory;
  const episodes = (m?.episodes || [])
    .map(
      (e) =>
        `<tr><td>${e.start}</td><td>${e.end}</td><td>${e.durationDays}</td><td>${(e.flowSequence || []).join(' → ') || '—'}</td></tr>`,
    )
    .join('');
  return `<!DOCTYPE html><html lang="ka"><head><meta charset="utf-8"/><title>Cycle doctor summary</title>
<style>
body{font-family:sans-serif;padding:32px;color:#1d1c1c}
h2{font-size:16px;page-break-after:avoid}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e5e7eb}
.disclaimer{margin-top:32px;font-size:11px;color:#666}
</style></head><body>
<h1>Medicard.GE — ციკლის კლინიკური ისტორია</h1>
<p>პერიოდი: ${summary.range.from} – ${summary.range.to}</p>
${
  episodes
    ? `<h2>მენსტრუაციის ისტორია</h2><table><thead><tr><th>დასაწყისი</th><th>დასასრული</th><th>ხანგრძლივობა</th><th>გამონადენი</th></tr></thead><tbody>${episodes}</tbody></table>
    ${m.cycleLengths?.length ? `<p>აღრიცხული ციკლის სიგრძეები: ${m.cycleLengths.map((c) => c.lengthDays).join(', ')}</p>` : ''}
    ${m.spottingDates?.length ? `<p>შუალედური წვეთოვანი სისხლდენა: ${m.spottingDates.join(', ')}</p>` : ''}`
    : ''
}
${section(
  'აღრიცხული ტკივილი',
  (summary.pain?.aggregates || []).map((p) => `${p.type}: ${p.dayCount} დღე${p.severityMode ? ` · ${p.severityMode}` : ''}`),
)}
${section(
  'სიმპტომები',
  (summary.symptoms?.rows || []).map((r) => `${r.key}: ${r.dayCount} დღე`),
)}
${section('ენერგია', (summary.wellness?.energy || []).map((r) => `${r.date} — ${r.value}`))}
${section('ძილის ხარისხი (სუბიექტური)', (summary.wellness?.sleep || []).map((r) => `${r.date} — ${r.value}`))}
${section('სტრესი', (summary.wellness?.stress || []).map((r) => `${r.date} — ${r.value}`))}
${section(
  'ნაყოფიერების ტესტები',
  [
    ...(summary.fertilityObservations?.ovulationTests || []).map((t) => `${t.date} — OPK ${t.result}`),
    ...(summary.fertilityObservations?.bbt || []).map((t) => `${t.date} — ${t.temperature} ${t.unit}`),
    ...(summary.fertilityObservations?.cervicalMucus || []).map((t) => `${t.date} — ${t.value}`),
    ...(summary.fertilityObservations?.pregnancyTests || []).map((t) => `${t.date} — pregnancy ${t.result}`),
  ],
)}
${section('სექსუალური ჯანმრთელობა', (summary.privateObservations?.sexual || []).map((r) => `${r.date} — ${r.key}`))}
${section('შენიშვნები', (summary.privateObservations?.notes || []).map((r) => `${r.date} — ${String(r.text).replace(/</g, '&lt;')}`))}
<p class="disclaimer">ინფორმაცია აღრიცხულ ჩანაწერებზეა დაფუძნებული და ისტორიაა, არა დიაგნოზი.</p>
</body></html>`;
}

const profile = { mode: 'TRACK_PERIOD', avgCycleLength: 28, avgPeriodLength: 5 };
const def = buildCycleDoctorSummaryData({ today: TODAY, profile, logs });
const opted = buildCycleDoctorSummaryData({
  today: TODAY,
  profile,
  logs,
  options: { includeFertility: true, includeSexual: true, includeNotes: true },
});

fs.writeFileSync(path.join(dir, '00-payload-default.json'), JSON.stringify(def, null, 2));
fs.writeFileSync(path.join(dir, '00-payload-opt-in.json'), JSON.stringify(opted, null, 2));
fs.writeFileSync(path.join(dir, '00-report-default.html'), html(def));
fs.writeFileSync(path.join(dir, '00-report-opt-in.html'), html(opted));

const leakKeys = ['gas', 'pain_sex', 'private journal', 'eggwhite', 'ovulationTest', 'nextPeriodStart', 'observationTrends'];
const defText = JSON.stringify(def);
const problems = leakKeys.filter((k) => defText.includes(k) && k !== 'gas' || (k === 'gas' && /\bgas\b/.test(defText) && defText.includes('"gas"')));
console.log(
  JSON.stringify(
    {
      defaultHasFertility: Boolean(def.fertilityObservations),
      defaultHasPrivate: Boolean(def.privateObservations),
      defaultHasGas: JSON.stringify(def.symptoms).includes('gas'),
      defaultHasSpotting: Boolean(def.menstrualHistory?.spottingDates?.length),
      optInHasFertility: Boolean(opted.fertilityObservations),
      defaultProblems: leakKeys.filter((k) => {
        if (k === 'gas') return (def.symptoms?.rows || []).some((r) => r.key === 'gas');
        return defText.includes(k);
      }),
    },
    null,
    2,
  ),
);
