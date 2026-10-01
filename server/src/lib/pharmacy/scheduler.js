import { prisma } from '../prisma.js';
import { acquireJobLease } from '../jobLease.js';
import { syncAllPharmacySources, isSyncRunning, cleanupStaleRuns } from './sync.js';

const CHECK_MS = 15 * 60 * 1000;
const STARTUP_DELAY_MS = 2 * 60 * 1000;
// Owner rule (2026-10-01): the scrape loads the web process for ~20 minutes, so it runs once a day
// at 06:00 Tbilisi time, while almost everyone is asleep — never during the day.
const TBILISI_UTC_OFFSET_H = 4; // Georgia has no daylight saving time
const DEFAULT_SYNC_HOUR = 6;
const WINDOW_HOURS = 3; // a restart or a busy lease at 06:00 still gets a run before 09:00

function syncHour(env = process.env) {
  const hour = Number(env.PHARMACY_SYNC_HOUR);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : DEFAULT_SYNC_HOUR;
}

/**
 * True once per Tbilisi day: inside [hour, hour + WINDOW_HOURS) local time and no automatic or
 * manual run has started since today's slot opened. Outside the window it is always false.
 */
export function pharmacySyncDue(now, lastStartedAt, hour = DEFAULT_SYNC_HOUR) {
  const local = new Date(now.getTime() + TBILISI_UTC_OFFSET_H * 3600_000);
  const slotOpen = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour)
    - TBILISI_UTC_OFFSET_H * 3600_000;
  const t = now.getTime();
  if (t < slotOpen || t >= slotOpen + WINDOW_HOURS * 3600_000) return false;
  return !lastStartedAt || new Date(lastStartedAt).getTime() < slotOpen;
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
    if (!pharmacySyncDue(new Date(), last?.startedAt, syncHour())) return;
    console.log('[pharmacy-scheduler] daily slot (Tbilisi morning) — starting automatic sync…');
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
