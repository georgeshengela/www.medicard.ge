import { prisma } from '../prisma.js';
import { acquireJobLease } from '../jobLease.js';
import { syncAllPharmacySources, isSyncRunning, cleanupStaleRuns } from './sync.js';

const DEFAULT_INTERVAL_HOURS = 6;
const CHECK_MS = 15 * 60 * 1000;
const STARTUP_DELAY_MS = 2 * 60 * 1000;

function intervalMs() {
  const hours = Number(process.env.PHARMACY_SYNC_CRON_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_INTERVAL_HOURS) * 60 * 60 * 1000;
}

let timer = null;
let ticking = false;

async function lastFinishedAllRun() {
  return prisma.syncRun.findFirst({
    where: { source: 'ALL', status: { in: ['DONE', 'FAILED'] } },
    orderBy: { startedAt: 'desc' },
  });
}

async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    // One scheduler across instances (the separate Render cron still guards itself via isSyncRunning).
    if (!(await acquireJobLease('pharmacy-sync-scheduler', CHECK_MS * 2))) return;
    await cleanupStaleRuns();
    if (await isSyncRunning()) return;
    const last = await lastFinishedAllRun();
    const due = !last || Date.now() - new Date(last.startedAt).getTime() >= intervalMs();
    if (!due) return;
    console.log('[pharmacy-scheduler] interval elapsed — starting automatic sync…');
    await syncAllPharmacySources();
  } catch (err) {
    console.error('[pharmacy-scheduler] automatic sync failed:', err?.message || err);
  } finally {
    ticking = false;
  }
}

/**
 * PHARMACY_SYNC_IN_WEB=off keeps the Playwright scrape out of the web process (memory on a single
 * instance). Only set it once the separate Render cron `medicard-pharmacy-sync` is confirmed running.
 */
export function pharmacySyncInWebEnabled(env = process.env) {
  return String(env.PHARMACY_SYNC_IN_WEB || '').trim().toLowerCase() !== 'off';
}

export function startPharmacySyncScheduler() {
  if (timer) return;
  if (!pharmacySyncInWebEnabled()) {
    console.log('[pharmacy-scheduler] off in the web process (PHARMACY_SYNC_IN_WEB=off) — the cron service syncs prices');
    return;
  }
  timer = setTimeout(() => {
    void tick();
    timer = setInterval(() => void tick(), CHECK_MS);
    timer.unref?.();
  }, STARTUP_DELAY_MS);
  timer.unref?.();
}

export function stopPharmacySyncScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
