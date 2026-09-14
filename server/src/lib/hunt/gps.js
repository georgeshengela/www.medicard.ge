import { haversineM } from './geo.js';

export function classifySample(prev, sample, config, mode, now) {
  if (!sample || !Number.isFinite(sample.lat) || !Number.isFinite(sample.lng)) {
    return { ok: false, reason: 'INVALID' };
  }
  const at = Number(sample.at);
  if (!Number.isFinite(at) || at > now + 2500) return { ok: false, reason: 'CLOCK' };
  if (now - at > config.maxSampleAgeMs) return { ok: false, reason: 'STALE' };
  if (sample.seq != null && prev?.seq != null && sample.seq <= prev.seq) return { ok: false, reason: 'ORDER' };
  const accuracy = Number(sample.accuracy);
  if (!Number.isFinite(accuracy) || accuracy > config.accuracyMaxM) {
    return { ok: false, reason: 'ACCURACY', accuracy };
  }
  const point = { lat: sample.lat, lng: sample.lng };
  if (prev?.point) {
    const dt = Math.max(0.2, (at - prev.at) / 1000);
    const dist = haversineM(prev.point, point);
    if (dist > config.teleportM) return { ok: false, reason: 'JUMP', dist };
    const cap = mode === 'gentle' ? config.gentleMaxSpeedMps : config.maxSpeedMps;
    if (dist / dt > cap + 0.4) return { ok: false, reason: 'SPEED', mps: dist / dt };
  }
  return { ok: true, point, at, accuracy, seq: sample.seq ?? (prev?.seq || 0) + 1 };
}

export function stoppedDwell(fixes, config, now) {
  const recent = (fixes || []).filter((f) => now - f.at <= config.dwellMs + 400);
  if (recent.length < config.minAcceptedFixes) return false;
  const last = recent[recent.length - 1];
  return recent.every((f) => haversineM(f.point, last.point) <= 2.4);
}

export function captureEligible({ config, hunting, enemyPoint, playerPoint, graphHitM, stopped, now, huntUntil }) {
  if (!hunting) return { ok: false, reason: 'NOT_HUNTING' };
  if (!huntUntil || now >= huntUntil) return { ok: false, reason: 'HUNT_EXPIRED' };
  if (!stopped) return { ok: false, reason: 'MOVING' };
  if (!playerPoint || !enemyPoint) return { ok: false, reason: 'NO_FIX' };
  const straight = haversineM(playerPoint, enemyPoint);
  if (straight > config.captureRadiusM) return { ok: false, reason: 'FAR', straight };
  if (graphHitM != null && graphHitM > config.captureRadiusM + 4) {
    return { ok: false, reason: 'INACCESSIBLE', graphHitM };
  }
  return { ok: true, straight };
}
