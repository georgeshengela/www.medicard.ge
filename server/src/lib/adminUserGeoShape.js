import { countryCodeOf, countryNameKa } from './geoPlace.js';

/** Approximate country centroids [lng, lat] — public geography, never user GPS. */
export const COUNTRY_CENTROIDS = {
  GE: [43.5, 42.0],
  AM: [45.0, 40.2],
  AZ: [47.6, 40.3],
  TR: [35.2, 39.0],
  RU: [37.6, 55.8],
  UA: [31.2, 49.0],
  BY: [27.6, 53.7],
  MD: [28.6, 47.4],
  US: [-98.6, 39.8],
  GB: [-1.8, 54.2],
  DE: [10.4, 51.2],
  FR: [2.3, 46.2],
  IT: [12.6, 42.5],
  ES: [-3.7, 40.4],
  PT: [-8.2, 39.6],
  NL: [5.3, 52.1],
  BE: [4.5, 50.6],
  CH: [8.2, 46.8],
  AT: [14.6, 47.6],
  PL: [19.4, 52.1],
  CZ: [15.5, 49.8],
  HU: [19.5, 47.2],
  RO: [25.0, 45.9],
  BG: [25.5, 42.7],
  GR: [22.0, 39.1],
  CY: [33.4, 35.1],
  IL: [34.9, 31.4],
  AE: [54.4, 24.0],
  SA: [45.1, 23.9],
  QA: [51.2, 25.3],
  CN: [104.2, 35.9],
  JP: [138.3, 36.2],
  KR: [127.8, 36.4],
  IN: [78.9, 21.1],
  CA: [-96.0, 56.1],
  AU: [133.8, -25.3],
  BR: [-51.9, -14.2],
  MX: [-102.6, 23.6],
  SE: [16.6, 62.2],
  NO: [8.5, 60.5],
  FI: [26.0, 64.5],
  DK: [10.0, 56.0],
  IE: [-8.2, 53.2],
  LT: [23.9, 55.2],
  LV: [24.6, 56.9],
  EE: [25.0, 58.6],
  KZ: [66.9, 48.0],
  UZ: [64.6, 41.4],
  EG: [30.8, 26.8],
  ZA: [24.7, -29.0],
  XK: [20.9, 42.6],
  TW: [120.9, 23.7],
  SG: [103.8, 1.35],
  HK: [114.2, 22.3],
  NZ: [172.0, -41.0],
  AR: [-64.0, -34.0],
  CL: [-71.5, -35.7],
  CO: [-74.3, 4.6],
  PE: [-75.0, -9.2],
  NG: [8.7, 9.1],
  KE: [37.9, 0.0],
  GH: [-1.0, 7.9],
  MA: [-7.1, 31.8],
  TN: [9.5, 33.9],
  PK: [69.3, 30.4],
  BD: [90.4, 23.7],
  ID: [113.9, -0.8],
  TH: [100.9, 15.9],
  VN: [108.3, 14.1],
  PH: [121.8, 12.9],
  MY: [109.7, 3.8],
};

export function sanitizeMapboxPublicToken(raw) {
  const token = String(raw || '').trim();
  return token.startsWith('pk.') ? token : '';
}

export function countryCentroid(code) {
  const iso = countryCodeOf(code);
  if (!iso) return null;
  const pair = COUNTRY_CENTROIDS[iso];
  if (!pair) return null;
  return { lng: pair[0], lat: pair[1] };
}

export function shapeGeoCountries(rows) {
  const byCode = new Map();
  for (const row of rows || []) {
    const code = countryCodeOf(row?.countryCode);
    if (!code) continue;
    const users = Number(row.users) || 0;
    if (users <= 0) continue;
    const center = countryCentroid(code);
    const prev = byCode.get(code);
    if (prev) {
      prev.users += users;
      continue;
    }
    byCode.set(code, {
      code,
      nameKa: countryNameKa(code, row.countryKa) || code,
      users,
      lng: center?.lng ?? null,
      lat: center?.lat ?? null,
    });
  }
  return [...byCode.values()].sort((a, b) => b.users - a.users || a.code.localeCompare(b.code));
}

/** Calling codes → country (longest prefix wins). Only the country, never the number, leaves this file. */
const PHONE_PREFIX_COUNTRY = [
  ['995', 'GE'], ['374', 'AM'], ['994', 'AZ'], ['380', 'UA'], ['375', 'BY'], ['373', 'MD'], ['972', 'IL'], ['971', 'AE'],
  ['966', 'SA'], ['974', 'QA'], ['420', 'CZ'], ['351', 'PT'], ['353', 'IE'], ['358', 'FI'], ['370', 'LT'], ['371', 'LV'],
  ['372', 'EE'], ['357', 'CY'], ['359', 'BG'], ['90', 'TR'], ['49', 'DE'], ['44', 'GB'], ['33', 'FR'], ['39', 'IT'],
  ['34', 'ES'], ['31', 'NL'], ['32', 'BE'], ['41', 'CH'], ['43', 'AT'], ['48', 'PL'], ['36', 'HU'], ['40', 'RO'],
  ['30', 'GR'], ['46', 'SE'], ['47', 'NO'], ['45', 'DK'], ['86', 'CN'], ['81', 'JP'], ['82', 'KR'], ['91', 'IN'],
  ['61', 'AU'], ['55', 'BR'], ['52', 'MX'], ['20', 'EG'], ['7', 'RU'], ['1', 'US'],
];

/** IANA zone → country for the zones people actually send; `Etc/*` and unknown zones say nothing. */
const TZ_COUNTRY = {
  'Asia/Tbilisi': 'GE', 'Asia/Yerevan': 'AM', 'Asia/Baku': 'AZ', 'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU',
  'Europe/Kyiv': 'UA', 'Europe/Kiev': 'UA', 'Europe/Minsk': 'BY', 'Europe/Chisinau': 'MD', 'Europe/Brussels': 'BE',
  'Europe/Berlin': 'DE', 'Europe/London': 'GB', 'Europe/Paris': 'FR', 'Europe/Rome': 'IT', 'Europe/Madrid': 'ES',
  'Europe/Lisbon': 'PT', 'Europe/Amsterdam': 'NL', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT', 'Europe/Warsaw': 'PL',
  'Europe/Prague': 'CZ', 'Europe/Budapest': 'HU', 'Europe/Bucharest': 'RO', 'Europe/Sofia': 'BG', 'Europe/Athens': 'GR',
  'Asia/Nicosia': 'CY', 'Europe/Dublin': 'IE', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK',
  'Europe/Helsinki': 'FI', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE', 'Asia/Jerusalem': 'IL',
  'Asia/Dubai': 'AE', 'Asia/Riyadh': 'SA', 'Asia/Qatar': 'QA', 'America/New_York': 'US', 'America/Chicago': 'US',
  'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Toronto': 'CA', 'Asia/Almaty': 'KZ', 'Asia/Tashkent': 'UZ',
};

export function phoneCountry(phone, email) {
  const synthetic = /^\+?(\d{6,15})@phone\.medicard\.ge$/i.exec(String(email || ''));
  const digits = String(phone || (synthetic ? synthetic[1] : '')).replace(/\D/g, '');
  if (digits.length < 8) return null;
  return PHONE_PREFIX_COUNTRY.find(([prefix]) => digits.startsWith(prefix))?.[1] ?? null;
}

export function timezoneCountry(tz) {
  return TZ_COUNTRY[String(tz || '').trim()] || null;
}

/**
 * One country per person from the best signal they have: the location they shared (GPS), then the calling
 * code of their phone, then the device time zone the app reports. Returns null when none says anything.
 */
export function userCountry({ locationCode, phone, email, timezone } = {}) {
  const gps = countryCodeOf(locationCode);
  if (gps) return { code: gps, source: 'location' };
  const tel = phoneCountry(phone, email);
  if (tel) return { code: tel, source: 'phone' };
  const tz = timezoneCountry(timezone);
  if (tz) return { code: tz, source: 'timezone' };
  return null;
}
