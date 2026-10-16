import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mergeDayHydrationMl, serverTotalsAfterOwnWrite, weekSoFarAverageMl, weekSoFarSums } from './hydrationMerge.js';

describe('hydration merge', () => {
  it('takes the stored daily total when Expo has no local taps', () => {
    assert.equal(mergeDayHydrationMl(0, 750), 750);
  });

  it('keeps local taps when they are ahead of the server row', () => {
    assert.equal(mergeDayHydrationMl(500, 250), 500);
  });

  it('ignores a missing server row', () => {
    assert.equal(mergeDayHydrationMl(250, null), 250);
  });
});

describe('own water writes and the stored day total', () => {
  const write = { date: '2026-10-13', deltaMl: 250, startedAt: 1_000 };

  it('a tap moves the number when the server already had more water that day', () => {
    // Medi chat logged 1 500 ml, the phone has 500 ml of its own taps: the shown value is the max.
    const server = serverTotalsAfterOwnWrite({ '2026-10-13': 1500 }, 900, write);
    assert.equal(server['2026-10-13'], 1750);
    assert.equal(mergeDayHydrationMl(750, server['2026-10-13']), 1750);
  });

  it('a delete takes the glass off the stored total, never below zero', () => {
    assert.equal(serverTotalsAfterOwnWrite({ '2026-10-13': 1500 }, 900, { ...write, deltaMl: -250 })['2026-10-13'], 1250);
    assert.equal(serverTotalsAfterOwnWrite({ '2026-10-13': 100 }, 900, { ...write, deltaMl: -250 })['2026-10-13'], 0);
  });

  it('a read that began after the write may already hold it: never counted twice', () => {
    const before = { '2026-10-13': 1750 };
    assert.equal(serverTotalsAfterOwnWrite(before, 1_200, write), before);
  });

  it('a day without a stored total stays without one (local taps are shown)', () => {
    const before = { '2026-10-12': 2000 };
    assert.equal(serverTotalsAfterOwnWrite(before, 900, write), before);
  });
});

describe('week numbers on the water screen', () => {
  const week = ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18'];

  it('the weekly average is per day so far, not the week sum', () => {
    assert.equal(weekSoFarAverageMl([2000, 1000, 0, 0, 0, 0, 0], week, '2026-10-13'), 1500);
    assert.equal(weekSoFarAverageMl([0, 0, 0, 0, 0, 0, 0], week, '2026-10-01'), 0);
  });

  it('week over week compares the same days', () => {
    const sums = weekSoFarSums([2000, 1000, 0, 0, 0, 0, 0], [1500, 1500, 1500, 1500, 1500, 1500, 1500], week, '2026-10-13');
    assert.deepEqual(sums, { current: 3000, previous: 3000 });
  });
});
