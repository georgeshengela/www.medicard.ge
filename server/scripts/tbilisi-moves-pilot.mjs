/**
 * Persistent owner-pilot for თბილისი მოძრაობს (Phase 6).
 *
 * Reuses the guarded user-space cluster on 127.0.0.1:55433.
 * Does NOT drop data. Does NOT run the Phase 5 test suite.
 * Does NOT use hosted DATABASE_URL. Real server clock.
 *
 *   cd server
 *   node scripts/tbilisi-moves-pilot.mjs
 *   node scripts/tbilisi-moves-pilot.mjs --verify
 *   node scripts/tbilisi-moves-pilot.mjs --visual-qa
 *
 * Phone: localhost on the device is not this PC. Use the printed LAN URL.
 * Database stays bound to 127.0.0.1. Only the API listens on 0.0.0.0.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PILOT_DB,
  TEST_PORT,
  TEST_USER,
  VISUAL_QA_DB,
} from '../src/lib/tbilisiMoves/testEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '..');
const PASSWORD = 'medicard_tm_test';
const PILOT_API_PORT = String(process.env.TBILISI_MOVES_PILOT_PORT || '4011');
const visualQa = process.argv.includes('--visual-qa');
const verifyOnly = process.argv.includes('--verify');
const noApi = process.argv.includes('--no-api');
const TARGET_DB = visualQa ? VISUAL_QA_DB : PILOT_DB;

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
  return spawnSync(bin, args, { encoding: 'utf8', windowsHide: true, ...opts });
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
  return run(ready, ['-h', '127.0.0.1', '-p', TEST_PORT]).status === 0;
}

function ensureUserSpaceCluster(binDir) {
  if (listening()) {
    console.log(`[tbilisi-moves-pilot] postgres already accepting 127.0.0.1:${TEST_PORT}`);
    return;
  }
  const dir = dataDir();
  const pgCtl = path.join(binDir, process.platform === 'win32' ? 'pg_ctl.exe' : 'pg_ctl');
  const initdb = path.join(binDir, process.platform === 'win32' ? 'initdb.exe' : 'initdb');
  if (!existsSync(path.join(dir, 'PG_VERSION'))) {
    mkdirSync(dir, { recursive: true });
    const init = run(initdb, ['-D', dir, '-U', TEST_USER, '--encoding=UTF8', '--locale=C', '--auth=trust', '--auth-local=trust', '--auth-host=trust', '--no-instructions']);
    if (init.status !== 0) throw new Error(`initdb failed: ${init.stderr || init.stdout}`);
  }
  const start = run(pgCtl, ['-D', dir, '-l', path.join(dir, 'pg.log'), '-o', `-p ${TEST_PORT} -c listen_addresses=127.0.0.1`, 'start']);
  if (start.status !== 0 && !listening()) {
    throw new Error(`pg_ctl start failed: ${start.stderr || start.stdout}`);
  }
  for (let i = 0; i < 20; i += 1) {
    if (listening()) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
  }
  throw new Error('user-space postgres did not become ready on 55433');
}

function ensurePilotDatabase(binDir) {
  const existing = psql(binDir, 'postgres', 'SELECT datname FROM pg_database;');
  if (!existing.includes(TARGET_DB)) {
    psql(binDir, 'postgres', `CREATE DATABASE ${TARGET_DB} OWNER ${TEST_USER};`);
    console.log(`[tbilisi-moves-pilot] created ${TARGET_DB}`);
  } else {
    console.log(`[tbilisi-moves-pilot] preserving ${TARGET_DB}`);
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

function applySchema(url) {
  executeSqlFile(url, 'prisma/tbilisi-moves-test-base.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-pilot-base.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-phase2.sql');
  executeSqlFile(url, 'prisma/tbilisi-moves-phase4.sql');
}

function lanIpv4() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const rows of Object.values(nets)) {
    for (const row of rows || []) {
      if (row.family !== 'IPv4' && row.family !== 4) continue;
      if (row.internal) continue;
      out.push(row.address);
    }
  }
  return out;
}

function childEnv(databaseUrl) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl,
    TBILISI_MOVES_TEST_DATABASE_URL: urlFor('medicard_tbilisi_moves_test'),
    TBILISI_MOVES_PILOT_DB: TARGET_DB,
    TBILISI_MOVES_VISUAL_QA: visualQa ? '1' : '',
    PORT: PILOT_API_PORT,
    NODE_ENV: 'development',
  };
}

function runSeed(databaseUrl) {
  const result = spawnSync(process.execPath, ['scripts/tbilisi-moves-pilot-seed.mjs'], {
    cwd: serverDir,
    encoding: 'utf8',
    env: childEnv(databaseUrl),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) {
    throw new Error(`pilot seed failed: ${result.stderr || result.stdout}`);
  }
}

function writeAccountHint() {
  const file = path.join(serverDir, '.tbilisi-moves-pilot-account.json');
  writeFileSync(
    file,
    `${JSON.stringify(
      {
        email: 'pilot.owner@medicard.test',
        password: 'MedicardPilot1!',
        note: 'Isolated disposable database only. Not a production account. Do not reuse on Neon.',
        database: TARGET_DB,
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8' },
  );
}

function printReachability() {
  const lan = lanIpv4();
  console.log(`[tbilisi-moves-pilot] API bind 0.0.0.0:${PILOT_API_PORT}`);
  console.log(`[tbilisi-moves-pilot] this PC        http://127.0.0.1:${PILOT_API_PORT}`);
  console.log(`[tbilisi-moves-pilot] Android emulator http://10.0.2.2:${PILOT_API_PORT}`);
  if (lan.length) {
    for (const ip of lan) {
      console.log(`[tbilisi-moves-pilot] phone LAN      http://${ip}:${PILOT_API_PORT}`);
    }
  } else {
    console.log('[tbilisi-moves-pilot] no LAN IPv4 found; a physical phone cannot use localhost');
  }
  console.log(`[tbilisi-moves-pilot] database stays 127.0.0.1:${TEST_PORT}/${TARGET_DB} (not exposed)`);
  console.log(`[tbilisi-moves-pilot] verify without secrets: GET /api/tbilisi-moves/status`);
  console.log(`[tbilisi-moves-pilot] expected: schemaReady=true featureEnabled=true enrollmentOpen=true ingestEligible=true pilotMode=true`);
}

async function verifyHttp() {
  const origin = `http://127.0.0.1:${PILOT_API_PORT}`;
  try {
    const res = await fetch(`${origin}/api/tbilisi-moves/status`);
    const body = await res.json();
    const safe = {
      httpStatus: res.status,
      schemaReady: body.schemaReady,
      featureEnabled: body.featureEnabled,
      enrollmentOpen: body.enrollmentOpen,
      ingestEligible: body.ingestEligible,
      resultsReady: body.resultsReady,
      pilotMode: body.pilotMode,
      visualQaFixture: Boolean(body.visualQaFixture),
      date: body.date,
      timezone: body.timezone,
      database: TARGET_DB,
    };
    console.log('[tbilisi-moves-pilot] status', JSON.stringify(safe));
    return body.schemaReady && body.featureEnabled && body.pilotMode === true;
  } catch (error) {
    console.log(`[tbilisi-moves-pilot] status probe failed (${error.message}). Start with --serve / default.`);
    return false;
  }
}

const binDir = findPgBin();
if (!listening() && !binDir) {
  console.error('[tbilisi-moves-pilot] Isolated PostgreSQL is not running and no local pg bin was found.');
  process.exit(2);
}
if (!listening()) ensureUserSpaceCluster(binDir);
const activeBin = findPgBin();
if (!activeBin) {
  console.error('[tbilisi-moves-pilot] pg client tools missing');
  process.exit(2);
}

ensurePilotDatabase(activeBin);
const databaseUrl = urlFor(TARGET_DB);
applySchema(databaseUrl);
runSeed(databaseUrl);
writeAccountHint();

console.log(`[tbilisi-moves-pilot] database=${TARGET_DB} user=${TEST_USER} port=${TEST_PORT} persist=true visualQa=${visualQa}`);
printReachability();
console.log('[tbilisi-moves-pilot] owner login:  — password is not printed; see gitignored server/.tbilisi-moves-pilot-account.json');
console.log('[tbilisi-moves-pilot] admin login: ADMIN_EMAIL from server/.env on this isolated DB only');

if (verifyOnly || noApi) {
  if (!noApi) {
    const ok = await verifyHttp();
    if (!ok) {
      console.log('[tbilisi-moves-pilot] schema applied. Start the API with: node scripts/tbilisi-moves-pilot.mjs');
    }
  }
  process.exit(0);
}

const child = spawn(process.execPath, ['src/server.js'], {
  cwd: serverDir,
  env: childEnv(databaseUrl),
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
