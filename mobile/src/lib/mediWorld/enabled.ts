import { useSyncExternalStore } from 'react';

/**
 * Medi World client gate.
 *
 * Compile-time: production store builds stay off unless EXPO_PUBLIC_MEDI_WORLD is on.
 * Runtime: GET /api/app/status settings.mediWorldEnabled is authoritative.
 * Development may show the entry before status loads; production never does.
 */
let serverEnabled: boolean | null = null;
let exploreServerEnabled: boolean | null = null;
let movementServerEnabled: boolean | null = null;
let gardenServerEnabled: boolean | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function rememberMediWorldServerEnabled(value?: boolean | null) {
  if (typeof value !== 'boolean') return;
  if (serverEnabled === value) return;
  serverEnabled = value;
  emit();
}

export function rememberMediWorldExploreServerEnabled(value?: boolean | null) {
  if (typeof value !== 'boolean') return;
  if (exploreServerEnabled === value) return;
  exploreServerEnabled = value;
  emit();
}

export function rememberMediWorldMovementServerEnabled(value?: boolean | null) {
  if (typeof value !== 'boolean') return;
  if (movementServerEnabled === value) return;
  movementServerEnabled = value;
  emit();
}

export function rememberMediWorldGardenServerEnabled(value?: boolean | null) {
  if (typeof value !== 'boolean') return;
  if (gardenServerEnabled === value) return;
  gardenServerEnabled = value;
  emit();
}

export function subscribeMediWorldAvailability(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isMediWorldClientEnabled(): boolean {
  const fromEnv = String(process.env.EXPO_PUBLIC_MEDI_WORLD || '').trim().toLowerCase();
  if (fromEnv === '1' || fromEnv === 'true' || fromEnv === 'on') return true;
  if (fromEnv === '0' || fromEnv === 'false' || fromEnv === 'off') return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isMediWorldExploreClientEnabled(): boolean {
  const fromEnv = String(process.env.EXPO_PUBLIC_MEDI_WORLD_EXPLORE || '').trim().toLowerCase();
  if (fromEnv === '1' || fromEnv === 'true' || fromEnv === 'on') return true;
  if (fromEnv === '0' || fromEnv === 'false' || fromEnv === 'off') return false;
  return isMediWorldClientEnabled();
}

export function isMediWorldMovementClientEnabled(): boolean {
  const fromEnv = String(process.env.EXPO_PUBLIC_MEDI_WORLD_MOVEMENT || '').trim().toLowerCase();
  if (fromEnv === '1' || fromEnv === 'true' || fromEnv === 'on') return true;
  if (fromEnv === '0' || fromEnv === 'false' || fromEnv === 'off') return false;
  return isMediWorldClientEnabled();
}

export function isMediWorldAvailable(): boolean {
  if (!isMediWorldClientEnabled()) return false;
  if (serverEnabled === true) return true;
  if (serverEnabled === false) return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isMediWorldExploreAvailable(): boolean {
  if (!isMediWorldAvailable()) return false;
  if (!isMediWorldExploreClientEnabled()) return false;
  if (exploreServerEnabled === true) return true;
  if (exploreServerEnabled === false) return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function isMediWorldMovementAvailable(): boolean {
  if (!isMediWorldAvailable()) return false;
  if (!isMediWorldMovementClientEnabled()) return false;
  if (movementServerEnabled === true) return true;
  if (movementServerEnabled === false) return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function useMediWorldAvailable(): boolean {
  return useSyncExternalStore(subscribeMediWorldAvailability, isMediWorldAvailable, isMediWorldAvailable);
}

export function useMediWorldExploreAvailable(): boolean {
  return useSyncExternalStore(subscribeMediWorldAvailability, isMediWorldExploreAvailable, isMediWorldExploreAvailable);
}

export function useMediWorldMovementAvailable(): boolean {
  return useSyncExternalStore(subscribeMediWorldAvailability, isMediWorldMovementAvailable, isMediWorldMovementAvailable);
}

export function isMediWorldGardenClientEnabled(): boolean {
  const fromEnv = String(process.env.EXPO_PUBLIC_MEDI_WORLD_GARDEN || '').trim().toLowerCase();
  if (fromEnv === '1' || fromEnv === 'true' || fromEnv === 'on') return true;
  if (fromEnv === '0' || fromEnv === 'false' || fromEnv === 'off') return false;
  return isMediWorldClientEnabled();
}

export function isMediWorldGardenAvailable(): boolean {
  if (!isMediWorldAvailable()) return false;
  if (!isMediWorldGardenClientEnabled()) return false;
  if (gardenServerEnabled === true) return true;
  if (gardenServerEnabled === false) return false;
  return typeof __DEV__ !== 'undefined' && __DEV__;
}

export function useMediWorldGardenAvailable(): boolean {
  return useSyncExternalStore(subscribeMediWorldAvailability, isMediWorldGardenAvailable, isMediWorldGardenAvailable);
}
