/**
 * Tells the server which home-screen icon this iPhone shows (owner 2026-10-13: admin #/app-icons — how many people
 * change the icon and which ones they pick). Sends the icon id only, nothing else, to POST /api/app/icon:
 * after sign-in / app start (runPostLoginSideEffects) and right after a pick in AppIconPicker. Skipped while the
 * icon is the one already reported for this account, except once a week. Quiet on every failure.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { API_BASE_URL, guardRequest } from '@/lib/api';
import { appIconsSupported, currentAppIcon } from '@/lib/appIcon';
import { localAccountId } from '@/lib/localAccount';
import { getPreference, getToken, setPreference } from '@/lib/storage';

const REPORTED_KEY = (account: string) => `medicard.appIcon.reported.v1.${account}`;
const REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

let inFlight = false;

export async function reportAppIcon({ force = false }: { force?: boolean } = {}): Promise<void> {
  if (inFlight || !appIconsSupported()) return;
  const account = localAccountId();
  if (!account) return;
  inFlight = true;
  try {
    const icon = currentAppIcon();
    const key = REPORTED_KEY(account);
    if (!force) {
      try {
        const last = JSON.parse((await getPreference(key)) || 'null') as { icon?: string; at?: number } | null;
        if (last?.icon === icon && typeof last.at === 'number' && Date.now() - last.at < REFRESH_MS) return;
      } catch {
        /* unreadable — report again */
      }
    }
    try {
      guardRequest('POST', '/api/app/icon');
    } catch {
      return;
    }
    const token = await getToken();
    if (!token) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/app/icon`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'X-Medicard-Platform': Platform.OS === 'ios' ? 'ios' : Platform.OS,
          'X-Medicard-App-Version': String(Constants.expoConfig?.version || ''),
        },
        body: JSON.stringify({ icon }),
      });
      if (res.ok) await setPreference(key, JSON.stringify({ icon, at: Date.now() }));
    } finally {
      clearTimeout(timer);
    }
  } catch {
    /* offline or server busy — the next start tries again */
  } finally {
    inFlight = false;
  }
}
