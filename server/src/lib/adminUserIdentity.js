// What the admin shows next to a person's name: their photo (or the preset avatar they picked) and the
// country we can tell (adminUserGeoShape.userCountry: shared location › phone code › device time zone).
// Admin only. The photo itself is served by GET /api/admin/users/:id/avatar; nothing here leaves the server
// except the avatar kind/version and the country.
import { prisma } from './prisma.js';
import { countryNameKa } from './geoPlace.js';
import { userCountry } from './adminUserGeoShape.js';

const PRESET_RE = /^avatar-(?:[1-9]|1[0-2])$/;

/** Pure: one DB row → { avatar, country }. */
export function shapeIdentity(row) {
  const avatar = row?.photoAt
    ? { kind: 'photo', v: new Date(row.photoAt).getTime() }
    : PRESET_RE.test(String(row?.preset || ''))
      ? { kind: 'preset', id: row.preset }
      : null;
  const hit = userCountry(row || {});
  const country = hit
    ? { code: hit.code, nameKa: countryNameKa(hit.code) || hit.code, source: hit.source, cityKa: hit.source === 'location' ? row.cityKa || null : null }
    : null;
  return { avatar, country };
}

const missing = (error) => /does not exist|42P01/.test(String(error?.message || error?.meta?.message || ''));

/** userId → { avatar, country } for the given accounts (a page of the registry, a profile, the online list). */
export async function loadAdminIdentity(userIds, db = prisma) {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  let rows;
  try {
    rows = await db.$queryRaw`
      SELECT u.id, u.phone, u.email, qp.timezone,
             CASE WHEN ul."enabled" = true THEN UPPER(TRIM(ul."countryCode")) END AS "locationCode",
             CASE WHEN ul."enabled" = true THEN NULLIF(TRIM(ul."cityKa"), '') END AS "cityKa",
             ua."updatedAt" AS "photoAt",
             hp."extraAnswers"->>'avatarId' AS preset
      FROM "User" u
      LEFT JOIN "UserLocation" ul ON ul."userId" = u.id
      LEFT JOIN "UserQuestProfile" qp ON qp."userId" = u.id
      LEFT JOIN "UserAvatar" ua ON ua."userId" = u.id
      LEFT JOIN "HealthProfile" hp ON hp."userId" = u.id
      WHERE u.id = ANY(${ids}::text[])`;
  } catch (error) {
    // A fresh database may not have the raw-SQL tables yet: fall back to what every database has.
    if (!missing(error)) throw error;
    rows = await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, phone: true, email: true } });
  }
  for (const row of rows) out.set(row.id, shapeIdentity(row));
  return out;
}
