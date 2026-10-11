// Read-only: counts rows whose "userId" belongs to no account (left behind by account deletion
// before deleteUser.js removed raw-SQL tables without a foreign key). Runs in a READ ONLY
// transaction, prints counts only — never ids, never row contents. Changes nothing.
//   cd server && node scripts/count-orphan-user-rows.mjs
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const report = await db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    // Every table with a "userId" column; a foreign key to "User" means nothing can be orphaned there.
    const tables = await tx.$queryRawUnsafe(`
      SELECT c.table_name AS name,
             EXISTS (
               SELECT 1 FROM pg_constraint con
               JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
               WHERE con.contype = 'f' AND con.conrelid = format('%I', c.table_name)::regclass
                 AND con.confrelid = '"User"'::regclass AND a.attname = 'userId'
             ) AS linked
      FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema = current_schema() AND t.table_type = 'BASE TABLE' AND c.column_name = 'userId'
      ORDER BY c.table_name`);
    const rows = [];
    for (const { name, linked } of tables) {
      if (linked) continue;
      // `name` comes from the catalog above, never from input.
      const [count] = await tx.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS rows, COUNT(DISTINCT t."userId")::int AS accounts
        FROM "${name}" t
        WHERE t."userId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = t."userId")`);
      rows.push({ table: name, ...count });
    }
    const [all] = rows.length ? await tx.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT id)::int AS accounts FROM (
        ${rows.map((row) => `SELECT "userId" AS id FROM "${row.table}" WHERE "userId" IS NOT NULL`).join(' UNION ALL ')}
      ) ids WHERE NOT EXISTS (SELECT 1 FROM "User" u WHERE u.id = ids.id)`) : [{ accounts: 0 }];
    return { linked: tables.filter((table) => table.linked).length, rows, accounts: all.accounts };
  }, { timeout: 60000 });

  console.log(`Tables with "userId": ${report.linked + report.rows.length} (${report.linked} with a foreign key to "User", skipped).`);
  console.table(report.rows.map((row) => ({ table: row.table, 'orphaned rows': row.rows, 'deleted accounts': row.accounts })));
  console.log(`Deleted accounts with rows left anywhere above: ${report.accounts}. Nothing was changed.`);
} finally {
  await db.$disconnect();
}
