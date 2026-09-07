/**
 * Pure geo + fitness math for the Run (beta) module. No React, no IO — unit-testable.
 */

export type LatLng = { lat: number; lng: number };

const EARTH_R = 6371008.8;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from a to b, degrees 0..360. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Point at `distM` metres from `origin` along `bearing` degrees. */
export function destinationPoint(origin: LatLng, bearing: number, distM: number): LatLng {
  const br = toRad(bearing);
  const la1 = toRad(origin.lat);
  const lo1 = toRad(origin.lng);
  const ad = distM / EARTH_R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(ad) + Math.cos(la1) * Math.sin(ad) * Math.cos(br));
  const lo2 =
    lo1 + Math.atan2(Math.sin(br) * Math.sin(ad) * Math.cos(la1), Math.cos(ad) - Math.sin(la1) * Math.sin(la2));
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}

/** Sum of segment lengths along a path. */
export function pathLengthM(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineM(path[i - 1], path[i]);
  return total;
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export type RunTargetKind = 'km' | 'steps';
export type RunTarget = { kind: RunTargetKind; value: number };

/** Stride in metres — running/jog stride from height, or a safe default. */
export function strideM(heightCm?: number | null): number {
  if (heightCm && heightCm > 100 && heightCm < 230) return Math.round(heightCm * 0.43) / 100;
  return 0.75;
}

export function targetMeters(target: RunTarget, heightCm?: number | null): number {
  if (target.kind === 'km') return Math.round(target.value * 1000);
  return Math.round(target.value * strideM(heightCm));
}

export function estimateSteps(distanceM: number, heightCm?: number | null): number {
  return Math.max(0, Math.round(distanceM / strideM(heightCm)));
}

// ---------------------------------------------------------------------------
// Fitness
// ---------------------------------------------------------------------------

/** MET by speed (km/h) — walking → jogging → running (Compendium of Physical Activities). */
export function metForSpeedKmh(kmh: number): number {
  if (kmh < 0.8) return 1.3;
  if (kmh < 4) return 2.8;
  if (kmh < 5) return 3.5;
  if (kmh < 6.5) return 4.3;
  if (kmh < 8) return 8.3;
  if (kmh < 9.7) return 9.8;
  if (kmh < 11.3) return 11;
  if (kmh < 12.9) return 11.8;
  if (kmh < 14.5) return 12.8;
  return 14.5;
}

/** Calories for a stretch: MET × kg × hours. */
export function caloriesKcal(distanceM: number, movingMs: number, weightKg?: number | null): number {
  const kg = weightKg && weightKg > 25 ? weightKg : 70;
  const hours = movingMs / 3_600_000;
  if (hours <= 0 || distanceM <= 0) return 0;
  const kmh = distanceM / 1000 / hours;
  return metForSpeedKmh(kmh) * kg * hours;
}

/** Seconds per km; null when there is not enough movement yet. */
export function paceSecPerKm(distanceM: number, movingMs: number): number | null {
  if (distanceM < 25 || movingMs < 5000) return null;
  const sec = (movingMs / 1000) / (distanceM / 1000);
  if (!Number.isFinite(sec) || sec > 3600) return null;
  return sec;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatKm(m: number, digits = 2): string {
  return (m / 1000).toFixed(digits);
}

/** 6'12'' style pace. */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm == null) return '–';
  const total = Math.round(secPerKm);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}'${String(s).padStart(2, '0')}"`;
}

/** 850 მ / 1.2 კმ. */
export function formatDistanceShort(m: number): string {
  if (m < 1000) return `${Math.round(m)} მ`;
  return `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} კმ`;
}

export function formatThousands(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Rough duration estimate for a target at a relaxed jog (~7.5 km/h). */
export function estimateDurationMs(distanceM: number, kmh = 7.5): number {
  return (distanceM / 1000 / kmh) * 3_600_000;
}

/** Deterministic-ish spread of bearings so candidates cover the compass. */
export function candidateBearings(count: number, seed = Math.random()): number[] {
  const start = seed * 360;
  const step = 360 / count;
  return Array.from({ length: count }, (_, i) => (start + i * step + (Math.random() - 0.5) * step * 0.6 + 360) % 360);
}

/** Straight-line radius to request so that the *walking* route lands near the target. Roads wind ~1.3×. */
export function crowFliesRadiusM(targetM: number): number {
  return Math.max(150, targetM / 1.3);
}
