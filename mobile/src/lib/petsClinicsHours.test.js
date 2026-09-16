import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clinicOpenState } from './petsClinicsHours.js';

describe('pets clinic open state', () => {
  it('uses Asia/Tbilisi wall clock against published hours', () => {
    const clinic = {
      hours: {
        wednesday: { allDay: false, openMin: 600, closeMin: 1140, label: '10: - 19:' },
      },
    };
    const open = new Date('2026-09-16T06:30:00.000Z');
    const closed = new Date('2026-09-16T16:30:00.000Z');
    assert.equal(clinicOpenState(clinic, open).open, true);
    assert.equal(clinicOpenState(clinic, closed).open, false);
  });
});
