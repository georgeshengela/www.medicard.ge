import type { HealthProfile, Usage, User } from '@/lib/api';
import { deletePreference, getPreference, setPreference } from '@/lib/storage';

const SESSION_KEY = 'medicard.session.snapshot';

type SessionSnapshot = {
  user: User;
  usage: Usage | null;
  stats: { records: number; chats: number; activeMedications: number } | null;
  healthProfile: HealthProfile | null;
};

export async function loadSessionSnapshot(): Promise<SessionSnapshot | null> {
  try {
    const raw = await getPreference(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionSnapshot;
    if (!parsed?.user?.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function saveSessionSnapshot(snapshot: SessionSnapshot): Promise<void> {
  await setPreference(SESSION_KEY, JSON.stringify(snapshot));
}

export async function clearSessionSnapshot(): Promise<void> {
  await deletePreference(SESSION_KEY);
}
