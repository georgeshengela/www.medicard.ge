// Countries where MEDICARD has at least one person, for the front-page world map (owner 2026-10-05).
// Public, so it carries country codes only — never counts, cities or coordinates.
// Same country per person as the admin „ქვეყნები“ map (owner 2026-10-09: the site showed only BE/GE while
// admin had more): shared location, else the phone's calling code, else the device time zone — see userCountry.
import { getUserGeoAnalytics } from './adminUserGeo.js';

/** Unique, sorted ISO codes from the admin geo rows ({ code, users }); nothing else leaves. */
export function presenceCodes(countries) {
  const set = new Set();
  for (const row of countries || []) {
    const code = String(row?.code || '').trim().toUpperCase();
    if (/^[A-Z]{2}$/.test(code)) set.add(code);
  }
  return [...set].sort();
}

export async function getSitePresence() {
  const geo = await getUserGeoAnalytics();
  return presenceCodes(geo.countries);
}
