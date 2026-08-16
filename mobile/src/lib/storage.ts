import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'medicard.auth.token';

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

/**
 * Non-secret preferences. Same backing store as the token so the app does not need a
 * second storage dependency; nothing sensitive is written through here.
 */
export async function getPreference(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return webStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setPreference(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      webStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // A failed preference write should never break the UI.
  }
}
