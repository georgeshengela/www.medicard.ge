import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addCalendarMonths, addDays, daysInMonth } from './petsCivilDate.js';

describe('pet civil month arithmetic', () => {
  it('anchors Jan 31 through February end back to Mar 31', () => {
    assert.equal(addCalendarMonths('2026-01-31', 1, 31), '2026-02-28');
    assert.equal(addCalendarMonths('2026-01-31', 2, 31), '2026-03-31');
    assert.equal(addCalendarMonths('2026-02-28', 1, 31), '2026-03-31');
  });

  it('uses leap-year February when the anchor is 31', () => {
    assert.equal(daysInMonth(2024, 2), 29);
    assert.equal(addCalendarMonths('2024-01-31', 1, 31), '2024-02-29');
    assert.equal(addCalendarMonths('2024-01-31', 2, 31), '2024-03-31');
    assert.equal(addCalendarMonths('2023-01-31', 1, 31), '2023-02-28');
    assert.equal(addCalendarMonths('2023-01-31', 2, 31), '2023-03-31');
  });

  it('does not treat a calendar month as a fixed day count', () => {
    assert.notEqual(addCalendarMonths('2026-01-31', 1, 31), addDays('2026-01-31', 30));
    assert.notEqual(addCalendarMonths('2026-01-31', 1, 31), addDays('2026-01-31', 31));
  });
});
