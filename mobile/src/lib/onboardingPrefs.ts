import { getPreference, setPreference } from '@/lib/storage';

const WELCOME_KEY = 'medicard.onboarding.welcomeDone';

/** Testing: keep true so splash always routes to welcome (ignore saved flag). */
export const ALWAYS_SHOW_WELCOME = true;

export async function getWelcomeCompleted(): Promise<boolean> {
  if (ALWAYS_SHOW_WELCOME) return false;
  return (await getPreference(WELCOME_KEY)) === '1';
}

export async function setWelcomeCompleted(done: boolean): Promise<void> {
  if (ALWAYS_SHOW_WELCOME) return;
  await setPreference(WELCOME_KEY, done ? '1' : '0');
}
