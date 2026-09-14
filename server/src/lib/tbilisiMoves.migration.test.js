import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import {
  isIsolatedTbilisiMovesTestUrl,
  isolatedTbilisiMovesTestUrl,
  TBILISI_MOVES_TEST_ENV_VAR,
  assertDisposableTbilisiMovesDatabase,
} from './tbilisiMoves/testEnv.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(__dirname, '../..');

function client(url) {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe('tbilisi moves SQL migration paths', { timeout: 120_000 }, () => {
  it('path A (Medicard base → phase2 → phase4) and path B (phase2 records → phase4) agree with Prisma', async (t) => {
    const main = isolatedTbilisiMovesTestUrl();
    const pathB = process.env.TBILISI_MOVES_TEST_DATABASE_URL_B || '';
    const phase2 = process.env.TBILISI_MOVES_TEST_DATABASE_URL_P2 || '';
    if (!main || !isIsolatedTbilisiMovesTestUrl(main)) {
      t.skip(`${TBILISI_MOVES_TEST_ENV_VAR} is unset. Run node scripts/tbilisi-moves-isolated-pg.mjs`);
      return;
    }
    if (!isIsolatedTbilisiMovesTestUrl(pathB) || !isIsolatedTbilisiMovesTestUrl(phase2)) {
      t.skip('Path B / phase2-only disposable URLs are not set by the harness.');
      return;
    }

    const a = client(main);
    const b = client(pathB);
    const p2 = client(phase2);
    try {
      await assertDisposableTbilisiMovesDatabase(a);
      await assertDisposableTbilisiMovesDatabase(b);
      await assertDisposableTbilisiMovesDatabase(p2);

      const cfgA = await a.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      assert.equal(cfgA.pilotMode, true);
      assert.equal(cfgA.leaderRecognitionEnabled, true);
      assert.equal(cfgA.leaderRewardedRanks, 3);
      assert.equal(cfgA.districtGoalBadgeEnabled, true);

      const districts = await a.tbilisiMovesDistrict.findMany({ orderBy: { sortOrder: 'asc' } });
      assert.equal(districts.length, 10);
      assert.equal(districts[0].slug, 'gldani');
      assert.equal(districts[2].nameKa, 'ვაკე');

      const indexes = await a.$queryRaw`
        SELECT indexname FROM pg_indexes
        WHERE tablename IN ('TbilisiMovesCredit','TbilisiMovesObservation','TbilisiMovesAward','TbilisiMovesResultRevision')
      `;
      const names = indexes.map((row) => row.indexname);
      assert.ok(names.includes('TbilisiMovesCredit_userId_date_key'));
      assert.ok(names.includes('TbilisiMovesObservation_userId_clientObservationId_key'));
      assert.ok(names.includes('TbilisiMovesAward_userId_date_awardKey_districtId_key'));
      assert.ok(names.includes('TbilisiMovesResultRevision_roundId_revision_key'));

      const fks = await a.$queryRaw`
        SELECT conname FROM pg_constraint
        WHERE contype = 'f' AND conrelid = '"TbilisiMovesCredit"'::regclass
      `;
      assert.ok(fks.some((row) => row.conname === 'TbilisiMovesCredit_userId_fkey'));

      await a.$executeRaw`
        UPDATE "TbilisiMovesConfig"
        SET "defaultDailyTarget" = 111000, "revision" = "revision" + 1
        WHERE "id" = 'default'
      `;
      const reseed = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['prisma', 'db', 'execute', '--file', 'prisma/tbilisi-moves-phase2.sql', '--schema', 'prisma/schema.prisma'],
        {
          cwd: serverDir,
          encoding: 'utf8',
          env: { ...process.env, DATABASE_URL: main },
          shell: process.platform === 'win32',
        },
      );
      assert.equal(reseed.status, 0, reseed.stderr || reseed.stdout);
      const afterSeed = await a.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      assert.equal(afterSeed.defaultDailyTarget, 111000);
      assert.equal(afterSeed.pilotMode, true);

      const cfgB = await b.tbilisiMovesConfig.findUnique({ where: { id: 'default' } });
      assert.equal(cfgB.defaultDailyTarget, 123456);
      assert.equal(cfgB.cooldownDays, 21);
      assert.equal(cfgB.revision, 4);
      assert.equal(cfgB.leaderRecognitionEnabled, true);
      const vake = await b.tbilisiMovesDistrict.findUnique({ where: { slug: 'vake' } });
      assert.equal(vake.dailyTargetOverride, 777000);
      const credit = await b.tbilisiMovesCredit.findUnique({
        where: { userId_date: { userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', date: '2026-07-01' } },
      });
      assert.equal(credit.eligibleSteps, 4321);
      const round = await b.tbilisiMovesRound.findUnique({ where: { date: '2026-07-01' } });
      assert.equal(round.resultRevision, 0);
      assert.equal(round.latestResultId, null);

      const p2Row = await p2.$queryRaw`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'TbilisiMovesConfig'
      `;
      const p2Cols = p2Row.map((row) => row.column_name);
      assert.ok(p2Cols.includes('featureEnabled'));
      assert.equal(p2Cols.includes('leaderRecognitionEnabled'), false);
      const p2Tables = await p2.$queryRaw`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'TbilisiMoves%'
      `;
      assert.equal(
        p2Tables.some((row) => row.tablename === 'TbilisiMovesResultRevision'),
        false,
      );
    } finally {
      await Promise.allSettled([a.$disconnect(), b.$disconnect(), p2.$disconnect()]);
    }
  });

  it('Phase 2-only schema yields controlled status, not a raw 500', async (t) => {
    const phase2 = process.env.TBILISI_MOVES_TEST_DATABASE_URL_P2 || '';
    if (!isIsolatedTbilisiMovesTestUrl(phase2)) {
      t.skip('phase2-only disposable URL is not set.');
      return;
    }
    const script = `
      import { getPublicStatus } from './src/lib/tbilisiMoves/config.js';
      import { requireResultsSchema } from './src/lib/tbilisiMoves/finalize.js';
      const status = await getPublicStatus();
      let resultsCode = null;
      try {
        await requireResultsSchema();
      } catch (error) {
        resultsCode = error.code || error.message;
      }
      console.log(JSON.stringify({ schemaReady: status.schemaReady, resultsReady: status.resultsReady, pilotMode: status.pilotMode, resultsCode }));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '--eval', script], {
      cwd: serverDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: phase2,
        TBILISI_MOVES_TEST_DATABASE_URL: phase2,
        NODE_ENV: 'test',
      },
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const line = result.stdout.trim().split('\n').filter(Boolean).at(-1);
    const body = JSON.parse(line);
    assert.equal(body.schemaReady, false);
    assert.equal(body.resultsReady, false);
    assert.equal(body.pilotMode, true);
    assert.equal(body.resultsCode, 'SCHEMA_NOT_READY');
  });
});
