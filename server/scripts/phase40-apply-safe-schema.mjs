/**
 * Apply Phase 40 additive Companion SQL to the disposable local Postgres only.
 * Never prints the connection URL. Does not touch production.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const url = process.env.PHASE38_TEST_DATABASE_URL;
if (!url) {
  console.error('BLOCKED: PHASE38_TEST_DATABASE_URL is not set');
  process.exit(2);
}
if (/neon|medicard\.ge|amazonaws|render\.com/i.test(url)) {
  console.error('BLOCKED: refusing a non-local database URL');
  process.exit(2);
}
process.env.DATABASE_URL = url;

const serverDir = dirname(dirname(fileURLToPath(import.meta.url)));
const prismaCli = join(serverDir, 'node_modules', 'prisma', 'build', 'index.js');

function run(args, extraEnv = {}) {
  return execFileSync(process.execPath, [prismaCli, ...args], {
    cwd: serverDir,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function hostOnly(value) {
  try {
    return new URL(value).host;
  } catch {
    return 'invalid';
  }
}

console.log(`target host=${hostOnly(url)}`);
console.log('prisma validate...');
console.log(run(['validate', '--schema', 'prisma/schema.prisma']).trim());

const db = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const companions = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "MediCompanionProfile"`;
  const worlds = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "MediWorldProfile"`;
  console.log(`upgrade-before companion=${companions[0].n} world=${worlds[0].n}`);
} finally {
  await db.$disconnect();
}

console.log('apply canonical Phase 40 SQL...');
console.log(run(['db', 'execute', '--file', 'prisma/phase40-medi-world-companion.sql', '--schema', 'prisma/schema.prisma']).trim());

const after = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  const cols = await after.$queryRaw`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'MediCompanionProfile'
      AND column_name IN ('displayName','worldStageKey','bondPoints','equippedAuraKey')
    ORDER BY column_name
  `;
  console.log('upgrade-after companion columns', cols.map((row) => row.column_name).join(','));
  const tables = await after.$queryRaw`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('MediCompanionWorldStageUnlock','MediCompanionBondEvent','MediCompanionCosmeticOwn')
    ORDER BY table_name
  `;
  console.log('upgrade-after tables', tables.map((row) => row.table_name).join(','));
} finally {
  await after.$disconnect();
}

console.log('migrate diff from empty (clean schema SQL)...');
const sql = run(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
const fullPath = join(process.env.TEMP || '/tmp', 'medicard-phase40-full-schema.sql');
writeFileSync(fullPath, sql);
console.log(`wrote clean schema SQL bytes=${sql.length}`);

const cleanUrl = url.replace(/\/medicard_phase38(\?|$)/, '/medicard_phase40_clean$1');
const admin = new PrismaClient({ datasources: { db: { url } }, log: ['error'] });
try {
  await admin.$executeRawUnsafe('CREATE DATABASE medicard_phase40_clean');
  console.log('created medicard_phase40_clean');
} catch (error) {
  if (!/already exists/i.test(error?.message || '')) {
    console.log(`clean-db create skipped: ${error.code || error.message}`);
  } else {
    console.log('medicard_phase40_clean already exists');
  }
} finally {
  await admin.$disconnect();
}

try {
  console.log('apply full schema to clean disposable database...');
  run(['db', 'execute', '--file', fullPath, '--schema', 'prisma/schema.prisma'], { DATABASE_URL: cleanUrl });
  console.log('clean schema apply ok');
  const clean = new PrismaClient({ datasources: { db: { url: cleanUrl } }, log: ['error'] });
  try {
    const cols = await clean.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'MediCompanionProfile'
        AND column_name IN ('displayName','worldStageKey','bondPoints','equippedAuraKey')
      ORDER BY column_name
    `;
    console.log('clean companion columns', cols.map((row) => row.column_name).join(','));
    const tables = await clean.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('MediCompanionWorldStageUnlock','MediCompanionBondEvent','MediCompanionCosmeticOwn')
      ORDER BY table_name
    `;
    console.log('clean companion tables', tables.map((row) => row.table_name).join(','));
  } finally {
    await clean.$disconnect();
  }
} catch (error) {
  console.log(`clean schema apply skipped: ${error.message.split('\n')[0]}`);
}

console.log('phase40 schema apply finished');
