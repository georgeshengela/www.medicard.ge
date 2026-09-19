// Generated from medipulsi/src by build-core.mjs.
// Illustrative pilot route, not a verified pedestrian routing dataset.
export const ROUTE = [
    [44.75272, 41.71067], [44.75242, 41.71030], [44.75211, 41.70989], [44.75181, 41.70950],
    [44.75151, 41.70910], [44.75122, 41.70872], [44.75091, 41.70829], [44.75063, 41.70790],
    [44.75024, 41.70781], [44.74969, 41.70804], [44.74939, 41.70837], [44.74973, 41.70871],
    [44.75009, 41.70908], [44.75046, 41.70946], [44.75081, 41.70985], [44.75117, 41.71022],
    [44.75158, 41.71060], [44.75201, 41.71101], [44.75250, 41.71131], [44.75316, 41.71104],
    [44.75373, 41.71072], [44.75429, 41.71037], [44.75451, 41.70994], [44.75414, 41.70963],
    [44.75356, 41.70949], [44.75305, 41.70974], [44.75255, 41.71001], [44.75211, 41.70989],
];
export function distance(a, b) { const r = Math.PI / 180, dLat = (b[1] - a[1]) * r, dLon = (b[0] - a[0]) * r; const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLon / 2) ** 2; return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)); }
export const SEGMENTS = ROUTE.slice(1).map((p, i) => distance(ROUTE[i], p));
export const TOTAL = SEGMENTS.reduce((a, b) => a + b, 0);
export const GIFT_AT = TOTAL * .62;
export function pointAt(meters) { let remaining = Math.max(0, Math.min(TOTAL, meters)); for (let i = 0; i < SEGMENTS.length; i++) {
    if (remaining <= SEGMENTS[i]) {
        const t = remaining / SEGMENTS[i];
        return [ROUTE[i][0] + (ROUTE[i + 1][0] - ROUTE[i][0]) * t, ROUTE[i][1] + (ROUTE[i + 1][1] - ROUTE[i][1]) * t];
    }
    remaining -= SEGMENTS[i];
} return ROUTE.at(-1); }
export function lineTo(meters) { const clamped = Math.max(0, Math.min(TOTAL, meters)); const result = [ROUTE[0]]; let length = 0; for (let i = 0; i < SEGMENTS.length; i++) {
    length += SEGMENTS[i];
    if (length <= clamped)
        result.push(ROUTE[i + 1]);
    else {
        result.push(pointAt(clamped));
        break;
    }
} if (result.length === 1)
    result.push(ROUTE[0]); return result; }
export function coverage(meters) { const m = Math.max(0, Math.min(TOTAL, meters)); return { percent: Math.round(m / TOTAL * 100), completed: m / TOTAL >= .85, meters: m }; }
export function heartbeatDistance(meters, giftAt = GIFT_AT) { return Math.abs(giftAt - Math.max(0, Math.min(TOTAL, meters))); }
export function heartbeatPeriod(distanceMeters) { return distanceMeters > 150 ? 0 : distanceMeters > 80 ? 2600 : distanceMeters > 35 ? 1700 : distanceMeters > 15 ? 1100 : 850; }
export function formatDistance(m) { return m < 1000 ? `${Math.round(m)} მ` : `${(m / 1000).toFixed(2)} კმ`; }
export function formatTime(seconds) { const s = Math.floor(seconds); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
export const ZONE = [[44.7477, 41.7090], [44.7517, 41.7120], [44.7558, 41.7108], [44.7549, 41.7084], [44.7518, 41.7060], [44.7484, 41.7068], [44.7477, 41.7090]];
export const EMPTY = { version: 1, meters: 0, seconds: 0, claimed: false, completedAt: null };
export function loadProgress(raw) { try {
    const d = JSON.parse(raw || 'null');
    if (d?.version !== 1)
        return { ...EMPTY };
    return { version: 1, meters: Number.isFinite(d.meters) ? Math.min(TOTAL, Math.max(0, d.meters)) : 0, seconds: Number.isFinite(d.seconds) ? Math.max(0, d.seconds) : 0, claimed: d.claimed === true, completedAt: typeof d.completedAt === 'string' ? d.completedAt : null };
}
catch {
    return { ...EMPTY };
} }
