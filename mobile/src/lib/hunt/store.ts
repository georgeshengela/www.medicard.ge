import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import * as Location from 'expo-location';
import { api, ApiError } from '@/lib/api';
import { invalidateMediCoinBalance } from '@/lib/quest/cache';
import { isHuntUnavailable } from './client';
import { completePreviewCapture, createLocalPreview, stepLocalPreview, takePreviewCapsule } from './preview';
import type { HuntMode, HuntSnapshot } from './types';

type HuntClient = {
  snap: HuntSnapshot | null;
  error: string | null;
  unavailable: boolean;
  starting: boolean;
};

let state: HuntClient = { snap: null, error: null, unavailable: false, starting: false };
const listeners = new Set<() => void>();
let watch: Location.LocationSubscription | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let seq = 0;
const queue: { lat: number; lng: number; accuracy: number; at: number }[] = [];

function emit() {
  listeners.forEach((fn) => fn());
}

function set(partial: Partial<HuntClient>) {
  state = { ...state, ...partial };
  emit();
}

export function getHuntClient() {
  return state;
}

export function useHuntSession() {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => state,
    () => state,
  );
}

async function applySnap(snap: HuntSnapshot) {
  if (snap.lastAward?.coins) {
    invalidateMediCoinBalance();
  }
  set({ snap, error: null, unavailable: false, starting: false });
}

export async function startHuntPlay(opts: {
  mode: HuntMode;
  simulation?: boolean;
  previewFallback?: boolean;
}) {
  set({ starting: true, error: null });
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    set({ starting: false, error: 'permission' });
    return;
  }
  const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
  const origin = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy || 20 };
  try {
    const snap = await api.hunt.start({
      lat: origin.lat,
      lng: origin.lng,
      accuracy: origin.accuracy,
      mode: opts.mode,
      simulation: Boolean(opts.simulation),
    });
    await applySnap(snap);
    await startWatch();
  } catch (error) {
    if (opts.previewFallback || isHuntUnavailable(error)) {
      const snap = createLocalPreview({ lat: origin.lat, lng: origin.lng }, opts.mode);
      set({ snap, starting: false, unavailable: Boolean(isHuntUnavailable(error)), error: null });
      await startWatch();
      return;
    }
    const message = error instanceof ApiError ? error.message : 'start';
    set({ starting: false, error: message, unavailable: false });
  }
}

async function startWatch() {
  await stopWatch();
  watch = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1 },
    (loc) => {
      seq += 1;
      queue.push({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 25,
        at: loc.timestamp || Date.now(),
      });
      if (queue.length > 8) queue.shift();
    },
  );
  pingTimer = setInterval(() => {
    void flushPing();
  }, 1100);
}

async function stopWatch() {
  watch?.remove();
  watch = null;
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
}

async function flushPing() {
  const snap = state.snap;
  if (!snap || snap.status === 'paused' || snap.status === 'encounter') return;
  const samples = queue.splice(0, 8);
  if (snap.previewLocal) {
    const last = samples[samples.length - 1] || snap.player;
    if (last) set({ snap: stepLocalPreview(snap, { lat: last.lat, lng: last.lng }) });
    return;
  }
  if (!samples.length) return;
  try {
    const next = await api.hunt.ping(snap.id, { samples });
    await applySnap(next);
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) return;
    set({ error: error instanceof ApiError ? error.message : 'ping' });
  }
}

export async function pauseHunt() {
  const snap = state.snap;
  if (!snap) return;
  if (snap.previewLocal) {
    set({ snap: { ...snap, status: 'paused' } });
    return;
  }
  await applySnap(await api.hunt.pause(snap.id));
}

export async function resumeHunt() {
  const snap = state.snap;
  if (!snap) return;
  if (snap.previewLocal) {
    set({ snap: { ...snap, status: 'active' } });
    return;
  }
  await applySnap(await api.hunt.resume(snap.id));
}

export async function endHunt() {
  const snap = state.snap;
  await stopWatch();
  if (!snap) return snap;
  if (snap.previewLocal) {
    const ended = { ...snap, status: 'ended' };
    set({ snap: ended });
    return ended;
  }
  const next = await api.hunt.end(snap.id);
  await applySnap(next);
  return next;
}

export async function collectCapsule(id: string) {
  const snap = state.snap;
  if (!snap) return;
  if (snap.previewLocal) {
    set({ snap: takePreviewCapsule(snap, id) });
    return;
  }
  await applySnap(await api.hunt.capsule(snap.id, id));
}

export async function beginEncounter(enemyId: string) {
  const snap = state.snap;
  if (!snap) return null;
  if (snap.previewLocal) {
    const next = {
      ...snap,
      status: 'encounter',
      encounter: { enemyId, token: 'preview-token', expiresAt: new Date(Date.now() + 45_000).toISOString(), preview: true },
    };
    set({ snap: next });
    return next;
  }
  const next = await api.hunt.encounter(snap.id, enemyId);
  await applySnap(next);
  return next;
}

export async function completeEncounter() {
  const snap = state.snap;
  if (!snap?.encounter?.token) return snap;
  if (snap.previewLocal) {
    const next = completePreviewCapture(snap);
    set({ snap: next });
    return next;
  }
  const next = await api.hunt.completeEncounter(snap.id, snap.encounter.token);
  await applySnap(next);
  return next;
}

export async function cancelEncounter() {
  const snap = state.snap;
  if (!snap) return;
  if (snap.previewLocal) {
    set({ snap: { ...snap, status: 'active', encounter: null } });
    return;
  }
  await applySnap(await api.hunt.cancelEncounter(snap.id));
}

export function clearHunt() {
  void stopWatch();
  set({ snap: null, error: null, unavailable: false, starting: false });
}

AppState.addEventListener('change', (next) => {
  if (next !== 'active') void pauseHunt();
});
