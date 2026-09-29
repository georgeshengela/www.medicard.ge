import { useSyncExternalStore } from 'react';
import { getPreference, setPreference } from '@/lib/storage';
import {
  EMPTY_FEATURE_STATE,
  featureOnIn,
  hrefAvailableIn,
  sanitizeFeatureState,
  type FeatureKey,
  type FeatureState,
} from '@/lib/featureRoutes';
import { isEn, tx } from '../i18n/locale.js';

export { featureForHref, featureForPath, type FeatureKey, type FeatureState } from '@/lib/featureRoutes';

/**
 * Admin module switches (server: `server/src/lib/featureFlags.js`, admin „მოდულები“).
 * The server blocks writes to a paused module for every build; this store lets the app
 * hide the module altogether — Home sections, tiles, Explore, Profile blocks — and puts a
 * „დროებით შეჩერებულია“ screen over its routes (ModuleGate).
 *
 * Missing keys count as ON, so an old server or a failed fetch never hides anything.
 * The last answer is cached so a cold start offline keeps the admin's choice.
 */
const CACHE_KEY = 'medicard.featureFlags.v1';
const listeners = new Set<() => void>();
let state: FeatureState = EMPTY_FEATURE_STATE;
let hydrated = false;

/** Title on the paused-module screen. */
export const FEATURE_LABELS: Record<FeatureKey, string> = {
  cycle: tx('ციკლი', 'Cycle'),
  nutrition: tx('კვება', 'Nutrition'),
  nutritionAi: tx('კვების AI', 'Nutrition AI'),
  medi: 'Medi',
  pets: tx('ჩემი ცხოველები', 'My pets'),
  mediVet: 'Medi Vet',
  medirun: 'MEDIRUN',
  quest: 'MEDI QUEST',
  rewardsStore: tx('ჯილდოები', 'Rewards'),
  coach: 'MEDI COACH',
  community: tx('ქალების სივრცე', "Women's space"),
  pharmacy: tx('აფთიაქი', 'Pharmacy'),
  news: tx('სიახლეები', 'News'),
};

const DEFAULT_MESSAGE = tx('ეს ფუნქცია დროებით შეჩერებულია. შენი მონაცემები შენახულია.', 'This feature is paused for now. Your data is safe.');
const hasGeorgian = (text: string) => /[\u10A0-\u10FF]/.test(text);

function emit() {
  listeners.forEach((listener) => listener());
}

export function featureState(): FeatureState {
  return state;
}

export function isFeatureOn(key: FeatureKey | string, from: FeatureState = state): boolean {
  return featureOnIn(from, key);
}

export function featureMessage(key: FeatureKey | string, from: FeatureState = state): string {
  const message = from.messages[key];
  // Admin messages are written in Georgian only; English users get the default instead.
  if (!message || (isEn() && hasGeorgian(message))) return DEFAULT_MESSAGE;
  return message;
}

export function isHrefAvailable(href: string, from: FeatureState = state): boolean {
  return hrefAvailableIn(from, href);
}

/** Apply the `/api/app/status` answer. */
export function applyFeatureStatus(features: unknown, messages: unknown) {
  if (!features || typeof features !== 'object') return;
  const next = sanitizeFeatureState({ flags: features, messages });
  const same = JSON.stringify(next) === JSON.stringify(state);
  state = next;
  hydrated = true;
  if (!same) emit();
  void setPreference(CACHE_KEY, JSON.stringify(next)).catch(() => undefined);
}

/** A write answered 503 FEATURE_DISABLED: hide the module now instead of on the next status poll. */
export function noteFeatureDisabled(key: unknown, message?: unknown) {
  if (typeof key !== 'string' || !key) return;
  if (state.flags[key] === false && (!message || state.messages[key] === message)) return;
  state = {
    flags: { ...state.flags, [key]: false },
    messages: typeof message === 'string' && message ? { ...state.messages, [key]: message } : state.messages,
  };
  emit();
}

/** Cached answer from the previous run; the live status replaces it moments later. */
export async function hydrateFeatureFlags() {
  if (hydrated) return;
  try {
    const raw = await getPreference(CACHE_KEY);
    if (!raw || hydrated) return;
    state = sanitizeFeatureState(JSON.parse(raw));
    emit();
  } catch {
    /* keep defaults: everything on */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useFeatureState(): FeatureState {
  return useSyncExternalStore(subscribe, featureState, featureState);
}

export function useFeature(key: FeatureKey): boolean {
  return isFeatureOn(key, useFeatureState());
}
