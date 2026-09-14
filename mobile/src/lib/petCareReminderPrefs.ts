import { getPreference, setPreference } from '@/lib/storage';
import { getScopedPreference, localAccountId, setScopedPreference } from '@/lib/localAccount';

export const PETS_REMINDER_PREFS_KEY = 'medicard.pets.reminders.v1';
export const PETS_REMINDER_BOOK_KEY = 'medicard.pets.reminderBook.v1';
export const PETS_PENDING_CONFIRM_KEY = 'medicard.pets.pendingConfirm.v1';
export const PETS_INSTALL_ID_KEY = 'medicard.pets.installId.v1';

export type PetCareSnooze = {
  scheduleId: string;
  occurrenceKey: string;
  fireAtMs: number;
};

export type PetCareReminderPrefs = {
  globalOptIn: boolean;
  dateBasedHour: number;
  dateBasedMinute: number;
  snoozeMinutes: number;
  overdueFollowUp: boolean;
  dateBasedTimeAccepted: boolean;
  lastTimeZone: string | null;
  lastSyncStatus: 'idle' | 'ok' | 'failed' | 'permission_denied' | 'cancelled';
  lastSyncedAt: number | null;
  lastGoodIds: string[];
  snoozes: PetCareSnooze[];
};

export type PetCareDeliveryBook = Record<
  string,
  { status: string; identity: string; updatedAt: number; fireAtMs?: number | null }
>;

export type PendingPetCareConfirm = {
  userId: string;
  petId: string;
  scheduleId: string;
  occurrenceKey: string;
  revision: number;
  clientRequestId: string;
  administeredOn: string;
  kind: 'complete' | 'skip';
  createdAt: number;
};

export const DEFAULT_PET_CARE_REMINDER_PREFS: PetCareReminderPrefs = {
  globalOptIn: false,
  dateBasedHour: 9,
  dateBasedMinute: 0,
  snoozeMinutes: 20,
  overdueFollowUp: false,
  dateBasedTimeAccepted: false,
  lastTimeZone: null,
  lastSyncStatus: 'idle',
  lastSyncedAt: null,
  lastGoodIds: [],
  snoozes: [],
};

function parseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export async function loadPetCareReminderPrefs(): Promise<PetCareReminderPrefs> {
  const parsed = parseJson<Partial<PetCareReminderPrefs>>(await getScopedPreference(PETS_REMINDER_PREFS_KEY), {});
  return { ...DEFAULT_PET_CARE_REMINDER_PREFS, ...parsed };
}

export async function savePetCareReminderPrefs(next: PetCareReminderPrefs): Promise<void> {
  await setScopedPreference(PETS_REMINDER_PREFS_KEY, JSON.stringify(next));
}

export async function loadPetCareDeliveryBook(): Promise<PetCareDeliveryBook> {
  return parseJson(await getScopedPreference(PETS_REMINDER_BOOK_KEY), {});
}

export async function savePetCareDeliveryBook(book: PetCareDeliveryBook): Promise<void> {
  await setScopedPreference(PETS_REMINDER_BOOK_KEY, JSON.stringify(book));
}

export async function loadPendingPetCareConfirms(): Promise<PendingPetCareConfirm[]> {
  const parsed = parseJson<PendingPetCareConfirm[]>(await getScopedPreference(PETS_PENDING_CONFIRM_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

export async function savePendingPetCareConfirms(rows: PendingPetCareConfirm[]): Promise<void> {
  await setScopedPreference(PETS_PENDING_CONFIRM_KEY, JSON.stringify(rows));
}

export async function clearPetCarePendingForAccount(userId: string): Promise<void> {
  const rows = await loadPendingPetCareConfirms();
  await savePendingPetCareConfirms(rows.filter((row) => row.userId !== userId));
}

export async function petCareInstallId(): Promise<string> {
  const existing = await getPreference(PETS_INSTALL_ID_KEY);
  if (existing) return existing;
  const created = `inst_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  await setPreference(PETS_INSTALL_ID_KEY, created);
  return created;
}

export function currentDeviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    return 'unknown';
  }
}

export function sessionUserId(): string | null {
  return localAccountId();
}
