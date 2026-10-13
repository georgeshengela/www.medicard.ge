// MEDIHOROSCOPE background work (one instance via JobLease): keeps every sign's readings ready ahead of time
// — tomorrow's day reading is written the day before, so at 00:00 Tbilisi the new day is already there — and
// fills the reading library in small batches.
import { acquireJobLease } from '../jobLease.js';
import { SIGNS } from './astro.js';
import { currentPeriodKeys, weekKey } from './generate.js';
import { generateSignReading } from './writer.js';
import { fillLibrary } from './library.js';
import { llmConfigured } from './llm.js';
import {
  closeStaleRuns, existingReadingIds, finishRun, modelsFrom, readConfig, readingId, saveReading, startRun,
} from './store.js';

const CHECK_MS = 10 * 60 * 1000;
const LEASE = 'horoscope-scheduler';
const PARALLEL = 3;

const addDays = (ymd, n) => new Date(Date.parse(`${ymd}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

/** Periods that must exist now, plus the next ones shortly before they start. */
export function wantedPeriods(now = new Date()) {
  const k = currentPeriodKeys(now);
  const out = [['day', k.day], ['day', k.tomorrow], ['week', k.week], ['month', k.month], ['year', k.year]];
  const dow = new Date(`${k.day}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) out.push(['week', weekKey(addDays(k.day, 7))]);
  const [y, m, d] = k.day.split('-').map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (lastDay - d < 2) out.push(['month', m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`]);
  if (m === 12 && d >= 20) out.push(['year', String(y + 1)]);
  return out;
}

async function inParallel(items, limit, fn) {
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

/** Writes every missing reading for the wanted periods. Returns { ok, failed, cost }. */
export async function ensureReadings({ now = new Date(), max = 36, force = null } = {}) {
  const config = await readConfig();
  if (!config.aiEnabled || !llmConfigured()) return { ok: 0, failed: 0, cost: 0, skipped: 'off' };
  const periods = force ? [force] : wantedPeriods(now);
  const jobs = [];
  for (const [kind, key] of periods) for (const sign of SIGNS) jobs.push({ kind, key, sign });
  const have = await existingReadingIds(jobs.map((j) => readingId(j.kind, j.key, j.sign, 'ai')));
  const todo = jobs.filter((j) => !have.has(readingId(j.kind, j.key, j.sign, 'ai'))).slice(0, max);
  if (!todo.length) return { ok: 0, failed: 0, cost: 0 };
  const runId = await startRun('readings', todo[0].key);
  const result = { ok: 0, failed: 0, cost: 0, errors: [] };
  const models = modelsFrom(config);
  await inParallel(todo, PARALLEL, async (j) => {
    try {
      const r = await generateSignReading({ sign: j.sign, kind: j.kind, key: j.key, models, extraStyle: config.extraStyle });
      await saveReading({ kind: j.kind, periodKey: j.key, sign: j.sign, source: 'ai', body: r.body, sky: r.snapshot, model: r.model, costUsd: r.costUsd });
      result.ok += 1;
      result.cost += r.costUsd || 0;
    } catch (err) {
      result.failed += 1;
      if (result.errors.length < 5) result.errors.push(`${j.kind}:${j.key}:${j.sign} — ${String(err?.message || err).slice(0, 160)}`);
    }
  });
  await finishRun(runId, { status: result.failed && !result.ok ? 'FAILED' : 'DONE', ok: result.ok, failed: result.failed, costUsd: Math.round(result.cost * 10000) / 10000, detail: { periods: [...new Set(todo.map((j) => `${j.kind}:${j.key}`))], errors: result.errors } });
  return result;
}

/** Writes one reading again (admin „ხელახლა დაწერა“). */
export async function regenerateReading({ kind, key, sign }) {
  const config = await readConfig();
  const r = await generateSignReading({ sign, kind, key, models: modelsFrom(config), extraStyle: config.extraStyle });
  await saveReading({ kind, periodKey: key, sign, source: 'ai', body: r.body, sky: r.snapshot, model: r.model, costUsd: r.costUsd, replace: true });
  return r;
}

export async function runLibraryFill({ maxBatches = 4, priority = [] } = {}) {
  const config = await readConfig();
  if (!config.aiEnabled || !llmConfigured()) return { skipped: 'off' };
  const runId = await startRun('library', null);
  const r = await fillLibrary({ models: modelsFrom(config), maxBatches, priority, year: Number(currentPeriodKeys().year) });
  await finishRun(runId, { status: r.failed && !r.ok ? 'FAILED' : 'DONE', ok: r.ok, failed: r.failed, costUsd: Math.round(r.cost * 10000) / 10000, detail: { remaining: r.remaining } });
  return r;
}

let timer = null;
let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    if (!(await acquireJobLease(LEASE, CHECK_MS * 3))) return;
    await closeStaleRuns();
    await ensureReadings();
    const config = await readConfig();
    if (config.libraryAutoFill) await runLibraryFill({ maxBatches: 4 });
  } catch (err) {
    console.error('[horoscope] scheduler tick failed:', err?.message || err);
  } finally {
    busy = false;
  }
}

/** Starts the scheduler (production only — called from server.js). */
export function startHoroscopeScheduler() {
  if (timer) return;
  timer = setInterval(tick, CHECK_MS);
  timer.unref?.();
  setTimeout(tick, 90 * 1000).unref?.();
}

export function stopHoroscopeScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
