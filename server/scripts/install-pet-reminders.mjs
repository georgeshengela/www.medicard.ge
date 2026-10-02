// One-time data fix (2026-10-02): pet care reminders never fired because every schedule was created with
// reminderEnabled=false and the reminder feed only returns enabled schedules. This turns reminders on, once,
// for existing ACTIVE schedules (the day before + on the day). A marker row makes it run a single time, so a
// schedule someone turns off afterwards stays off. Additive: creates only the marker table if missing.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const MARKER = 'pet-reminders-default-on-2026-10-02';
const db = new PrismaClient();
try {
  const [{ exists }] = await db.$queryRaw`SELECT to_regclass('"PetCareSchedule"') IS NOT NULL AS exists`;
  if (!exists) {
    console.log('PetCareSchedule table not present — nothing to do.');
  } else {
    await db.$executeRawUnsafe(
      'CREATE TABLE IF NOT EXISTS "OneTimeDataFix" ("key" TEXT PRIMARY KEY, "ranAt" TIMESTAMPTZ NOT NULL DEFAULT now(), "rows" INTEGER)',
    );
    const updated = await db.$transaction(async (tx) => {
      const claimed = await tx.$executeRaw`INSERT INTO "OneTimeDataFix" ("key") VALUES (${MARKER}) ON CONFLICT ("key") DO NOTHING`;
      if (!claimed) return null;
      const rows = await tx.$executeRaw`
        UPDATE "PetCareSchedule"
           SET "reminderEnabled" = true,
               "reminderOffsetsDays" = CASE WHEN "reminderOffsetsDays"::text = '[0]' THEN '[1, 0]'::jsonb ELSE "reminderOffsetsDays" END
         WHERE "status" = 'ACTIVE' AND "reminderEnabled" = false`;
      await tx.$executeRaw`UPDATE "OneTimeDataFix" SET "rows" = ${rows} WHERE "key" = ${MARKER}`;
      return rows;
    });
    console.log(updated == null ? 'Pet reminder default already applied earlier.' : `Pet reminders turned on for ${updated} active schedule(s).`);
  }
} finally {
  await db.$disconnect();
}
