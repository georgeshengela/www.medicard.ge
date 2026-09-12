import { useSyncExternalStore } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import {
  bearingDeg,
  caloriesKcal,
  estimateSteps,
  haversineM,
  paceSecPerKm,
  targetMeters as targetToMeters,
  type LatLng,
  type RunTarget,
} from '@/lib/run/geo';
import {
  clearActiveRun,
  loadActiveRun,
  saveActiveRun,
  type PersistedActiveRun,
} from '@/lib/run/activePersist';
import { downsamplePath, saveRunSummary, type RunSummary } from '@/lib/run/history';
import { generateTargetPin, type RunRoute } from '@/lib/run/mapbox';
import { requestLocationPermission } from '@/lib/userLocation';

export type RunPhase = 'idle' | 'preparing' | 'ready' | 'running' | 'paused' | 'finished';
export type RunError = 'permission' | 'location' | null;
export type SimMode = 'off' | 'run' | 'drive';

export type RunState = {
  phase: RunPhase;
  error: RunError;
  target: RunTarget | null;
  targetMeters: number;
  origin: LatLng | null;
  pin: LatLng | null;
  route: RunRoute | null;
  routed: boolean;
  expectedDistanceM: number;
  path: LatLng[];
  current: LatLng | null;
  headingDeg: number | null;
  accuracyM: number | null;
  distanceM: number;
  /** Time spent in the `running` phase (pauses excluded). */
  movingMs: number;
  /** Wall-clock time since start. */
  elapsedMs: number;
  startedAt: number | null;
  reachedPin: boolean;
  reachedAt: number | null;
  completedTarget: boolean;
  weightKg: number | null;
  heightCm: number | null;
  simulating: boolean;
  simMode: SimMode;
  summary: RunSummary | null;
  /** Smoothed live speed, km/h. */
  speedKmh: number;
  /** Sustained vehicle-like speed detected — warn the runner. */
  transportWarning: boolean;
  /** Run was auto-cancelled because the user appears to be in a vehicle. */
  transportCancelled: boolean;
};

const PIN_RADIUS_M = 28;
const MIN_STEP_M = 2;
const MAX_SPEED_MPS = 12; // > 43 km/h = GPS jump
const MAX_ACCURACY_M = 45;

// Vehicle detection: sustained speed no runner holds → warn, keep going → cancel.
const TRANSPORT_FAST_MPS = 25 / 3.6; // > 25 km/h counts as "too fast"
const TRANSPORT_SLOW_MPS = 18 / 3.6; // < 18 km/h cools the counter down
const TRANSPORT_WARN_MS = 12_000;
const TRANSPORT_CANCEL_MS = 32_000;

const initial: RunState = {
  phase: 'idle',
  error: null,
  target: null,
  targetMeters: 0,
  origin: null,
  pin: null,
  route: null,
  routed: false,
  expectedDistanceM: 0,
  path: [],
  current: null,
  headingDeg: null,
  accuracyM: null,
  distanceM: 0,
  movingMs: 0,
  elapsedMs: 0,
  startedAt: null,
  reachedPin: false,
  reachedAt: null,
  completedTarget: false,
  weightKg: null,
  heightCm: null,
  simulating: false,
  simMode: 'off',
  summary: null,
  speedKmh: 0,
  transportWarning: false,
  transportCancelled: false,
};

let state: RunState = initial;
const listeners = new Set<() => void>();

let watchSub: Location.LocationSubscription | null = null;
let headingSub: Location.LocationSubscription | null = null;
/** Compass is live — do not overwrite heading with GPS course. */
let compassLive = false;
let timer: ReturnType<typeof setInterval> | null = null;
let simTimer: ReturnType<typeof setInterval> | null = null;
let movingAccumMs = 0;
let segmentStartedAt: number | null = null;
let prepareAbort: AbortController | null = null;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let hydratePromise: Promise<boolean> | null = null;
let appStateSub: { remove: () => void } | null = null;

/** Live session the user has started — badge + persistence apply. */
export function isActiveRunPhase(phase: RunPhase): boolean {
  return phase === 'running' || phase === 'paused';
}

/** One-shot event hooks for haptics / banners in the UI layer. */
type RunEvent = 'pin_reached' | 'target_completed' | 'transport_warning' | 'transport_cancelled';
const eventListeners = new Set<(e: RunEvent) => void>();
export function onRunEvent(fn: (e: RunEvent) => void): () => void {
  eventListeners.add(fn);
  return () => eventListeners.delete(fn);
}
function emit(e: RunEvent) {
  eventListeners.forEach((fn) => fn(e));
}

function set(patch: Partial<RunState>) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
  if (isActiveRunPhase(state.phase)) schedulePersist();
}

function currentMovingAccum(): number {
  if (state.phase === 'running' && segmentStartedAt != null) {
    return movingAccumMs + (Date.now() - segmentStartedAt);
  }
  return movingAccumMs;
}

function buildPersistSnapshot(): PersistedActiveRun | null {
  if (!isActiveRunPhase(state.phase) || !state.target || !state.origin || !state.startedAt) return null;
  return {
    v: 1,
    phase: state.phase,
    target: state.target,
    targetMeters: state.targetMeters,
    origin: state.origin,
    pin: state.pin,
    route: state.route,
    routed: state.routed,
    expectedDistanceM: state.expectedDistanceM,
    path: state.path,
    current: state.current,
    headingDeg: state.headingDeg,
    accuracyM: state.accuracyM,
    distanceM: state.distanceM,
    movingAccumMs: currentMovingAccum(),
    startedAt: state.startedAt,
    reachedPin: state.reachedPin,
    reachedAt: state.reachedAt,
    completedTarget: state.completedTarget,
    weightKg: state.weightKg,
    heightCm: state.heightCm,
    savedAt: Date.now(),
  };
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void flushPersist();
  }, 900);
}

async function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  const snap = buildPersistSnapshot();
  if (!snap) return;
  try {
    await saveActiveRun(snap);
  } catch {
    /* disk full / scoped key missing — keep going in memory */
  }
}

function wipePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  void clearActiveRun();
}

function ensureAppStatePersist() {
  if (appStateSub) return;
  appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
    if (next === 'background' || next === 'inactive') {
      if (isActiveRunPhase(state.phase)) void flushPersist();
    } else if (next === 'active' && state.phase === 'running') {
      // Re-arm GPS after OS may have paused the watch while backgrounded.
      void startWatch();
      startTimer();
    }
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getRunState(): RunState {
  return state;
}

export function useRunSession(): RunState {
  return useSyncExternalStore(subscribe, getRunState, getRunState);
}

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------

export function runDerived(s: RunState) {
  const calories = caloriesKcal(s.distanceM, s.movingMs, s.weightKg);
  const steps = estimateSteps(s.distanceM, s.heightCm);
  const pace = paceSecPerKm(s.distanceM, s.movingMs);
  const toPinM = s.current && s.pin ? haversineM(s.current, s.pin) : null;
  const progress = s.targetMeters > 0 ? Math.min(1, s.distanceM / s.targetMeters) : 0;
  return { calories, steps, pace, toPinM, progress };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

async function readFix(): Promise<Location.LocationObject | null> {
  try {
    return await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  } catch {
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
      return last ?? null;
    } catch {
      return null;
    }
  }
}

/** Permission → GPS fix → random routed pin. Leaves the store in `ready` (or `idle` + error). */
export async function prepareRun(
  target: RunTarget,
  body: { weightKg?: number | null; heightCm?: number | null } = {},
): Promise<boolean> {
  stopEverything();
  wipePersist();
  prepareAbort?.abort();
  prepareAbort = new AbortController();
  isReachedEmitted = false;
  isCompletedEmitted = false;
  lastFixAt = 0;
  fastMs = 0;
  emaSpeedMps = 0;
  const meters = targetToMeters(target, body.heightCm);
  set({
    ...initial,
    phase: 'preparing',
    target,
    targetMeters: meters,
    weightKg: body.weightKg ?? null,
    heightCm: body.heightCm ?? null,
  });

  const permission = await requestLocationPermission();
  if (permission !== 'granted') {
    set({ phase: 'idle', error: 'permission' });
    return false;
  }

  const fix = await readFix();
  if (!fix) {
    set({ phase: 'idle', error: 'location' });
    return false;
  }
  const origin = { lat: fix.coords.latitude, lng: fix.coords.longitude };
  set({ origin, current: origin, accuracyM: fix.coords.accuracy ?? null });

  const generated = await generateTargetPin(origin, meters, { signal: prepareAbort.signal });
  if (state.phase !== 'preparing') return false; // cancelled
  set({
    phase: 'ready',
    pin: generated.pin,
    route: generated.route,
    routed: generated.routed,
    expectedDistanceM: generated.expectedDistanceM,
  });
  return true;
}

export async function regeneratePin(): Promise<void> {
  if (!state.origin || state.phase !== 'ready') return;
  set({ route: null, pin: null });
  const generated = await generateTargetPin(state.origin, state.targetMeters);
  if (state.phase !== 'ready') return;
  set({
    pin: generated.pin,
    route: generated.route,
    routed: generated.routed,
    expectedDistanceM: generated.expectedDistanceM,
  });
}

export async function startRun(): Promise<void> {
  if (state.phase !== 'ready' && state.phase !== 'paused') return;
  const now = Date.now();
  if (state.phase === 'ready') {
    movingAccumMs = 0;
    set({
      phase: 'running',
      startedAt: now,
      path: state.current ? [state.current] : [],
      distanceM: 0,
      movingMs: 0,
      elapsedMs: 0,
    });
  } else {
    set({ phase: 'running' });
  }
  segmentStartedAt = now;
  startTimer();
  ensureAppStatePersist();
  await startWatch();
  void flushPersist();
}

export function pauseRun(): void {
  if (state.phase !== 'running') return;
  if (segmentStartedAt != null) movingAccumMs += Date.now() - segmentStartedAt;
  segmentStartedAt = null;
  set({ phase: 'paused', movingMs: movingAccumMs });
  void flushPersist();
}

export async function resumeRun(): Promise<void> {
  if (state.phase !== 'paused') return;
  await startRun();
}

export async function finishRun(): Promise<RunSummary | null> {
  if (state.phase !== 'running' && state.phase !== 'paused') return null;
  if (state.phase === 'running' && segmentStartedAt != null) movingAccumMs += Date.now() - segmentStartedAt;
  segmentStartedAt = null;
  const now = Date.now();
  const movingMs = movingAccumMs;
  const elapsedMs = state.startedAt ? now - state.startedAt : movingMs;
  const d = runDerived({ ...state, movingMs });
  const summary: RunSummary = {
    id: `${state.startedAt ?? now}`,
    startedAt: new Date(state.startedAt ?? now).toISOString(),
    endedAt: new Date(now).toISOString(),
    target: state.target ?? { kind: 'km', value: 0 },
    targetMeters: state.targetMeters,
    distanceM: Math.round(state.distanceM),
    movingMs,
    elapsedMs,
    calories: Math.round(d.calories),
    steps: d.steps,
    paceSecPerKm: d.pace,
    reachedPin: state.reachedPin,
    completedTarget: state.completedTarget || state.distanceM >= state.targetMeters,
    pin: state.pin,
    origin: state.origin,
    path: downsamplePath(state.path),
  };
  stopEverything();
  wipePersist();
  set({ phase: 'finished', movingMs, elapsedMs, summary });
  if (summary.distanceM >= 50 || summary.movingMs >= 60_000) {
    void saveRunSummary(summary);
  }
  return summary;
}

export function cancelRun(): void {
  prepareAbort?.abort();
  stopEverything();
  wipePersist();
  hydratePromise = null;
  state = initial;
  listeners.forEach((fn) => fn());
}

/** Drop in-memory session without clearing the disk snapshot (logout / account switch). */
export function resetRunMemory(): void {
  prepareAbort?.abort();
  stopEverything();
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  hydratePromise = null;
  movingAccumMs = 0;
  segmentStartedAt = null;
  state = initial;
  listeners.forEach((fn) => fn());
}

export function clearRunError(): void {
  if (state.error) set({ error: null });
}

/**
 * Restore a live run after cold start / reload. Safe to call multiple times —
 * only restores while phase is still idle; failed loads can retry.
 */
export function hydrateActiveRun(): Promise<boolean> {
  if (state.phase !== 'idle') return Promise.resolve(false);
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    if (state.phase !== 'idle') return false;
    const snap = await loadActiveRun();
    if (!snap || state.phase !== 'idle') return false;

    movingAccumMs = Math.max(0, snap.movingAccumMs);
    segmentStartedAt = null;
    isReachedEmitted = snap.reachedPin;
    isCompletedEmitted = snap.completedTarget;
    lastFixAt = 0;
    fastMs = 0;
    emaSpeedMps = 0;

    const now = Date.now();
    state = {
      ...initial,
      phase: snap.phase,
      target: snap.target,
      targetMeters: snap.targetMeters,
      origin: snap.origin,
      pin: snap.pin,
      route: snap.route,
      routed: snap.routed,
      expectedDistanceM: snap.expectedDistanceM,
      path: snap.path,
      current: snap.current ?? snap.origin,
      headingDeg: snap.headingDeg,
      accuracyM: snap.accuracyM,
      distanceM: snap.distanceM,
      movingMs: movingAccumMs,
      elapsedMs: Math.max(0, now - snap.startedAt),
      startedAt: snap.startedAt,
      reachedPin: snap.reachedPin,
      reachedAt: snap.reachedAt,
      completedTarget: snap.completedTarget,
      weightKg: snap.weightKg,
      heightCm: snap.heightCm,
    };
    listeners.forEach((fn) => fn());

    ensureAppStatePersist();
    startTimer();
    if (snap.phase === 'running') {
      segmentStartedAt = now;
      await startWatch();
    }
    void flushPersist();
    return true;
  })()
    .catch(() => false)
    .then((ok) => {
      if (!ok) hydratePromise = null;
      return ok;
    });

  return hydratePromise;
}

/** Walk/jog threshold — above this, heading is GPS course (GMaps/Waze), not phone compass. */
const COURSE_SPEED_MPS = 1.0;

function wrapHeading(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function headingDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

function isMovingForCourse(): boolean {
  return emaSpeedMps >= COURSE_SPEED_MPS;
}

function smoothHeadingTo(next: number): number {
  const wrapped = wrapHeading(next);
  const prev = state.headingDeg;
  if (prev == null) return wrapped;
  const d = headingDelta(prev, wrapped);
  if (Math.abs(d) > 90) return wrapped;
  return wrapHeading(prev + d * 0.45);
}

function applyCompassHeading(deg: number): void {
  compassLive = true;
  // Moving: course-up from GPS / path, like Google Maps & Waze — not phone twist.
  if (isMovingForCourse()) return;
  const next = smoothHeadingTo(deg);
  if (state.headingDeg != null && Math.abs(headingDelta(state.headingDeg, next)) < 2) return;
  set({ headingDeg: next });
}

function stopEverything() {
  watchSub?.remove();
  watchSub = null;
  headingSub?.remove();
  headingSub = null;
  compassLive = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
  if (pinFinishTimer) {
    clearTimeout(pinFinishTimer);
    pinFinishTimer = null;
  }
  segmentStartedAt = null;
}

function startTimer() {
  if (timer) return;
  timer = setInterval(() => {
    if (state.phase !== 'running' && state.phase !== 'paused') return;
    const now = Date.now();
    const moving = movingAccumMs + (state.phase === 'running' && segmentStartedAt != null ? now - segmentStartedAt : 0);
    set({ movingMs: moving, elapsedMs: state.startedAt ? now - state.startedAt : moving });
  }, 1000);
}

async function startHeadingWatch() {
  if (headingSub || state.simulating) return;
  try {
    headingSub = await Location.watchHeadingAsync((h) => {
      const deg = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
      if (typeof deg !== 'number' || deg < 0 || Number.isNaN(deg)) return;
      applyCompassHeading(deg);
    });
  } catch {
    compassLive = false;
  }
}

async function startWatch() {
  if (state.simulating) return;
  if (!watchSub) {
    try {
      watchSub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 2,
        },
        (fix) => ingestFix({
          lat: fix.coords.latitude,
          lng: fix.coords.longitude,
          accuracy: fix.coords.accuracy ?? null,
          heading: fix.coords.heading != null && fix.coords.heading >= 0 ? fix.coords.heading : null,
          at: fix.timestamp,
        }),
      );
    } catch {
      /* keep the timer running; the HUD shows the last known point */
    }
  }
  await startHeadingWatch();
}

type Fix = { lat: number; lng: number; accuracy: number | null; heading: number | null; at: number };
let lastFixAt = 0;
let fastMs = 0;
let emaSpeedMps = 0;

/** Runner appears to be in a vehicle — stop tracking, keep the screen state for the explainer modal. */
function cancelForTransport() {
  stopEverything();
  wipePersist();
  set({
    phase: 'idle',
    transportCancelled: true,
    transportWarning: false,
    simulating: false,
    simMode: 'off',
    speedKmh: 0,
  });
  emit('transport_cancelled');
}

function ingestFix(fix: Fix) {
  const point = { lat: fix.lat, lng: fix.lng };
  const patch: Partial<RunState> = { accuracyM: fix.accuracy };

  if (fix.accuracy != null && fix.accuracy > MAX_ACCURACY_M && state.current) {
    set(patch);
    return;
  }

  // ── Live speed + vehicle detection (raw, before the GPS-jump filter) ──────
  const dtMs = lastFixAt && fix.at > lastFixAt ? fix.at - lastFixAt : 1000;
  let rawMps = 0;
  if (state.current && dtMs >= 300 && dtMs <= 30_000) {
    rawMps = haversineM(state.current, point) / (dtMs / 1000);
    if (rawMps > 70) rawMps = 0; // GPS teleport, not motion
  }
  emaSpeedMps = emaSpeedMps <= 0 ? rawMps : emaSpeedMps * 0.6 + rawMps * 0.4;
  patch.speedKmh = Math.round(emaSpeedMps * 36) / 10;

  let warnNow = false;
  if (state.phase === 'running') {
    const step = Math.min(dtMs, 5000);
    if (rawMps > TRANSPORT_FAST_MPS) fastMs += step;
    else if (rawMps < TRANSPORT_SLOW_MPS) fastMs = Math.max(0, fastMs - step * 2);
    if (fastMs >= TRANSPORT_CANCEL_MS) {
      cancelForTransport();
      return;
    }
    if (fastMs >= TRANSPORT_WARN_MS && !state.transportWarning) {
      patch.transportWarning = true;
      warnNow = true;
    } else if (fastMs === 0 && state.transportWarning) {
      patch.transportWarning = false;
    }
  }

  const prev = state.path[state.path.length - 1] ?? state.current;
  let heading = state.headingDeg;
  const stepped = Boolean(prev && haversineM(prev, point) >= 3);
  if (isMovingForCourse() || stepped) {
    if (fix.heading != null) heading = smoothHeadingTo(fix.heading);
    else if (prev && stepped) heading = smoothHeadingTo(bearingDeg(prev, point));
  } else if (!compassLive && fix.heading != null) {
    heading = smoothHeadingTo(fix.heading);
  }

  if (state.phase === 'running' && prev) {
    const d = haversineM(prev, point);
    const dt = lastFixAt ? (fix.at - lastFixAt) / 1000 : 1;
    const speed = dt > 0 ? d / dt : 0;
    if (d >= MIN_STEP_M && speed <= MAX_SPEED_MPS) {
      const distanceM = state.distanceM + d;
      const path = state.path.length ? [...state.path, point] : [prev, point];
      const completedTarget = state.completedTarget || distanceM >= state.targetMeters;
      const pinDist = state.pin ? haversineM(point, state.pin) : Infinity;
      const radius = Math.min(45, Math.max(PIN_RADIUS_M, (fix.accuracy ?? 0) + 8));
      const reachedPin = state.reachedPin || pinDist <= radius;
      Object.assign(patch, {
        current: point,
        headingDeg: heading,
        distanceM,
        path,
        completedTarget,
        reachedPin,
        reachedAt: reachedPin && !state.reachedPin ? Date.now() : state.reachedAt,
      });
      set(patch);
      if (warnNow) emit('transport_warning');
      if (reachedPin && !isReachedEmitted) {
        isReachedEmitted = true;
        emit('pin_reached');
        schedulePinFinish();
      }
      if (completedTarget && !isCompletedEmitted) {
        isCompletedEmitted = true;
        emit('target_completed');
      }
      lastFixAt = fix.at;
      return;
    }
  }

  set({ ...patch, current: point, headingDeg: heading });
  if (warnNow) emit('transport_warning');
  lastFixAt = fix.at;
}

let isReachedEmitted = false;
let isCompletedEmitted = false;
let pinFinishTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePinFinish() {
  if (pinFinishTimer) return;
  pinFinishTimer = setTimeout(() => {
    pinFinishTimer = null;
    if (state.phase === 'running' || state.phase === 'paused') {
      void finishRun();
    }
  }, 2000);
}

// ---------------------------------------------------------------------------
// DEV simulation — glide along the route so the feature can be demoed on an emulator.
// ---------------------------------------------------------------------------

export function toggleSimulation(): void {
  if (!__DEV__) return;
  const order: SimMode[] = ['off', 'run', 'drive'];
  setSimMode(order[(order.indexOf(state.simMode) + 1) % order.length]);
}

function setSimMode(mode: SimMode): void {
  if (simTimer) clearInterval(simTimer);
  simTimer = null;
  if (mode === 'off') {
    set({ simulating: false, simMode: 'off' });
    if (state.phase === 'running') void startWatch();
    return;
  }
  watchSub?.remove();
  watchSub = null;
  headingSub?.remove();
  headingSub = null;
  compassLive = false;
  set({ simulating: true, simMode: mode });

  const line: LatLng[] =
    state.route?.coords.map(([lng, lat]) => ({ lat, lng })) ??
    (state.current && state.pin ? [state.current, state.pin] : []);
  if (line.length < 2) return;

  let seg = 0;
  let along = 0;
  const speed = mode === 'drive' ? 13.5 : 4.6; // m/s — 48.6 km/h vs fast run 16.6 km/h
  simTimer = setInterval(() => {
    if (state.phase !== 'running') return;
    let remaining = speed;
    while (remaining > 0 && seg < line.length - 1) {
      const a = line[seg];
      const b = line[seg + 1];
      const segLen = haversineM(a, b);
      const left = segLen - along;
      if (remaining >= left) {
        remaining -= left;
        seg += 1;
        along = 0;
      } else {
        along += remaining;
        remaining = 0;
      }
    }
    if (seg >= line.length - 1) {
      const end = line[line.length - 1];
      ingestFix({ lat: end.lat + (Math.random() - 0.5) * 0.00002, lng: end.lng, accuracy: 6, heading: null, at: Date.now() });
      return;
    }
    const a = line[seg];
    const b = line[seg + 1];
    const t = along / Math.max(1, haversineM(a, b));
    ingestFix({
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
      accuracy: 5,
      heading: bearingDeg(a, b),
      at: Date.now(),
    });
  }, 1000);
}
