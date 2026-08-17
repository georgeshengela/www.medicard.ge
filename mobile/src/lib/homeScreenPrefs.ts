import type { Gender } from '@/lib/api';
import { getPreference, setPreference } from '@/lib/storage';

/** Where the app opens after sign-in. */
export type HomeLanding = 'hub' | 'cycle';

const KEYS = {
  landing: 'medicard.home.landing',
  promptSeen: 'medicard.home.cyclePromptSeen',
} as const;

export async function getHomeLanding(): Promise<HomeLanding> {
  const value = await getPreference(KEYS.landing);
  return value === 'cycle' ? 'cycle' : 'hub';
}

export async function setHomeLanding(landing: HomeLanding): Promise<void> {
  await setPreference(KEYS.landing, landing);
}

export async function getCyclePromptSeen(): Promise<boolean> {
  return (await getPreference(KEYS.promptSeen)) === '1';
}

export async function setCyclePromptSeen(seen: boolean): Promise<void> {
  await setPreference(KEYS.promptSeen, seen ? '1' : '0');
}

export function resolveInitialRoute(landing: HomeLanding, gender: Gender | null | undefined): string {
  if (landing === 'cycle' && gender === 'FEMALE') return '/cycle';
  return '/(tabs)/home';
}
