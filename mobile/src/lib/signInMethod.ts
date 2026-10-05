import { getPreference, setPreference } from '@/lib/storage';

/** Phone (SMS code) or email + password on the sign-in screen — the same choice on the web (/app). */
export type SignInMethod = 'phone' | 'email';

const KEY = 'auth.lastSignInMethod';

/** First visit: Georgian → phone (only Georgian numbers get the SMS), English → email. */
export function defaultSignInMethod(lang: string): SignInMethod {
  return lang === 'ka' ? 'phone' : 'email';
}

export async function readLastSignInMethod(): Promise<SignInMethod | null> {
  const value = await getPreference(KEY).catch(() => null);
  return value === 'phone' || value === 'email' ? value : null;
}

export async function rememberSignInMethod(method: SignInMethod): Promise<void> {
  await setPreference(KEY, method).catch(() => undefined);
}
