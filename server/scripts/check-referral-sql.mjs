// Read-only check: plans (EXPLAIN, no execution) the referral queries against the configured database.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const id = '00000000-0000-0000-0000-000000000000';
try {
  await db.$queryRaw`EXPLAIN INSERT INTO "Referral" (id, "inviterId", "inviteeId", code, "deviceHash") VALUES (${id}, ${id}, ${id}, ${'ABCDEF'}, ${null}) ON CONFLICT DO NOTHING RETURNING id`;
  await db.$queryRaw`EXPLAIN INSERT INTO "ReferralCode" ("userId", code) VALUES (${id}, ${'ABCDEF'}) ON CONFLICT DO NOTHING RETURNING code`;
  await db.$queryRaw`EXPLAIN SELECT (EXISTS (SELECT 1 FROM "MedicationSchedule" WHERE "userId" = ${id}) OR EXISTS (SELECT 1 FROM "DailyCheckIn" WHERE "userId" = ${id})
    OR EXISTS (SELECT 1 FROM "DoctorVisit" WHERE "userId" = ${id}) OR EXISTS (SELECT 1 FROM "MedicalRecord" WHERE "userId" = ${id})
    OR EXISTS (SELECT 1 FROM "NutritionMeal" WHERE "userId" = ${id}) OR EXISTS (SELECT 1 FROM "CycleLog" WHERE "userId" = ${id})) AS ok`;
  const { referralAdminOverview } = await import('../src/lib/referral.js');
  const overview = await referralAdminOverview({ db });
  console.log('referral SQL ok · totals', overview.totals);
} finally {
  await db.$disconnect();
}
