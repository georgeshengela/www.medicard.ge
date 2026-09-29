/**
 * App language (ka / en).
 *
 * The language is fixed for the lifetime of the JS runtime: it is read synchronously the first
 * time any string is resolved, and changing it saves the choice and reloads the bundle. That keeps
 * every string — including module-level constants and catalogs — in one language without making
 * each screen subscribe to a context.
 *
 * Plain JS (no react-native import at module level) so node tests can import it; there the
 * language is always Georgian.
 */

export const LANGUAGES = /** @type {const} */ (['ka', 'en']);
const STORAGE_KEY = 'medicard.language';
/** Same key scheme as `src/lib/storage.ts` prefs, so getPreference('medicard.language') agrees. */
const IOS_PREF_KEY = `@medicard/pref/${STORAGE_KEY}`;

let current = null;
let chosen = false;

function isLang(value) {
  return value === 'ka' || value === 'en';
}

function rn() {
  try {
    // eslint-disable-next-line global-require
    return typeof navigator !== 'undefined' && navigator.product === 'ReactNative' ? require('react-native') : null;
  } catch {
    return null;
  }
}

function readStored() {
  const RN = rn();
  try {
    if (!RN) {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    }
    if (RN.Platform.OS === 'ios') return RN.Settings?.get?.(IOS_PREF_KEY) ?? null;
    if (RN.Platform.OS === 'android') return require('expo-secure-store').getItem(STORAGE_KEY);
    if (typeof localStorage !== 'undefined') return localStorage.getItem(STORAGE_KEY);
  } catch {
    /* fall through to the default */
  }
  return null;
}

function writeStored(lang) {
  const RN = rn();
  if (!RN) {
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
    return;
  }
  if (RN.Platform.OS === 'ios') RN.Settings.set({ [IOS_PREF_KEY]: lang });
  else if (RN.Platform.OS === 'android') require('expo-secure-store').setItem(STORAGE_KEY, lang);
  else if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, lang);
}

function resolve() {
  if (current) return current;
  const stored = readStored();
  chosen = isLang(stored);
  // Existing users never chose a language and have always used Georgian — keep it.
  current = chosen ? stored : 'ka';
  return current;
}

/** Active app language. */
export function appLang() {
  return resolve();
}

export function isEn() {
  return resolve() === 'en';
}

/** Whether the person picked a language (first-launch picker shows until they do). */
export function hasChosenLanguage() {
  resolve();
  return chosen;
}

/**
 * Pick the string for the active language. Both arguments are evaluated; keep them cheap.
 * @template T
 * @param {T} kaValue
 * @param {T} enValue
 * @returns {T}
 */
export function tx(kaValue, enValue) {
  return resolve() === 'en' ? enValue : kaValue;
}

/** BCP-47 locale for Intl / toLocale*String calls. */
export function dateLocale() {
  return resolve() === 'en' ? 'en-GB' : 'ka-GE';
}

/** Language the phone itself uses (for the first-launch default highlight). */
export function deviceLanguage() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    if (/^ka\b/i.test(locale)) return 'ka';
    const RN = rn();
    const constants = RN?.I18nManager?.getConstants?.();
    const native = String(
      constants?.localeIdentifier || RN?.NativeModules?.SettingsManager?.settings?.AppleLocale || '',
    );
    if (/^ka/i.test(native)) return 'ka';
    return locale ? 'en' : 'ka';
  } catch {
    return 'ka';
  }
}

const NEXT_KEY = 'medicard.language.next';
const IOS_NEXT_KEY = `@medicard/pref/${NEXT_KEY}`;

/** Route to open once after a language reload (welcome → sign-in continues where the person was). */
export function setPendingRoute(route) {
  const value = String(route || '');
  const RN = rn();
  try {
    if (!RN || RN.Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(NEXT_KEY, value);
    } else if (RN.Platform.OS === 'ios') RN.Settings.set({ [IOS_NEXT_KEY]: value });
    else require('expo-secure-store').setItem(NEXT_KEY, value);
  } catch {
    /* the person lands on welcome instead */
  }
}

/** Read and clear the pending route (null when none). */
export function takePendingRoute() {
  const RN = rn();
  let value = null;
  try {
    if (!RN || RN.Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        value = localStorage.getItem(NEXT_KEY);
        localStorage.removeItem(NEXT_KEY);
      }
    } else if (RN.Platform.OS === 'ios') {
      value = RN.Settings.get(IOS_NEXT_KEY) ?? null;
      if (value) RN.Settings.set({ [IOS_NEXT_KEY]: '' });
    } else {
      const store = require('expo-secure-store');
      value = store.getItem(NEXT_KEY);
      if (value) store.setItem(NEXT_KEY, '');
    }
  } catch {
    value = null;
  }
  return typeof value === 'string' && value.startsWith('/') ? value : null;
}

/** Save without reloading (the chosen language is already the running one). */
export function saveLanguage(lang) {
  if (!isLang(lang)) return;
  writeStored(lang);
  chosen = true;
}

/**
 * Save the language and restart the JS bundle so every screen re-renders in it.
 * Returns false when nothing changed.
 */
export async function setLanguageAndReload(lang) {
  if (!isLang(lang)) return false;
  const changed = lang !== resolve();
  saveLanguage(lang);
  if (!changed) return false;
  current = lang;
  const RN = rn();
  if (!RN || RN.Platform?.OS === 'web') {
    // Web: start again from the app root (a plain reload would stay on the current route).
    if (typeof location !== 'undefined') location.assign('/');
    return true;
  }
  try {
    // eslint-disable-next-line no-undef
    if (!__DEV__) {
      const Updates = require('expo-updates');
      await Updates.reloadAsync();
      return true;
    }
  } catch {
    /* expo-updates disabled — fall back to the dev reload */
  }
  try {
    RN.DevSettings?.reload?.();
  } catch {
    /* nothing else we can do; next cold start uses the new language */
  }
  return true;
}
