import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { petsHealthErrorKind, sortWeightChronological, weightTrendAccessibleText } from './petsHealth.js';

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
});
