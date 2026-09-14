/** Pure geo helpers for Medi Hunt (metres, WGS84). */

const EARTH_R = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;
const toDeg = (r) => (r * 180) / Math.PI;

export function haversineM(a, b) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function destinationPoint(origin, bearingDeg, distM) {
  const br = toRad(bearingDeg);
  const la1 = toRad(origin.lat);
  const lo1 = toRad(origin.lng);
  const ad = distM / EARTH_R;
  const la2 = Math.asin(Math.sin(la1) * Math.cos(ad) + Math.cos(la1) * Math.sin(ad) * Math.cos(br));
  const lo2 =
    lo1 + Math.atan2(Math.sin(br) * Math.sin(ad) * Math.cos(la1), Math.cos(ad) - Math.sin(la1) * Math.sin(la2));
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}

export function bearingDeg(a, b) {
  const la1 = toRad(a.lat);
  const la2 = toRad(b.lat);
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function playBounds(origin, sizeM = 1000) {
  const half = sizeM / 2;
  const north = destinationPoint(origin, 0, half).lat;
  const south = destinationPoint(origin, 180, half).lat;
  const east = destinationPoint(origin, 90, half).lng;
  const west = destinationPoint(origin, 270, half).lng;
  return { south, west, north, east, sizeM };
}

export function inBounds(point, bounds, padM = 0) {
  if (!point || !bounds) return false;
  if (!padM) {
    return point.lat >= bounds.south && point.lat <= bounds.north && point.lng >= bounds.west && point.lng <= bounds.east;
  }
  const padded = {
    south: destinationPoint({ lat: bounds.south, lng: bounds.west }, 180, padM).lat,
    north: destinationPoint({ lat: bounds.north, lng: bounds.west }, 0, padM).lat,
    west: destinationPoint({ lat: bounds.south, lng: bounds.west }, 270, padM).lng,
    east: destinationPoint({ lat: bounds.south, lng: bounds.east }, 90, padM).lng,
  };
  return inBounds(point, padded, 0);
}

export function alongSegment(a, b, t) {
  const u = Math.min(1, Math.max(0, t));
  return { lat: a.lat + (b.lat - a.lat) * u, lng: a.lng + (b.lng - a.lng) * u };
}

export function pointToSegmentM(point, a, b) {
  const lab = haversineM(a, b);
  if (lab < 0.5) return { distanceM: haversineM(point, a), t: 0, point: a };
  // Equirectangular local projection.
  const x = (p) => toRad(p.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2)) * EARTH_R;
  const y = (p) => toRad(p.lat - a.lat) * EARTH_R;
  const abx = x(b);
  const aby = y(b);
  const apx = x(point);
  const apy = y(point);
  const t = Math.min(1, Math.max(0, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
  const closest = alongSegment(a, b, t);
  return { distanceM: haversineM(point, closest), t, point: closest };
}

export function geohashCell(lat, lng, metres = 1000) {
  const latStep = metres / 111_320;
  const lngStep = metres / (111_320 * Math.max(0.2, Math.cos(toRad(lat))));
  const i = Math.floor(lat / latStep);
  const j = Math.floor(lng / lngStep);
  return `${i}:${j}`;
}
