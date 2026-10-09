import type { MedicationConfig, MedicationDoseLog, PillShape } from '@/types/medications';
import { tx } from '../i18n/locale.js';

export function parseMedicationConfig(raw: unknown): MedicationConfig {
  if (!raw || typeof raw !== 'object') return {};
  return raw as MedicationConfig;
}

export function parseFrequencyTimes(frequency: string): string[] {
  return frequency
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export function formatFrequencyTimes(times: string[]): string {
  return [...new Set(times)].sort().join(', ');
}

export const DAY_LABELS_KA: readonly string[] = tx(
  ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ'],
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
);
export const DAY_LABELS_FULL_KA: readonly string[] = tx(
  [
    'ორშაბათი',
    'სამშაბათი',
    'ოთხშაბათი',
    'ხუთშაბათი',
    'პარასკევი',
    'შაბათი',
    'კვირა',
  ],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
);

export function daysSummaryKa(days: number[] | undefined): string {
  if (!days?.length) return '';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => DAY_LABELS_FULL_KA[d] ?? '')
    .filter(Boolean)
    .join(', ');
}

export function pillShapePath(shape: PillShape): string {
  switch (shape) {
    case 'diamond':
      return 'M12 2L22 12L12 22L2 12Z';
    case 'triangle':
      return 'M12 3L22 21H2Z';
    case 'circle':
      return 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20z';
    case 'hexagon':
      return 'M12 2l8.66 5v10L12 22l-8.66-5V7Z';
    case 'rectangle':
    case 'long':
      return 'M6 8h12a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v0a4 4 0 0 1 4-4z';
    case 'pentagon':
      return 'M12 2l9 7v8l-9 7-9-7V9z';
    case 'shield':
      return 'M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6z';
    case 'teardrop':
      return 'M12 2c3 6 8 10 8 14a8 8 0 1 1-16 0c0-4 5-8 8-14z';
    case 'trapezoid':
      return 'M7 7h10l3 10H4z';
    case 'square':
      return 'M5 5h14v14H5z';
    default:
      return 'M6 8h12a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v0a4 4 0 0 1 4-4z';
  }
}

const DOSE_LOG_KEY = 'medicard.meds.doseLogs';
/** Device-level queue for marks made before any account could be resolved (see notificationDose.ts). */
const PENDING_DOSE_KEY = 'medicard.meds.pendingDoseLogs';

/**
 * Dose logs are stored per account, and the account id is only set once /api/auth/me answers. A
 * notification's „მივიღე ✓“ on a cold start runs before that, so resolve the account the way
 * healthDataSync does: the session snapshot (readable while the phone is locked), then the token.
 */
export async function ensureLocalAccountScope(): Promise<string | null> {
  const { localAccountId, setLocalAccountId } = await import('@/lib/localAccount');
  if (localAccountId()) return localAccountId();
  try {
    const { loadSessionSnapshot } = await import('@/lib/sessionSnapshot');
    const snapshot = await loadSessionSnapshot();
    if (!localAccountId() && snapshot?.user?.id) setLocalAccountId(snapshot.user.id);
    if (!localAccountId()) {
      const [{ getToken }, { jwtSubject }] = await Promise.all([import('@/lib/storage'), import('@/lib/jwtSubject')]);
      const id = jwtSubject(await getToken());
      if (!localAccountId() && id) setLocalAccountId(id);
    }
  } catch {
    /* no session to resolve */
  }
  return localAccountId();
}

let pendingDrain: Promise<void> | null = null;
/** False once this process saw the queue empty, so ordinary reads skip the storage lookup. */
let pendingMaybe = true;

/**
 * Moves queued marks into the signed-in account's dose log (once; concurrent readers share it). Only
 * marks from this account's reminders are applied; the rest of the queue is dropped with it.
 */
function drainPendingDoseLogs(): Promise<void> {
  if (!pendingMaybe) return Promise.resolve();
  if (pendingDrain) return pendingDrain;
  pendingDrain = (async () => {
    const [{ getPreference, deletePreference }, { getScopedPreference, setScopedPreference, localAccountId }, pending] =
      await Promise.all([import('@/lib/storage'), import('@/lib/localAccount'), import('@/lib/notificationDose')]);
    const owner = localAccountId();
    if (!owner) return;
    const raw = await getPreference(PENDING_DOSE_KEY);
    if (!raw) {
      pendingMaybe = false;
      return;
    }
    let queue: unknown[] = [];
    try {
      const parsed = JSON.parse(raw);
      queue = Array.isArray(parsed) ? parsed : [];
    } catch {
      queue = [];
    }
    const marks = pending.takePendingDoses(queue, Date.now(), owner);
    const current = marks.length && localAccountId() === owner ? parseDoseLogs(await getScopedPreference(DOSE_LOG_KEY)) : null;
    // Checked again right before the write (no await in between): the scoped key follows the account
    // at call time, so a switch during the read would otherwise put her log into the next account.
    if (current && localAccountId() === owner) {
      await setScopedPreference(DOSE_LOG_KEY, JSON.stringify(pending.mergeDoseLogs(current, marks)));
      void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
      for (const mark of marks) syncDoseMark(mark, 'notification');
    }
    await deletePreference(PENDING_DOSE_KEY);
    pendingMaybe = false;
  })()
    .catch(() => undefined)
    .finally(() => {
      pendingDrain = null;
    });
  return pendingDrain;
}

function parseDoseLogs(raw: string | null): MedicationDoseLog[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MedicationDoseLog[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function syncDoseMark(entry: MedicationDoseLog, source: 'app' | 'notification') {
  if (entry.status !== 'taken' && entry.status !== 'skipped') return;
  const status = entry.status;
  void import('@/lib/productObservability').then(({ syncDoseEvent }) =>
    syncDoseEvent({
      medicationId: entry.medicationId,
      date: entry.date,
      time: entry.time,
      status,
      source,
      occurredAt: entry.updatedAt,
    }),
  );
}

export async function loadDoseLogs(): Promise<MedicationDoseLog[]> {
  try {
    if (!(await ensureLocalAccountScope())) return [];
    const { getScopedPreference } = await import('@/lib/localAccount');
    await drainPendingDoseLogs();
    return parseDoseLogs(await getScopedPreference(DOSE_LOG_KEY));
  } catch {
    return [];
  }
}

/**
 * A fresh sign-in (password, SMS, Apple / Google, account switch) is about to set `accountId`: of the
 * marks still queued from before it (a reminder's „მივიღე ✓“ tapped while signed out) only her own
 * reminders' marks stay, and the drain applies them once the account is set. A mark from another
 * account's reminder or from an older reminder without an owner was made in another session and is
 * dropped. A restored session (snapshot / token) keeps the whole queue. Never fails the sign-in.
 */
export async function prunePendingDoseLogs(accountId: string): Promise<void> {
  try {
    // A drain still running for the previous account ends by deleting the queue: let it finish first,
    // so it never deletes what is written back here.
    if (pendingDrain) await pendingDrain;
    const [{ getPreference, setPreference, deletePreference }, { ownPendingDoses }] = await Promise.all([
      import('@/lib/storage'),
      import('@/lib/notificationDose'),
    ]);
    let queue: unknown[] = [];
    try {
      const parsed = JSON.parse((await getPreference(PENDING_DOSE_KEY)) || '[]');
      queue = Array.isArray(parsed) ? parsed : [];
    } catch {
      queue = [];
    }
    const own = ownPendingDoses(queue, accountId);
    if (own.length) {
      await setPreference(PENDING_DOSE_KEY, JSON.stringify(own));
      pendingMaybe = true;
    } else {
      await deletePreference(PENDING_DOSE_KEY);
      pendingMaybe = false;
    }
  } catch {
    /* sign-in never fails on this */
  }
}

/**
 * `reminderOwner`: for a reminder's „მივიღე ✓“, the account the reminder was scheduled for (null when
 * an older version scheduled it without one). A mark is never written into another account.
 */
export async function saveDoseLog(
  entry: MedicationDoseLog,
  source: 'app' | 'notification' = 'app',
  reminderOwner?: string | null,
): Promise<void> {
  const { setScopedPreference, localAccountId } = await import('@/lib/localAccount');
  // Resolve the account before reading: reading with no account returns [] and writing would then
  // replace the whole history with this one mark.
  const account = await ensureLocalAccountScope();
  if (!account) {
    // No session could be read (e.g. a lock-screen tap before the phone was ever unlocked): keep the
    // mark on the device and apply it once its account is signed in again, instead of dropping it.
    const [{ getPreference, setPreference }, { queuePendingDose }] = await Promise.all([
      import('@/lib/storage'),
      import('@/lib/notificationDose'),
    ]);
    let queue: unknown[] = [];
    try {
      const parsed = JSON.parse((await getPreference(PENDING_DOSE_KEY)) || '[]');
      queue = Array.isArray(parsed) ? parsed : [];
    } catch {
      queue = [];
    }
    await setPreference(PENDING_DOSE_KEY, JSON.stringify(queuePendingDose(queue, entry, Date.now(), reminderOwner)));
    pendingMaybe = true;
    // The dose is answered now: its „გადატანა“ reminder must not ring before the queue is applied
    // (the id needs no account; nothing scheduled → nothing happens).
    if (!entry.rescheduledTo) cancelMovedDoseReminder(entry);
    // Its dose event goes to the server when the queue is applied (there is no session to send it with now).
    return;
  }
  // Another account's reminder (left on a shared phone): never mark this account's log with it.
  if (reminderOwner && reminderOwner !== account) return;
  const existing = await loadDoseLogs();
  const key = `${entry.medicationId}|${entry.date}|${entry.time}`;
  const previous = existing.find((e) => `${e.medicationId}|${e.date}|${e.time}` === key);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffKey = cutoff.toISOString().slice(0, 10);
  const next = [
    ...existing.filter((e) => `${e.medicationId}|${e.date}|${e.time}` !== key && e.date >= cutoffKey),
    { ...entry, updatedAt: new Date().toISOString() },
  ];
  // Another account signed in while her log was read: never write her log and mark into it.
  if (localAccountId() !== account) return;
  await setScopedPreference(DOSE_LOG_KEY, JSON.stringify(next));
  void import('@/lib/accountSync').then(({ scheduleAccountSyncPush }) => scheduleAccountSyncPush());
  void import('@/lib/mediNotificationBrain').then(({ requestEngageRefresh }) => requestEngageRefresh());
  // A dose moved with „გადატანა“ and now answered (or undone) needs no moved reminder any more.
  if (previous?.rescheduledTo && !entry.rescheduledTo) cancelMovedDoseReminder(entry);
  syncDoseMark(entry, source);
}

/** Cancels the one-off reminder of a dose moved with „გადატანა“ (fire and forget; no account needed). */
export function cancelMovedDoseReminder(entry: Pick<MedicationDoseLog, 'medicationId' | 'date' | 'time'>) {
  void Promise.all([import('@/lib/expoNotifications'), import('@/lib/notificationPlan')])
    .then(([{ Notifications }, { movedDoseReminderId }]) =>
      Notifications.cancelScheduledNotificationAsync(movedDoseReminderId(entry.medicationId, entry.date, entry.time)),
    )
    .catch(() => undefined);
}

export function doseLogKey(medicationId: string, date: string, time: string): string {
  return `${medicationId}|${date}|${time}`;
}

export function findDoseLog(
  logs: MedicationDoseLog[],
  medicationId: string,
  date: string,
  time: string,
): MedicationDoseLog | undefined {
  return logs.find((l) => l.medicationId === medicationId && l.date === date && l.time === time);
}

export function formatTime24h(time24: string): string {
  const [hStr, mStr] = time24.split(':');
  const h = Number(hStr);
  const m = (mStr ?? '00').slice(0, 2);
  const hour = Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 0;
  return `${String(hour).padStart(2, '0')}:${m.padStart(2, '0')}`;
}

/** Georgian UI uses 24h. Kept as an alias so older imports stay honest. */
export function formatTime12h(time24: string): string {
  return formatTime24h(time24);
}

/** The server accepts 1–8 dose times a day (`medications.routes.js` timeList); the form never offers more. */
export const MAX_TIMES_PER_DAY = 8;

export function defaultTimesForCount(count: number): string[] {
  const safe = Math.max(1, Math.min(MAX_TIMES_PER_DAY, count));
  if (safe === 1) return ['08:00'];
  if (safe === 2) return ['08:00', '20:00'];
  if (safe === 3) return ['08:00', '14:00', '20:00'];
  const startMin = 7 * 60;
  const endMin = 21 * 60;
  const step = (endMin - startMin) / safe;
  return Array.from({ length: safe }, (_, i) => {
    const total = Math.round(startMin + step * i + step / 2);
    const h = Math.floor(total / 60);
    const m = total % 60 >= 30 ? 30 : 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  });
}

export function formatDateDisplay(iso: string): string {
  const [y, mo, d] = iso.split('-');
  return `${d}  /  ${mo}  /  ${y}`;
}

export const DAY_LETTERS: readonly string[] = tx(['ო', 'ს', 'ო', 'ხ', 'პ', 'შ', 'კ'], ['M', 'T', 'W', 'T', 'F', 'S', 'S']);

export function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addYearsToIso(iso: string, years: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setFullYear(date.getFullYear() + years);
  return todayYmdFromDate(date);
}

function todayYmdFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function adherenceStats(logs: MedicationDoseLog[]): { onTime: number; late: number; skipped: number } {
  let onTime = 0;
  let skipped = 0;
  for (const log of logs) {
    if (log.status === 'taken') onTime += 1;
    if (log.status === 'skipped') skipped += 1;
  }
  const total = onTime + skipped;
  if (total === 0) return { onTime: 0, late: 0, skipped: 0 };
  const onTimePct = Math.round((onTime / total) * 100);
  const skippedPct = Math.round((skipped / total) * 100);
  return { onTime: onTimePct, late: Math.max(0, 100 - onTimePct - skippedPct), skipped: skippedPct };
}
