import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays } from './cycle.js';
import { buildCycleDoctorSummaryData, doctorSummaryHasSensitiveLeak } from './cycleDoctorSummary.js';
import {
  DOCTOR_SUMMARY,
  OBSERVATION_REGISTRY,
  PAIN_TYPES,
  SENSITIVITY,
  STORAGE,
  getObservationDef,
} from './cycleObservationRegistry.js';
import {
  SYMPTOM_MAP_MAX_ROWS,
  buildSymptomCycleMap,
  isSymptomMapItem,
  symptomMapItemsForLog,
} from './cycleSymptomMap.js';

const TODAY = '2026-09-30';

/** Period starts every `len` days, oldest first, the last one before TODAY. */
function startsEvery(len, count, last = '2026-09-20') {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) out.push(addDays(last, -len * i));
  return out;
}

function bleedLogs(starts) {
  return starts.flatMap((s) => [0, 1, 2, 3].map((i) => ({ date: addDays(s, i), flow: i ? 'light' : 'medium' })));
}

function merge(...groups) {
  const byDate = new Map();
  for (const log of groups.flat()) {
    const prev = byDate.get(log.date) || { date: log.date, flow: 'none', symptoms: [], moods: [], painEntries: [] };
    byDate.set(log.date, {
      ...prev,
      flow: log.flow && log.flow !== 'none' ? log.flow : prev.flow,
      symptoms: [...prev.symptoms, ...(log.symptoms || [])],
      moods: [...prev.moods, ...(log.moods || [])],
      painEntries: [...prev.painEntries, ...(log.painEntries || [])],
    });
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** One extra field on cycle day `day` of each start. */
function onDay(starts, day, extra) {
  return starts.map((s) => ({ date: addDays(s, day - 1), ...extra }));
}

describe('symptom heat map — which items may appear', () => {
  it('only doctor-summary HEALTH symptoms and pain places; never moods, sex, tests, discharge or intimate symptoms', () => {
    const log = {
      date: TODAY,
      symptoms: ['bloating', 'discharge', 'vaginal_dryness', 'itching_vulva', 'protected', 'orgasm', 'sex', 'cramps', 'gas', 'heartburn'],
      moods: ['irritable', 'romantic'],
      painEntries: [{ type: 'lower_back', severity: 'mild' }],
      bbt: 36.7,
      ovulationTest: 'positive',
      cervicalMucus: 'eggwhite',
      pregnancyTest: 'negative',
      sexualActivity: true,
      libido: 3,
    };
    assert.deepEqual(symptomMapItemsForLog(log).sort(), [
      'pain:cramps',
      'pain:lower_back',
      'symptom:bloating',
    ]);
  });

  it('every eligible registry key is HEALTH and every SENSITIVE / HIGHLY_SENSITIVE key is refused', () => {
    for (const [key, defn] of Object.entries(OBSERVATION_REGISTRY)) {
      const kind = defn.storage === STORAGE.MOODS ? 'mood' : defn.storage === STORAGE.SYMPTOMS ? 'symptom' : null;
      if (!kind) continue;
      if (defn.sensitivity !== SENSITIVITY.HEALTH) {
        assert.equal(isSymptomMapItem(`${kind}:${key}`), false, key);
      }
    }
    assert.equal(isSymptomMapItem('mood:romantic'), false);
    assert.equal(isSymptomMapItem('mood:irritable'), false, 'moods are EXCLUDE in the doctor summary');
    assert.equal(isSymptomMapItem('symptom:heartburn'), false, 'HEALTH but EXCLUDE in the doctor summary');
    assert.equal(isSymptomMapItem('symptom:gas'), false, 'HEALTH but EXCLUDE in the doctor summary');
    assert.equal(isSymptomMapItem('symptom:cramps'), false, 'pain chips fold into their pain type');
    assert.equal(isSymptomMapItem('pain:cramps'), true);
    assert.equal(isSymptomMapItem('bbt:36.6'), false);
  });

  it('every possible row id passes the registry doctor-summary flag', () => {
    const ids = [...PAIN_TYPES.map((t) => `pain:${t}`)];
    for (const [key, defn] of Object.entries(OBSERVATION_REGISTRY)) {
      if (defn.storage === STORAGE.SYMPTOMS) ids.push(`symptom:${key}`);
      if (defn.storage === STORAGE.MOODS) ids.push(`mood:${key}`);
    }
    const allowed = ids.filter(isSymptomMapItem);
    assert.ok(allowed.length >= 15);
    for (const id of allowed) {
      const [kind, key] = id.split(':');
      const defn = getObservationDef(kind === 'pain' ? 'pain' : key);
      assert.ok(
        defn.doctorSummary === DOCTOR_SUMMARY.INCLUDE || defn.doctorSummary === DOCTOR_SUMMARY.INCLUDE_IF_NONEMPTY,
        `${id} ${defn.doctorSummary}`,
      );
      assert.equal(defn.sensitivity, SENSITIVITY.HEALTH, id);
      assert.notEqual(kind, 'mood', id);
    }
  });

  it('every row id in a busy history passes the doctor-summary flag', () => {
    const starts = startsEvery(28, 7);
    const everything = Object.keys(OBSERVATION_REGISTRY);
    const logs = merge(
      bleedLogs(starts),
      onDay(starts.slice(0, 6), 5, {
        symptoms: everything,
        moods: everything,
        painEntries: PAIN_TYPES.map((type) => ({ type, severity: 'mild' })),
      }),
      onDay(starts.slice(0, 6), 6, { symptoms: everything, moods: everything }),
    );
    const map = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[0], to: TODAY });
    assert.ok(map.rows.length > 0);
    for (const row of map.rows) {
      const defn = getObservationDef(row.kind === 'pain' ? 'pain' : row.key);
      assert.ok([DOCTOR_SUMMARY.INCLUDE, DOCTOR_SUMMARY.INCLUDE_IF_NONEMPTY].includes(defn.doctorSummary), row.key);
      assert.ok(row.kind === 'pain' || row.kind === 'symptom', row.kind);
    }
  });
});

describe('symptom heat map — numbers', () => {
  const starts = startsEvery(28, 7); // 6 completed cycles + the current one

  it('counts in how many cycles an item was logged on each cycle day', () => {
    const logs = merge(
      bleedLogs(starts),
      onDay(starts.slice(0, 6), 1, { painEntries: [{ type: 'cramps', severity: 'moderate' }] }),
      onDay(starts.slice(1, 6), 2, { symptoms: ['cramps'] }),
      onDay(starts.slice(2, 6), 3, { symptoms: ['cramps'] }),
    );
    const map = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[0], to: TODAY });
    assert.equal(map.cycleCount, 6);
    assert.equal(map.dayCount, 28);
    assert.equal(map.overflow, false);
    const cramps = map.rows.find((r) => r.key === 'cramps');
    assert.equal(cramps.kind, 'pain');
    assert.deepEqual(cramps.counts.slice(0, 4), [6, 5, 4, 0]);
    assert.equal(cramps.counts.length, 28);
    assert.deepEqual(cramps.peak, { from: 1, to: 1, cycles: 6 });
    assert.equal(cramps.loggedDays, 15);
    assert.equal(cramps.cyclesWithItem, 6);
  });

  it('the peak is the longest run of the busiest days', () => {
    const logs = merge(
      bleedLogs(starts),
      ...[1, 2, 3].map((d) => onDay(starts.slice(1, 6), d, { symptoms: ['bloating'] })),
      onDay(starts.slice(1, 6), 20, { symptoms: ['bloating'] }),
    );
    const map = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[0], to: TODAY });
    assert.equal(map.cycleCount, 5, 'the cycle with nothing logged does not count');
    assert.deepEqual(map.rows[0].peak, { from: 1, to: 3, cycles: 5 });
  });

  it('stretches to the longest cycle up to day 35 and buckets later days into „36+“', () => {
    const s = ['2026-03-01', '2026-04-02', '2026-05-15', '2026-06-12'];
    const logs = merge(
      bleedLogs(s),
      [
        { date: '2026-03-30', symptoms: ['dizziness'] }, // day 30 of a 32-day cycle
        { date: '2026-05-10', symptoms: ['dizziness'] }, // day 39 of a 43-day cycle → 36+
        { date: '2026-05-13', symptoms: ['dizziness'] }, // day 42, same cycle, same bucket
        { date: '2026-05-20', symptoms: ['dizziness'] }, // day 6 of the third cycle
      ],
    );
    const map = buildSymptomCycleMap({ logs, periodStarts: s, from: '2026-03-01', to: TODAY });
    assert.equal(map.dayCount, 35);
    assert.equal(map.overflow, true);
    const row = map.rows[0];
    assert.equal(row.counts.length, 36);
    assert.equal(row.counts[29], 1);
    assert.equal(row.counts[35], 1, 'one cycle, however many days past 35');
    assert.equal(row.counts[5], 1);
    assert.equal(row.loggedDays, 4);
  });

  it('a short history keeps 28 columns; a 31-day cycle widens to 31', () => {
    const s = ['2026-07-01', '2026-08-01', '2026-08-27'];
    const logs = merge(bleedLogs(s), onDay(s.slice(0, 2), 2, { symptoms: ['fatigue'] }));
    const map = buildSymptomCycleMap({ logs, periodStarts: s, from: '2026-06-01', to: TODAY });
    assert.equal(map.dayCount, 31);
    assert.equal(map.overflow, false);
  });

  it('hidden cycles are left out', () => {
    const logs = merge(bleedLogs(starts), onDay(starts.slice(0, 6), 5, { symptoms: ['acne'] }));
    const all = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[0], to: TODAY });
    const hidden = buildSymptomCycleMap({
      logs,
      periodStarts: starts,
      hiddenStarts: [starts[2], starts[4]],
      from: starts[0],
      to: TODAY,
    });
    assert.equal(all.cycleCount, 6);
    assert.equal(hidden.cycleCount, 4);
    assert.equal(hidden.rows[0].counts[4], 4);
    assert.ok(!hidden.cycles.some((c) => c.start === starts[2] || c.start === starts[4]));
  });

  it('only the last six completed cycles; the running cycle never counts', () => {
    const many = startsEvery(28, 10);
    const logs = merge(bleedLogs(many), onDay(many, 4, { symptoms: ['nausea'] }));
    const map = buildSymptomCycleMap({ logs, periodStarts: many, from: many[0], to: TODAY });
    assert.equal(map.cycleCount, 6);
    assert.deepEqual(
      map.cycles.map((c) => c.start),
      many.slice(3, 9),
    );
    assert.equal(map.rows[0].counts[3], 6);
  });

  it('at most ten rows, most frequent first; single sightings are dropped', () => {
    const keys = ['bloating', 'nausea', 'acne', 'fatigue', 'dizziness', 'migraine', 'vomiting', 'constipation', 'diarrhea', 'hair_loss', 'hot_flashes'];
    const logs = merge(
      bleedLogs(starts),
      ...keys.map((k, i) => onDay(starts.slice(0, 6 - (i % 5)), 3 + i, { symptoms: [k] })),
      [{ date: addDays(starts[1], 9), symptoms: ['headache'] }],
    );
    const map = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[0], to: TODAY });
    assert.equal(map.rows.length, SYMPTOM_MAP_MAX_ROWS);
    for (let i = 1; i < map.rows.length; i += 1) {
      assert.ok(map.rows[i - 1].loggedDays >= map.rows[i].loggedDays);
    }
    assert.ok(!map.rows.some((r) => r.key === 'headache'), 'a single sighting is dropped');
  });

  it('on a tie, pain comes before symptoms', () => {
    const logs = merge(
      bleedLogs(starts),
      onDay(starts.slice(0, 6), 9, { symptoms: ['acne'] }),
      onDay(starts.slice(0, 6), 10, { painEntries: [{ type: 'pelvic', severity: 'mild' }] }),
    );
    const map = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[0], to: TODAY });
    assert.deepEqual(map.rows.map((r) => r.kind), ['pain', 'symptom']);
  });

  it('empty → null (no logs, only sensitive logs, no completed cycle)', () => {
    assert.equal(buildSymptomCycleMap({ logs: [], periodStarts: starts, to: TODAY }), null);
    const sensitive = merge(
      bleedLogs(starts),
      onDay(starts, 14, { symptoms: ['discharge', 'unprotected', 'gas', 'heartburn'], moods: ['romantic', 'irritable'] }),
    );
    assert.equal(buildSymptomCycleMap({ logs: sensitive, periodStarts: starts, from: starts[0], to: TODAY }), null);
    assert.equal(
      buildSymptomCycleMap({
        logs: [{ date: TODAY, symptoms: ['bloating'] }],
        periodStarts: ['2026-09-20'],
        to: TODAY,
      }),
      null,
    );
  });

  it('cycles before the report range are not used', () => {
    const logs = merge(bleedLogs(starts), onDay(starts.slice(0, 6), 2, { symptoms: ['fatigue'] }));
    const map = buildSymptomCycleMap({ logs, periodStarts: starts, from: starts[3], to: TODAY });
    assert.equal(map.cycleCount, 3);
  });
});

describe('symptom heat map in the doctor summary', () => {
  const starts = startsEvery(28, 7);
  const logs = merge(
    bleedLogs(starts),
    onDay(starts.slice(0, 6), 1, { symptoms: ['cramps', 'protected'], moods: ['irritable', 'romantic'] }),
    onDay(starts.slice(0, 6), 14, { symptoms: ['discharge', 'bloating'] }),
  ).map((l) => ({ ...l, bbt: 36.6, cervicalMucus: 'eggwhite' }));

  it('is in the payload with doctor-summary HEALTH rows only and no leak', () => {
    const out = buildCycleDoctorSummaryData({ logs, today: TODAY, options: { from: starts[0] } });
    assert.ok(out.symptomMap);
    assert.equal(out.inclusions.symptomMap, true);
    assert.deepEqual(
      out.symptomMap.rows.map((r) => `${r.kind}:${r.key}`).sort(),
      ['pain:cramps', 'symptom:bloating'],
    );
    const text = JSON.stringify(out.symptomMap);
    for (const word of ['protected', 'romantic', 'irritable', 'mood', 'discharge', 'bbt', 'eggwhite', 'cervicalMucus']) {
      assert.ok(!text.includes(word), word);
    }
    assert.equal(doctorSummaryHasSensitiveLeak(out), false);
  });

  it('leaves out the cycles she hid', () => {
    const out = buildCycleDoctorSummaryData({
      logs,
      today: TODAY,
      hiddenCycles: [starts[1]],
      options: { from: starts[0] },
    });
    assert.equal(out.symptomMap.cycleCount, 5);
    assert.ok(!out.symptomMap.cycles.some((c) => c.start === starts[1]));
  });

  it('is null when nothing qualifies', () => {
    const out = buildCycleDoctorSummaryData({ logs: bleedLogs(starts), today: TODAY, options: { from: starts[0] } });
    assert.equal(out.symptomMap, null);
    assert.equal(out.inclusions.symptomMap, false);
  });
});
