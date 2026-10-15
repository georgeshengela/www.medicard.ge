import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { earnedFor, normalizePay, periodBounds } from './payroll.js';
import { tbilisiInstant } from './time.js';

describe('MEDIBOOK payroll', () => {
  it('pay rules clamp to sensible numbers', () => {
    assert.deepEqual(normalizePay(undefined), { servicePercent: 0, productPercent: 0, fixedMonthly: 0 });
    assert.deepEqual(normalizePay({ servicePercent: 140, productPercent: -3, fixedMonthly: '800' }), { servicePercent: 100, productPercent: 0, fixedMonthly: 800 });
  });

  it('earnings: a share of visits, a share of products, the fixed amount pro-rated by days', () => {
    const e = earnedFor({ servicePercent: 40, productPercent: 10, fixedMonthly: 300 }, { serviceValue: 1000, productRevenue: 200, days: 15 });
    assert.deepEqual(e, { fromServices: 400, fromProducts: 20, fixed: 150, total: 570 });
    assert.equal(earnedFor({}, { serviceValue: 1000, days: 30 }).total, 0);
  });

  it('the period defaults to this month and is inclusive', () => {
    const p = periodBounds({ now: tbilisiInstant('2026-10-18', 12 * 60) });
    assert.equal(p.from, '2026-10-01');
    assert.equal(p.to, '2026-10-18');
    assert.equal(p.days, 18);
    assert.equal(p.toAt.toISOString(), tbilisiInstant('2026-10-19', 0).toISOString());
    assert.throws(() => periodBounds({ from: '2026-10-20', to: '2026-10-10' }), /BAD_RANGE|ადრეა/);
  });
});
