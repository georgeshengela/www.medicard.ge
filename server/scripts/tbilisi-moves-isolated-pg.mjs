/**
 * Isolated PostgreSQL for თბილისი მოძრაობს Phase 5.
 *
 * Never uses hosted DATABASE_URL. Never touches Windows PostgreSQL services.
 * User-space cluster: 127.0.0.1:55433 / medicard_tbilisi_moves_test / medicard_tm_test
 *
 *   cd server
 *   node scripts/tbilisi-moves-isolated-pg.mjs
 *
 * Owner-pilot (persistent, no tests): node scripts/tbilisi-moves-pilot.mjs
 * This file still applies SQL then runs the Phase 5 test suite.
 *   docker compose -f docker-compose.tbilisi-moves-test.yml up -d
 *   then the same command with TBILISI_MOVES_TEST_DATABASE_URL already set.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');
const repoDir = path.resolve(serverDir, '..');

const TEST_USER = 'medicard_tm_test';
const TEST_PORT = '55433';
const MAIN_DB = 'medicard_tbilisi_moves_test';
const PATH_B_DB = 'medicard_tbilisi_moves_test_b';
const PHASE2_DB = 'medicard_tbilisi_moves_test_p2';
const PASSWORD = 'medicard_tm_test';

function urlFor(db) {
  return `postgresql://${TEST_USER}:${PASSWORD}@127.0.0.1:${TEST_PORT}/${db}`;
}

function pgBinCandidates() {
  const extra = process.env.TBILISI_MOVES_PG_BIN ? [process.env.TBILISI_MOVES_PG_BIN] : [];
  return [
    ...extra,
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\18\\bin',
    'C:\\Program Files\\PostgreSQL\\16\\bin',
    '/usr/lib/postgresql/17/bin',
    '/usr/lib/postgresql/16/bin',
    '/usr/bin',
  ];
}

function findPgBin() {
  for (const dir of pgBinCandidates()) {
    const initdb = path.join(dir, process.platform === 'win32' ? 'initdb.exe' : 'initdb');
    const psql = path.join(dir, process.platform === 'win32' ? 'psql.exe' : 'psql');
    const pgCtl = path.join(dir, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
    if (existsSync(initdb) && existsSync(psql) && existsSync(pgCtl)) return dir;
  }
  return null;
}

function dataDir() {
  return process.env.TBILISI_MOVES_PG_DATA || path.join(process.env.TEMP || process.env.TMPDIR || '/tmp', 'medicard-tbilisi-moves-pg');
}

function run(bin, args, opts = {}) {
  const result = spawnSync(bin, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...opts,
  });
  return result;
}

function psql(binDir, database, sql) {
  const psqlBin = path.join(binDir, process.platform === 'win32' ? 'psql.exe' : 'psql');
  const result = run(psqlBin, ['-h', '127.0.0.1', '-p', TEST_PORT, '-U', TEST_USER, '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', sql], {
    env: { ...process.env, PGPASSWORD: PASSWORD, PGUSER: TEST_USER },
  });
  if (result.status !== 0) {
    throw new Error(`psql failed (${database}): ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function listening() {
  const binDir = findPgBin();
  if (!binDir) return false;
  const ready = path.join(binDir, process.platform === 'win32' ? 'pg_isready.exe' : 'pg_isready');
  if (!existsSync(ready)) return false;
  const result = run(ready, ['-h', '127.0.0.1', '-p', TEST_PORT]);
  return result.status === 0;
}

function ensureUserSpaceCluster(binDir) {
  if (listening()) {
    console.log(`[tbilisi-moves-pg] already accepting 127.0.0.1:${TEST_PORT}`);
    return { started: false, harness: 'userspace' };
  }
  const dir = dataDir();
  const pgCtl = path.join(binDir, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
  const initdb = path.join(binDir, process.platform === 'win32' ? 'initdb.exe' : 'initdb');
  if (!existsSync(path.join(dir, 'PG_VERSION'))) {
    mkdirSync(dir, { recursive: true });
    const init = run(initdb, ['-D', dir, '-U', TEST_USER, '--encoding=UTF8', '--locale=C', '--auth=trust', '--auth-local=trust', '--auth-host=trust', '--no-instructions']);
    if (init.status !== 0) {
      throw new Error(`initdb failed: ${init.stderr || init.stdout}`);
    }
  }
  const logFile = path.join(dir, 'pg.log');
  const start = run(pgCtl, ['-D', dir, '-l', logFile, '-o', `-p ${TEST_PORT} -c listen_addresses=127.0.0.1`, 'start']);
  if (start.status !== 0 && !listening()) {
    throw new Error(`pg_ctl start failed: ${start.stderr || start.stdout}`);
  }
  for (let i = 0; i < 20; i += 1) {
    if (listening()) return { started: true, harness: 'userspace', dataDir: dir };
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error('user-space postgres did not become ready on 55433');
}

function ensureDatabases(binDir) {
  const existing = psql(binDir, 'postgres', 'SELECT datname FROM pg_database;');
  for (const name of [MAIN_DB, PATH_B_DB, PHASE2_DB]) {
    if (!existing.includes(name)) {
      psql(binDir, 'postgres', `CREATE DATABASE ${name} OWNER ${TEST_USER};`);
    }
  }
}

function executeSqlFile(databaseUrl, relativeFile) {
  const file = path.join(serverDir, relativeFile);
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['prisma', 'db', 'execute', '--file', file, '--schema', 'prisma/schema.prisma'],
    {
      cwd: serverDir,
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: databaseUrl },
      shell: process.platform === 'win32',
    },
  );
  if (result.status !== 0) {
    throw new Error(`prisma db execute ${relativeFile} failed: ${result.stderr || result.stdout}`);
  }
}

function applyPathA(url) {
  executeSqlFile(url, 'prisma/tbilisi-moves-test-base.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-phase2.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-phase4.sql');
}

function applyPathB(binDir, url) {
  executeSqlFile(url, 'prisma/tbilisi-moves-test-base.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-phase2.sql');
  psql(
    binDir,
    PATH_B_DB,
    `
    UPDATE "TbilisiMovesConfig"
      SET "defaultDailyTarget" = 123456, "cooldownDays" = 21, "revision" = 4, "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'default';
    UPDATE "TbilisiMovesDistrict"
      SET "dailyTargetOverride" = 777000, "revision" = 3
      WHERE "slug" = 'vake';
    INSERT INTO "User" ("id","email","passwordHash","fullName","status","createdAt","updatedAt")
    VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','tm.pathb@medicard.test','x','Path B User','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
    ON CONFLICT ("id") DO NOTHING;
    INSERT INTO "TbilisiMovesRound" ("id","date","status","rulesSnapshot","districtTargetsSnapshot","openedAt","graceEndsAt","createdAt","updatedAt")
    VALUES (
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
      '2026-07-01',
      'PROVISIONAL',
      '{"competitiveCap":10000,"defaultDailyTarget":123456,"minParticipantsForRank":2,"lateSyncGraceHours":8,"rewardsEnabled":true,"pilotMode":true}',
      '{"11111111-1111-4111-a111-111111111003":777000}',
      '2026-06-30 20:00:00+00',
      '2026-07-01 20:00:00+00',
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT ("date") DO NOTHING;
    INSERT INTO "TbilisiMovesMembership" (
      "userId","status","optedInAt","publicBoardConsentAt","districtId","publicHandle","enrolledAt","lockUntilDate","createdAt","updatedAt"
    ) VALUES (
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','ACTIVE',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,
      '11111111-1111-4111-a111-111111111003','პათბი',CURRENT_TIMESTAMP,'2026-07-31',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    ) ON CONFLICT ("userId") DO NOTHING;
    INSERT INTO "TbilisiMovesMembershipPeriod" ("id","userId","districtId","startDate")
    VALUES ('cccccccc-cccc-4ccc-8ccc-ccccccccccc1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','11111111-1111-4111-a111-111111111003','2026-07-01')
    ON CONFLICT ("id") DO NOTHING;
    INSERT INTO "TbilisiMovesCredit" (
      "id","userId","date","roundId","districtId","rawObservedSteps","eligibleSteps","capSnapshot",
      "authoritativeProvider","sourceInstallationId","lastRecordedAt","lastClientSequence","lastObservationId",
      "publicHandleSnapshot","acceptedAt","updatedAt"
    ) VALUES (
      'dddddddd-dddd-4ddd-8ddd-ddddddddddd1','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1','2026-07-01',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1','11111111-1111-4111-a111-111111111003',
      4321,4321,10000,'APPLE_HEALTH','install-path-b',CURRENT_TIMESTAMP,1,'obs-path-b','პათბი',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
    ) ON CONFLICT ("userId","date") DO NOTHING;
    `,
  );
  executeSqlFile(url, 'prisma/tbilisi-moves-phase4.sql');
}

function applyPhase2Only(url) {
  executeSqlFile(url, 'prisma/tbilisi-moves-test-base.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-phase2.sql');
}

function spawnTests(env) {
  const files = [
    'src/lib/tbilisiMoves/errors.test.js',
    'src/lib/tbilisiMoves.migration.test.js',
    'src/lib/tbilisiMoves.phase5.int.test.js',
    'src/lib/tbilisiMoves.pilot.test.js',
    'src/lib/tbilisiMoves.http.test.js',
  ];
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], {
      cwd: serverDir,
      env: {
        ...process.env,
        ...env,
        NODE_ENV: 'test',
      },
      stdio: 'inherit',
    });
    child.on('exit', (code) => resolve(code ?? 1));
  });
}

function printUnavailable() {
  console.error(`
[tbilisi-moves-pg] Isolated PostgreSQL is not running yet.

This machine can use either:
  1. User-space initdb from an installed PostgreSQL bin directory (does not modify Windows services)
  2. Docker: docker compose -f server/docker-compose.tbilisi-moves-test.yml up -d

Then:
  cd server
  node scripts/tbilisi-moves-isolated-pg.mjs

Never point this harness at hosted Neon or the normal DATABASE_URL.
`);
}

const binDir = findPgBin();
let harness = 'none';
try {
  if (listening()) {
    harness = 'existing-55433';
  } else if (binDir) {
    const started = ensureUserSpaceCluster(binDir);
    harness = started.harness;
    ensureDatabases(binDir);
  } else {
    printUnavailable();
    process.exit(2);
  }
} catch (error) {
  console.error('[tbilisi-moves-pg]', error.message);
  printUnavailable();
  process.exit(2);
}

if (!binDir && !listening()) {
  printUnavailable();
  process.exit(2);
}

const activeBin = findPgBin();
if (!activeBin) {
  printUnavailable();
  process.exit(2);
}

ensureDatabases(activeBin);
applyPathA(urlFor(MAIN_DB));
applyPathB(activeBin, urlFor(PATH_B_DB));
applyPhase2Only(urlFor(PHASE2_DB));

const env = {
  TBILISI_MOVES_TEST_DATABASE_URL: urlFor(MAIN_DB),
  TBILISI_MOVES_TEST_DATABASE_URL_B: urlFor(PATH_B_DB),
  TBILISI_MOVES_TEST_DATABASE_URL_P2: urlFor(PHASE2_DB),
  DATABASE_URL: urlFor(MAIN_DB),
  TBILISI_MOVES_PG_HARNESS: harness,
};

console.log(`[tbilisi-moves-pg] harness=${harness} db=${MAIN_DB} port=${TEST_PORT} user=${TEST_USER}`);
console.log('[tbilisi-moves-pg] applied path A (base→phase2→phase4), path B (phase2 records→phase4), phase2-only');

const code = await spawnTests(env);
process.exit(code);
