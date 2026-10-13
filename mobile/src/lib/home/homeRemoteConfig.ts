import { useSyncExternalStore } from 'react';
import { getPreference, setPreference } from '@/lib/storage';
import type { HomeLayoutId } from './homeLayout';
import { EMPTY_HOME_REMOTE, sanitizeHomeRemote, type HomeRemoteConfig, type HomeRemoteLayout } from './homeSectionOrder';

/**
 * Admin control of Home (#/home, owner 2026-10-13): per layout, the sections it hides and their order.
 * Arrives with /api/app/status (`home`) on launch, on every return to the app and the moment the admin saves
 * (socket `app:config`, quest/socket.ts). The last answer is cached so a cold start offline keeps it; an old
 * server without `home` changes nothing.
 */
const CACHE_KEY = 'medicard.homeConfig.v1';
const listeners = new Set<() => void>();
let state: HomeRemoteConfig = EMPTY_HOME_REMOTE;
let hydrated = false;

const emit = () => listeners.forEach((fn) => fn());

export function applyHomeConfig(raw: unknown) {
  if (raw === undefined) return;
  const next = sanitizeHomeRemote(raw);
  hydrated = true;
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  state = next;
  emit();
  void setPreference(CACHE_KEY, JSON.stringify(next)).catch(() => undefined);
}

export async function hydrateHomeConfig() {
  if (hydrated) return;
  try {
    const raw = await getPreference(CACHE_KEY);
    if (!raw || hydrated) return;
    state = sanitizeHomeRemote(JSON.parse(raw));
    emit();
  } catch {
    /* app defaults */
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const snapshot = () => state;

/** The admin's choice for one layout (undefined = the app's own default). */
export function useHomeRemoteLayout(layout: HomeLayoutId): HomeRemoteLayout | undefined {
  return useSyncExternalStore(subscribe, snapshot, snapshot).layouts[layout];
}
