import type { CycleBundle } from './api';

export const CYCLE_OFFLINE_SCHEMA_VERSION: 2;
export const CYCLE_OFFLINE_LEGACY_SCHEMA_VERSION: 1;
export const CYCLE_OFFLINE_STORAGE_KEY: 'medicard.cycle.offline.v2';
export const CYCLE_OFFLINE_STORAGE_KEY_V1: 'medicard.cycle.offline.v1';
export const CYCLE_OFFLINE_DEK_KEY: 'medicard.cycle.offline.dek.v1';
export const CYCLE_OFFLINE_ENCRYPTION_VERSION: 1;
export const MAX_BACKOFF_MS: number;
export const BASE_BACKOFF_MS: number;
export const MAX_RETRY_AFTER_MS: number;
export const QUOTA_CODES: string[];

export type CycleOfflineOperation =
  | 'UPSERT_LOG'
  | 'REMOVE_LOG'
  | 'START_PERIOD'
  | 'END_PERIOD'
  | 'FILL_PERIOD';

export type CycleMutationStatus = 'pending' | 'failed_permanent';

export type CycleMutation = {
  id: string;
  userScope: string;
  operation: CycleOfflineOperation;
  date: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  attemptCount: number;
  status: CycleMutationStatus;
  lastError?: string;
  retryAfterSeconds?: number | null;
};

export type CycleCacheRecord = {
  userScope: string;
  cachedAt: string;
  schemaVersion: number;
  bundle: CycleBundle;
};

export type CycleOfflineAccount = {
  userScope: string;
  cache: CycleCacheRecord | null;
  queue: CycleMutation[];
  cooldownUntil: number;
  authPaused: boolean;
};

export type CycleOfflineStore = {
  version: number;
  accounts: Record<string, CycleOfflineAccount>;
};

export type CycleFailureKind = 'retryable' | 'permanent' | 'auth_pause';

export function isBleedFlow(flow: string | null | undefined): boolean;
export function cloneJson<T>(value: T): T;
export function addDaysYmd(ymd: string, days: number): string;
export function eachYmd(start: string, end: string): string[];
export function createMutationId(): string;
export function emptyAccount(userScope: string): CycleOfflineAccount;
export function emptyStore(): CycleOfflineStore;
export function parseOfflineStore(raw: string | CycleOfflineStore | null | undefined): CycleOfflineStore;
export function isLegacyPlaintextStore(value: unknown): boolean;
export function isEncryptedEnvelope(value: unknown): boolean;
export function readAccount(
  store: string | CycleOfflineStore | null | undefined,
  userScope: string,
): CycleOfflineAccount;
export function writeAccount(
  store: string | CycleOfflineStore | null | undefined,
  userScope: string,
  account: CycleOfflineAccount,
): CycleOfflineStore;
export function persistStore(root: CycleOfflineStore): string;
export function createCacheRecord(
  userScope: string,
  bundle: CycleBundle,
  cachedAt?: string,
): CycleCacheRecord;
export function createMutation(
  userScope: string,
  operation: CycleOfflineOperation,
  payload: Record<string, unknown>,
  createdAt?: string,
): CycleMutation;
export function compactCycleQueue(items: CycleMutation[]): CycleMutation[];
export function enqueueMutation(
  account: CycleOfflineAccount,
  mutation: CycleMutation,
): CycleOfflineAccount;
export function classifyCycleFailure(error: {
  status?: number;
  statusCode?: number;
  code?: string;
  retryAfterSeconds?: number;
  retryAfter?: string | number;
}): CycleFailureKind;
export function isQuotaCode(code: string | undefined): boolean;
export function parseRetryAfterSeconds(raw: string | number | null | undefined): number | null;
export function backoffMs(attemptCount: number, retryAfterSeconds?: number | null): number;
export function hasObservationExtras(body: Record<string, unknown> | null | undefined): boolean;
export function planQueuedLogMutations(
  body: Record<string, unknown> & { date?: string; flow?: string | null },
  options?: { markStart?: boolean },
): { operation: CycleOfflineOperation; payload: Record<string, unknown> }[];
export function discardMutation(account: CycleOfflineAccount, mutationId: string): CycleOfflineAccount;
export function cyclePersistFeedback(result: {
  synced?: boolean;
  persistedLocally?: boolean;
  sessionOnly?: boolean;
}): 'synced' | 'device' | 'session' | 'fail';
export function attentionItems(
  account: CycleOfflineAccount,
): { id: string; date: string | null; operation: CycleOfflineOperation }[];
export function overlayPendingOnBundle(
  bundle: CycleBundle | null | undefined,
  queue: CycleMutation[] | undefined,
  userScope?: string,
): { bundle: CycleBundle | null; pendingDates: string[] };
export function restoreCanonicalDerived(original: CycleBundle, next: CycleBundle): CycleBundle;
export function snapshotEqualsDerived(
  before: CycleBundle | null | undefined,
  after: CycleBundle | null | undefined,
): boolean;
export function replayCycleQueue(
  queue: CycleMutation[],
  play: (item: CycleMutation) => Promise<CycleBundle | null | undefined>,
): Promise<{
  remaining: CycleMutation[];
  flushed: number;
  bundle: CycleBundle | null;
  authPaused: boolean;
  failureKind: CycleFailureKind | null;
  lastError: string | null;
}>;
export function accountIsolationSafe(
  store: string | CycleOfflineStore,
  userA: string,
  userB: string,
): {
  aHasCache: boolean;
  bHasCache: boolean;
  aQueue: number;
  bQueue: number;
  crossLeak: boolean;
};
