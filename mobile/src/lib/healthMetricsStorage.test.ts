// Health card calories and water (2026-10-11): the phone's day total goes up as a total, and a day
// both read from the phone and stored on the server is counted once on the weekly sparkline.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSyncPayloadFromNative,
  emptyStoredDaily,
  mergeHealthDailyRows,
  mergeMetricPoints,
} from './healthMetricsStorage.ts';

const TODAY = '2026-10-11';
const YESTERDAY = '2026-10-10';

describe('device calories go to the server as a day total', () => {
  it('sums the day’s Health samples into nutritionKcalTotal, never the adding nutritionKcal', () => {
    const payload = buildSyncPayloadFromNative(
      { nutrition: [{ date: TODAY, value: 450.4 }, { date: TODAY, value: 700 }, { date: YESTERDAY, value: 1900 }] },
      [],
    );
    const today = payload.daily.find((row) => row.date === TODAY);
    assert.equal(today?.nutritionKcalTotal, 1150);
    assert.equal(today?.nutritionKcal, undefined);
    assert.equal(payload.daily.find((row) => row.date === YESTERDAY)?.nutritionKcalTotal, 1900);
  });
});

describe('weekly sparkline counts a day once', () => {
  it('a day on the phone and on the server is one value, not their sum', () => {
    const merged = mergeMetricPoints(
      { nutrition: [{ date: TODAY, value: 600 }, { date: TODAY, value: 700 }] },
      { nutrition: [{ date: TODAY, value: 1300 }] },
    );
    assert.deepEqual(merged.nutrition, [{ date: TODAY, value: 1300 }]);
  });

  it('keeps the server’s extra entries (Medi, manual) and the phone’s newer meals', () => {
    const withMedi = mergeMetricPoints({ nutrition: [{ date: TODAY, value: 1300 }] }, { nutrition: [{ date: TODAY, value: 1600 }] });
    assert.deepEqual(withMedi.nutrition, [{ date: TODAY, value: 1600 }]);
    const newerOnPhone = mergeMetricPoints({ nutrition: [{ date: TODAY, value: 1500 }] }, { nutrition: [{ date: TODAY, value: 1300 }] });
    assert.deepEqual(newerOnPhone.nutrition, [{ date: TODAY, value: 1500 }]);
  });

  it('water follows the same rule; days only one side knows stay', () => {
    const merged = mergeMetricPoints(
      { hydration: [{ date: TODAY, value: 250 }, { date: TODAY, value: 500 }] },
      { hydration: [{ date: YESTERDAY, value: 1800 }, { date: TODAY, value: 750 }] },
    );
    assert.deepEqual(merged.hydration, [{ date: YESTERDAY, value: 1800 }, { date: TODAY, value: 750 }]);
  });

  it('sleep still takes the phone’s night', () => {
    const merged = mergeMetricPoints({ sleep: [{ date: TODAY, value: 7.2 }] }, { sleep: [{ date: TODAY, value: 13.5 }, { date: YESTERDAY, value: 6.8 }] });
    assert.deepEqual(merged.sleep, [{ date: YESTERDAY, value: 6.8 }, { date: TODAY, value: 7.2 }]);
  });
});

describe('device cache mirrors the server', () => {
  it('a manual entry adds to the cached day; a phone total never lowers it', () => {
    const base = [{ ...emptyStoredDaily(TODAY, '2026-10-11T08:00:00.000Z'), nutritionKcal: 1800 }];
    const afterEntry = mergeHealthDailyRows(base, [{ date: TODAY, nutritionKcal: 300 }]);
    assert.equal(afterEntry[0].nutritionKcal, 2100);
    const afterRead = mergeHealthDailyRows(afterEntry, [{ date: TODAY, nutritionKcalTotal: 1800 }]);
    assert.equal(afterRead[0].nutritionKcal, 2100);
    const firstRead = mergeHealthDailyRows([], [{ date: YESTERDAY, nutritionKcalTotal: 1900 }]);
    assert.equal(firstRead[0].nutritionKcal, 1900);
  });
});
