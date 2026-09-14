const DISPOSABLE_MARKER = 'medicard-tbilisi-moves-disposable';
const TEST_USER = 'medicard_tm_test';
const TEST_PORT = '55433';
const TEST_DB_PREFIX = 'medicard_tbilisi_moves_test';
const PILOT_DB = 'medicard_tbilisi_moves_pilot';
const VISUAL_QA_DB = 'medicard_tbilisi_moves_visual';

export const TBILISI_MOVES_TEST_ENV_VAR = 'TBILISI_MOVES_TEST_DATABASE_URL';

export function parseDatabaseUrl(url = '') {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function isIsolatedTbilisiMovesTestUrl(url = '') {
  const parsed = parseDatabaseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const db = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '');
  return (
    host &&
    parsed.port === TEST_PORT &&
    parsed.username === TEST_USER &&
    db.startsWith(TEST_DB_PREFIX)
  );
}

export function isolatedTbilisiMovesTestUrl() {
  return process.env[TBILISI_MOVES_TEST_ENV_VAR] || '';
}

export function skipUnlessIsolatedTbilisiMovesDb(t, { requireMainDb = true } = {}) {
  const dedicated = isolatedTbilisiMovesTestUrl();
  const live = process.env.DATABASE_URL || '';
  if (!dedicated) {
    t.skip(
      `${TBILISI_MOVES_TEST_ENV_VAR} is unset. Run: node scripts/tbilisi-moves-isolated-pg.mjs (never use DATABASE_URL as a fallback).`,
    );
    return true;
  }
  if (!isIsolatedTbilisiMovesTestUrl(dedicated)) {
    t.skip(
      `${TBILISI_MOVES_TEST_ENV_VAR} is not the disposable identity (127.0.0.1:${TEST_PORT}/${TEST_DB_PREFIX}* as ${TEST_USER}).`,
    );
    return true;
  }
  if (requireMainDb) {
    const db = parseDatabaseUrl(dedicated)?.pathname.replace(/^\//, '').split('?')[0];
    if (db !== TEST_DB_PREFIX) {
      t.skip(`Integration tests require database ${TEST_DB_PREFIX}, not ${db}.`);
      return true;
    }
  }
  if (!isIsolatedTbilisiMovesTestUrl(live) || live !== dedicated) {
    t.skip(
      'Prisma DATABASE_URL is not identical to TBILISI_MOVES_TEST_DATABASE_URL. Hosted/normal DATABASE_URL is never used as a fallback.',
    );
    return true;
  }
  return false;
}

export async function assertDisposableTbilisiMovesDatabase(db) {
  const rows = await db.$queryRaw`SELECT current_database() AS db, current_user AS usr`;
  const row = rows[0];
  if (row.usr !== TEST_USER || !String(row.db).startsWith(TEST_DB_PREFIX)) {
    throw new Error(`Refusing to run: connected to ${row.usr}@${row.db}, not disposable test identity.`);
  }
  const guard = await db.$queryRaw`
    SELECT marker FROM "_tbilisi_moves_disposable" WHERE id = 'guard'
  `;
  if (!guard[0] || guard[0].marker !== DISPOSABLE_MARKER) {
    throw new Error('Refusing to run: disposable guard row is missing. Localhost is not enough.');
  }
  return { database: row.db, user: row.usr, marker: guard[0].marker };
}

function isIsolatedClusterUrl(url = '', databaseName) {
  const parsed = parseDatabaseUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const db = decodeURIComponent(parsed.pathname.replace(/^\//, '').split('?')[0] || '');
  return host && parsed.port === TEST_PORT && parsed.username === TEST_USER && db === databaseName;
}

export function isIsolatedTbilisiMovesPilotUrl(url = '') {
  return isIsolatedClusterUrl(url, PILOT_DB);
}

export function isIsolatedTbilisiMovesVisualQaUrl(url = '') {
  return isIsolatedClusterUrl(url, VISUAL_QA_DB);
}

async function assertDisposableNamedDatabase(db, expectedDb, label) {
  const rows = await db.$queryRaw`SELECT current_database() AS db, current_user AS usr`;
  const row = rows[0];
  if (row.usr !== TEST_USER || row.db !== expectedDb) {
    throw new Error(`Refusing to run ${label}: connected to ${row.usr}@${row.db}, not ${TEST_USER}@${expectedDb}.`);
  }
  const guard = await db.$queryRaw`
    SELECT marker FROM "_tbilisi_moves_disposable" WHERE id = 'guard'
  `;
  if (!guard[0] || guard[0].marker !== DISPOSABLE_MARKER) {
    throw new Error(`Refusing to run ${label}: disposable guard row is missing.`);
  }
  return { database: row.db, user: row.usr, marker: guard[0].marker };
}

export async function assertDisposableTbilisiMovesPilotDatabase(db) {
  return assertDisposableNamedDatabase(db, PILOT_DB, 'owner-pilot');
}

export async function assertDisposableTbilisiMovesVisualQaDatabase(db) {
  return assertDisposableNamedDatabase(db, VISUAL_QA_DB, 'visual-qa');
}

export async function resetTbilisiMovesRound(db, ymd) {
  const round = await db.tbilisiMovesRound.findUnique({ where: { date: ymd } });
  if (!round) return;
  await db.tbilisiMovesAward.deleteMany({ where: { roundId: round.id } });
  await db.tbilisiMovesResultRevision.deleteMany({ where: { roundId: round.id } });
  await db.tbilisiMovesObservation.deleteMany({ where: { roundId: round.id } });
  await db.tbilisiMovesCredit.deleteMany({ where: { roundId: round.id } });
  await db.tbilisiMovesDistrictDay.deleteMany({ where: { roundId: round.id } });
  await db.tbilisiMovesRound.delete({ where: { id: round.id } });
}

export { DISPOSABLE_MARKER, PILOT_DB, TEST_DB_PREFIX, TEST_PORT, TEST_USER, VISUAL_QA_DB };
