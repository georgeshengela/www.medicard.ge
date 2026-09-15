import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { petsHealthErrorKind, petWeightWeekSeries, sortWeightChronological, weightTrendAccessibleText } from './petsHealth.js';

describe('pets health mobile helpers', () => {
  it('does not treat schema 503 as an empty history', () => {
    const error = { status: 503, schemaReady: false, isSchemaUnavailable: true };
    assert.equal(petsHealthErrorKind(error), 'unavailable');
    assert.notEqual(petsHealthErrorKind(error), 'error');
  });

  it('sorts weight points by civil date without inventing gaps', () => {
    const rows = [
      { id: 'b', petId: 'p', recordedOn: '2026-09-10', weightKg: 4, inputValue: 4, inputUnit: 'kg', note: null, createdAt: '2', updatedAt: '2' },
      { id: 'a', petId: 'p', recordedOn: '2026-08-01', weightKg: 3, inputValue: 4, inputUnit: 'kg', note: null, createdAt: '1', updatedAt: '1' },
    ];
    assert.deepEqual(sortWeightChronological(rows).map((row) => row.id), ['a', 'b']);
    const text = weightTrendAccessibleText(rows, (ymd) => ymd, {
      weightEmpty: 'empty',
      weightOnePoint: 'one',
      weightKgLabel: (kg, date) => `${kg}@${date}`,
    });
    assert.match(text, /2026-08-01/);
    assert.match(text, /2026-09-10/);
    assert.equal(text.includes('2026-08-15'), false);
  });

  it('builds a 7-day chart series without filling skipped calendar days in history copy', () => {
    const now = new Date(2026, 8, 15, 12, 0, 0);
    const rows = [
      { id: 'a', petId: 'p', recordedOn: '2026-09-09', weightKg: 4, inputValue: 4, inputUnit: 'kg', note: null, createdAt: '1', updatedAt: '1' },
      { id: 'b', petId: 'p', recordedOn: '2026-09-15', weightKg: 4.4, inputValue: 4.4, inputUnit: 'kg', note: null, createdAt: '2', updatedAt: '2' },
    ];
    const week = petWeightWeekSeries(rows, now);
    assert.equal(week.length, 7);
    assert.equal(week[0].ymd, '2026-09-09');
    assert.equal(week[0].value, 4);
    assert.equal(week[6].ymd, '2026-09-15');
    assert.equal(week[6].value, 4.4);
    assert.equal(week[3].value, 4);
  });
});
