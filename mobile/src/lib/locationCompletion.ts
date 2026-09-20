import type { UserLocationSnapshot } from './api';

export function hasResolvedLocation(location: UserLocationSnapshot | null | undefined) {
  return Boolean(location?.enabled && location.countryCode?.trim() && location.cityKa?.trim()
    && Number.isFinite(location.lat) && Number.isFinite(location.lng)
    && Math.abs(location.lat!) <= 90 && Math.abs(location.lng!) <= 180);
}

/** A previous permission prompt is not evidence that a city was actually saved. */
export function shouldCompleteLocation(location: UserLocationSnapshot | null | undefined, postponedAt: number | null, now = Date.now()) {
  return !hasResolvedLocation(location) && !(postponedAt && now >= postponedAt && now - postponedAt < 24 * 60 * 60 * 1000);
}
