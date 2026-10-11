import test from 'node:test';
import assert from 'node:assert/strict';
import { buildLabUsage, canonicalTestKey, imagingRegionKey, testGroup } from './adminUsageLab.js';

const NOW = new Date('2026-10-11T09:00:00Z'); // 13:00 in Tbilisi
const at = (s) => new Date(s);

function fixture() {
  return {
    teamUserIds: ['team'],
    accountsTotal: 12,
    records: [
      { id: 'rt1', userId: 'team', type: 'LAB', createdAt: at('2026-10-03T08:00:00Z') },
      { id: 'rt2', userId: 'team', type: 'CT_MRI', createdAt: at('2026-09-13T08:00:00Z') },
      { id: 'rx', userId: 'team', type: 'PRESCRIPTION', createdAt: at('2026-09-04T08:00:00Z') },
      { id: 'r1', userId: 'u1', type: 'LAB', createdAt: at('2026-10-07T09:00:00Z') },
      { id: 'r2', userId: 'u2', type: 'SKIN', createdAt: at('2026-09-01T08:00:00Z') },
      { id: 'r3', userId: 'u3', type: 'SKINCARE', createdAt: at('2026-10-10T17:45:00Z') },
    ],
    ai: [
      { userId: 'team', mode: 'LAB', status: 'OK', latencyMs: 10000, cost: 0.01, createdAt: at('2026-10-03T08:01:00Z') },
      { userId: 'u1', mode: 'LAB', status: 'OK', latencyMs: 20000, cost: 0.02, createdAt: at('2026-10-07T09:01:00Z') },
      { userId: 'u1', mode: 'LAB_ALIGN', status: 'OK', latencyMs: 5000, cost: 0.001, createdAt: at('2026-10-09T10:00:00Z') },
      { userId: 'u2', mode: 'IMAGING', status: 'OK', latencyMs: 30000, cost: 0.03, region: 'knee', createdAt: at('2026-10-10T08:00:00Z') },
      { userId: 'u2', mode: 'IMAGING', status: 'ERROR', latencyMs: 60000, cost: 0, region: 'knee', createdAt: at('2026-10-10T08:05:00Z') },
      { userId: 'u2', mode: 'SKIN', status: 'ERROR_REVIEWED', latencyMs: 1000, cost: 0, createdAt: at('2026-10-10T08:10:00Z') },
      // Two routines, one record left (the other was deleted): the AI log wins.
      { userId: 'u3', mode: 'SKINCARE', status: 'OK', latencyMs: 16000, tokenUsage: { cost: 0.01 }, createdAt: at('2026-10-10T17:45:00Z') },
      { userId: 'u3', mode: 'SKINCARE', status: 'OK', latencyMs: 21000, tokenUsage: { cost: 0.012 }, createdAt: at('2026-10-10T17:48:00Z') },
      // Not this page's modes.
      { userId: 'u9', mode: 'SYMPTOM_CHECKER', status: 'OK', latencyMs: 1, cost: 1, createdAt: at('2026-10-10T08:00:00Z') },
      { userId: 'u9', mode: 'DOCTOR', status: 'OK', latencyMs: 1, cost: 1, createdAt: at('2026-10-10T08:00:00Z') },
    ],
    panels: [
      { userId: 'team', date: '2024-06-18', createdAt: '2026-10-03T08:00:00.000Z', explained: true, params: 53, recordIds: ['rt1'], keys: ['hemoglobin', 'glucose'] },
      { userId: 'u1', date: '2026-10-01', createdAt: '2026-10-07T09:00:00.000Z', explained: true, params: 30, recordIds: ['r1'], keys: ['hemoglobin', 'hematocrit', 'glucose'] },
      { userId: 'u1', date: '2026-05-01', createdAt: '2026-10-07T09:00:00.000Z', explained: false, params: 12, recordIds: [], keys: ['HGB', 'neutrophils_pct'] },
      // Typed-in panel (no record): stays.
      { userId: 'u4', date: '2026-09-30', createdAt: '2026-10-02T10:00:00.000Z', explained: false, params: 8, recordIds: [], keys: ['hgb', 'glucose'] },
      // Its upload was deleted: it leaves MEDILAB with it.
      { userId: 'u5', date: '2026-09-30', createdAt: '2026-10-02T10:00:00.000Z', explained: false, params: 8, recordIds: ['gone'], keys: ['hemoglobin'] },
    ],
    feedback: [{ userId: 'u2', rating: -1, mode: 'IMAGING' }, { userId: 'u1', rating: 1, mode: 'LAB' }],
    signups: [
      { id: 'u1', createdAt: at('2026-10-07T08:00:00Z') },
      { id: 'u9', createdAt: at('2026-10-08T08:00:00Z') },
    ],
    people: [
      { id: 'team', fullName: 'Demo', email: 'demo@medicard.ge', phone: null, createdAt: at('2026-03-24T08:00:00Z'), lastSeenAt: at('2026-10-11T08:00:00Z') },
      { id: 'u1', fullName: 'Nino', email: '995599123456@phone.medicard.ge', phone: null, createdAt: at('2026-10-07T08:00:00Z'), lastSeenAt: at('2026-10-10T08:00:00Z') },
      { id: 'u2', fullName: 'Giorgi', email: 'x@apple.medicard.ge', phone: null, createdAt: at('2026-08-01T08:00:00Z'), lastSeenAt: null },
      { id: 'u3', fullName: 'Ana', email: 'ana@example.com', phone: null, createdAt: at('2026-10-10T08:00:00Z'), lastSeenAt: null },
      { id: 'u4', fullName: 'Luka', email: 'luka@example.com', phone: null, createdAt: at('2026-09-01T08:00:00Z'), lastSeenAt: null },
    ],
    appActivity: [
      { userId: 'u1', date: '2026-10-07' },
      { userId: 'u1', date: '2026-10-10' },
      { userId: 'u2', date: '2026-10-10' },
    ],
    flags: [{ key: 'labs', enabled: true, effective: true }, { key: 'imaging', enabled: false, effective: false }],
  };
}

test('sheet keys fold into one test; groups and regions map to known keys', () => {
  assert.equal(canonicalTestKey('HGB'), 'hemoglobin');
  assert.equal(canonicalTestKey('hematocrit'), 'hct');
  assert.equal(canonicalTestKey('neutrophils_pct'), 'neutrophils');
  assert.equal(canonicalTestKey('total_cholesterol_hdl_ratio'), 'lipid_ratio');
  assert.equal(testGroup('hct'), 'cbc');
  assert.equal(testGroup('weird_ocr_row'), 'other');
  assert.equal(imagingRegionKey('Knee'), 'knee');
  assert.equal(imagingRegionKey('humerus / elbow / forearm'), 'arm');
  assert.equal(imagingRegionKey('somewhere else'), 'other');
  assert.equal(imagingRegionKey(null), null);
});

test('team accounts are left out unless asked for', () => {
  const d = buildLabUsage(fixture(), { now: NOW });
  assert.equal(d.installed, true);
  assert.equal(d.team.accounts, 1);
  assert.equal(d.team.users, 1);
  assert.equal(d.team.labSheets, 1);
  assert.equal(d.totals.accounts, 11);
  assert.equal(d.totals.users, 4); // u1, u2, u3, u4 — u5's only panel went with its deleted upload
  assert.equal(d.totals.labSheets, 1);
  assert.equal(d.totals.legacy.prescription, 0);
  assert.ok(d.items.every((i) => !i.person.team));
  assert.equal(d.flags.imaging.effective, false);
  assert.equal(d.flags.labs.effective, true);

  const all = buildLabUsage(fixture(), { now: NOW, includeTeam: true });
  assert.equal(all.totals.accounts, 12);
  assert.equal(all.totals.users, 5);
  assert.equal(all.totals.labSheets, 2);
  assert.equal(all.totals.imaging, 1 + 1); // team record (no AI row) + u2's OK read
  assert.equal(all.totals.legacy.prescription, 1);
  assert.equal(all.items.find((i) => i.id === 'team').person.team, true);
});

test('ladder: used → read → explained → in MEDILAB → two test dates → came back', () => {
  const d = buildLabUsage(fixture(), { now: NOW });
  const L = Object.fromEntries(d.ladder.map((s) => [s.key, s]));
  assert.equal(L.used.count, 4);
  assert.equal(L.read.count, 3); // u1 lab, u2 imaging + skin, u4 panel; u3 only made a skincare routine
  assert.equal(L.explained.count, 1);
  assert.equal(L.saved.count, 2); // u1, u4
  assert.equal(L.twoTests.count, 1); // u1: 2026-10-01 and 2026-05-01
  assert.equal(L.returned.count, 2); // u1 (7 and 9 Oct), u2 (1 Sep skin, 10 Oct imaging)
  assert.equal(L.used.rate, 100);
  assert.equal(L.read.rate, 75);
});

test('one person card: counts only, newest activity first', () => {
  const d = buildLabUsage(fixture(), { now: NOW });
  assert.equal(d.items[0].id, 'u3'); // 10 Oct 17:48
  const u1 = d.items.find((i) => i.id === 'u1');
  assert.deepEqual(u1.usage, { lab: 1, explain: 1, panels: 2, testDates: 2, panelsExplained: 1, imaging: 0, skin: 0, skincare: 0, align: 1, failed: 0 });
  assert.equal(u1.days, 2);
  assert.equal(u1.person.name, 'Nino');
  assert.equal(u1.person.contact, '+995 599 12 34 56');
  const u2 = d.items.find((i) => i.id === 'u2');
  assert.equal(u2.usage.imaging, 1);
  assert.equal(u2.usage.skin, 1); // the record stands in when there is no OK AI row
  assert.equal(u2.usage.failed, 2); // ERROR + ERROR_REVIEWED
  const u3 = d.items.find((i) => i.id === 'u3');
  assert.equal(u3.usage.skincare, 2);
  assert.equal(d.itemsTotal, 4);
});

test('period: last 30 Tbilisi days, trend covers every day', () => {
  const d = buildLabUsage(fixture(), { now: NOW, days: 30 });
  const p = d.period;
  assert.equal(p.from, '2026-09-12');
  assert.equal(p.to, '2026-10-11');
  assert.equal(p.labSheets, 1);
  assert.equal(p.explanations, 1);
  assert.equal(p.imaging, 1);
  assert.equal(p.skin, 0); // 1 Sep is outside the window
  assert.equal(p.skincare, 2);
  assert.equal(p.failed, 2);
  assert.equal(p.activeUsers, 4);
  assert.equal(p.signups, 2);
  assert.equal(p.signupsUsed, 1);
  assert.equal(p.signupUseRate, 50);
  assert.equal(p.trend.reads.length, 30);
  assert.equal(p.trend.reads.reduce((s, x) => s + x.count, 0), 2); // u1 sheet + u2 imaging
  assert.equal(p.trend.explanations.find((x) => x.day === '2026-10-07').count, 1);
  assert.equal(p.trend.active.find((x) => x.day === '2026-10-10').count, 2); // u2, u3
  const week = buildLabUsage(fixture(), { now: NOW, days: 7 });
  assert.equal(week.period.from, '2026-10-05');
  assert.equal(week.period.labSheets, 1); // 7 Oct is inside 5–11 Oct
  assert.equal(week.period.trend.reads.length, 7);
});

test('test names and regions are named only when 3+ people share them', () => {
  const real = buildLabUsage(fixture(), { now: NOW });
  assert.deepEqual(real.lab.tests, []); // hemoglobin: u1, u4 only
  assert.deepEqual(real.lab.groups, [{ key: 'other', people: 2 }]);
  assert.deepEqual(real.imaging.regions, [{ key: 'other', people: 1, reads: 1 }]);
  const all = buildLabUsage(fixture(), { now: NOW, includeTeam: true });
  assert.deepEqual(all.lab.tests.map((t) => [t.key, t.people]), [['glucose', 3], ['hemoglobin', 3]]);
  assert.ok(all.lab.groups.some((g) => g.key === 'cbc' && g.people === 3));
  assert.equal(all.imaging.regionUnknown, 1); // the team record has no region
});

test('AI quality per kind, feedback, sheet ages', () => {
  const d = buildLabUsage(fixture(), { now: NOW });
  const by = Object.fromEntries(d.ai.byMode.map((m) => [m.mode, m]));
  assert.equal(by.IMAGING.ok, 1);
  assert.equal(by.IMAGING.errors, 1);
  assert.equal(by.SKIN.reviewed, 1);
  assert.equal(by.SKINCARE.avgMs, 18500);
  assert.equal(by.SKINCARE.costUsd, 0.022);
  assert.equal(by.IMAGING.down, 1);
  assert.equal(d.ai.calls, 7);
  assert.equal(d.ai.errors, 1);
  assert.equal(d.ai.up, 1);
  assert.equal(d.totals.failedOpen, 1);
  assert.deepEqual(d.lab.testAge, { fresh: 2, year: 1, older: 0, unknown: 0 });
  assert.equal(d.lab.valuesMedian, 12);
});

test('privacy: no test dates, record ids or region text leave the builder', () => {
  const text = JSON.stringify(buildLabUsage(fixture(), { now: NOW, includeTeam: true }));
  for (const needle of ['2026-05-01', '2024-06-18', '"r1"', 'rt1', 'gone', 'hematocrit', 'neutrophils_pct', '"knee"']) {
    assert.equal(text.includes(needle), false, needle);
  }
});

test('empty data: zeros, no crash', () => {
  const d = buildLabUsage({}, { now: NOW });
  assert.equal(d.totals.users, 0);
  assert.equal(d.totals.userRate, null);
  assert.equal(d.ladder[0].count, 0);
  assert.equal(d.ladder[1].rate, null);
  assert.equal(d.items.length, 0);
  assert.equal(d.period.trend.active.length, 30);
  assert.equal(d.lab.valuesMedian, null);
  assert.deepEqual(d.lab.groups, []);
  assert.equal(d.ai.avgMs, null);
  assert.equal(d.flags.labs.effective, true);
});
