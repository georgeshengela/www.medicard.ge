/**
 * MEDIRUN background GPS. A session the person started on screen keeps recording after the screen locks:
 * iOS shows the blue location indicator, Android a foreground-service notification. Nothing records
 * outside a running session — every launch first stops a task left over from an earlier process.
 *
 * The task is defined when the JS bundle loads (index.js imports this file), because the OS can deliver
 * locations before any screen mounts. Every start/stop goes through one queue, so a pause racing a resume
 * can never stop the newer session.
 */
import { Platform } from 'react-native';
import * as Location from 'expo-location';

export const RUN_LOCATION_TASK = 'medirun-location';

export type TaskFix = {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  at: number;
  speed: number | null;
  mocked: boolean;
};

type TaskManagerModule = typeof import('expo-task-manager');

let TaskManager: TaskManagerModule | null = null;
try {
  // A bundle must never crash a binary that lacks the native module.
  TaskManager = Platform.OS === 'web' ? null : (require('expo-task-manager') as TaskManagerModule);
} catch {
  TaskManager = null;
}

type Sink = (fixes: TaskFix[]) => void;
let sink: Sink | null = null;
/** Locations that arrived before the run store attached; bounded (~15 min at 1 Hz). */
let pending: TaskFix[] = [];
const MAX_PENDING = 900;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validated, plain fixes from the task payload (`data.locations`). Anything malformed is dropped. */
export function toTaskFixes(raw: unknown): TaskFix[] {
  if (!Array.isArray(raw)) return [];
  const out: TaskFix[] = [];
  for (const item of raw) {
    const coords = (item as { coords?: Record<string, unknown> } | null)?.coords;
    const at = (item as { timestamp?: unknown } | null)?.timestamp;
    if (!coords || !finite(coords.latitude) || !finite(coords.longitude) || !finite(at)) continue;
    if (Math.abs(coords.latitude) > 90 || Math.abs(coords.longitude) > 180) continue;
    out.push({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: finite(coords.accuracy) && coords.accuracy >= 0 ? coords.accuracy : null,
      heading: finite(coords.heading) && coords.heading >= 0 ? coords.heading : null,
      at: Math.trunc(at),
      speed: finite(coords.speed) && coords.speed >= 0 ? coords.speed : null,
      mocked: (item as { mocked?: unknown }).mocked === true,
    });
  }
  return out.sort((a, b) => a.at - b.at);
}

function deliver(fixes: TaskFix[]): void {
  if (!fixes.length) return;
  if (sink) {
    sink(fixes);
    return;
  }
  pending.push(...fixes);
  if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);
}

if (TaskManager) {
  try {
    TaskManager.defineTask(RUN_LOCATION_TASK, async ({ data, error }) => {
      // A transient CoreLocation error (no fix yet, a brief denial) is not fatal: the next update follows.
      if (error) return;
      deliver(toTaskFixes((data as { locations?: unknown } | null)?.locations));
    });
  } catch {
    TaskManager = null;
  }
}

/** True when this binary can record in the background (task module present and the task defined). */
export function backgroundLocationAvailable(): boolean {
  try {
    return Boolean(TaskManager?.isTaskDefined(RUN_LOCATION_TASK));
  } catch {
    return false;
  }
}

/** The run store receives locations here; `null` detaches it and forgets anything still buffered. */
export function setRunLocationSink(next: Sink | null): void {
  sink = next;
  if (!next) {
    pending = [];
    return;
  }
  if (pending.length) {
    const batch = pending;
    pending = [];
    next(batch);
  }
}

export type RunLocationMode = { drive: boolean; notificationTitle: string; notificationBody: string };

function taskOptions(mode: RunLocationMode): Location.LocationTaskOptions {
  return {
    // Walking: every couple of metres, best accuracy. A long drive: coarser and sparser, the chip rests a bit.
    accuracy: mode.drive ? Location.Accuracy.High : Location.Accuracy.BestForNavigation,
    distanceInterval: mode.drive ? 10 : 2,
    timeInterval: mode.drive ? 3000 : 1000,
    activityType: Location.LocationActivityType.Fitness,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: mode.notificationTitle,
      notificationBody: mode.notificationBody,
      notificationColor: '#0D9488',
      killServiceOnDestroy: true,
    },
  };
}

let queue: Promise<unknown> = Promise.resolve();
let applied: string | null = null;

function enqueue<T>(work: () => Promise<T>, fallback: T): Promise<T> {
  const next = queue.then(work, work).catch(() => fallback);
  queue = next;
  return next;
}

async function hasStarted(): Promise<boolean> {
  try {
    return await Location.hasStartedLocationUpdatesAsync(RUN_LOCATION_TASK);
  } catch {
    return false;
  }
}

/**
 * Start (or retune) background updates. Must first be called while the app is on screen: Android only
 * lets a location foreground service start from the foreground. Resolves false when unavailable or refused.
 */
export function startRunLocationUpdates(mode: RunLocationMode): Promise<boolean> {
  if (!backgroundLocationAvailable()) return Promise.resolve(false);
  const key = JSON.stringify(mode);
  return enqueue(async () => {
    if (applied === key && (await hasStarted())) return true;
    try {
      await Location.startLocationUpdatesAsync(RUN_LOCATION_TASK, taskOptions(mode));
      applied = key;
      return true;
    } catch {
      applied = null;
      return false;
    }
  }, false);
}

/** Stop background updates (no-op when none run). Queued behind any start still in flight. */
export function stopRunLocationUpdates(): Promise<void> {
  return enqueue(async () => {
    applied = null;
    if (!TaskManager) return;
    if (await hasStarted()) {
      try {
        await Location.stopLocationUpdatesAsync(RUN_LOCATION_TASK);
      } catch {
        /* already stopped by the OS */
      }
    }
  }, undefined);
}

// The OS restores registered tasks on every launch. No session runs at launch, so a task left over from a
// previous process (crash, swipe-away, OTA reload) must not keep recording.
if (TaskManager) void stopRunLocationUpdates();
