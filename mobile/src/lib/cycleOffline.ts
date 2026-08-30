import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { api, ApiError, type CycleBundle } from '@/lib/api';
import { deletePreference, getPreference, setPreferenceStrict } from '@/lib/storage';
import {
  CYCLE_OFFLINE_DEK_KEY,
  CYCLE_OFFLINE_STORAGE_KEY,
  CYCLE_OFFLINE_STORAGE_KEY_V1,
  attentionItems,
  backoffMs,
  compactCycleQueue,
  createCacheRecord,
  createMutation,
  discardMutation,
  emptyAccount,
  emptyStore,
  enqueueMutation,
  overlayPendingOnBundle,
  parseOfflineStore,
  planQueuedLogMutations,
  readAccount,
  replayCycleQueue,
  writeAccount,
  type CycleMutation,
  type CycleOfflineAccount,
  type CycleOfflineOperation,
  type CycleOfflineStore,
} from './cycleOfflineCore';
import {
  b64ToBytes,
  bytesToB64,
  decryptStore,
  encryptStore,
  generateDekBytes,
  migratePlaintextToEncrypted,
} from './cycleOfflineCrypto';

export type CycleSyncState =
  | 'synced'
  | 'saving'
  | 'saved_offline'
  | 'sync_needed'
  | 'sync_failed'
  | 'auth_paused';

export type CycleView = {
  display: CycleBundle;
  canonical: CycleBundle;
  stale: boolean;
  reachable: boolean;
  cachedAt: string | null;
  pendingCount: number;
  pendingDates: string[];
  syncState: CycleSyncState;
  lastError: string | null;
  persistedLocally: boolean;
  attention: CycleAttentionItem[];
};

export type CycleFlushResult = {
  flushed: number;
  remaining: number;
  bundle: CycleBundle | null;
  authPaused: boolean;
  skipped: boolean;
  failureKind: string | null;
};

export class CyclePersistError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.name = 'CyclePersistError';
    this.code = code;
  }
}

export type PersistResult = {
  view: CycleView | null;
  synced: boolean;
  persistedLocally: boolean;
  sessionOnly?: boolean;
};

export type CycleAttentionItem = {
  id: string;
  date: string | null;
  operation: CycleOfflineOperation;
};

const GET_TIMEOUT_MS = 20_000;
const MUT_TIMEOUT_MS = 30_000;

let flushLock: Promise<CycleFlushResult> | null = null;
let accountWrite: Promise<void> = Promise.resolve();

function withAccountWrite<T>(fn: () => Promise<T>): Promise<T> {
  const run = accountWrite.then(fn, fn);
  accountWrite = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

let webSessionStore: CycleOfflineStore | null = null;
let dekCache: Uint8Array | null = null;

function durableOfflineEnabled() {
  return Platform.OS !== 'web';
}

async function loadDek(): Promise<Uint8Array> {
  if (dekCache) return dekCache;
  if (Platform.OS === 'web') {
    const err = new CyclePersistError('cycle_offline_web_no_dek');
    throw err;
  }
  try {
    const existing = await SecureStore.getItemAsync(CYCLE_OFFLINE_DEK_KEY);
    if (existing) {
      dekCache = b64ToBytes(existing);
      return dekCache;
    }
    const next = generateDekBytes();
    await SecureStore.setItemAsync(CYCLE_OFFLINE_DEK_KEY, bytesToB64(next), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    dekCache = next;
    return next;
  } catch (error) {
    if (error instanceof CyclePersistError) throw error;
    throw new CyclePersistError('cycle_offline_dek_unavailable');
  }
}

async function readEncryptedEnvelope(): Promise<string | null> {
  return getPreference(CYCLE_OFFLINE_STORAGE_KEY);
}

async function writeEncryptedEnvelope(raw: string): Promise<void> {
  await setPreferenceStrict(CYCLE_OFFLINE_STORAGE_KEY, raw);
}

async function deletePlaintextV1(): Promise<void> {
  await deletePreference(CYCLE_OFFLINE_STORAGE_KEY_V1);
}

async function loadRootStore(): Promise<CycleOfflineStore> {
  if (!durableOfflineEnabled()) {
    const leftover = await getPreference(CYCLE_OFFLINE_STORAGE_KEY_V1);
    if (leftover) {
      const parsed = parseOfflineStore(leftover);
      if (!webSessionStore) webSessionStore = parsed;
      await deletePlaintextV1();
    }
    return webSessionStore ?? emptyStore();
  }

  const dek = await loadDek();
  const envelope = await readEncryptedEnvelope();
  if (envelope) {
    try {
      return await decryptStore(envelope, dek);
    } catch {
      // Unreadable envelope must not lock Cycle (date pick, logs, TTC).
      try {
        await deletePreference(CYCLE_OFFLINE_STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return emptyStore();
    }
  }

  const plaintext = await getPreference(CYCLE_OFFLINE_STORAGE_KEY_V1);
  if (plaintext) {
    const result = await migratePlaintextToEncrypted(plaintext, dek, {
      writeEncrypted: writeEncryptedEnvelope,
      readEncrypted: readEncryptedEnvelope,
      deletePlaintext: deletePlaintextV1,
    });
    return result.store;
  }

  return emptyStore();
}

async function persistRootStore(root: CycleOfflineStore): Promise<void> {
  try {
    if (!durableOfflineEnabled()) {
      webSessionStore = root;
      return;
    }
    const dek = await loadDek();
    const envelope = await encryptStore(root, dek);
    await writeEncryptedEnvelope(envelope);
    const verify = await readEncryptedEnvelope();
    if (!verify) throw new CyclePersistError('cycle_offline_write_verify_failed');
    await decryptStore(verify, dek);
  } catch (error) {
    if (error instanceof CyclePersistError) throw error;
    throw new CyclePersistError('cycle_offline_persist_failed');
  }
}

export async function loadCycleAccount(userId: string): Promise<CycleOfflineAccount> {
  const root = await loadRootStore();
  return readAccount(root, userId);
}

async function saveCycleAccount(userId: string, account: CycleOfflineAccount): Promise<void> {
  const root = writeAccount(await loadRootStore(), userId, account);
  await persistRootStore(root);
}

function viewFromAccount(
  account: CycleOfflineAccount,
  extras?: Partial<CycleView>,
): CycleView | null {
  const canonical = account.cache?.bundle;
  if (!canonical) return extras?.display
    ? {
        display: extras.display,
        canonical: extras.display,
        stale: true,
        reachable: extras.reachable ?? false,
        cachedAt: extras.cachedAt ?? null,
        pendingCount: account.queue.filter((i) => i.status !== 'failed_permanent').length,
        pendingDates: [],
        syncState: extras.syncState ?? 'sync_needed',
        lastError: extras.lastError ?? null,
        persistedLocally: extras.persistedLocally ?? false,
        attention: extras.attention ?? attentionItems(account),
      }
    : null;
  const pending = account.queue.filter((i) => i.status !== 'failed_permanent');
  const { bundle: display, pendingDates } = overlayPendingOnBundle(
    canonical,
    account.queue,
    account.userScope,
  );
  const failed = account.queue.some((i) => i.status === 'failed_permanent');
  const syncState: CycleSyncState = account.authPaused
    ? 'auth_paused'
    : failed
      ? 'sync_failed'
      : pending.length
        ? 'saved_offline'
        : extras?.stale
          ? 'sync_needed'
          : 'synced';
  return {
    display: display ?? canonical,
    canonical,
    stale: extras?.stale ?? (pending.length > 0 || Boolean(extras?.stale)),
    reachable: extras?.reachable ?? false,
    cachedAt: account.cache?.cachedAt ?? null,
    pendingCount: pending.length,
    pendingDates,
    syncState: extras?.syncState ?? syncState,
    lastError: extras?.lastError ?? null,
    persistedLocally: extras?.persistedLocally ?? pending.length > 0,
    attention: extras?.attention ?? attentionItems(account),
  };
}

export async function cacheCycleBundle(userId: string, bundle: CycleBundle): Promise<void> {
  await withAccountWrite(async () => {
    const account = await loadCycleAccount(userId);
    account.cache = createCacheRecord(userId, bundle);
    await saveCycleAccount(userId, account);
  });
}

async function playMutation(item: CycleMutation): Promise<CycleBundle> {
  const payload = item.payload || {};
  if (item.operation === 'UPSERT_LOG') {
    const date = String(payload.date || '');
    const { date: _d, ...body } = payload;
    const res = await api.cycle.upsertLog(date, body, { timeoutMs: MUT_TIMEOUT_MS });
    return res.bundle;
  }
  if (item.operation === 'REMOVE_LOG') {
    return api.cycle.removeLog(String(payload.date || ''), { timeoutMs: MUT_TIMEOUT_MS });
  }
  if (item.operation === 'START_PERIOD') {
    return api.cycle.applyPeriod(
      {
        action: 'start',
        date: String(payload.date || ''),
        flow:
          payload.flow === 'light' || payload.flow === 'heavy' || payload.flow === 'medium'
            ? payload.flow
            : 'medium',
      },
      { timeoutMs: MUT_TIMEOUT_MS },
    );
  }
  if (item.operation === 'END_PERIOD') {
    return api.cycle.applyPeriod(
      { action: 'end', date: String(payload.date || '') },
      { timeoutMs: MUT_TIMEOUT_MS },
    );
  }
  return api.cycle.applyPeriod(
    {
      action: 'fill',
      start: String(payload.start || ''),
      end: String(payload.end || ''),
      flow:
        payload.flow === 'light' || payload.flow === 'heavy' || payload.flow === 'medium'
          ? payload.flow
          : 'medium',
    },
    { timeoutMs: MUT_TIMEOUT_MS },
  );
}

export async function flushCycleQueue(userId: string): Promise<CycleFlushResult> {
  if (!userId) {
    return { flushed: 0, remaining: 0, bundle: null, authPaused: false, skipped: true, failureKind: null };
  }
  if (flushLock) return flushLock;
  flushLock = (async () => {
    const account = await loadCycleAccount(userId);
    const now = Date.now();
    if (account.authPaused) {
      return {
        flushed: 0,
        remaining: account.queue.length,
        bundle: account.cache?.bundle ?? null,
        authPaused: true,
        skipped: true,
        failureKind: 'auth_pause',
      };
    }
    if (account.cooldownUntil > now) {
      return {
        flushed: 0,
        remaining: account.queue.length,
        bundle: account.cache?.bundle ?? null,
        authPaused: false,
        skipped: true,
        failureKind: null,
      };
    }
    const pending = compactCycleQueue(account.queue);
    if (pending.length === 0) {
      return {
        flushed: 0,
        remaining: 0,
        bundle: account.cache?.bundle ?? null,
        authPaused: false,
        skipped: false,
        failureKind: null,
      };
    }

    const result = await replayCycleQueue(pending, playMutation);
    await withAccountWrite(async () => {
      const latest = await loadCycleAccount(userId);
      const pendingIds = new Set(pending.map((item) => item.id));
      const newlyEnqueued = latest.queue.filter((item) => !pendingIds.has(item.id));
      latest.queue = compactCycleQueue([...result.remaining, ...newlyEnqueued]);
      latest.authPaused = result.authPaused;
      if (result.bundle) {
        latest.cache = createCacheRecord(userId, result.bundle);
      }
      if (result.failureKind === 'retryable') {
        const failed = result.remaining.find((item) => item.status === 'pending');
        latest.cooldownUntil =
          Date.now() + backoffMs(failed?.attemptCount ?? 1, failed?.retryAfterSeconds);
      } else {
        latest.cooldownUntil = 0;
      }
      await saveCycleAccount(userId, latest);
    });
    return {
      flushed: result.flushed,
      remaining: result.remaining.filter((i) => i.status !== 'failed_permanent').length,
      bundle: result.bundle,
      authPaused: result.authPaused,
      skipped: false,
      failureKind: result.failureKind,
    };
  })();
  try {
    return await flushLock;
  } finally {
    flushLock = null;
  }
}

function logBodyFromPayload(form: {
  flow?: string | null;
  symptoms?: string[];
  moods?: string[];
  sexualActivity?: boolean | null;
  libido?: number | null;
  bbt?: number | null;
  cervicalMucus?: string | null;
  ovulationTest?: string | null;
  pregnancyTest?: string | null;
  notes?: string | null;
}) {
  return {
    flow: form.flow ?? null,
    symptoms: form.symptoms ?? [],
    moods: form.moods ?? [],
    sexualActivity: form.sexualActivity ?? null,
    libido: form.libido ?? null,
    bbt: form.bbt ?? null,
    cervicalMucus: form.cervicalMucus ?? null,
    ovulationTest: form.ovulationTest ?? null,
    pregnancyTest: form.pregnancyTest ?? null,
    notes: form.notes ?? null,
  };
}

export async function enqueueCycleOp(
  userId: string,
  operation: CycleOfflineOperation,
  payload: Record<string, unknown>,
): Promise<CycleOfflineAccount> {
  return withAccountWrite(async () => {
    let account = await loadCycleAccount(userId);
    account = enqueueMutation(account, createMutation(userId, operation, payload));
    await saveCycleAccount(userId, account);
    return account;
  });
}

async function afterEnqueue(userId: string): Promise<PersistResult> {
  const flushed = await flushCycleQueue(userId);
  const account = await loadCycleAccount(userId);
  const pending = account.queue.filter((i) => i.status !== 'failed_permanent');
  const stale = pending.length > 0 || !flushed.bundle;
  const view = viewFromAccount(account, {
    stale,
    reachable: flushed.flushed > 0 || Boolean(flushed.bundle),
    syncState: flushed.authPaused
      ? 'auth_paused'
      : account.queue.some((i) => i.status === 'failed_permanent')
        ? 'sync_failed'
        : pending.length
          ? 'saved_offline'
          : 'synced',
    persistedLocally: durableOfflineEnabled(),
  });
  return {
    view,
    synced: flushed.flushed > 0 && pending.length === 0 && !flushed.authPaused,
    persistedLocally: durableOfflineEnabled(),
    sessionOnly: !durableOfflineEnabled(),
  };
}

export async function saveCycleObservation(
  userId: string,
  date: string,
  body: Partial<ReturnType<typeof logBodyFromPayload>>,
  options?: { markStart?: boolean },
): Promise<PersistResult> {
  try {
    const planned = planQueuedLogMutations({ date, ...body }, options);
    for (const step of planned) {
      await enqueueCycleOp(userId, step.operation, step.payload);
    }
    return afterEnqueue(userId);
  } catch (error) {
    if (error instanceof CyclePersistError) {
      return { view: null, synced: false, persistedLocally: false };
    }
    throw error;
  }
}

export async function queueRemoveCycleLog(userId: string, date: string): Promise<PersistResult> {
  try {
    await enqueueCycleOp(userId, 'REMOVE_LOG', { date });
    return afterEnqueue(userId);
  } catch (error) {
    if (error instanceof CyclePersistError) {
      return { view: null, synced: false, persistedLocally: false };
    }
    throw error;
  }
}

export async function queueApplyPeriod(
  userId: string,
  body: {
    action: 'start' | 'end' | 'fill';
    date?: string;
    start?: string;
    end?: string;
    flow?: 'light' | 'medium' | 'heavy';
  },
): Promise<PersistResult> {
  try {
    if (body.action === 'start') {
      await enqueueCycleOp(userId, 'START_PERIOD', { date: body.date, flow: body.flow ?? 'medium' });
    } else if (body.action === 'end') {
      await enqueueCycleOp(userId, 'END_PERIOD', { date: body.date });
    } else {
      await enqueueCycleOp(userId, 'FILL_PERIOD', {
        start: body.start,
        end: body.end,
        flow: body.flow ?? 'medium',
      });
    }
    return afterEnqueue(userId);
  } catch (error) {
    if (error instanceof CyclePersistError) {
      return { view: null, synced: false, persistedLocally: false };
    }
    throw error;
  }
}

export async function loadCycleView(userId: string): Promise<CycleView> {
  if (!userId) throw new ApiError('unauthorized', 401);
  try {
    await flushCycleQueue(userId);
    const fresh = await api.cycle.get({ timeoutMs: GET_TIMEOUT_MS });
    try {
      await cacheCycleBundle(userId, fresh);
    } catch {
      /* Server data is enough to pick dates; cache is best-effort. */
    }
    let account: CycleOfflineAccount;
    try {
      account = await loadCycleAccount(userId);
    } catch {
      account = emptyAccount(userId);
    }
    const pending = account.queue.filter((i) => i.status !== 'failed_permanent');
    const { bundle: display, pendingDates } = overlayPendingOnBundle(fresh, account.queue, userId);
    return {
      display: display ?? fresh,
      canonical: fresh,
      stale: pending.length > 0,
      reachable: true,
      cachedAt: account.cache?.cachedAt ?? new Date().toISOString(),
      pendingCount: pending.length,
      pendingDates,
      syncState: account.authPaused
        ? 'auth_paused'
        : account.queue.some((i) => i.status === 'failed_permanent')
          ? 'sync_failed'
          : pending.length
            ? 'saved_offline'
            : 'synced',
      lastError: null,
      persistedLocally: pending.length > 0,
      attention: attentionItems(account),
    };
  } catch (error) {
    const account = await loadCycleAccount(userId);
    const stale = viewFromAccount(account, {
      stale: true,
      reachable: false,
      syncState:
        error instanceof ApiError && error.isUnauthorized
          ? 'auth_paused'
          : account.queue.some((i) => i.status === 'failed_permanent')
            ? 'sync_failed'
            : account.queue.length
              ? 'saved_offline'
              : 'sync_needed',
      lastError: error instanceof ApiError ? error.message : null,
    });
    if (stale) return stale;
    throw error;
  }
}

export async function peekCyclePendingCount(userId: string): Promise<number> {
  const account = await loadCycleAccount(userId);
  return account.queue.filter((i) => i.status !== 'failed_permanent').length;
}

export async function listCycleAttention(userId: string): Promise<CycleAttentionItem[]> {
  const account = await loadCycleAccount(userId);
  return attentionItems(account);
}

export async function discardCycleMutation(userId: string, mutationId: string): Promise<void> {
  await withAccountWrite(async () => {
    const account = await loadCycleAccount(userId);
    await saveCycleAccount(userId, discardMutation(account, mutationId));
  });
}

/** Destroys one account's local Cycle cache + queue. Used after intentional account/health deletion. */
export async function destroyCycleOfflineAccount(userId: string): Promise<void> {
  await withAccountWrite(async () => {
    const root = await loadRootStore();
    const next = { ...root, accounts: { ...root.accounts } };
    delete next.accounts[userId];
    await persistRootStore(next);
  });
}

/**
 * Logout policy: keep per-account cache + queue. Never delete silently.
 * Never replay User A into User B — every read/flush is scoped by userId.
 */
export async function cycleAccountHasPending(userId: string): Promise<boolean> {
  return (await peekCyclePendingCount(userId)) > 0;
}

export function formatCycleCachedAtKa(cachedAt: string | null, todayYmd: string): string {
  if (!cachedAt) return '';
  const day = cachedAt.slice(0, 10);
  const date = new Date(cachedAt);
  const hh = Number.isNaN(date.getTime())
    ? ''
    : `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  if (day === todayYmd && hh) return hh;
  const yest = new Date(`${todayYmd}T12:00:00`);
  yest.setDate(yest.getDate() - 1);
  const ymd = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`;
  if (day === ymd) return 'გუშინ';
  return day;
}

