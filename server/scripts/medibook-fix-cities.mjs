// One-off maintenance (not in db:install): crawled catalogue rows that came without a city get the nearest
// known town (CITY_TABLE, ≤ 30 km). Touches only LISTED rows from MAPBOX / OSM with an empty city.
//   node server/scripts/medibook-fix-cities.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { nearestCity } from '../src/lib/book/catalog.js';

const db = new PrismaClient();
try {
  const rows = await db.$queryRaw`SELECT id, lat, lng FROM "BookBusiness" WHERE city IS NULL AND status = 'LISTED' AND source IN ('MAPBOX', 'OSM') AND lat IS NOT NULL`;
  let fixed = 0;
  for (const r of rows) {
    const city = nearestCity(Number(r.lat), Number(r.lng));
    if (!city) continue;
    fixed += await db.$executeRaw`UPDATE "BookBusiness" SET city = ${city.en} WHERE id = ${r.id} AND city IS NULL`;
  }
  console.log(`${rows.length} rows without a city; ${fixed} filled with the nearest town.`);
} finally {
  await db.$disconnect();
}
