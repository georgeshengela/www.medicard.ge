// Health sync, calories (2026-10-11): the phone sends the day's TOTAL from Apple Health / Health
// Connect on every read, while a manual entry or Medi sends an ADDITION. The server used to add both,
// so every later device read added the whole day again. The sync route runs here against an
// in-memory Prisma: src/lib/prisma.js reuses globalThis.__medicardPrisma. Runs on its own or through
// hydrationSync.test.js (`npm test` is at the Windows 8 191-character command-line limit), so the hooks
// stay inside the outer describe and nothing here imports prisma.js before the fake is in place.
import { before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

process.env.DATABASE_URL ||= 'postgresql://unused@127.0.0.1:1/unused';
process.env.JWT_SECRET ||= 'nutrition-sync-test-secret-0123456789';
process.env.EVIDENCEMD_API_KEY ||= 'unused';

const USER = 'user-kcal-1';
const TODAY = '2026-10-11';
const YESTERDAY = '2026-10-10';
const rowKey = (userId, date) => `${userId}|${date}`;

const db = {
  rows: new Map(),
  /** The raw-SQL column; `columnMissing` = before db:install added it. */
  added: new Map(),
  columnMissing: false,
  healthMetricDaily: {
    findUnique: async ({ where }) => {
      const row = db.rows.get(rowKey(where.userId_date.userId, where.userId_date.date));
      return row ? { ...row } : null;
    },
    upsert: async ({ where, create, update }) => {
      const key = rowKey(where.userId_date.userId, where.userId_date.date);
      const prev = db.rows.get(key);
      const next = prev ? { ...prev, ...update } : { ...create };
      db.rows.set(key, next);
      return { ...next };
    },
  },
  stepLog: {
    createMany: async ({ data }) => ({ count: data.length }),
    aggregate: async () => ({ _sum: { stepCount: 0 } }),
  },
  async $queryRaw(strings, ...values) {
    if (!/nutritionKcalAdded/.test(strings.join('?'))) return [];
    if (db.columnMissing) throw Object.assign(new Error('column "nutritionKcalAdded" does not exist'), { code: 'P2010' });
    const key = rowKey(values[0], values[1]);
    return db.rows.has(key) ? [{ nutritionKcalAdded: db.added.get(key) ?? null }] : [];
  },
  async $executeRaw(strings, ...values) {
    if (!/nutritionKcalAdded/.test(strings.join('?'))) return 0;
    if (db.columnMissing) throw Object.assign(new Error('column "nutritionKcalAdded" does not exist'), { code: 'P2010' });
    db.added.set(rowKey(values[1], values[2]), values[0]);
    return 1;
  },
};

let mod;
let syncHandler;
let operationBody;

describe('health sync — calories (nutritionKcal)', () => {
  before(async () => {
    globalThis.__medicardPrisma = db;
    mod = await import('./nutritionKcalSync.js');
    ({ operationBody } = await import('./assistantExecution.js'));
    const { healthMetricsRouter } = await import('../routes/health-metrics.routes.js');
    const layer = healthMetricsRouter.stack.find((l) => l.route?.path === '/sync' && l.route.methods.post);
    syncHandler = layer.route.stack.at(-1).handle; // past the per-user rate limiter
  });

  beforeEach(() => {
    db.rows.clear();
    db.added.clear();
    db.columnMissing = false;
  });

  /** POST /api/health-metrics/sync as Express would run it → { status, body }. */
  function sync(body) {
    const warn = console.warn;
    console.warn = () => {}; // Quest refresh has no tables in this fake and says so; not under test.
    return new Promise((resolve, reject) => {
      const req = { body, user: { id: USER }, headers: {}, lang: 'ka' };
      const res = {
        statusCode: 200,
        status(code) { this.statusCode = code; return this; },
        json(payload) { resolve({ status: this.statusCode, body: payload }); return this; },
      };
      syncHandler(req, res, (error) => (error ? reject(error) : reject(new Error('no response'))));
    }).finally(() => { console.warn = warn; });
  }

  const kcal = (date = TODAY) => db.rows.get(rowKey(USER, date))?.nutritionKcal ?? null;

  /** What app 1.0.0.21.43+ sends after reading the phone. */
  const deviceRead = (total, steps = 4200) => ({ daily: [{ date: TODAY, steps, nutritionKcalTotal: total }], stepLogs: [] });
  /** What every older app sends after reading the phone: the week's days plus step logs, totals as nutritionKcal. */
  const legacyDeviceRead = (total) => ({
    daily: [{ date: YESTERDAY, steps: 8000 }, { date: TODAY, steps: 4200, nutritionKcal: total }],
    stepLogs: [{ at: `${TODAY}T08:00:00.000Z`, count: 1200 }],
  });
  /** logManualHealthMetric('nutrition', …) in every build. */
  const manualEntry = (value) => ({ daily: [{ date: TODAY, nutritionKcal: value }], stepLogs: [] });

  describe('POST /sync — calories from the phone are a day total', () => {
    it('the same day read again and again stays the day total (it used to add up every read)', async () => {
      for (let i = 0; i < 5; i += 1) assert.equal((await sync(deviceRead(1800, 4200 + i))).status, 200);
      assert.equal(kcal(), 1800);
      await sync(deviceRead(2100, 5000)); // dinner logged in Health
      assert.equal(kcal(), 2100);
      await sync(deviceRead(1900, 5100)); // a meal deleted in Health
      assert.equal(kcal(), 1900);
    });

    it('an older app’s device read (several days, step logs) also replaces instead of adding', async () => {
      for (let i = 0; i < 4; i += 1) await sync(legacyDeviceRead(1800));
      assert.equal(kcal(), 1800);
      await sync(legacyDeviceRead(2000));
      assert.equal(kcal(), 2000);
    });

    it('heals a day the old adding rule inflated', async () => {
      db.rows.set(rowKey(USER, TODAY), { userId: USER, date: TODAY, nutritionKcal: 9000, source: 'merged', syncedAt: new Date() });
      await sync(deviceRead(1800));
      assert.equal(kcal(), 1800);
    });
  });

  describe('POST /sync — manual entries and Medi still add', () => {
    it('a manual entry adds to the day and survives the next device totals', async () => {
      await sync(deviceRead(1800));
      await sync(manualEntry(300));
      assert.equal(kcal(), 2100);
      assert.equal(db.added.get(rowKey(USER, TODAY)), 300);
      await sync(deviceRead(1800, 6000));
      assert.equal(kcal(), 2100);
      await sync(deviceRead(1950, 6100));
      assert.equal(kcal(), 2250);
      await sync(legacyDeviceRead(1950));
      assert.equal(kcal(), 2250);
    });

    it('Medi’s metric_record body is an addition', async () => {
      const body = operationBody({ tool: 'metric_record', args: { date: TODAY, values: { nutritionKcal: 250 } } });
      assert.deepEqual(body, { daily: [{ date: TODAY, nutritionKcal: 250 }] });
      await sync(body);
      await sync(body);
      assert.equal(kcal(), 500);
      await sync(deviceRead(1200));
      assert.equal(kcal(), 1700);
    });

    it('entries on a day without phone data simply add up', async () => {
      await sync(manualEntry(400));
      await sync(manualEntry(350));
      assert.equal(kcal(), 750);
    });
  });

  describe('POST /sync — before db:install adds the column', () => {
    it('never fails; a device total replaces the value and nothing inflates', async () => {
      db.columnMissing = true;
      assert.equal((await sync(deviceRead(1800))).status, 200);
      assert.equal((await sync(manualEntry(300))).status, 200);
      assert.equal(kcal(), 2100);
      assert.equal((await sync(deviceRead(1800, 6000))).status, 200);
      assert.equal(kcal(), 1800);
    });
  });

  describe('nutritionKcalSync rules', () => {
    it('recognises an older app’s device read only by its shape', () => {
      assert.equal(mod.legacyDeviceTotals({ daily: [{ date: TODAY, nutritionKcal: 1 }], stepLogs: [] }), false);
      assert.equal(mod.legacyDeviceTotals({ daily: [{ date: TODAY }, { date: YESTERDAY }], stepLogs: [] }), true);
      assert.equal(mod.legacyDeviceTotals({ daily: [{ date: TODAY }], stepLogs: [{ at: 'x', count: 1 }] }), true);
      assert.equal(mod.legacyDeviceTotals({ daily: [{ date: TODAY, nutritionKcalTotal: 1 }, { date: YESTERDAY }], stepLogs: [] }), false);
    });

    it('merges a total, then an addition, without losing either', () => {
      assert.deepEqual(mod.mergeNutritionKcal({ existingKcal: null, existingAdded: null, total: 1800 }), { nutritionKcal: 1800, nutritionKcalAdded: null });
      assert.deepEqual(mod.mergeNutritionKcal({ existingKcal: 1800, existingAdded: null, addition: 300 }), { nutritionKcal: 2100, nutritionKcalAdded: 300 });
      assert.deepEqual(mod.mergeNutritionKcal({ existingKcal: 2100, existingAdded: 300, total: 2000 }), { nutritionKcal: 2300, nutritionKcalAdded: 300 });
      assert.deepEqual(mod.mergeNutritionKcal({ existingKcal: 2300, existingAdded: 300 }), { nutritionKcal: 2300, nutritionKcalAdded: 300 });
    });

    it('reads and writes the column fail-open', async () => {
      const broken = { $queryRaw: async () => { throw new Error('gone'); }, $executeRaw: async () => { throw new Error('gone'); } };
      assert.deepEqual(await mod.readNutritionAdded(broken, USER, TODAY), { known: false, value: null });
      assert.equal(await mod.writeNutritionAdded(broken, USER, TODAY, 1), false);
    });

    it('the install script only adds the nullable column', async () => {
      const { nutritionAddedStatements, NUTRITION_ADDED_SQL_URL } = await import('../../scripts/install-health-nutrition-added.mjs');
      assert.equal(nutritionAddedStatements(readFileSync(NUTRITION_ADDED_SQL_URL, 'utf8')).length, 1);
      assert.throws(() => nutritionAddedStatements('UPDATE "HealthMetricDaily" SET "nutritionKcal" = 0;'), /non-additive/);
    });
  });
});
