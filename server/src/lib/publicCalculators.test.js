import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  cycleStrip,
  dueDateFromIvf,
  dueDateFromLmp,
  dueDateFromUltrasound,
  estimateOvulation,
  gestationalAge,
  hcgDoubling,
  implantationWindow,
  menstrualCycle,
  periodForecast,
  pregnancyMonthFromWeek,
  pregnancyTestWindow,
  trimesterFromWeek,
  weeksToMonths,
  calendarMonthCells,
} from '../../public/calculators-engine.js';

describe('ovulation / cycle', () => {
  it('matches the app luteal-14 rule', () => {
    const ov = estimateOvulation('2026-01-01', 28);
    assert.equal(ov.ovulation, '2026-01-15');
    assert.equal(ov.fertileStart, '2026-01-10');
    assert.equal(ov.fertileEnd, '2026-01-16');
    assert.equal(ov.nextPeriod, '2026-01-29');
  });

  it('shifts ovulation for a 32-day cycle', () => {
    const ov = estimateOvulation('2026-01-01', 32);
    assert.equal(ov.ovulation, '2026-01-19');
    assert.equal(ov.nextPeriod, '2026-02-02');
  });

  it('forecasts the next period after the logged one', () => {
    const forecast = periodForecast('2026-03-01', 28, 5, 3);
    assert.equal(forecast.cycles[0].start, '2026-03-01');
    assert.equal(forecast.next.start, '2026-03-29');
    assert.equal(forecast.cycles[0].end, '2026-03-05');
  });

  it('names the period phase on day 1', () => {
    const cycle = menstrualCycle('2026-09-01', 28, 5, '2026-09-01');
    assert.equal(cycle.phase, 'period');
    assert.equal(cycle.cycleDay, 1);
  });

  it('colors ovulation on the predicted date', () => {
    const strip = cycleStrip('2026-01-01', 28, 5);
    const ov = strip.find((d) => d.kind === 'ovulation');
    assert.equal(ov.date, '2026-01-15');
    assert.equal(strip.filter((d) => d.kind === 'period').length, 5);
  });
});

describe('pregnancy windows', () => {
  it('places implantation 6–10 days after ovulation', () => {
    const win = implantationWindow({ mode: 'ovulation', date: '2026-04-10' });
    assert.equal(win.start, '2026-04-16');
    assert.equal(win.end, '2026-04-20');
    assert.equal(win.testFrom, '2026-04-24');
  });

  it('recommends a test on the expected period day', () => {
    const win = pregnancyTestWindow({ mode: 'lmp', date: '2026-01-01', cycleLength: 28 });
    assert.equal(win.recommended, '2026-01-29');
    assert.equal(win.earliest, '2026-01-25');
  });
});

describe('weeks to months', () => {
  it('maps Flo’s 5-month window to weeks 18–22', () => {
    assert.equal(pregnancyMonthFromWeek(18), 5);
    assert.equal(pregnancyMonthFromWeek(22), 5);
    assert.equal(pregnancyMonthFromWeek(17), 4);
    assert.equal(pregnancyMonthFromWeek(23), 6);
  });

  it('uses Flo trimester bounds', () => {
    assert.equal(trimesterFromWeek(13), 1);
    assert.equal(trimesterFromWeek(14), 2);
    assert.equal(trimesterFromWeek(27), 2);
    assert.equal(trimesterFromWeek(28), 3);
  });

  it('returns remaining days on a 40-week clock', () => {
    const result = weeksToMonths(26, 0);
    assert.equal(result.month, 6);
    assert.equal(result.trimester, 2);
    assert.equal(result.remainingDays, 280 - 182);
  });
});

describe('due dates', () => {
  it('uses Naegele’s 280-day rule and cycle-length adjustment', () => {
    const regular = dueDateFromLmp('2026-01-01', 28, '2026-01-01');
    assert.equal(regular.edd, addDays('2026-01-01', 280));
    const long = dueDateFromLmp('2026-01-01', 32, '2026-01-01');
    assert.equal(long.edd, addDays(regular.edd, 4));
  });

  it('dates IVF from embryo age', () => {
    const day5 = dueDateFromIvf('2026-06-01', 'day5', '2026-06-01');
    assert.equal(day5.edd, addDays('2026-06-01', 261));
    const day3 = dueDateFromIvf('2026-06-01', 'day3', '2026-06-01');
    assert.equal(day3.edd, addDays('2026-06-01', 263));
    const retrieval = dueDateFromIvf('2026-06-01', 'retrieval', '2026-06-01');
    assert.equal(retrieval.edd, addDays('2026-06-01', 266));
  });

  it('projects EDD from an ultrasound gestational age', () => {
    const result = dueDateFromUltrasound('2026-03-01', 8, 0, '2026-03-01');
    assert.equal(result.edd, addDays('2026-03-01', 280 - 56));
    assert.equal(gestationalAge(result.lmpEquivalent, '2026-03-01').weeks, 8);
  });
});

describe('hCG doubling', () => {
  it('finds a 48-hour doubling time', () => {
    const result = hcgDoubling({
      date1: '2026-02-01',
      value1: 100,
      date2: '2026-02-03',
      value2: 200,
    });
    assert.equal(result.ok, true);
    assert.ok(Math.abs(result.doublingHours - 48) < 0.01);
    assert.equal(result.band, 'typical');
  });

  it('flags a falling result', () => {
    const result = hcgDoubling({
      date1: '2026-02-01',
      value1: 200,
      date2: '2026-02-03',
      value2: 80,
    });
    assert.equal(result.band, 'falling');
  });
});

describe('Georgian calendar grid', () => {
  it('starts weeks on Monday and fills 42 cells', () => {
    const cells = calendarMonthCells(2026, 9);
    assert.equal(cells.length, 42);
    assert.equal(cells[0].date, '2026-08-31');
    const first = cells.find((c) => c.date === '2026-09-01');
    assert.equal(first.inMonth, true);
    assert.equal(cells[1].inMonth, true);
    assert.equal(cells[0].inMonth, false);
    assert.equal(cells[5].weekend, true);
    assert.equal(cells[6].weekend, true);
  });
});
