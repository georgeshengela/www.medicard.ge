import { Platform, Settings } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { notifyProtectedTokenReplace } from '@/lib/protectedTokenChange.js';

const TOKEN_KEY = 'medicard.auth.token';
const PREFS_PREFIX = '@medicard/pref/';
/** UserDefaults flag — wiped with the app. iOS Keychain is NOT. */
const SANDBOX_FLAG = 'medicard.sandbox.v1';

/** Serialize Keychain access. Prefs on iOS use UserDefaults (no RCTAsyncLocalStorage). */
let nativeStorageChain: Promise<unknown> = Promise.resolve();

function runNativeStorage<T>(work: () => Promise<T>): Promise<T> {
  const next = nativeStorageChain.then(work, work);
  nativeStorageChain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

const webStorage = {
  getItem: (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  setItem: (key: string, value: string) => localStorage?.setItem(key, value),
  deleteItem: (key: string) => localStorage?.removeItem(key),
};

let memoryToken: string | null = null;
const memoryPrefs = new Map<string, string>();
let sandboxPromise: Promise<void> | null = null;

function prefStorageKey(key: string): string {
  return `${PREFS_PREFIX}${key}`;
}

function iosSettingsOk() {
  return Platform.OS === 'ios' && Settings && typeof Settings.get === 'function' && typeof Settings.set === 'function';
}

function iosReadPref(key: string): string | null {
  if (!iosSettingsOk()) return null;
  try {
    const stored = Settings.get(prefStorageKey(key));
    return typeof stored === 'string' && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

function iosWritePref(key: string, value: string | null): void {
  if (!iosSettingsOk()) return;
  try {
    Settings.set({ [prefStorageKey(key)]: value ?? '' });
  } catch {
    /* UserDefaults must never abort the process */
  }
}

/**
 * iOS Keychain outlives deletion. If UserDefaults is empty, this is a new sandbox
 * (reinstall or first launch of this storage scheme) — drop the leftover JWT.
 */
function ensureIosSandbox(): Promise<void> {
  if (Platform.OS !== 'ios') return Promise.resolve();
  if (sandboxPromise) return sandboxPromise;
  sandboxPromise = (async () => {
    try {
      if (!iosSettingsOk()) {
        memoryToken = null;
        await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
        return;
      }
      if (Settings.get(SANDBOX_FLAG) === '1') return;
      memoryToken = null;
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
      Settings.set({ [SANDBOX_FLAG]: '1' });
    } catch {
      /* continue without a token */
    }
  })();
  return sandboxPromise;
}

async function androidGet(key: string): Promise<string | null> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  return AsyncStorage.getItem(prefStorageKey(key));
}

async function androidSet(key: string, value: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(prefStorageKey(key), value);
}

async function androidRemove(key: string): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.removeItem(prefStorageKey(key));
}

export async function getToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  if (Platform.OS === 'web') {
    memoryToken = webStorage.getItem(TOKEN_KEY);
    return memoryToken;
  }
  try {
    return await runNativeStorage(async () => {
      await ensureIosSandbox();
      if (memoryToken) return memoryToken;
      memoryToken = await SecureStore.getItemAsync(TOKEN_KEY).catch(() => null);
      return memoryToken;
    });
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  const previous = memoryToken;
  memoryToken = token;
  if (Platform.OS === 'web') {
    webStorage.setItem(TOKEN_KEY, token);
    notifyProtectedTokenReplace(previous, token);
    return;
  }
  await runNativeStorage(async () => {
    await ensureIosSandbox();
    await SecureStore.setItemAsync(TOKEN_KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }).catch(() => undefined);
  });
  notifyProtectedTokenReplace(previous, token);
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  if (Platform.OS === 'web') {
    webStorage.deleteItem(TOKEN_KEY);
    return;
  }
  await runNativeStorage(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => undefined);
  });
}

export async function getPreference(key: string): Promise<string | null> {
  try {
    if (memoryPrefs.has(key)) return memoryPrefs.get(key) ?? null;
    if (Platform.OS === 'web') {
      const value = webStorage.getItem(key);
      if (value !== null) memoryPrefs.set(key, value);
      return value;
    }
    return await runNativeStorage(async () => {
      await ensureIosSandbox();
      if (memoryPrefs.has(key)) return memoryPrefs.get(key) ?? null;
      const stored = Platform.OS === 'ios' ? iosReadPref(key) : await androidGet(key);
      if (stored !== null) memoryPrefs.set(key, stored);
      return stored;
    });
  } catch {
    return memoryPrefs.get(key) ?? null;
  }
}

export async function setPreference(key: string, value: string): Promise<void> {
  try {
    await setPreferenceStrict(key, value);
  } catch {
    memoryPrefs.set(key, value);
  }
}

export async function setPreferenceStrict(key: string, value: string): Promise<void> {
  memoryPrefs.set(key, value);
  if (Platform.OS === 'web') {
    webStorage.setItem(key, value);
    if (webStorage.getItem(key) !== value) {
      throw new Error('preference_write_failed');
    }
    return;
  }
  await runNativeStorage(async () => {
    await ensureIosSandbox();
    if (Platform.OS === 'ios') {
      iosWritePref(key, value);
      return;
    }
    await androidSet(key, value);
  });
}

export async function deletePreference(key: string): Promise<void> {
  try {
    memoryPrefs.delete(key);
    if (Platform.OS === 'web') {
      webStorage.deleteItem(key);
      return;
    }
    await runNativeStorage(async () => {
      await ensureIosSandbox();
      if (Platform.OS === 'ios') {
        iosWritePref(key, '');
        return;
      }
      await androidRemove(key);
    });
  } catch {
    /* keep going */
  }
}

export async function withNativeStorageLock<T>(work: () => Promise<T>): Promise<T> {
  if (Platform.OS === 'web') return work();
  return runNativeStorage(work);
}
