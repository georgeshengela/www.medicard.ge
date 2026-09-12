import * as Location from 'expo-location';
import { AppState, type AppStateStatus } from 'react-native';
import {
  getExplorePermission,
  locationServicesOn,
  requestExploreForegroundPermission,
  type ExploreFix,
  type ExploreLocationState,
  type ExplorePermission,
} from '@/lib/mediWorld/exploreLocation';
import { isValidLatitude, isValidLongitude } from '@/lib/mediWorld/exploreGeo';
import { EXPLORE_ACCURACY_MAX_M } from '@/lib/mediWorld/exploreLocationPolicy';
import {
  MOVEMENT_LAST_KNOWN_FORBIDDEN,
  MOVEMENT_MIN_INTERVAL_MS,
  movementSampleRejectReason,
  shouldSendMovementSample,
} from '@/lib/mediWorld/movementLocationPolicy';
import { applyMovementQaFix } from '@/lib/mediWorld/movementQa.js';

const HIGH = Location.Accuracy.High;
const MIN_INTERVAL_MS = MOVEMENT_MIN_INTERVAL_MS;
const MIN_DISTANCE_M = 8;

let watch: Location.LocationSubscription | null = null;
let appSub: { remove: () => void } | null = null;

export { getExplorePermission as getMovementPermission, locationServicesOn };

/** Skip the system prompt when foreground permission is already settled. */
export async function requestMovementPermission(): Promise<ExplorePermission> {
  const current = await getExplorePermission();
  if (current === 'granted' || current === 'granted_approximate' || current === 'denied_permanent') {
    return current;
  }
  return requestExploreForegroundPermission();
}
export type { ExploreFix as MovementFix, ExploreLocationState as MovementLocationState, ExplorePermission as MovementPermission };
export { MOVEMENT_LAST_KNOWN_FORBIDDEN, movementSampleRejectReason, shouldSendMovementSample };

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
    approximate: accuracy != null && accuracy > EXPLORE_ACCURACY_MAX_M,
  };
}

function fromNative(pos: Location.LocationObject): ExploreFix | null {
  return applyMovementQaFix(toFix(pos));
}

/** Fresh native sample only. Last-known is never used for movement verification. */
export async function readMovementSample(timeoutMs = 15_000): Promise<ExploreFix | null> {
  const enabled = await locationServicesOn();
  if (!enabled) return null;
  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: HIGH,
        mayShowUserSettingsDialog: true,
      }),
      new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
    return pos ? fromNative(pos) : null;
  } catch {
    return null;
  }
}

export function startMovementWatch(
  onFix: (fix: ExploreFix) => void,
  onState?: (state: ExploreLocationState) => void,
  onBackground?: () => void,
) {
  stopMovementWatch();
  let active = true;

  const pauseIfBackground = (status: AppStateStatus) => {
    if (status !== 'active') {
      onBackground?.();
      stopMovementWatch();
    }
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
        distanceInterval: MIN_DISTANCE_M,
        timeInterval: MIN_INTERVAL_MS,
      },
      (pos) => {
        if (!active) return;
        const fix = fromNative(pos);
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
    stopMovementWatch();
  };
}

export function stopMovementWatch() {
  watch?.remove();
  watch = null;
  appSub?.remove();
  appSub = null;
}
