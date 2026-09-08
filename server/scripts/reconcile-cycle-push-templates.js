/**
 * Report (and optionally rewrite) stored fertility PushTemplate rows that
 * violate Cycle safety copy. Serving already overlays code defaults for
 * unsafe fertility keys — this script only repairs stored rows.
 *
 *   node scripts/reconcile-cycle-push-templates.js
 *   node scripts/reconcile-cycle-push-templates.js --apply
 *
 * Does not delete admin rows. Non-fertility templates are left untouched.
 */
import { prisma } from '../src/lib/prisma.js';
import {
  FERTILITY_PUSH_KEYS,
  PUSH_TEMPLATE_DEFAULTS,
  fertilityPushCopyUnsafe,
} from '../src/lib/pushTemplates.js';

const apply = process.argv.includes('--apply');

const defaults = new Map(PUSH_TEMPLATE_DEFAULTS.map((row) => [row.key, row]));

const rows = await prisma.$queryRaw`
  SELECT key, title, body, "updatedAt"
  FROM "PushTemplate"
  WHERE key = ${FERTILITY_PUSH_KEYS[0]} OR key = ${FERTILITY_PUSH_KEYS[1]}
`.catch((err) => {
  console.error('Could not read PushTemplate:', err.message);
  process.exit(1);
});

const unsafe = [];
for (const row of rows ?? []) {
  if (fertilityPushCopyUnsafe(row.title, row.body)) {
    unsafe.push(row);
  }
}

if (!unsafe.length) {
  console.log(`Fertility PushTemplate rows: ${(rows ?? []).length}. Unsafe: 0.`);
  process.exit(0);
}

console.log(`Unsafe fertility templates (${unsafe.length}):`);
for (const row of unsafe) {
  console.log(`  - ${row.key} updatedAt=${row.updatedAt?.toISOString?.() ?? row.updatedAt}`);
}

if (!apply) {
  console.log('\nServing already uses code defaults for these keys.');
  console.log('Rewrite stored copy to current defaults with --apply (does not delete rows).');
  process.exit(0);
}

for (const row of unsafe) {
  const def = defaults.get(row.key);
  if (!def) continue;
  await prisma.$executeRaw`
    UPDATE "PushTemplate"
    SET title = ${def.title}, body = ${def.body}, "updatedAt" = CURRENT_TIMESTAMP
    WHERE key = ${row.key}
  `;
  console.log(`Rewrote ${row.key} to code defaults.`);
}

process.exit(0);
