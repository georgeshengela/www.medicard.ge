import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const TOKEN_KEY = 'medicard.auth.token';
const PREFS_DIR = `${FileSystem.documentDirectory ?? ''}medicard-prefs/`;

/**
 * SecureStore is unavailable on web, so fall back to localStorage there.
 * On device the JWT lives in the Keychain / Android Keystore.
 */
const webStorage = {
  getItem: (key: string) => (typeof localStorage === 'undefined' ? null : localStorage.getItem(key)),
  setItem: (key: string, value: string) => localStorage?.setItem(key, value),
  deleteItem: (key: string) => localStorage?.removeItem(key),
};

export async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') return webStorage.getItem(TOKEN_KEY);
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.setItem(TOKEN_KEY, token);
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function clearToken(): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.deleteItem(TOKEN_KEY);
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

function prefsPath(key: string) {
  return `${PREFS_DIR}${encodeURIComponent(key)}.json`;
}

/**
 * Non-secret preferences. Large JSON (symptom history, dose logs) lives in the
 * document directory — SecureStore silently fails above ~2048 bytes on Android.
 */
export async function getPreference(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return webStorage.getItem(key);
    const path = prefsPath(key);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) return await FileSystem.readAsStringAsync(path);

    const legacy = await SecureStore.getItemAsync(key);
    if (legacy) {
      await setPreference(key, legacy);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        /* keep going */
      }
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export async function setPreference(key: string, value: string): Promise<void> {
  try {
    await setPreferenceStrict(key, value);
  } catch {
    // A failed preference write should never break the UI.
  }
}

/** Throws if the write cannot be verified. Use for health data. */
export async function setPreferenceStrict(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage.setItem(key, value);
    if (webStorage.getItem(key) !== value) {
      throw new Error('preference_write_failed');
    }
    return;
  }
  await FileSystem.makeDirectoryAsync(PREFS_DIR, { intermediates: true });
  await FileSystem.writeAsStringAsync(prefsPath(key), value);
  const readBack = await FileSystem.readAsStringAsync(prefsPath(key));
  if (readBack !== value) throw new Error('preference_write_verify_failed');
}

export async function deletePreference(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      webStorage.deleteItem(key);
      return;
    }
    const path = prefsPath(key);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) await FileSystem.deleteAsync(path, { idempotent: true });
  } catch {
    /* keep going */
  }
}
