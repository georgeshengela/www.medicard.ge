/**
 * Cycle offline queue + overlay (pure).
 * The client must not become a second cycle engine: overlay pending USER
 * observations only. Never recompute cycle day, phase, averages, windows,
 * or confidence from elapsed time or local logs.
 *
 * Inner store schema is version 2. Encryption envelope is separate
 * (AES-256-GCM). Never log payloads, notes, or keys.
 */

'use strict';

const CYCLE_OFFLINE_SCHEMA_VERSION = 2;
const CYCLE_OFFLINE_LEGACY_SCHEMA_VERSION = 1;
const CYCLE_OFFLINE_STORAGE_KEY_V1 = 'medicard.cycle.offline.v1';
const CYCLE_OFFLINE_STORAGE_KEY = 'medicard.cycle.offline.v2';
const CYCLE_OFFLINE_DEK_KEY = 'medicard.cycle.offline.dek.v1';
const CYCLE_OFFLINE_ENCRYPTION_VERSION = 1;
const MAX_BACKOFF_MS = 300_000;
const BASE_BACKOFF_MS = 30_000;
const MAX_RETRY_AFTER_MS = 900_000;
const QUOTA_CODES = ['MONTHLY_LIMIT_REACHED', 'DAILY_LIMIT_REACHED'];

function isBleedFlow(flow) {
  return flow === 'light' || flow === 'medium' || flow === 'heavy';
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function eachYmd(start, end) {
  if (!start || !end || start > end) return [];
  const out = [];
  let cur = start;
  while (cur <= end) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
    if (out.length > 60) break;
  }
  return out;
}

function createMutationId() {
  return `c${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyAccount(userScope) {
  return {
    userScope,
    cache: null,
    queue: [],
    cooldownUntil: 0,
    authPaused: false,
  };
}

function emptyStore() {
  return { version: CYCLE_OFFLINE_SCHEMA_VERSION, accounts: {} };
}

function parseOfflineStore(raw) {
  if (raw == null || raw === '') return emptyStore();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return emptyStore();
    if (
      parsed.version !== CYCLE_OFFLINE_SCHEMA_VERSION &&
      parsed.version !== CYCLE_OFFLINE_LEGACY_SCHEMA_VERSION
    ) {
      return emptyStore();
    }
    if (!parsed.accounts || typeof parsed.accounts !== 'object' || Array.isArray(parsed.accounts)) {
      return emptyStore();
    }
    return { version: CYCLE_OFFLINE_SCHEMA_VERSION, accounts: parsed.accounts };
  } catch {
    return emptyStore();
  }
}

function isLegacyPlaintextStore(value) {
  const parsed = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  })() : value;
  return Boolean(
    parsed &&
      parsed.version === CYCLE_OFFLINE_LEGACY_SCHEMA_VERSION &&
      parsed.accounts &&
      typeof parsed.accounts === 'object' &&
      !parsed.ciphertext,
  );
}

function isEncryptedEnvelope(value) {
  const parsed = typeof value === 'string' ? (() => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  })() : value;
  return Boolean(
    parsed &&
      parsed.schemaVersion === CYCLE_OFFLINE_SCHEMA_VERSION &&
      parsed.encryptionVersion === CYCLE_OFFLINE_ENCRYPTION_VERSION &&
      typeof parsed.iv === 'string' &&
      typeof parsed.ciphertext === 'string',
  );
}

function readAccount(store, userScope) {
  const root = typeof store === 'string' || !store?.accounts ? parseOfflineStore(store) : store;
  const id = String(userScope || '');
  if (!id) return emptyAccount('');
  const raw = root.accounts[id];
  if (!raw || typeof raw !== 'object') return emptyAccount(id);
  return {
    userScope: id,
    cache: raw.cache && typeof raw.cache === 'object' ? raw.cache : null,
    queue: Array.isArray(raw.queue) ? raw.queue : [],
    cooldownUntil: Number(raw.cooldownUntil) || 0,
    authPaused: Boolean(raw.authPaused),
  };
}

function writeAccount(store, userScope, account) {
  const root = parseOfflineStore(store);
  const id = String(userScope || '');
  if (!id) return root;
  root.accounts[id] = {
    userScope: id,
    cache: account.cache ?? null,
    queue: Array.isArray(account.queue) ? account.queue : [],
    cooldownUntil: Number(account.cooldownUntil) || 0,
    authPaused: Boolean(account.authPaused),
  };
  return root;
}

function persistStore(root) {
  return JSON.stringify(root);
}

function createCacheRecord(userScope, bundle, cachedAt) {
  return {
    userScope: String(userScope),
    cachedAt: cachedAt || new Date().toISOString(),
    schemaVersion: CYCLE_OFFLINE_SCHEMA_VERSION,
    bundle,
  };
}

function createMutation(userScope, operation, payload, createdAt) {
  const date =
    payload?.date ||
    payload?.start ||
    null;
  return {
    id: createMutationId(),
    userScope: String(userScope),
    operation,
    date,
    payload: payload || {},
    createdAt: createdAt || new Date().toISOString(),
    attemptCount: 0,
    status: 'pending',
  };
}

function mutationDate(item) {
  return item?.payload?.date || item?.date || null;
}

function isLogFamily(op) {
  return op === 'UPSERT_LOG' || op === 'REMOVE_LOG';
}

/**
 * Compact consecutive UPSERT/REMOVE on the same date to the latest intended
 * state. Never compact START/END/FILL — those change meaning if merged.
 */
function compactCycleQueue(items) {
  const out = [];
  for (const item of items || []) {
    if (!item || item.status === 'failed_permanent') {
      if (item) out.push(item);
      continue;
    }
    if (!isLogFamily(item.operation)) {
      out.push(item);
      continue;
    }
    const last = out[out.length - 1];
    const sameDate =
      last &&
      last.status !== 'failed_permanent' &&
      isLogFamily(last.operation) &&
      mutationDate(last) &&
      mutationDate(last) === mutationDate(item);
    if (sameDate) {
      out[out.length - 1] = {
        ...item,
        id: last.id,
        createdAt: last.createdAt,
        attemptCount: 0,
        status: 'pending',
      };
      continue;
    }
    out.push(item);
  }
  return out;
}

function enqueueMutation(account, mutation) {
  const scoped = { ...mutation, userScope: account.userScope };
  return {
    ...account,
    queue: compactCycleQueue([...(account.queue || []), scoped]),
    authPaused: false,
  };
}

function isQuotaCode(code) {
  return QUOTA_CODES.includes(String(code || ''));
}

function classifyCycleFailure(error) {
  const status = Number(error?.status ?? error?.statusCode);
  const code = error?.code;
  if (status === 401) return 'auth_pause';
  if (status === 400 || status === 403 || status === 404 || status === 409 || status === 422) {
    return 'permanent';
  }
  if (status === 429 && isQuotaCode(code)) return 'permanent';
  if (!Number.isFinite(status) || status === 0 || status === 408 || status === 429) return 'retryable';
  if (status >= 500) return 'retryable';
  if (status >= 400 && status < 500) return 'permanent';
  return 'retryable';
}

function parseRetryAfterSeconds(raw) {
  if (raw == null || raw === '') return null;
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber >= 0) return Math.floor(asNumber);
  const when = Date.parse(String(raw));
  if (Number.isNaN(when)) return null;
  return Math.max(0, Math.ceil((when - Date.now()) / 1000));
}

function backoffMs(attemptCount, retryAfterSeconds) {
  if (retryAfterSeconds != null && Number.isFinite(Number(retryAfterSeconds))) {
    const ms = Math.floor(Number(retryAfterSeconds) * 1000);
    return Math.min(Math.max(ms, 1000), MAX_RETRY_AFTER_MS);
  }
  const n = Math.max(0, Number(attemptCount) || 0);
  return Math.min(BASE_BACKOFF_MS * 2 ** Math.min(n, 5), MAX_BACKOFF_MS);
}

function hasObservationExtras(body) {
  if (!body || typeof body !== 'object') return false;
  const symptoms = Array.isArray(body.symptoms) ? body.symptoms : [];
  const moods = Array.isArray(body.moods) ? body.moods : [];
  return (
    symptoms.length > 0 ||
    moods.length > 0 ||
    Boolean(body.notes) ||
    body.bbt != null ||
    body.sexualActivity != null ||
    body.libido != null ||
    Boolean(body.cervicalMucus) ||
    Boolean(body.ovulationTest) ||
    Boolean(body.pregnancyTest)
  );
}

/**
 * One user intent → one queued operation.
 * Start Period with only flow → START_PERIOD (server upserts that bleed day).
 * Start Period plus other observations → UPSERT_LOG only (also syncs LMP).
 * Never queue START + UPSERT together.
 */
function planQueuedLogMutations(body, options) {
  const date = body?.date;
  const markStart = Boolean(options?.markStart);
  const flow = body?.flow;
  if (markStart && !hasObservationExtras(body)) {
    return [
      {
        operation: 'START_PERIOD',
        payload: {
          date,
          flow: flow === 'light' || flow === 'heavy' || flow === 'medium' ? flow : 'medium',
        },
      },
    ];
  }
  return [{ operation: 'UPSERT_LOG', payload: { ...body, date } }];
}

function discardMutation(account, mutationId) {
  return {
    ...account,
    queue: (account.queue || []).filter((item) => item.id !== mutationId),
  };
}

function cyclePersistFeedback(result) {
  if (result?.synced) return 'synced';
  if (result?.persistedLocally) return 'device';
  if (result?.sessionOnly) return 'session';
  return 'fail';
}

function attentionItems(account) {
  return (account.queue || [])
    .filter((item) => item.status === 'failed_permanent')
    .map((item) => ({
      id: item.id,
      date: item.payload?.date || item.payload?.start || item.date || null,
      operation: item.operation,
    }));
}

function upsertLogOnBundle(bundle, date, patch, userScope) {
  const logs = Array.isArray(bundle.logs) ? bundle.logs.slice() : [];
  const idx = logs.findIndex((l) => l.date === date);
  const prev = idx >= 0 ? logs[idx] : null;
  const next = {
    id: prev?.id || `pending:${date}`,
    userId: prev?.userId || userScope || '',
    date,
    flow: patch.flow !== undefined ? patch.flow : prev?.flow ?? null,
    symptoms: patch.symptoms !== undefined ? patch.symptoms : prev?.symptoms || [],
    moods: patch.moods !== undefined ? patch.moods : prev?.moods || [],
    sexualActivity:
      patch.sexualActivity !== undefined ? patch.sexualActivity : prev?.sexualActivity ?? null,
    libido: patch.libido !== undefined ? patch.libido : prev?.libido ?? null,
    bbt: patch.bbt !== undefined ? patch.bbt : prev?.bbt ?? null,
    cervicalMucus:
      patch.cervicalMucus !== undefined ? patch.cervicalMucus : prev?.cervicalMucus ?? null,
    ovulationTest:
      patch.ovulationTest !== undefined ? patch.ovulationTest : prev?.ovulationTest ?? null,
    pregnancyTest:
      patch.pregnancyTest !== undefined ? patch.pregnancyTest : prev?.pregnancyTest ?? null,
    notes: patch.notes !== undefined ? patch.notes : prev?.notes ?? null,
  };
  if (idx >= 0) logs[idx] = next;
  else logs.push(next);
  logs.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  bundle.logs = logs;
  return next;
}

function removeLogFromBundle(bundle, date) {
  bundle.logs = (bundle.logs || []).filter((l) => l.date !== date);
}

function patchCalendarObservation(bundle, date, { flow, logged, period }) {
  if (!bundle.predictions) return;
  const cal = bundle.predictions.calendar || {};
  const prev = cal[date] ? { ...cal[date] } : {};
  const next = { ...prev };
  if (logged !== undefined) next.logged = logged;
  if (flow !== undefined) next.flow = flow;
  if (period !== undefined) next.period = period;
  if (period === true) next.predicted = false;
  cal[date] = next;
  bundle.predictions.calendar = cal;
}

function restoreCanonicalDerived(original, next) {
  next.cycleDay = original.cycleDay;
  next.phase = original.phase;
  next.phaseKa = original.phaseKa;
  next.averages = original.averages;
  next.inferred = original.inferred;
  next.periodRanges = original.periodRanges;
  next.meta = original.meta;
  next.trends = original.trends;
  next.alerts = original.alerts;
  next.summary = original.summary;
  next.pregnancy = original.pregnancy;
  if (original.profile) {
    next.profile = {
      ...next.profile,
      lastPeriodStart: original.profile.lastPeriodStart,
      avgCycleLength: original.profile.avgCycleLength,
      avgPeriodLength: original.profile.avgPeriodLength,
      aiInsights: original.profile.aiInsights,
      aiInsightsAt: original.profile.aiInsightsAt,
    };
  }
  if (original.predictions && next.predictions) {
    next.predictions.nextPeriodStart = original.predictions.nextPeriodStart;
    next.predictions.nextPeriodEnd = original.predictions.nextPeriodEnd;
    next.predictions.ovulationDate = original.predictions.ovulationDate;
    next.predictions.fertileWindow = original.predictions.fertileWindow;
    next.predictions.confidence = original.predictions.confidence;
    next.predictions.estimated = original.predictions.estimated;
    next.predictions.phases = original.predictions.phases;
    const origCal = original.predictions.calendar || {};
    const nextCal = next.predictions.calendar || {};
    for (const key of Object.keys(nextCal)) {
      const o = origCal[key];
      if (!o) continue;
      nextCal[key] = {
        ...nextCal[key],
        cycleDay: o.cycleDay,
        phase: o.phase,
        phaseKa: o.phaseKa,
        fertile: o.fertile,
        ovulation: o.ovulation,
      };
    }
  }
  return next;
}

/**
 * Overlay pending user-entered observations onto a cached canonical bundle.
 * Does not advance or recompute medical predictions.
 */
function overlayPendingOnBundle(bundle, queue, userScope) {
  if (!bundle) return { bundle: null, pendingDates: [] };
  const original = bundle;
  const next = cloneJson(bundle);
  const pendingDates = [];
  const pending = (queue || []).filter((item) => item && item.status !== 'failed_permanent');

  for (const item of pending) {
    const op = item.operation;
    const payload = item.payload || {};
    if (op === 'UPSERT_LOG') {
      const date = payload.date;
      if (!date) continue;
      upsertLogOnBundle(next, date, payload, userScope);
      const bleed = isBleedFlow(payload.flow);
      const cleared = payload.flow === 'none' || payload.flow === 'spotting';
      patchCalendarObservation(next, date, {
        flow: payload.flow,
        logged: true,
        period: bleed ? true : cleared ? false : undefined,
      });
      pendingDates.push(date);
    } else if (op === 'REMOVE_LOG') {
      const date = payload.date;
      if (!date) continue;
      removeLogFromBundle(next, date);
      patchCalendarObservation(next, date, { flow: null, logged: false, period: false });
      pendingDates.push(date);
    } else if (op === 'START_PERIOD') {
      const date = payload.date;
      if (!date) continue;
      const flow = isBleedFlow(payload.flow) ? payload.flow : 'medium';
      upsertLogOnBundle(next, date, { flow }, userScope);
      patchCalendarObservation(next, date, { flow, logged: true, period: true });
      pendingDates.push(date);
    } else if (op === 'END_PERIOD') {
      if (payload.date) pendingDates.push(payload.date);
    } else if (op === 'FILL_PERIOD') {
      const days = eachYmd(payload.start, payload.end);
      const flow = isBleedFlow(payload.flow) ? payload.flow : 'medium';
      for (const date of days) {
        const existing = (next.logs || []).find((l) => l.date === date);
        if (isBleedFlow(existing?.flow)) continue;
        upsertLogOnBundle(next, date, { flow }, userScope);
        patchCalendarObservation(next, date, { flow, logged: true, period: true });
        pendingDates.push(date);
      }
    }
  }

  restoreCanonicalDerived(original, next);
  return { bundle: next, pendingDates: [...new Set(pendingDates)] };
}

function snapshotEqualsDerived(before, after) {
  return (
    before?.cycleDay === after?.cycleDay &&
    before?.phase === after?.phase &&
    before?.phaseKa === after?.phaseKa &&
    before?.predictions?.nextPeriodStart === after?.predictions?.nextPeriodStart &&
    before?.predictions?.nextPeriodEnd === after?.predictions?.nextPeriodEnd &&
    before?.predictions?.ovulationDate === after?.predictions?.ovulationDate &&
    JSON.stringify(before?.predictions?.fertileWindow) ===
      JSON.stringify(after?.predictions?.fertileWindow) &&
    before?.predictions?.confidence === after?.predictions?.confidence &&
    before?.profile?.lastPeriodStart === after?.profile?.lastPeriodStart
  );
}

/**
 * Replay pending mutations. Successful items are dropped. On retryable/auth/
 * permanent failure, remaining items (including the failed one) stay.
 */
async function replayCycleQueue(queue, play) {
  const remaining = [];
  let flushed = 0;
  let bundle = null;
  let authPaused = false;
  let failureKind = null;
  let lastError = null;

  for (let i = 0; i < (queue || []).length; i++) {
    const item = queue[i];
    if (item.status === 'failed_permanent') {
      remaining.push(item);
      continue;
    }
    try {
      const result = await play(item);
      bundle = result ?? bundle;
      flushed += 1;
    } catch (error) {
      const kind = classifyCycleFailure(error);
      lastError = error?.message ? String(error.message) : 'error';
      failureKind = kind;
      if (kind === 'auth_pause') {
        remaining.push(item, ...queue.slice(i + 1));
        authPaused = true;
        break;
      }
      if (kind === 'permanent') {
        remaining.push(
          { ...item, status: 'failed_permanent', lastError, attemptCount: (item.attemptCount || 0) + 1 },
          ...queue.slice(i + 1),
        );
        break;
      }
      remaining.push(
        {
          ...item,
          attemptCount: (item.attemptCount || 0) + 1,
          lastError,
          status: 'pending',
          retryAfterSeconds: parseRetryAfterSeconds(error?.retryAfterSeconds ?? error?.retryAfter),
        },
        ...queue.slice(i + 1),
      );
      break;
    }
  }

  return { remaining, flushed, bundle, authPaused, failureKind, lastError };
}

function accountIsolationSafe(store, userA, userB) {
  const a = readAccount(store, userA);
  const b = readAccount(store, userB);
  return {
    aHasCache: Boolean(a.cache?.bundle),
    bHasCache: Boolean(b.cache?.bundle),
    aQueue: a.queue.length,
    bQueue: b.queue.length,
    crossLeak:
      Boolean(b.cache?.userScope && b.cache.userScope === userA) ||
      b.queue.some((item) => item.userScope === userA),
  };
}

module.exports = {
  CYCLE_OFFLINE_SCHEMA_VERSION,
  CYCLE_OFFLINE_LEGACY_SCHEMA_VERSION,
  CYCLE_OFFLINE_STORAGE_KEY,
  CYCLE_OFFLINE_STORAGE_KEY_V1,
  CYCLE_OFFLINE_DEK_KEY,
  CYCLE_OFFLINE_ENCRYPTION_VERSION,
  MAX_BACKOFF_MS,
  BASE_BACKOFF_MS,
  MAX_RETRY_AFTER_MS,
  QUOTA_CODES,
  isBleedFlow,
  cloneJson,
  addDaysYmd,
  eachYmd,
  createMutationId,
  emptyAccount,
  emptyStore,
  parseOfflineStore,
  readAccount,
  writeAccount,
  persistStore,
  createCacheRecord,
  createMutation,
  compactCycleQueue,
  enqueueMutation,
  classifyCycleFailure,
  isQuotaCode,
  parseRetryAfterSeconds,
  backoffMs,
  hasObservationExtras,
  planQueuedLogMutations,
  discardMutation,
  attentionItems,
  cyclePersistFeedback,
  isLegacyPlaintextStore,
  isEncryptedEnvelope,
  overlayPendingOnBundle,
  restoreCanonicalDerived,
  snapshotEqualsDerived,
  replayCycleQueue,
  accountIsolationSafe,
};
