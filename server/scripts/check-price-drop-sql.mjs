// Read-only check: plans (EXPLAIN, no execution) the price-drop queries against the configured database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const productId = '00000000-0000-0000-0000-000000000000';
try {
  await db.$queryRaw`EXPLAIN INSERT INTO "PriceDropAlert" (id, "userId", "productId", "medName", "fromGel", "toGel", "sourceId")
    SELECT gen_random_uuid()::text, m."userId", ${productId}, m."medName", ${10}, ${8}, ${null}
    FROM "MedicationSchedule" m
    LEFT JOIN "HealthProfile" h ON h."userId" = m."userId"
    WHERE m.active = TRUE
      AND m.config->>'catalogProductId' = ${productId}
      AND COALESCE(h."extraAnswers"->>'priceDropAlerts', 'true') <> 'false'
    ON CONFLICT ("userId", "productId", "toGel") DO NOTHING`;
  await db.$queryRaw`EXPLAIN SELECT id FROM "PriceDropAlert" WHERE state = 'PENDING' ORDER BY "createdAt" LIMIT 300`;
  const [{ n }] = await db.$queryRaw`SELECT count(*)::int AS n FROM "MedicationSchedule" WHERE active = TRUE AND config ? 'catalogProductId'`;
  console.log(`price-drop SQL ok · active medicines linked to the catalog: ${n}`);
} finally {
  await db.$disconnect();
}
