import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  clinicOpenState,
  getPetsClinicsDirectory,
  parseClockToken,
  parseDogdogClinicsHtml,
  parseHourRange,
  resetPetsClinicsCache,
  slotOpenAt,
} from './petsClinics.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(join(here, 'petsClinics.fixture.html'), 'utf8');

describe('pets clinic directory hours', () => {
  it('parses directory clocks including 24h and 10: shorthand', () => {
    assert.deepEqual(parseClockToken('24:'), { allDay: true, minutes: 0 });
    assert.deepEqual(parseClockToken('10:'), { allDay: false, minutes: 600 });
    assert.deepEqual(parseHourRange('00:00 - 00:00'), { allDay: true, openMin: 0, closeMin: 1440 });
    assert.deepEqual(parseHourRange('9:00 - 00:00'), { allDay: false, openMin: 540, closeMin: 1440 });
    assert.deepEqual(parseHourRange('10: - 19:'), { allDay: false, openMin: 600, closeMin: 1140 });
  });

  it('marks 9:00-midnight open in the evening and closed before 9', () => {
    const slot = parseHourRange('9:00 - 00:00');
    assert.equal(slotOpenAt(slot, 8 * 60 + 59).open, false);
    assert.equal(slotOpenAt(slot, 9 * 60).open, true);
    assert.equal(slotOpenAt(slot, 23 * 60 + 59).open, true);
  });
});

describe('pets clinic directory parse', () => {
  it('reads all Dogdog clinic cards with phones, locations, and hours', () => {
    const clinics = parseDogdogClinicsHtml(fixture);
    assert.equal(clinics.length, 9);
    assert.equal(clinics[0].name, 'ვეტერინარი გამოძახებით');
    assert.equal(clinics[0].location, 'ვარკეთილი');
    assert.equal(clinics[0].phones[0].tel, '555342416');
    assert.equal(clinics[0].hours.monday.allDay, true);
    assert.equal(clinics[1].name, 'VET-Vibe');
    assert.equal(clinics[1].hours.monday.openMin, 540);
    assert.equal(clinics[2].name.includes('ზოოპლაზა'), true);
    assert.equal(clinics[2].hours.sunday.allDay, true);
    assert.ok(clinics[2].phones.length >= 2);
    const balto = clinics.find((row) => /ბალტო/.test(row.name));
    assert.ok(balto);
    assert.equal(balto.hours.monday?.allDay || balto.hours.monday == null, true);
  });

  it('computes Tbilisi open/closed from published hours', () => {
    const clinics = parseDogdogClinicsHtml(fixture);
    const lucky = clinics.find((row) => row.name === 'ლაქი ფოუ');
    const wednesdayTen = new Date('2026-09-16T06:30:00.000Z'); // 10:30 in Tbilisi
    const wednesdayNight = new Date('2026-09-16T16:30:00.000Z'); // 20:30 in Tbilisi
    assert.equal(clinicOpenState(lucky, wednesdayTen).open, true);
    assert.equal(clinicOpenState(lucky, wednesdayNight).open, false);
  });

  it('serves cached clinics when the directory fetch fails', async () => {
    resetPetsClinicsCache();
    const first = await getPetsClinicsDirectory({
      now: new Date('2026-09-16T06:30:00.000Z'),
      fetchHtml: async () => fixture,
    });
    assert.equal(first.clinics.length, 9);
    assert.equal(first.stale, false);
    const second = await getPetsClinicsDirectory({
      force: true,
      now: new Date('2026-09-16T06:30:00.000Z'),
      fetchHtml: async () => {
        throw new Error('offline');
      },
    });
    assert.equal(second.stale, true);
    assert.equal(second.clinics.length, 9);
    resetPetsClinicsCache();
  });
});
