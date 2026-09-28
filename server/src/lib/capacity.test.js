import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alertText, decideAlert, evaluate, fleetSeries, recommend } from './capacity.js';
import { capacityStatements } from '../../scripts/install-capacity.mjs';
import { readFileSync } from 'node:fs';

const base = { cpuPct: 20, memPct: 30, p95Ms: 80, loopP95Ms: 20, requests: 100, errors5xx: 0, errorPct: 0, dbMs: 20, dbOk: true };
const minutes = (n, patch = {}) => Array.from({ length: n }, (_, i) => ({ ...base, at: new Date(Date.UTC(2026, 8, 28, 12, i)).toISOString(), ...patch }));

test('install SQL is additive and only touches Capacity* tables', () => {
  const sql = readFileSync(new URL('../../prisma/20260928-capacity.sql', import.meta.url), 'utf8');
  assert.equal(capacityStatements(sql).length, 4);
  assert.throws(() => capacityStatements('DROP TABLE "User";'));
});

test('a quiet fleet is ok', () => {
  assert.deepEqual(evaluate(minutes(10)), { level: 'ok', reasons: [] });
});

test('one CPU spike does not alert; three minutes in a row does', () => {
  assert.equal(evaluate([...minutes(9), { ...base, cpuPct: 95 }]).level, 'ok');
  const hot = [...minutes(7), ...minutes(3, { cpuPct: 92 })];
  const res = evaluate(hot);
  assert.equal(res.level, 'critical');
  assert.equal(res.reasons[0].key, 'cpu');
});

test('latency and error rules need enough traffic', () => {
  assert.equal(evaluate(minutes(5, { p95Ms: 5000, requests: 3 })).level, 'ok');
  assert.equal(evaluate(minutes(5, { p95Ms: 2000 })).level, 'warn');
  assert.equal(evaluate(minutes(5, { errorPct: 12, requests: 10 })).level, 'ok');
  assert.equal(evaluate(minutes(5, { errorPct: 12 })).level, 'critical');
});

test('a database that does not answer is critical', () => {
  const res = evaluate(minutes(3, { dbOk: false, dbMs: 10000 }));
  assert.equal(res.level, 'critical');
  assert.match(alertText(res, recommend(res, { instances: 1 }), { instances: 1 }), /არ პასუხობს/);
});

test('fleet merges instances per minute: CPU averaged, latency worst, requests summed', () => {
  const at = '2026-09-28T12:00:10.000Z';
  const series = fleetSeries([
    { instance: 'a', at, data: { ...base, cpuPct: 80, p95Ms: 100, requests: 50, errors5xx: 1 } },
    { instance: 'b', at: '2026-09-28T12:00:40.000Z', data: { ...base, cpuPct: 40, p95Ms: 900, requests: 50, errors5xx: 1 } },
  ]);
  assert.equal(series.length, 1);
  assert.equal(series[0].instances, 2);
  assert.equal(series[0].cpuPct, 60);
  assert.equal(series[0].p95Ms, 900);
  assert.equal(series[0].requests, 100);
  assert.equal(series[0].errorPct, 2);
});

test('recommendation scales out to reach ~60% CPU, and names the Render step', () => {
  const series = minutes(5, { cpuPct: 95 });
  const res = evaluate(series);
  const [step] = recommend(res, { instances: 1, series });
  assert.equal(step.action, 'scale_out');
  assert.equal(step.to, 2);
  const three = recommend(res, { instances: 2, series: minutes(5, { cpuPct: 95 }) });
  assert.equal(three[0].to, 4);
  assert.match(step.text, /Scaling: Instances 1 → 2/);
});

test('memory asks for a bigger plan; database and errors say scaling will not help', () => {
  const mem = recommend(evaluate(minutes(3, { memPct: 92 })), { instances: 1 });
  assert.deepEqual(mem.map((s) => s.action), ['bigger_plan']);
  const db = recommend(evaluate(minutes(3, { dbMs: 1000 })), { instances: 1 });
  assert.deepEqual(db.map((s) => s.action), ['database']);
});

test('suggests scaling in after an hour of low load on several instances', () => {
  const quiet = minutes(60, { cpuPct: 10 });
  const steps = recommend(evaluate(quiet), { instances: 3, series: quiet });
  assert.equal(steps[0].action, 'scale_in');
  assert.equal(steps[0].to, 2);
});

test('alert decisions: escalate at once, remind later, recover after 10 quiet minutes', () => {
  const now = Date.UTC(2026, 8, 28, 13, 0);
  const warn = { level: 'warn', reasons: [] };
  const critical = { level: 'critical', reasons: [] };
  assert.equal(decideAlert(warn, null, [], now), 'warn');
  assert.equal(decideAlert(critical, { level: 'warn', at: new Date(now - 60_000) }, [], now), 'critical');
  assert.equal(decideAlert(warn, { level: 'warn', at: new Date(now - 10 * 60_000) }, [], now), null);
  assert.equal(decideAlert(warn, { level: 'warn', at: new Date(now - 3 * 3600_000) }, [], now), 'warn');
  assert.equal(decideAlert(critical, { level: 'critical', at: new Date(now - 31 * 60_000) }, [], now), 'critical');
  const ok = { level: 'ok', reasons: [] };
  assert.equal(decideAlert(ok, null, minutes(20), now), null);
  assert.equal(decideAlert(ok, { level: 'critical', at: new Date(now) }, minutes(4), now), null);
  assert.equal(decideAlert(ok, { level: 'critical', at: new Date(now) }, minutes(12), now), 'recovered');
  assert.equal(decideAlert(ok, { level: 'recovered', at: new Date(now) }, minutes(12), now), null);
});
