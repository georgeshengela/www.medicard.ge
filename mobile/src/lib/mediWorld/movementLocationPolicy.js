import { EXPLORE_ACCURACY_MAX_M, isCollectSampleAccurate, isCollectSampleFresh } from './exploreLocationPolicy.ts';

export const MOVEMENT_LAST_KNOWN_FORBIDDEN = true;
export const MOVEMENT_MIN_INTERVAL_MS = 5_000;

export function movementSampleRejectReason(fix) {
  if (!fix) return 'SEGMENT_LOCATION_UNAVAILABLE';
  if (!isCollectSampleFresh(fix.timestamp)) return 'SEGMENT_STALE';
  if (!isCollectSampleAccurate(fix.accuracy, EXPLORE_ACCURACY_MAX_M)) return 'SEGMENT_INACCURATE';
  return null;
}

export function shouldSendMovementSample(prev, next) {
  if (!next) return false;
  if (!isCollectSampleFresh(next.timestamp)) return false;
  if (!prev) return true;
  if (next.timestamp <= prev.timestamp) return false;
  if (next.timestamp - prev.timestamp < MOVEMENT_MIN_INTERVAL_MS) return false;
  return true;
}
