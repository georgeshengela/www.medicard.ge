import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';
import { ACCURACY_MAX_M, MOTORIZED_MPS, isValidLatitude, isValidLongitude } from '@/lib/mediWorld/exploreGeo';
import {
  EXPLORE_BROWSE_TIMEOUT_MS,
  EXPLORE_COLLECT_TIMEOUT_MS,
  isCollectSampleAccurate,
  isCollectSampleFresh,
  redactExploreCoordinate,
  shouldUseLastKnown,
} from '@/lib/mediWorld/exploreLocationPolicy';

export type ExplorePermission = 'undetermined' | 'granted' | 'granted_approximate' | 'denied' | 'denied_permanent';

export type ExploreFix = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
  mocked: boolean;
  speedMps: number | null;
  approximate: boolean;
};

export type ExploreLocationState =
  | 'idle'
  | 'locating'
  | 'ready'
  | 'timeout'
  | 'inaccurate'
  | 'services_off'
  | 'denied'
  | 'denied_permanent'
  | 'unavailable';

export type ExploreLocationProbe = {
  permission: ExplorePermission;
  androidAccuracy: string | null;
  services: boolean;
  hasSample: boolean;
  ageSec: number | null;
  accuracyM: number | null;
  mocked: boolean | null;
  redactedLat: number | null;
  redactedLng: number | null;
  lastError: string | null;
};

const HIGH = Location.Accuracy.High;

let watch: Location.LocationSubscription | null = null;
let appSub: { remove: () => void } | null = null;
let currentPositionTask: Promise<Location.LocationObject | null> | null = null;
let lastError: string | null = null;

function permissionFromResponse(current: Location.LocationPermissionResponse): ExplorePermission {
  if (current.status === 'granted') {
    if (current.android?.accuracy === 'coarse') return 'granted_approximate';
    return 'granted';
  }
  if (current.status === 'denied' && current.canAskAgain === false) return 'denied_permanent';
  if (current.status === 'denied') return 'denied';
  return 'undetermined';
}

export async function getExplorePermission(): Promise<ExplorePermission> {
  const current = await Location.getForegroundPermissionsAsync();
  return permissionFromResponse(current);
}

export async function requestExploreForegroundPermission(): Promise<ExplorePermission> {
  const current = await getExplorePermission();
  if (current === 'denied_permanent') return current;
  const next = await Location.requestForegroundPermissionsAsync();
  return permissionFromResponse(next);
}

export async function locationServicesOn(): Promise<boolean> {
  try {
    return await Location.hasServicesEnabledAsync();
  } catch {
    return false;
  }
}

function toFix(pos: Location.LocationObject): ExploreFix | null {
  const latitude = pos.coords.latitude;
  const longitude = pos.coords.longitude;
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return null;
  const accuracy = Number.isFinite(pos.coords.accuracy) ? Number(pos.coords.accuracy) : null;
  return {
    latitude,
    longitude,
    accuracy,
    timestamp: pos.timestamp,
    mocked: pos.mocked === true,
    speedMps: Number.isFinite(pos.coords.speed) ? Number(pos.coords.speed) : null,
    approximate: accuracy != null && accuracy > ACCURACY_MAX_M,
  };
}

async function getCurrentPositionExclusive(
  timeoutMs: number,
): Promise<Location.LocationObject | null> {
  if (currentPositionTask) return currentPositionTask;
  currentPositionTask = (async () => {
    try {
      lastError = null;
      return await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: HIGH,
          mayShowUserSettingsDialog: true,
        }),
        new Promise<null>((resolve) => {
          setTimeout(() => resolve(null), timeoutMs);
        }),
      ]);
    } catch (error) {
      lastError = error instanceof Error ? error.name : 'location_error';
      return null;
    } finally {
      currentPositionTask = null;
    }
  })();
  return currentPositionTask;
}

export async function readExploreFix(timeoutMs = EXPLORE_BROWSE_TIMEOUT_MS): Promise<ExploreFix | null> {
  const enabled = await locationServicesOn();
  if (!enabled) {
    lastError = 'services_off';
    return null;
  }
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last && shouldUseLastKnown(Date.now() - last.timestamp)) {
      const fix = toFix(last);
      if (fix) return fix;
    }
  } catch {
    // last-known is optional and never used for collection
  }
  const pos = await getCurrentPositionExclusive(timeoutMs);
  if (!pos) lastError = lastError || 'timeout';
  return pos ? toFix(pos) : null;
}

export async function readCollectSample(): Promise<ExploreFix | null> {
  const enabled = await locationServicesOn();
  if (!enabled) {
    lastError = 'services_off';
    return null;
  }
  const pos = await getCurrentPositionExclusive(EXPLORE_COLLECT_TIMEOUT_MS);
  if (!pos) {
    lastError = lastError || 'timeout';
    return null;
  }
  return toFix(pos);
}

export function collectSampleRejectReason(fix: ExploreFix | null) {
  if (!fix) return 'SPARK_LOCATION_UNAVAILABLE';
  if (!isCollectSampleFresh(fix.timestamp)) return 'SPARK_LOCATION_STALE';
  if (!isCollectSampleAccurate(fix.accuracy)) return 'SPARK_LOCATION_INACCURATE';
  return null;
}

export function isMotorized(fix: ExploreFix | null) {
  return Boolean(fix && Number.isFinite(fix.speedMps) && (fix.speedMps as number) >= MOTORIZED_MPS);
}

export function startExploreWatch(
  onFix: (fix: ExploreFix) => void,
  onState?: (state: ExploreLocationState) => void,
) {
  stopExploreWatch();
  let active = true;

  const pauseIfBackground = (status: AppStateStatus) => {
    if (status !== 'active') stopExploreWatch();
  };
  appSub = AppState.addEventListener('change', pauseIfBackground);

  void (async () => {
    const enabled = await locationServicesOn();
    if (!enabled) {
      onState?.('services_off');
      return;
    }
    onState?.('locating');
    watch = await Location.watchPositionAsync(
      {
        accuracy: HIGH,
        distanceInterval: 5,
        timeInterval: 4_000,
      },
      (pos) => {
        if (!active) return;
        const fix = toFix(pos);
        if (!fix) {
          onState?.('unavailable');
          return;
        }
        onFix(fix);
        onState?.(fix.approximate ? 'inaccurate' : 'ready');
      },
    );
  })();

  return () => {
    active = false;
    stopExploreWatch();
  };
}

export function stopExploreWatch() {
  watch?.remove();
  watch = null;
  appSub?.remove();
  appSub = null;
}

export async function getExploreLocationProbe(fix: ExploreFix | null = null): Promise<ExploreLocationProbe> {
  const permission = await getExplorePermission();
  const services = await locationServicesOn();
  const current = await Location.getForegroundPermissionsAsync();
  return {
    permission,
    androidAccuracy: current.android?.accuracy || null,
    services,
    hasSample: Boolean(fix),
    ageSec: fix ? Math.max(0, Math.round((Date.now() - fix.timestamp) / 1000)) : null,
    accuracyM: fix?.accuracy ?? null,
    mocked: fix ? fix.mocked : null,
    redactedLat: fix ? redactExploreCoordinate(fix.latitude) : null,
    redactedLng: fix ? redactExploreCoordinate(fix.longitude) : null,
    lastError,
  };
}
