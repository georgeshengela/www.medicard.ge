// Country → city, never a district (owner 2026-10-08). Older tile lookups stored city parts as cities (Liège's
// sections Rocourt, Glain, Grivegnée …). This finds every stored "city" that OpenStreetMap places inside another
// city and moves it up: the whole city's boundary is stored, its tiles point to it, the part becomes kind
// 'district' (so home places match the city), and a MEDIRUN city row for the part is switched off while the
// city gets its own row and park spots. Live boxes of a part move to the city. History rows are left as they are.
//
//   node server/scripts/medirun-city-merge.mjs            dry run: what would change
//   node server/scripts/medirun-city-merge.mjs --apply    write to the main database
import { fileURLToPath } from 'node:url';

const apply = process.argv.includes('--apply');
const UA = 'Medicard.GE/1.0 (MEDIRUN city merge; contact@medicard.ge)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const dotenv = await import('dotenv');
  dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
  const { prisma } = await import('../src/lib/prisma.js');
  const { cityAbove } = await import('../src/lib/medipulsi/territory.js');
  const { geometryAreaKm2 } = await import('../src/lib/medipulsi/territoryMath.js');
  const { cityNameKa, cityNameEn, countryCodeOf } = await import('../src/lib/geoPlace.js');
  const { ensureCityTable, harvestCity } = await import('../src/lib/medipulsi/cities.js');
  const { timezoneFor } = await import('../src/lib/medipulsi/citySpotsMath.js');
  const { geometryBbox } = await import('../src/lib/medipulsi/territoryMath.js');

  await ensureCityTable(prisma);
  const areas = await prisma.$queryRaw`SELECT "id","nameEn" FROM "MedipulsiArea" WHERE "kind"='city'`;
  const moves = [];
  for (const area of areas) {
    const osm = area.id[0].toUpperCase() + area.id.slice(1);
    const [body] = await fetch(`https://nominatim.openstreetmap.org/lookup?format=jsonv2&addressdetails=1&namedetails=1&polygon_geojson=1&polygon_threshold=0.0005&osm_ids=${osm}`, { headers: { 'User-Agent': UA } }).then((r) => r.json()).catch(() => []);
    await sleep(1100);
    if (!body) { console.log(`?  ${area.id} ${area.nameEn}: not found in OSM`); continue; }
    const city = await cityAbove(body).catch(() => null);
    await sleep(1100);
    if (!city) { console.log(`=  ${area.id} ${area.nameEn} (${body.addresstype}) stays`); continue; }
    const cityId = `${city.osm_type[0]}${city.osm_id}`;
    console.log(`→  ${area.id} ${area.nameEn} (${body.addresstype})  ⇒  ${cityId} ${city.name} (${city.addresstype})`);
    moves.push({ from: area.id, to: cityId, city });
  }
  if (!apply) { console.log(`\n${moves.length} part(s) would move. Run with --apply to write.`); return 0; }

  const harvest = new Set();
  for (const { from, to, city } of moves) {
    const n = city.namedetails || {}, cc = countryCodeOf(city.address?.country_code) || null;
    await prisma.$executeRaw`INSERT INTO "MedipulsiArea" ("id","kind","countryCode","nameKa","nameEn","areaKm2","geometry") VALUES (${to},'city',${cc},${n['name:ka'] || cityNameKa(city.name) || city.name},${n['name:en'] || cityNameEn(city.name) || city.name},${geometryAreaKm2(city.geojson)},${JSON.stringify(city.geojson)}::jsonb) ON CONFLICT ("id") DO NOTHING`;
    const tiles = await prisma.$executeRaw`UPDATE "MedipulsiPlaceTile" SET "cityId"=${to} WHERE "cityId"=${from}`;
    await prisma.$executeRaw`UPDATE "MedipulsiArea" SET "kind"='district' WHERE "id"=${from}`;
    const [part] = await prisma.$queryRaw`SELECT "cityId","players" FROM "MedirunCity" WHERE "cityId"=${from}`;
    if (part) {
      await prisma.$executeRaw`UPDATE "MedirunCity" SET "enabled"=false,"players"=0,"updatedAt"=now() WHERE "cityId"=${from}`;
      const [a] = await prisma.$queryRaw`SELECT "nameKa","nameEn","countryCode","geometry" FROM "MedipulsiArea" WHERE "id"=${to}`;
      const b = geometryBbox(a.geometry), tz = timezoneFor(a.countryCode, (b[0] + b[2]) / 2);
      await prisma.$executeRaw`INSERT INTO "MedirunCity" ("cityId","nameKa","nameEn","countryCode","timezone","players") VALUES (${to},${a.nameKa},${a.nameEn},${a.countryCode},${tz},${Math.max(1, part.players || 0)})
        ON CONFLICT ("cityId") DO UPDATE SET "enabled"=true,"players"=GREATEST("MedirunCity"."players",EXCLUDED."players"),"updatedAt"=now()`;
      harvest.add(to);
    }
    const boxes = await prisma.$executeRaw`UPDATE "MedipulsiGiftRule" r SET "meta"=jsonb_set(r."meta",'{cityId}',to_jsonb(${to}::text)) FROM "MedipulsiGift" g WHERE g."id"=r."giftId" AND g."endsAt">now() AND r."meta"->>'cityId'=${from}`;
    console.log(`✓  ${from} ⇒ ${to}: ${tiles} tile(s), ${part ? 'MEDIRUN city switched' : 'no MEDIRUN city'}, ${boxes} live box(es) moved`);
  }
  for (const id of harvest) console.log(`park spots ${id}:`, await harvestCity(id, { db: prisma }));
  return 0;
}

main().then((code) => process.exit(code), (error) => { console.error(error); process.exit(1); });
