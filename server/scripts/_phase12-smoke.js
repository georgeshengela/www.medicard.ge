/**
 * Phase 12 — live QA/synthetic smoke against local API + target Neon.
 * Account: cycle.qa.phase6@medicard.ge
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { addDays, todayInTimeZone } from '../src/lib/cycle.js';

const BASE = process.env.PHASE12_API || 'http://127.0.0.1:4000';
const EMAIL = 'cycle.qa.phase6@medicard.ge';
const PASSWORD = 'CycleQaPhase6a';

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: res.status, json };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const login = await req('POST', '/api/auth/login', { body: { email: EMAIL, password: PASSWORD } });
  assert(login.status === 200 && login.json?.token, `login failed ${login.status}`);
  const token = login.json.token;
  const userId = login.json.user.id;
  const today = todayInTimeZone();
  const richDate = addDays(today, -3);
  const legacyDate = addDays(today, -4);
  const unknownStoredDate = addDays(today, -5);
  const emptyObsDate = addDays(today, -6);

  const results = {};

  const write = await req('PUT', `/api/cycle/logs/${richDate}`, {
    token,
    body: {
      flow: 'none',
      symptoms: ['bloating', 'acne', 'unprotected'],
      moods: ['anxious'],
      painEntries: [{ type: 'cramps', severity: 'mild' }],
      energy: 'low',
      observations: { energy: 'low' },
      bbt: 36.6,
      cervicalMucus: 'creamy',
      ovulationTest: 'negative',
      pregnancyTest: 'negative',
      sexualActivity: true,
      libido: 2,
      notes: 'phase12 private note',
    },
  });
  assert(write.status === 200, `rich write ${write.status} ${JSON.stringify(write.json)}`);
  const log = write.json.log;
  results.writeRead = {
    energy: log.energy,
    observations: log.observations,
    symptoms: log.symptoms,
    ovulationTest: log.ovulationTest,
    bbt: log.bbt,
    cervicalMucus: log.cervicalMucus,
    pregnancyTest: log.pregnancyTest,
    sexualActivity: log.sexualActivity,
    notes: log.notes,
  };
  assert(log.energy === 'low', 'energy missing');
  assert(log.observations?.energy === 'low', 'observations.energy missing');
  assert(log.symptoms.includes('bloating') && log.symptoms.includes('acne'), 'skin/digestion missing');
  assert(log.ovulationTest === 'negative' && log.bbt === 36.6 && log.cervicalMucus === 'creamy', 'fertility missing');
  assert(log.pregnancyTest === 'negative' && log.sexualActivity === true, 'private missing');

  const unknown = await req('PUT', `/api/cycle/logs/${richDate}`, {
    token,
    body: { observations: { mystery_key: true, energy: 'high' } },
  });
  results.unknownWrite = { status: unknown.status, error: unknown.json?.error };
  assert(unknown.status === 400, `unknown write expected 400 got ${unknown.status}`);
  const afterUnknown = await req('GET', '/api/cycle/', { token });
  const richAfterUnknown = afterUnknown.json.logs.find((row) => row.date === richDate);
  assert(!Object.hasOwn(richAfterUnknown.observations || {}, 'mystery_key'), 'unknown key persisted');
  assert(richAfterUnknown.observations?.energy === 'low', 'good energy clobbered by failed unknown write');

  await prisma.cycleLog.upsert({
    where: { userId_date: { userId, date: legacyDate } },
    create: {
      id: randomUUID(),
      userId,
      date: legacyDate,
      flow: 'none',
      symptoms: ['headache', 'bloating'],
      moods: [],
      painEntries: [{ type: 'headache', severity: 'moderate' }],
      observations: {},
      observationSchemaVersion: 1,
    },
    update: {
      flow: 'none',
      symptoms: ['headache', 'bloating'],
      moods: [],
      painEntries: [{ type: 'headache', severity: 'moderate' }],
    },
  });
  const rawLegacy = await prisma.cycleLog.findUnique({ where: { userId_date: { userId, date: legacyDate } } });
  const bundleLegacy = await req('GET', '/api/cycle/', { token });
  const shapedLegacy = bundleLegacy.json.logs.find((row) => row.date === legacyDate);
  results.legacy = {
    dbSymptoms: rawLegacy.symptoms,
    dbPain: rawLegacy.painEntries,
    shapedSymptoms: shapedLegacy.symptoms,
    shapedPain: shapedLegacy.painEntries,
  };
  assert(JSON.stringify(rawLegacy.symptoms).includes('headache'), 'read destroyed legacy headache chip');
  assert(shapedLegacy.painEntries.some((p) => p.type === 'headache'), 'pain missing');

  const editLegacy = await req('PUT', `/api/cycle/logs/${legacyDate}`, {
    token,
    body: {
      symptoms: ['headache', 'bloating', 'acne'],
      painEntries: [{ type: 'headache', severity: 'moderate' }],
    },
  });
  assert(editLegacy.status === 200, `legacy edit ${editLegacy.status}`);
  results.legacyAfterWrite = {
    symptoms: editLegacy.json.log.symptoms,
    painEntries: editLegacy.json.log.painEntries,
  };
  assert(!editLegacy.json.log.symptoms.includes('headache'), 'headache chip not stripped on write');
  assert(editLegacy.json.log.symptoms.includes('bloating') && editLegacy.json.log.symptoms.includes('acne'), 'other chips lost');

  await prisma.cycleLog.upsert({
    where: { userId_date: { userId, date: unknownStoredDate } },
    create: {
      id: randomUUID(),
      userId,
      date: unknownStoredDate,
      flow: 'none',
      symptoms: ['bloating'],
      moods: [],
      observations: { energy: 'normal', mystery_stored: true },
      observationSchemaVersion: 1,
    },
    update: {
      observations: { energy: 'normal', mystery_stored: true },
    },
  });
  const rawUnknown = await prisma.cycleLog.findUnique({
    where: { userId_date: { userId, date: unknownStoredDate } },
  });
  const bundleUnknown = await req('GET', '/api/cycle/', { token });
  const shapedUnknown = bundleUnknown.json.logs.find((row) => row.date === unknownStoredDate);
  results.unknownStored = {
    dbKeys: Object.keys(rawUnknown.observations || {}),
    shaped: shapedUnknown.observations,
  };
  assert(rawUnknown.observations.mystery_stored === true, 'stored unknown not in DB');
  assert(!Object.hasOwn(shapedUnknown.observations || {}, 'mystery_stored'), 'unknown shown as canonical');
  assert(shapedUnknown.observations?.energy === 'normal', 'known energy dropped');

  const nextWrite = await req('PUT', `/api/cycle/logs/${unknownStoredDate}`, {
    token,
    body: { energy: 'high' },
  });
  assert(nextWrite.status === 200, `normalize write ${nextWrite.status}`);
  const afterNorm = await prisma.cycleLog.findUnique({
    where: { userId_date: { userId, date: unknownStoredDate } },
  });
  results.unknownAfterWrite = afterNorm.observations;
  assert(!Object.hasOwn(afterNorm.observations || {}, 'mystery_stored'), 'unknown not normalized away');
  assert(afterNorm.observations.energy === 'high', 'energy not updated');

  const emptyKeep = await req('PUT', `/api/cycle/logs/${emptyObsDate}`, {
    token,
    body: { flow: 'none', moods: ['calm'], observations: { energy: 'low' } },
  });
  assert(emptyKeep.status === 200);
  const cleared = await req('PUT', `/api/cycle/logs/${emptyObsDate}`, {
    token,
    body: { energy: null, observations: { energy: null } },
  });
  assert(cleared.status === 200);
  results.removeToEmpty = {
    moods: cleared.json.log.moods,
    observations: cleared.json.log.observations,
    flow: cleared.json.log.flow,
  };
  assert(cleared.json.log.moods.includes('calm'), 'ordinary log deleted');
  assert(Object.keys(cleared.json.log.observations || {}).length === 0, 'observations not empty');

  const startNullEnergy = await req('PUT', `/api/cycle/logs/${addDays(today, -7)}`, {
    token,
    body: { flow: 'medium', energy: null },
  });
  results.startPeriodNullEnergy = { status: startNullEnergy.status, flow: startNullEnergy.json.log?.flow };
  assert(startNullEnergy.status === 200 && startNullEnergy.json.log.flow === 'medium', 'start period flow lost');

  const pred = bundleUnknown.json.inferred || bundleUnknown.json.predictions;
  results.predictions = {
    nextPeriodStart: afterUnknown.json.inferred?.nextPeriodStart || afterUnknown.json.predictions?.nextPeriodStart,
    ovulationDate: afterUnknown.json.inferred?.ovulationDate || afterUnknown.json.predictions?.ovulationDate,
    fertileWindow: afterUnknown.json.inferred?.fertileWindow || afterUnknown.json.predictions?.fertileWindow,
    confidence: afterUnknown.json.inferred?.confidence || afterUnknown.json.predictions?.confidence,
    dailyMetricsSample: (afterUnknown.json.dailyMetrics || []).slice(0, 1),
    logCount: afterUnknown.json.logs?.length,
  };
  void pred;

  console.log(JSON.stringify({ ok: true, userId, today, results }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
