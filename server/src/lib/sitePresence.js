// Countries where MEDICARD has at least one person, for the front-page world map (owner 2026-10-05).
// Public, so it carries country codes only — never counts, cities or coordinates.
// Sources: the home country of a person who shares location (UserLocation, enabled) and the
// country of a verified phone number (User.phone is written only after an OTP check).
import { prisma } from './prisma.js';
import { ensureUserLocationTable } from './userLocation.js';

// Dial code → ISO 3166-1 alpha-2. Longest prefix wins; +1 and +7 go to their largest country.
const DIAL = {
  1: 'US', 7: 'RU', 20: 'EG', 27: 'ZA', 30: 'GR', 31: 'NL', 32: 'BE', 33: 'FR', 34: 'ES', 36: 'HU', 39: 'IT',
  40: 'RO', 41: 'CH', 43: 'AT', 44: 'GB', 45: 'DK', 46: 'SE', 47: 'NO', 48: 'PL', 49: 'DE', 51: 'PE', 52: 'MX',
  54: 'AR', 55: 'BR', 56: 'CL', 57: 'CO', 60: 'MY', 61: 'AU', 62: 'ID', 63: 'PH', 64: 'NZ', 65: 'SG', 66: 'TH',
  81: 'JP', 82: 'KR', 84: 'VN', 86: 'CN', 90: 'TR', 91: 'IN', 92: 'PK', 93: 'AF', 94: 'LK', 98: 'IR',
  212: 'MA', 213: 'DZ', 216: 'TN', 234: 'NG', 254: 'KE', 351: 'PT', 352: 'LU', 353: 'IE', 354: 'IS', 355: 'AL',
  356: 'MT', 357: 'CY', 358: 'FI', 359: 'BG', 370: 'LT', 371: 'LV', 372: 'EE', 373: 'MD', 374: 'AM', 375: 'BY',
  376: 'AD', 377: 'MC', 380: 'UA', 381: 'RS', 382: 'ME', 383: 'XK', 385: 'HR', 386: 'SI', 387: 'BA', 389: 'MK',
  420: 'CZ', 421: 'SK', 423: 'LI', 880: 'BD', 886: 'TW', 961: 'LB', 962: 'JO', 963: 'SY', 964: 'IQ', 965: 'KW',
  966: 'SA', 968: 'OM', 971: 'AE', 972: 'IL', 973: 'BH', 974: 'QA', 976: 'MN', 992: 'TJ', 993: 'TM', 994: 'AZ',
  995: 'GE', 996: 'KG', 998: 'UZ',
};

/** ISO country of an international phone number („+995 555 …“), or null. */
export function phoneCountry(phone) {
  const digits = String(phone || '').trim();
  if (!digits.startsWith('+')) return null;
  const d = digits.replace(/\D/g, '');
  for (const len of [3, 2, 1]) {
    const code = DIAL[d.slice(0, len)];
    if (code) return code;
  }
  return null;
}

/** Merge both sources into a sorted list of unique ISO codes. */
export function presenceCountries(locationCodes, phones) {
  const set = new Set();
  for (const raw of locationCodes || []) {
    const code = String(raw || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) set.add(code);
  }
  for (const phone of phones || []) {
    const code = phoneCountry(phone);
    if (code) set.add(code);
  }
  return [...set].sort();
}

const CACHE_MS = 5 * 60_000;
let cache = { at: 0, value: null };
let pending = null;

export async function getSitePresence() {
  if (cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  if (pending) return pending;
  pending = (async () => {
    let located = [];
    try {
      await ensureUserLocationTable();
      located = await prisma.$queryRaw`
        SELECT DISTINCT UPPER(TRIM(ul."countryCode")) AS code
        FROM "UserLocation" ul
        WHERE ul."enabled" = true AND ul."countryCode" IS NOT NULL`;
    } catch {
      located = [];
    }
    const phones = await prisma.$queryRaw`
      SELECT DISTINCT substring(phone from 1 for 5) AS phone
      FROM "User" WHERE phone LIKE '+%'`;
    const value = presenceCountries(located.map((r) => r.code), phones.map((r) => r.phone));
    cache = { at: Date.now(), value };
    return value;
  })().finally(() => { pending = null; });
  return pending;
}
