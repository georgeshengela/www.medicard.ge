import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, inferCycleStats } from './cycle.js';
import {
  DEVIATION_FACTOR_TAIL_DAYS,
  buildCycleDeviations,
  deviationFactors,
  evaluateCycleDeviations,
} from './cycleDeviations.js';

const TODAY = '2026-10-03';

/**
 * Logs for periods whose starts are `gaps` apart (oldest → newest), ending so that the last period
 * starts `lastStartAgo` days before TODAY. `lengths[i]` = bleeding days of period i (default 5).
 */
function history(gaps, { lastStartAgo = 10, lengths = [], extra = [] } = {}) {
  const starts = [addDays(TODAY, -lastStartAgo)];
  for (let i = gaps.length - 1; i >= 0; i -= 1) starts.unshift(addDays(starts[0], -gaps[i]));
  const logs = [];
  starts.forEach((start, i) => {
    const len = lengths[i] ?? 5;
    for (let d = 0; d < len; d += 1) logs.push({ date: addDays(start, d), flow: 'medium' });
  });
  logs.push(...extra);
  logs.sort((a, b) => a.date.localeCompare(b.date));
  return { starts, logs, periodRanges: inferCycleStats(logs).periodRanges };
}

function evaluate(h, extra = {}) {
  return evaluateCycleDeviations({ today: TODAY, periodRanges: h.periodRanges, logs: h.logs, ...extra });
}

const ids = (r) => (r.deviations?.findings ?? []).map((f) => f.id);

describe('cycle deviations — gates', () => {
  it('regular history shows nothing', () => {
    const r = evaluate(history([28, 29, 27, 28, 28, 29, 28]));
    assert.equal(r.shown, false);
    assert.equal(r.reason, 'no_findings');
    assert.equal(r.deviations, null);
  });

  it('below 180 days of history → null, even with a large spread', () => {
    // 22 + 41 + 22 + 41 = 126 days of history before the last start (+10) < 180.
    const r = evaluate(history([22, 41, 22, 41]));
    assert.equal(r.reason, 'history');
    assert.equal(buildCycleDeviations({ today: TODAY, periodRanges: history([22, 41, 22, 41]).periodRanges }), null);
  });

  it('below 3 completed cycles → null', () => {
    // Two cycles of 90 days each = 190 days of history, but only 2 completed cycles.
    const r = evaluate(history([90, 90]));
    assert.equal(r.reason, 'cycles');
  });

  it('exactly 180 days of history and 3 cycles is enough', () => {
    // Starts at −179 … with gaps 22/41/... last start at −(179−22−41−80)= −36.
    const h = history([22, 41, 80], { lastStartAgo: 36 });
    assert.equal(h.starts[0], addDays(TODAY, -179));
    const r = evaluate(h);
    assert.equal(r.shown, true);
  });

  it('Tracking (no bleeding expected) → null', () => {
    assert.equal(evaluate(history([22, 41, 22, 41, 30, 25]), { expectsBleeding: false }).reason, 'tracking');
  });

  it('pregnancy and postpartum modes → null', () => {
    const h = history([22, 41, 22, 41, 30, 25]);
    assert.equal(evaluate(h, { mode: 'PREGNANCY' }).reason, 'mode');
    assert.equal(evaluate(h, { mode: 'POSTPARTUM' }).reason, 'mode');
  });
});

describe('cycle deviations — factors', () => {
  const h = history([22, 41, 22, 41, 30, 25, 33]);

  it('the fixture alone triggers irregular', () => {
    assert.deepEqual(ids(evaluate(h)), ['irregular']);
  });

  it('hormonal contraception (pill, implant, hormonal IUD, …) disables the card; start date not needed', () => {
    for (const method of ['COMBINED_PILL', 'PROGESTIN_PILL', 'IMPLANT', 'INJECTION', 'PATCH', 'VAGINAL_RING', 'HORMONAL_IUD']) {
      const r = evaluate(h, { factors: deviationFactors({ contraceptionMethod: method }) });
      assert.equal(r.reason, 'factor:hormonal_contraception', method);
    }
  });

  it('non-hormonal methods do not disable it', () => {
    for (const method of [null, 'NONE', 'BARRIER', 'COPPER_IUD', 'FERTILITY_AWARENESS']) {
      assert.equal(evaluate(h, { factors: deviationFactors({ contraceptionMethod: method }) }).shown, true, String(method));
    }
  });

  it('active pregnancy / postpartum from the mode', () => {
    assert.equal(evaluate(h, { factors: deviationFactors({ mode: 'PREGNANCY' }) }).reason, 'factor:pregnancy');
    assert.equal(evaluate(h, { factors: deviationFactors({ mode: 'POSTPARTUM' }) }).reason, 'factor:postpartum');
  });

  for (const kind of ['pregnancy', 'postpartum']) {
    const key = kind === 'pregnancy' ? 'pregnancyEndedAt' : 'postpartumEndedAt';

    it(`${kind} ended < 90 days ago → null (90-day tail)`, () => {
      for (const ago of [0, 30, DEVIATION_FACTOR_TAIL_DAYS - 1]) {
        const r = evaluate(h, { factors: deviationFactors({ [key]: addDays(TODAY, -ago) }) });
        assert.equal(r.reason, `factor:${kind}`, `${ago} days ago`);
      }
    });

    it(`${kind} ended ≥ 90 days ago but < 180 days of history since → still null`, () => {
      const r = evaluate(h, { factors: deviationFactors({ [key]: addDays(TODAY, -DEVIATION_FACTOR_TAIL_DAYS) }) });
      assert.equal(r.reason, 'history');
    });

    it(`${kind} ended long ago → the card can show again`, () => {
      const r = evaluate(h, { factors: deviationFactors({ [key]: addDays(TODAY, -400) }) });
      assert.equal(r.shown, true);
    });
  }

  it('an end date in the future counts as active', () => {
    const r = evaluate(h, { factors: [{ kind: 'pregnancy', active: false, endedAt: addDays(TODAY, 5) }] });
    assert.equal(r.reason, 'factor:pregnancy');
  });

  it('a Date object as endedAt works', () => {
    const r = evaluate(h, { factors: deviationFactors({ postpartumEndedAt: new Date(`${addDays(TODAY, -20)}T10:00:00Z`) }) });
    assert.equal(r.reason, 'factor:postpartum');
  });
});

describe('cycle deviations — rules', () => {
  it('irregular: spread ≥ 17 days in the window, with the numbers', () => {
    const r = evaluate(history([28, 28, 22, 41, 30, 25, 33]));
    assert.deepEqual(ids(r), ['irregular']);
    const f = r.deviations.findings[0];
    assert.equal(f.shortestDays, 22);
    assert.equal(f.longestDays, 41);
    assert.equal(f.spreadDays, 19);
    assert.equal(r.deviations.windowDays, 180);
    assert.equal(r.deviations.to, TODAY);
    assert.equal(r.deviations.from, addDays(TODAY, -179));
  });

  it('irregular: spread of 16 does not trigger', () => {
    assert.equal(evaluate(history([28, 28, 24, 40, 30, 28, 33])).reason, 'no_findings');
  });

  it('irregular: cycles that started before the window are ignored', () => {
    // A 60-day cycle 300 days ago, regular since.
    const r = evaluate(history([60, 28, 29, 28, 27, 28, 29, 28, 28, 27]));
    assert.equal(r.reason, 'no_findings');
  });

  it('perimenopause turns irregular off and keeps the others', () => {
    const h = history([28, 28, 22, 41, 30, 25, 33]);
    const r = evaluate(h, { mode: 'PERIMENOPAUSE' });
    assert.equal(r.reason, 'no_findings');
    const h2 = history([28, 28, 22, 41, 30, 25, 33], { lengths: [5, 5, 5, 5, 11, 5, 12, 5] });
    const r2 = evaluate(h2, { mode: 'PERIMENOPAUSE' });
    assert.deepEqual(ids(r2), ['prolonged']);
    assert.deepEqual(r2.deviations.rulesOff, ['irregular']);
  });

  it('prolonged: two periods of ≥ 10 days', () => {
    const h = history([28, 29, 27, 28, 28, 29, 28], { lengths: [5, 5, 5, 10, 5, 12, 5, 5] });
    const r = evaluate(h);
    assert.deepEqual(ids(r), ['prolonged']);
    assert.equal(r.deviations.findings[0].periods, 2);
    assert.equal(r.deviations.findings[0].longestDays, 12);
  });

  it('prolonged: one long period is not enough; 9 days is not long', () => {
    assert.equal(evaluate(history([28, 29, 27, 28, 28, 29, 28], { lengths: [5, 5, 5, 11, 5, 9, 5, 5] })).reason, 'no_findings');
  });

  it('infrequent: only 1–2 periods in the window', () => {
    // Regular before, then two periods in 180 days (gaps 95 + the open cycle).
    const h = history([28, 28, 28, 120, 95], { lastStartAgo: 60, extra: [{ date: addDays(TODAY, -5), flow: 'none' }] });
    const r = evaluate(h);
    assert.ok(ids(r).includes('infrequent'));
    assert.equal(r.deviations.findings.find((f) => f.id === 'infrequent').periods, 2);
  });

  it('infrequent: one period in the window', () => {
    const h = history([28, 28, 28, 200], { lastStartAgo: 40 });
    const r = evaluate(h);
    assert.equal(r.deviations.findings.find((f) => f.id === 'infrequent').periods, 1);
  });

  it('infrequent: not when nothing was logged for 90+ days (stopped tracking)', () => {
    const h = history([28, 28, 28, 100, 28], { lastStartAgo: 120 });
    const r = evaluate(h);
    assert.ok(!ids(r).includes('infrequent'));
  });

  it('perimenopause keeps the infrequent rule', () => {
    const h = history([28, 28, 28, 120, 95], { lastStartAgo: 60, extra: [{ date: addDays(TODAY, -5), flow: 'none' }] });
    assert.ok(ids(evaluate(h, { mode: 'PERIMENOPAUSE' })).includes('infrequent'));
  });

  it('spotting between periods in ≥ 2 cycles', () => {
    const base = history([28, 29, 27, 28, 28, 29, 28]);
    const [, , , , , s5, s6] = base.starts;
    const h = history([28, 29, 27, 28, 28, 29, 28], {
      extra: [
        { date: addDays(s5, 14), flow: 'spotting' },
        { date: addDays(s5, 15), flow: 'spotting' },
        { date: addDays(s6, 12), flow: 'spotting' },
      ],
    });
    const r = evaluate(h);
    assert.deepEqual(ids(r), ['spotting']);
    assert.deepEqual(r.deviations.findings[0], { id: 'spotting', cycles: 2, days: 3 });
  });

  it('spotting: one cycle is not enough; spotting next to a period does not count', () => {
    const base = history([28, 29, 27, 28, 28, 29, 28]);
    const [, , , , , s5, s6] = base.starts;
    const one = history([28, 29, 27, 28, 28, 29, 28], { extra: [{ date: addDays(s5, 14), flow: 'spotting' }] });
    assert.equal(evaluate(one).reason, 'no_findings');
    const edges = history([28, 29, 27, 28, 28, 29, 28], {
      extra: [
        { date: addDays(s5, -1), flow: 'spotting' },
        { date: addDays(s5, 6), flow: 'spotting' },
        { date: addDays(s6, -2), flow: 'spotting' },
      ],
    });
    assert.equal(evaluate(edges).reason, 'no_findings');
  });

  it('several rules at once, in a fixed order', () => {
    const base = history([28, 28, 22, 41, 30, 25, 33], { lengths: [5, 5, 5, 5, 11, 5, 12, 5] });
    const [, , , , s4, s5] = base.starts;
    const h = history([28, 28, 22, 41, 30, 25, 33], {
      lengths: [5, 5, 5, 5, 11, 5, 12, 5],
      extra: [
        { date: addDays(s4, 18), flow: 'spotting' },
        { date: addDays(s5, 14), flow: 'spotting' },
      ],
    });
    assert.deepEqual(ids(evaluate(h)), ['irregular', 'prolonged', 'spotting']);
  });

  it('missing / bad today → null', () => {
    assert.equal(buildCycleDeviations({}), null);
    assert.equal(buildCycleDeviations({ today: 'yesterday' }), null);
  });
});
