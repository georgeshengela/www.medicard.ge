/**
 * Georgian gym directory for MEDICOACH (brands → branches). The curated list lives in
 * src/data/gyms-ge.json; install-trainer.mjs inserts rows that are not in the table yet and never
 * touches existing rows. Low-confidence entries start HIDDEN until an admin confirms them.
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from './prisma.js';

const slug = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[^\p{L}\p{N}]+/gu, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 48);

/** Stable id so re-running the installer never duplicates a branch. */
export function gymId(brand, name, city) {
  const hash = createHash('sha1').update(`${brand}|${name}|${city}`.toLowerCase()).digest('hex').slice(0, 8);
  return `gym-${slug(brand) || 'x'}-${hash}`;
}

const clean = (v, max = 200) => {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
};

export function gymRowsFromDirectory(directory) {
  const rows = [];
  const seen = new Set();
  for (const brand of Array.isArray(directory) ? directory : []) {
    const brandName = clean(brand.brand, 80);
    if (!brandName) continue;
    const brandStatus = brand.confidence === 'low' ? 'HIDDEN' : 'ACTIVE';
    const branches = Array.isArray(brand.branches) && brand.branches.length ? brand.branches : [{ name: brandName, city: 'თბილისი' }];
    for (const b of branches) {
      const name = clean(b.name, 80) || brandName;
      const city = clean(b.city, 40) || 'თბილისი';
      const id = gymId(brandName, name, city);
      if (seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        brand: brandName,
        brandKa: clean(brand.brandKa, 80),
        name,
        nameKa: clean(b.nameKa, 80),
        city,
        district: clean(b.district, 60),
        address: clean(b.address, 160),
        website: clean(brand.website, 160),
        instagram: clean(brand.instagram, 160),
        source: clean(brand.source, 300),
        status: b.confidence === 'low' ? 'HIDDEN' : b.confidence ? 'ACTIVE' : brandStatus,
      });
    }
  }
  return rows;
}

export function gymPublic(g) {
  return {
    id: g.id,
    brand: g.brand,
    brandKa: g.brandKa ?? null,
    name: g.name,
    nameKa: g.nameKa ?? null,
    city: g.city,
    district: g.district ?? null,
    address: g.address ?? null,
    status: g.status,
  };
}

/** Group branches by brand for the picker. */
export function groupByBrand(gyms) {
  const map = new Map();
  for (const g of gyms) {
    const key = g.brand;
    if (!map.has(key)) map.set(key, { brand: g.brand, brandKa: g.brandKa ?? null, branches: [] });
    map.get(key).branches.push(gymPublic(g));
  }
  return [...map.values()]
    .map((b) => ({ ...b, branches: b.branches.sort((x, y) => `${x.city}${x.name}`.localeCompare(`${y.city}${y.name}`, 'ka')) }))
    .sort((a, b) => b.branches.length - a.branches.length || a.brand.localeCompare(b.brand, 'ka'));
}

/** Active gyms (plus the caller's own proposals), optionally filtered by a search term / city. */
export async function listGyms({ q = '', city = '', userId = null } = {}, db = prisma) {
  const term = `%${String(q).trim().toLowerCase()}%`;
  const cityTerm = String(city).trim();
  const rows = await db.$queryRaw`SELECT * FROM "Gym"
    WHERE (status = 'ACTIVE' OR (status = 'PROPOSED' AND "proposedBy" = ${userId}))
      AND (${term} = '%%' OR lower(brand) LIKE ${term} OR lower(name) LIKE ${term} OR lower(coalesce("brandKa", '')) LIKE ${term}
           OR lower(coalesce("nameKa", '')) LIKE ${term} OR lower(coalesce(address, '')) LIKE ${term} OR lower(city) LIKE ${term})
      AND (${cityTerm} = '' OR city = ${cityTerm})
    ORDER BY brand, city, name LIMIT 400`;
  return rows;
}

export async function gymsByIds(ids, db = prisma) {
  const list = [...new Set((ids || []).filter(Boolean))];
  if (!list.length) return new Map();
  const rows = await db.$queryRaw`SELECT * FROM "Gym" WHERE id = ANY(${list})`;
  return new Map(rows.map((g) => [g.id, g]));
}

export async function proposeGym(userId, { brand, name, city, address }, db = prisma) {
  const id = `gym-p-${randomUUID()}`;
  const [row] = await db.$queryRaw`INSERT INTO "Gym" (id, brand, name, city, address, status, "proposedBy", source)
    VALUES (${id}, ${brand}, ${name || brand}, ${city}, ${address || null}, 'PROPOSED', ${userId}, 'trainer')
    RETURNING *`;
  return row;
}
