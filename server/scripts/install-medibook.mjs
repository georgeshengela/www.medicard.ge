// Additive only; installs the MEDIBOOK tables on the configured main database and adds every catalogue
// business from server/src/data/medibook-ge.json that is not there yet (matched by source + sourceRef).
// Existing rows — claimed businesses, owner edits, bookings — are never changed or deleted.
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { Prisma, PrismaClient } from '@prisma/client';
import { catalogRowsFromDirectory } from '../src/lib/book/catalog.js';

const TABLES = 'BookBusiness|BookImage|BookMember|BookClaim|BookStaff|BookService|BookTimeOff|BookClient|BookDiscount|BookAppointment|BookReview|BookFavorite|BookTransaction|BookEvent';
const db = new PrismaClient();
try {
  const sql = await readFile(new URL('../prisma/20261015-medibook.sql', import.meta.url), 'utf8');
  const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean);
  const allowed = new RegExp(`^CREATE (TABLE|INDEX|UNIQUE INDEX) IF NOT EXISTS "(${TABLES})`);
  if (statements.some((s) => !allowed.test(s))) throw new Error('Unexpected non-additive statement');
  const dataUrl = new URL('../src/data/medibook-ge.json', import.meta.url);
  const directory = existsSync(dataUrl) ? JSON.parse(await readFile(dataUrl, 'utf8')) : { businesses: [] };
  const rows = catalogRowsFromDirectory(directory);
  let added = 0;
  await db.$transaction(async (tx) => {
    for (const statement of statements) await tx.$executeRawUnsafe(statement);
  }, { timeout: 60000 });
  // The catalogue is inserted outside the schema transaction, 200 rows per statement: a few thousand rows
  // must never hold the deploy for long, and a duplicate slug or ref simply stays as it is.
  for (let i = 0; i < rows.length; i += 200) {
    const batch = rows.slice(i, i + 200);
    const values = batch.map((r) => Prisma.sql`(${r.id}, ${r.slug}, ${r.name}, ${r.nameKa}, ${r.category}, ${JSON.stringify(r.tags)}::jsonb, ${r.phone}, ${r.website}, ${r.instagram}, ${r.address}, ${r.addressKa}, ${r.city}, ${r.district}, ${r.lat}, ${r.lng}, ${JSON.stringify(r.hours)}::jsonb, ${r.source}, ${r.sourceRef}, 'LISTED')`);
    added += await db.$executeRaw`INSERT INTO "BookBusiness" (id, slug, name, "nameKa", category, tags, phone, website, instagram, address, "addressKa", city, district, lat, lng, hours, source, "sourceRef", status)
      VALUES ${Prisma.join(values)} ON CONFLICT DO NOTHING`;
  }
  console.log(`MEDIBOOK tables installed; ${added} new business(es) added of ${rows.length} in the directory. Existing data was not modified.`);
} finally {
  await db.$disconnect();
}
