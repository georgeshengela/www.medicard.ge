/**
 * Server capacity monitor (2026-09-28, owner request: know before the server falls over, scale in time).
 *
 * Every instance measures itself once a minute — CPU against its cgroup limit, memory against its
 * limit, event-loop delay, GET /api p95 latency (AI/streams are POST and excluded), 5xx rate, in-flight
 * requests and a database ping — and writes one "CapacitySample" row. The instance holding the
 * `capacity-monitor` lease evaluates the whole fleet per minute and tells the owner on Director
 * Telegram when a threshold holds for several minutes, with a concrete Render step (more instances,
 * bigger plan, or "scaling will not help: look at the logs / database"). Admin page: #/capacity.
 * Samples carry numbers only — no users, paths or payloads.
 */
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { prisma } from './prisma.js';
import { acquireJobLease } from './jobLease.js';

const MINUTE = 60_000;
const RETENTION_DAYS = 7;

/** Thresholds: a rule fires when every one of the last `minutes` fleet samples is at or above it. */
export const RULES = Object.freeze([
  { key: 'cpu', label: 'CPU', unit: '%', warn: 70, critical: 90, minutes: 3, scale: 'instances' },
  { key: 'memory', label: 'მეხსიერება', unit: '%', warn: 75, critical: 90, minutes: 2, scale: 'plan' },
  { key: 'latency', label: 'პასუხის დრო (p95)', unit: 'ms', warn: 1500, critical: 3000, minutes: 3, scale: 'instances', minRequests: 20 },
  { key: 'loop', label: 'Event loop დაყოვნება', unit: 'ms', warn: 150, critical: 500, minutes: 3, scale: 'instances' },
  { key: 'errors', label: 'სერვერის შეცდომები (5xx)', unit: '%', warn: 2, critical: 10, minutes: 2, scale: 'none', minRequests: 30 },
  { key: 'db', label: 'ბაზის პასუხი', unit: 'ms', warn: 800, critical: 3000, minutes: 2, scale: 'database' },
]);

const REMIND_MS = { warn: 2 * 60 * MINUTE, critical: 30 * MINUTE };
const RECOVER_MINUTES = 10;
/** Fleet CPU we aim for after scaling out. */
const TARGET_CPU = 60;

// ---------- pure evaluation (tested) ----------

const LEVEL_RANK = { ok: 0, warn: 1, critical: 2 };

function ruleValue(rule, s) {
  if (!s) return null;
  if (rule.minRequests && (s.requests ?? 0) < rule.minRequests) return null;
  if (rule.key === 'db' && s.dbOk === false) return Number.POSITIVE_INFINITY;
  const v = { cpu: s.cpuPct, memory: s.memPct, latency: s.p95Ms, loop: s.loopP95Ms, errors: s.errorPct, db: s.dbMs }[rule.key];
  return Number.isFinite(v) || v === Number.POSITIVE_INFINITY ? v : null;
}

/**
 * Merges per-instance samples into one per-minute fleet series (oldest first).
 * CPU is the average (load is balanced), everything else the worst instance.
 */
export function fleetSeries(samples) {
  const byMinute = new Map();
  for (const row of samples) {
    const minute = Math.floor(new Date(row.at).getTime() / MINUTE) * MINUTE;
    if (!byMinute.has(minute)) byMinute.set(minute, []);
    byMinute.get(minute).push(row.data || row);
  }
  const max = (list, k) => {
    const vals = list.map((x) => x[k]).filter(Number.isFinite);
    return vals.length ? Math.max(...vals) : null;
  };
  const avg = (list, k) => {
    const vals = list.map((x) => x[k]).filter(Number.isFinite);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
  };
  const sum = (list, k) => list.reduce((a, x) => a + (Number(x[k]) || 0), 0);
  return [...byMinute.entries()].sort((a, b) => a[0] - b[0]).map(([minute, list]) => {
    const requests = sum(list, 'requests');
    const errors = sum(list, 'errors5xx');
    return {
      at: new Date(minute).toISOString(),
      instances: list.length,
      cpuPct: avg(list, 'cpuPct'),
      cpuMaxPct: max(list, 'cpuPct'),
      memPct: max(list, 'memPct'),
      memMb: max(list, 'memMb'),
      p95Ms: max(list, 'p95Ms'),
      loopP95Ms: max(list, 'loopP95Ms'),
      requests,
      errors5xx: errors,
      errorPct: requests ? Math.round((errors / requests) * 1000) / 10 : 0,
      inflightMax: sum(list, 'inflightMax'),
      dbMs: max(list, 'dbMs'),
      dbOk: list.every((x) => x.dbOk !== false),
    };
  });
}

/** Level of the fleet from the newest samples of its series. */
export function evaluate(series, rules = RULES) {
  const reasons = [];
  for (const rule of rules) {
    const recent = series.slice(-rule.minutes);
    if (recent.length < rule.minutes) continue;
    const values = recent.map((s) => ruleValue(rule, s));
    if (values.some((v) => v == null)) continue;
    const low = Math.min(...values);
    const level = low >= rule.critical ? 'critical' : low >= rule.warn ? 'warn' : null;
    if (level) reasons.push({ key: rule.key, label: rule.label, level, value: values.at(-1), unit: rule.unit, threshold: rule[level], minutes: rule.minutes, scale: rule.scale });
  }
  const level = reasons.reduce((top, r) => (LEVEL_RANK[r.level] > LEVEL_RANK[top] ? r.level : top), 'ok');
  return { level, reasons };
}

const fmtValue = (v, unit) => (v === Number.POSITIVE_INFINITY ? 'არ პასუხობს' : `${Math.round(v)}${unit === '%' ? '%' : ' ms'}`);

/** What the owner should do on Render. `instances` = instances reporting right now. */
export function recommend({ level, reasons }, { instances = 1, series = [] } = {}) {
  const steps = [];
  const keys = new Set(reasons.map((r) => r.key));
  const peakCpu = Math.max(0, ...series.slice(-10).map((s) => s.cpuPct ?? 0));
  if (level !== 'ok' && reasons.some((r) => r.scale === 'instances')) {
    const target = Math.max(instances + 1, Math.ceil((instances * Math.max(peakCpu, TARGET_CPU)) / TARGET_CPU));
    steps.push({
      action: 'scale_out',
      from: instances,
      to: target,
      text: `Render → www.medicard.ge → Scaling: Instances ${instances} → ${target} (ან ჩართე Autoscaling: min ${instances}, max ${target + 1}, CPU 70%).`,
    });
  }
  if (keys.has('memory')) {
    steps.push({ action: 'bigger_plan', text: 'Render → Compute: მეხსიერება ლიმიტთანაა — აიწიე გეგმა (1 CPU / 2 GB → 2 CPU / 4 GB). ინსტანსების დამატება გამოსადეგია, თუ ზრდა დატვირთვისგანაა და არა ერთ ინსტანსში გაჟონვისგან.' });
  }
  if (keys.has('db')) {
    steps.push({ action: 'database', text: 'ბაზა ნელა პასუხობს: Render-ის გაზრდა ამას არ შველის. შეამოწმე Neon → Monitoring (compute ზომა, კავშირები).' });
  }
  if (keys.has('errors')) {
    steps.push({ action: 'logs', text: 'სერვერის შეცდომები გაიზარდა: ჯერ Render → Logs (5xx), მასშტაბირება ხშირად არ შველის.' });
  }
  const recentWindow = series.slice(-60);
  if (level === 'ok' && instances > 1 && recentWindow.length >= 30 && recentWindow.every((s) => (s.cpuPct ?? 0) < 25 && (s.memPct ?? 0) < 60)) {
    steps.push({ action: 'scale_in', from: instances, to: instances - 1, text: `ბოლო საათი დატვირთვა დაბალია — შეგიძლია შეამცირო: Instances ${instances} → ${instances - 1}.` });
  }
  return steps;
}

export function alertText({ level, reasons }, steps, { instances }) {
  const head = level === 'critical' ? '🔴 სერვერი ზღვარზეა' : level === 'warn' ? '🟠 სერვერის დატვირთვა იზრდება' : '✅ სერვერი ნორმას დაუბრუნდა';
  const lines = [head, ''];
  if (reasons.length) {
    for (const r of reasons) lines.push(`• ${r.label}: ${fmtValue(r.value, r.unit)} (ზღვარი ${fmtValue(r.threshold, r.unit)}, ${r.minutes} წთ ზედიზედ)`);
    lines.push('');
  }
  lines.push(`ინსტანსები ახლა: ${instances}`);
  if (steps.length) {
    lines.push('', 'რა გააკეთო:');
    steps.forEach((s, i) => lines.push(`${i + 1}. ${s.text}`));
  }
  lines.push('', 'დეტალები: ადმინი → სერვერის დატვირთვა (#/capacity)');
  return lines.join('\n');
}

/**
 * Decides whether to message the owner. `last` = newest CapacityEvent (or null).
 * Up-transitions go out at once, the same level is repeated after REMIND_MS, and "recovered"
 * goes out after RECOVER_MINUTES of ok.
 */
export function decideAlert(current, last, series, now = Date.now()) {
  const lastLevel = last?.level === 'recovered' ? 'ok' : last?.level || 'ok';
  if (current.level !== 'ok') {
    if (LEVEL_RANK[current.level] > LEVEL_RANK[lastLevel]) return current.level;
    // Same or lower (critical → warn) level: repeat after the reminder interval.
    if (last && now - new Date(last.at).getTime() >= REMIND_MS[current.level]) return current.level;
    return null;
  }
  if (lastLevel === 'ok') return null;
  const tail = series.slice(-RECOVER_MINUTES);
  if (tail.length < RECOVER_MINUTES) return null;
  const stillOk = tail.every((_, i) => evaluate(series.slice(0, series.length - i)).level === 'ok');
  return stillOk ? 'recovered' : null;
}

// ---------- per-instance measurement ----------

export const INSTANCE_ID = String(process.env.RENDER_INSTANCE_ID || hostname()).split('-').slice(-1)[0] || hostname();

function readFirst(paths) {
  for (const p of paths) {
    try { return readFileSync(p, 'utf8').trim(); } catch { /* not this cgroup layout */ }
  }
  return null;
}

/** CPU cores this container may use (cgroup quota), else the env hint, else 1. */
export function cpuLimit() {
  const v2 = readFirst(['/sys/fs/cgroup/cpu.max']);
  if (v2) {
    const [quota, period] = v2.split(/\s+/);
    if (quota !== 'max' && Number(quota) > 0 && Number(period) > 0) return Number(quota) / Number(period);
  }
  const quota = Number(readFirst(['/sys/fs/cgroup/cpu/cpu.cfs_quota_us']));
  const period = Number(readFirst(['/sys/fs/cgroup/cpu/cpu.cfs_period_us']));
  if (quota > 0 && period > 0) return quota / period;
  return Number(process.env.CAPACITY_CPU_LIMIT) || 1;
}

function memoryLimitBytes() {
  const raw = readFirst(['/sys/fs/cgroup/memory.max', '/sys/fs/cgroup/memory/memory.limit_in_bytes']);
  const n = Number(raw);
  // "max" or a huge sentinel means unlimited: fall back to the plan size.
  if (Number.isFinite(n) && n > 0 && n < 2 ** 50) return n;
  return (Number(process.env.CAPACITY_MEMORY_MB) || 2048) * 1024 * 1024;
}

function memoryUsedBytes() {
  const current = Number(readFirst(['/sys/fs/cgroup/memory.current', '/sys/fs/cgroup/memory/memory.usage_in_bytes']));
  // cgroup usage includes child processes (OCR workers); rss is the fallback off-Linux.
  return Number.isFinite(current) && current > 0 ? current : process.memoryUsage().rss;
}

const LATENCY_CAP = 5000;
let bucket = null;
let inflight = 0;
let loop = null;
let lastCpu = null;
let lastCpuAt = 0;

function freshWindow() {
  return { requests: 0, errors5xx: 0, latencies: [], seen: 0, inflightMax: inflight };
}

/** Express middleware: counts /api traffic; latency only for GET (AI answers and uploads are POST). */
export function capacityMiddleware(req, res, next) {
  if (!bucket || !req.path.startsWith('/api')) return next();
  const started = process.hrtime.bigint();
  inflight += 1;
  if (inflight > bucket.inflightMax) bucket.inflightMax = inflight;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    inflight -= 1;
    const w = bucket;
    w.requests += 1;
    if (res.statusCode >= 500) w.errors5xx += 1;
    if (req.method === 'GET' && !String(res.getHeader('content-type') || '').includes('event-stream')) {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      // Reservoir sampling keeps memory flat under heavy traffic.
      w.seen += 1;
      if (w.latencies.length < LATENCY_CAP) w.latencies.push(ms);
      else {
        const j = Math.floor(Math.random() * w.seen);
        if (j < LATENCY_CAP) w.latencies[j] = ms;
      }
    }
  };
  res.on('finish', finish);
  res.on('close', finish);
  next();
}

const percentile = (list, p) => {
  if (!list.length) return null;
  const sorted = [...list].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

async function dbPing(db) {
  const start = Date.now();
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10_000)),
    ]);
    return { dbOk: true, dbMs: Date.now() - start };
  } catch {
    return { dbOk: false, dbMs: Date.now() - start };
  }
}

/** Closes the current minute and returns its sample. */
export async function takeSample(db = prisma) {
  const now = Date.now();
  const cpu = process.cpuUsage();
  let cpuPct = null;
  if (lastCpu) {
    const usedMicros = (cpu.user - lastCpu.user) + (cpu.system - lastCpu.system);
    const wallMicros = (now - lastCpuAt) * 1000;
    if (wallMicros > 0) cpuPct = Math.round((usedMicros / (wallMicros * cpuLimit())) * 1000) / 10;
  }
  lastCpu = cpu;
  lastCpuAt = now;
  const w = bucket || freshWindow();
  bucket = freshWindow();
  const used = memoryUsedBytes();
  const limit = memoryLimitBytes();
  const loopP95Ms = loop ? Math.round((loop.percentile(95) / 1e6) * 10) / 10 : null;
  const loopMaxMs = loop ? Math.round(loop.max / 1e6) : null;
  loop?.reset();
  const p95 = percentile(w.latencies, 0.95);
  return {
    cpuPct,
    memPct: Math.round((used / limit) * 1000) / 10,
    memMb: Math.round(used / 1024 / 1024),
    memLimitMb: Math.round(limit / 1024 / 1024),
    heapMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    loopP95Ms,
    loopMaxMs,
    requests: w.requests,
    errors5xx: w.errors5xx,
    p95Ms: p95 == null ? null : Math.round(p95),
    inflightMax: w.inflightMax,
    uptimeMin: Math.round(process.uptime() / 60),
    ...(await dbPing(db)),
  };
}

// ---------- persistence + fleet evaluation ----------

const isMissingTable = (error) => /Capacity(Sample|Event)|42P01|does not exist/.test(String(error?.message || error?.meta?.message || ''));

export async function loadSamples(sinceMs, db = prisma) {
  return db.$queryRaw`SELECT "instance", "at", "data" FROM "CapacitySample"
    WHERE "at" >= ${new Date(Date.now() - sinceMs)} ORDER BY "at" ASC`;
}

export async function loadEvents(limit = 30, db = prisma) {
  return db.$queryRaw`SELECT "id", "at", "level", "reasons", "message", "delivered" FROM "CapacityEvent"
    ORDER BY "at" DESC LIMIT ${limit}`;
}

async function recordEvent(level, reasons, message, delivered, db) {
  await db.$executeRaw`INSERT INTO "CapacityEvent" ("id", "level", "reasons", "message", "delivered")
    VALUES (${randomUUID()}, ${level}, ${JSON.stringify(reasons)}::jsonb, ${message}, ${delivered})`;
}

/** Current fleet status for the admin page (and the alert pass). */
export async function capacityStatus({ hours = 6, db = prisma } = {}) {
  const samples = await loadSamples(Math.max(1, Math.min(168, hours)) * 60 * MINUTE, db);
  const series = fleetSeries(samples);
  const freshSince = Date.now() - 3 * MINUTE;
  const live = new Map();
  for (const row of samples) if (new Date(row.at).getTime() >= freshSince) live.set(row.instance, { instance: row.instance, at: row.at, ...row.data });
  const instances = Math.max(1, live.size);
  const current = evaluate(series);
  return { current, instances, live: [...live.values()], series, steps: recommend(current, { instances, series }) };
}

async function alertPass(db, notify) {
  if (!(await acquireJobLease('capacity-monitor', 3 * MINUTE, { db }))) return;
  const { current, instances, series, steps } = await capacityStatus({ hours: 2, db });
  const [last] = await loadEvents(1, db);
  const decision = decideAlert(current, last, series);
  if (!decision) return;
  const message = alertText(decision === 'recovered' ? { level: 'ok', reasons: [] } : current, decision === 'recovered' ? [] : steps, { instances });
  let delivered = false;
  try {
    delivered = Boolean((await notify(message))?.delivered);
  } catch (error) {
    console.warn('[capacity] owner notice failed:', error?.message || error);
  }
  await recordEvent(decision, current.reasons, message, delivered, db);
}

let timer = null;
let purgedAt = 0;

async function tick(db, notify) {
  try {
    const data = await takeSample(db);
    const at = new Date(Math.floor(Date.now() / MINUTE) * MINUTE);
    await db.$executeRaw`INSERT INTO "CapacitySample" ("instance", "at", "data") VALUES (${INSTANCE_ID}, ${at}, ${JSON.stringify(data)}::jsonb)
      ON CONFLICT ("instance", "at") DO UPDATE SET "data" = EXCLUDED."data"`;
    await alertPass(db, notify);
    if (Date.now() - purgedAt > 60 * MINUTE) {
      purgedAt = Date.now();
      await db.$executeRaw`DELETE FROM "CapacitySample" WHERE "at" < NOW() - (${RETENTION_DAYS}::int * INTERVAL '1 day')`;
      await db.$executeRaw`DELETE FROM "CapacityEvent" WHERE "at" < NOW() - INTERVAL '90 days'`;
    }
  } catch (error) {
    if (isMissingTable(error)) {
      console.warn('[capacity] tables missing — run npm run db:install; monitor paused');
      stopCapacityMonitor();
      return;
    }
    console.warn('[capacity] tick failed:', error?.message || error);
  }
}

export function startCapacityMonitor({ db = prisma, notify } = {}) {
  if (timer) return;
  bucket = freshWindow();
  lastCpu = process.cpuUsage();
  lastCpuAt = Date.now();
  try {
    loop = monitorEventLoopDelay({ resolution: 20 });
    loop.enable();
  } catch {
    loop = null;
  }
  const send = notify || (async (text) => {
    const { notifyOwner } = await import('./director/service.js');
    return notifyOwner(text, { direction: 'system' });
  });
  // First sample one minute after boot so the CPU delta covers a full bucket, not startup.
  timer = setInterval(() => void tick(db, send), MINUTE);
  timer.unref?.();
}

export function stopCapacityMonitor() {
  if (timer) clearInterval(timer);
  timer = null;
  loop?.disable();
  loop = null;
  bucket = null;
}

/** Sends a sample alert so the owner can see what one looks like (admin „სატესტო გაფრთხილება“). */
export async function sendTestAlert({ db = prisma, notify } = {}) {
  const { instances, series } = await capacityStatus({ hours: 1, db });
  const sample = { level: 'warn', reasons: [{ key: 'cpu', label: 'CPU', level: 'warn', value: 74, unit: '%', threshold: 70, minutes: 3, scale: 'instances' }] };
  const text = `🧪 სატესტო გაფრთხილება — რეალური პრობლემა არ არის.\n\n${alertText(sample, recommend(sample, { instances, series }), { instances })}`;
  const send = notify || (async (t) => {
    const { notifyOwner } = await import('./director/service.js');
    return notifyOwner(t, { direction: 'system' });
  });
  const result = await send(text);
  return { delivered: Boolean(result?.delivered) };
}
