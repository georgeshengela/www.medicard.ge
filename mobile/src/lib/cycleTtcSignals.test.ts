import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cycleBbtReadings,
  cycleWristReadings,
  findThermalShift,
  ttcSignal,
  ttcSignalExplain,
  ttcSignalFromBundle,
  type TtcSignalInput,
  type TtcSignalLog,
} from './cycleTtcSignals.ts';
// One table for the app rule and its server mirror (server/src/lib/cycleTemperature.js).
import { SHIFT_CASES } from '../../../server/src/lib/cycleTemperature.cases.js';
import { findThermalShift as serverFindThermalShift } from '../../../server/src/lib/cycleTemperature.js';

function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const start = '2026-09-10';
const day = (n: number) => addDays(start, n - 1); // cycle day n

/** BBT on consecutive cycle days, beginning at `fromDay`. */
function temps(fromDay: number, values: number[]): TtcSignalLog[] {
  return values.map((bbt, i) => ({ date: day(fromDay + i), bbt }));
}

const LOW6 = [36.3, 36.35, 36.4, 36.3, 36.45, 36.35]; // coverline 36.45

function input(over: Partial<TtcSignalInput> = {}): TtcSignalInput {
  return {
    mode: 'TRY_TO_CONCEIVE',
    fertilityDisplay: true,
    locked: false,
    logs: [],
    periodStarts: ['2026-08-13', start],
    date: day(16),
    ...over,
  };
}

test('3 over 6: three readings each ≥ 0.20 °C above the highest of the previous six → thermal shift line', () => {
  const logs = temps(7, [...LOW6, 36.65, 36.7, 36.68]); // days 7–15
  const signal = ttcSignal(input({ logs, date: day(15) }));
  assert.equal(signal?.kind, 'thermalShift');
  assert.equal(signal?.days, 3);
  assert.match(signal!.text, /^BBT 3 დღეა მომატებულია — სავარაუდოდ ოვულაცია უკვე მოხდა$/);
  const shift = findThermalShift(cycleBbtReadings(logs, start, day(15)));
  assert.equal(shift?.coverline, 36.45);
  assert.equal(shift?.start, day(13));
});

test('edge: 0.19 °C above the coverline is not a rise, 0.20 is (no float noise)', () => {
  const just = temps(7, [...LOW6, 36.65, 36.65, 36.65]); // exactly +0.20
  assert.equal(ttcSignal(input({ logs: just, date: day(15) }))?.kind, 'thermalShift');
  const short = temps(7, [...LOW6, 36.65, 36.64, 36.65]); // one reading +0.19
  assert.equal(ttcSignal(input({ logs: short, date: day(15) })), null);
  // Float trap: 36.1 + 0.2 = 36.300000000000004 must still count as a rise.
  const trap = temps(7, [36.1, 36.0, 36.05, 36.1, 35.95, 36.0, 36.3, 36.3, 36.3]);
  assert.equal(ttcSignal(input({ logs: trap, date: day(15) }))?.kind, 'thermalShift');
});

test('fewer than 6 readings before the rise → no shift', () => {
  const logs = temps(8, [36.3, 36.35, 36.4, 36.3, 36.45, 36.7, 36.75, 36.7]); // only 5 before
  assert.equal(findThermalShift(cycleBbtReadings(logs, start, day(15))), null);
  assert.equal(ttcSignal(input({ logs, date: day(15) })), null);
});

test('only two high readings → no shift yet', () => {
  const logs = temps(7, [...LOW6, 36.7, 36.72]);
  assert.equal(ttcSignal(input({ logs, date: day(14) })), null);
});

test('a missed day does not break the run; readings from the previous cycle never count', () => {
  const logs: TtcSignalLog[] = [
    // previous cycle, high values — must be ignored
    { date: addDays(start, -3), bbt: 36.9 },
    { date: addDays(start, -2), bbt: 36.9 },
    ...temps(5, [36.3, 36.35]),
    ...temps(9, [36.4, 36.3, 36.45, 36.35]), // days 9–12 (6–8 not measured)
    { date: day(13), bbt: 36.7 },
    // day 14 not measured
    { date: day(15), bbt: 36.72 },
    { date: day(16), bbt: 36.7 },
  ];
  const signal = ttcSignal(input({ logs, date: day(16) }));
  assert.equal(signal?.kind, 'thermalShift');
  assert.equal(signal?.days, 3);
});

test('the run counts high readings and goes quiet when it breaks or goes stale', () => {
  const run = temps(7, [...LOW6, 36.7, 36.72, 36.7, 36.75, 36.68]); // days 7–17
  assert.equal(ttcSignal(input({ logs: run, date: day(17) }))?.days, 5);
  // Latest reading at day 17; two days later still shown, three days later not.
  assert.equal(ttcSignal(input({ logs: run, date: day(19) }))?.kind, 'thermalShift');
  assert.equal(ttcSignal(input({ logs: run, date: day(20) })), null);
  // Fell back to the coverline → nothing (and no OPK/mucus line either: a shift already happened).
  const broke = [...run, { date: day(18), bbt: 36.45, ovulationTest: 'positive', cervicalMucus: 'eggwhite' }];
  assert.equal(ttcSignal(input({ logs: broke, date: day(18) })), null);
});

test('readings after `date` and implausible values are ignored', () => {
  const logs = [...temps(7, [...LOW6, 36.7, 36.72]), { date: day(15), bbt: 36.7 }, { date: day(14), bbt: 3.67 }];
  assert.equal(ttcSignal(input({ logs, date: day(14) })), null);
  assert.equal(cycleBbtReadings(logs, start, day(14)).length, 8);
});

test('positive OPK today or yesterday without a shift → OPK line; two days ago or negative → nothing', () => {
  assert.equal(ttcSignal(input({ logs: [{ date: day(14), ovulationTest: 'positive' }], date: day(14) }))?.opkWhen, 'today');
  const y = ttcSignal(input({ logs: [{ date: day(13), ovulationTest: 'positive' }], date: day(14) }));
  assert.equal(y?.kind, 'opkPositive');
  assert.equal(y?.opkWhen, 'yesterday');
  assert.match(ttcSignal(input({ logs: [{ date: day(14), ovulationTest: 'positive' }], date: day(14) }))!.text, /^OPK დადებითია — ოვულაცია სავარაუდოდ მომდევნო 1–2 დღეშია$/);
  assert.equal(ttcSignal(input({ logs: [{ date: day(12), ovulationTest: 'positive' }], date: day(14) })), null);
  assert.equal(ttcSignal(input({ logs: [{ date: day(14), ovulationTest: 'negative' }], date: day(14) })), null);
  assert.equal(ttcSignal(input({ logs: [{ date: day(14), ovulationTest: 'unclear' }], date: day(14) })), null);
  // Yesterday in the previous cycle does not count on cycle day 1.
  assert.equal(ttcSignal(input({ logs: [{ date: addDays(start, -1), ovulationTest: 'positive' }], date: start })), null);
});

test('egg-white or watery mucus today → mucus line; other types or yesterday → nothing', () => {
  for (const m of ['eggwhite', 'watery']) {
    const s = ttcSignal(input({ logs: [{ date: day(13), cervicalMucus: m }], date: day(13) }));
    assert.equal(s?.kind, 'fertileMucus', m);
    assert.match(s!.text, /^ლორწო ნაყოფიერ დღეებს ჰგავს/);
  }
  for (const m of ['dry', 'sticky', 'creamy']) assert.equal(ttcSignal(input({ logs: [{ date: day(13), cervicalMucus: m }], date: day(13) })), null, m);
  assert.equal(ttcSignal(input({ logs: [{ date: day(12), cervicalMucus: 'eggwhite' }], date: day(13) })), null);
});

test('priority: thermal shift > OPK > mucus', () => {
  const shift = temps(7, [...LOW6, 36.7, 36.72, 36.7]);
  const today = day(15);
  const all = [...shift.slice(0, -1), { ...shift[shift.length - 1], ovulationTest: 'positive', cervicalMucus: 'eggwhite' }];
  assert.equal(ttcSignal(input({ logs: all, date: today }))?.kind, 'thermalShift');
  const noShift = [{ date: today, ovulationTest: 'positive', cervicalMucus: 'eggwhite' }];
  assert.equal(ttcSignal(input({ logs: noShift, date: today }))?.kind, 'opkPositive');
  assert.equal(ttcSignal(input({ logs: [{ date: today, cervicalMucus: 'watery' }], date: today }))?.kind, 'fertileMucus');
});

test('gates: only TTC, only with the fertile-days display, never while locked, never without a cycle start', () => {
  const logs = [{ date: day(14), ovulationTest: 'positive' }];
  const base = input({ logs, date: day(14) });
  assert.ok(ttcSignal(base));
  for (const mode of ['TRACK_PERIOD', 'PREGNANCY', 'POSTPARTUM', 'PERIMENOPAUSE', null]) {
    assert.equal(ttcSignal({ ...base, mode }), null, String(mode));
  }
  assert.equal(ttcSignal({ ...base, fertilityDisplay: false }), null);
  assert.equal(ttcSignal({ ...base, locked: true }), null);
  assert.equal(ttcSignal({ ...base, periodStarts: [] }), null);
  assert.equal(ttcSignal({ ...base, date: 'today' }), null);
});

test('from a bundle: TTC on → line; track mode or hormonal contraception hiding fertility → nothing', () => {
  const logs = [{ date: day(14), ovulationTest: 'positive', bbt: null, cervicalMucus: null }];
  const bundle = { profile: { mode: 'TRY_TO_CONCEIVE' }, logs, inferred: { periodStarts: ['2026-08-13', start] } } as never;
  assert.equal(ttcSignalFromBundle(bundle, day(14), { locked: false })?.kind, 'opkPositive');
  assert.equal(ttcSignalFromBundle(bundle, day(14), { locked: true }), null);
  const track = { profile: { mode: 'TRACK_PERIOD' }, logs, inferred: { periodStarts: [start] } } as never;
  assert.equal(ttcSignalFromBundle(track, day(14), { locked: false }), null);
  const hidden = {
    profile: { mode: 'TRY_TO_CONCEIVE' },
    logs,
    inferred: { periodStarts: [start] },
    contraception: { presentation: { showFertilityMarkers: false, showFertileWindow: false } },
  } as never;
  assert.equal(ttcSignalFromBundle(hidden, day(14), { locked: false }), null);
  assert.equal(ttcSignalFromBundle(null, day(14), { locked: false }), null);
});

test('copy is hedged, never a diagnosis and never mentions sex; the explain sheet says it is not contraception', () => {
  const lines = [
    ttcSignal(input({ logs: temps(7, [...LOW6, 36.7, 36.72, 36.7]), date: day(15) }))!.text,
    ttcSignal(input({ logs: [{ date: day(14), ovulationTest: 'positive' }], date: day(14) }))!.text,
    ttcSignal(input({ logs: [{ date: day(13), ovulationTest: 'positive' }], date: day(14) }))!.text,
    ttcSignal(input({ logs: [{ date: day(14), cervicalMucus: 'eggwhite' }], date: day(14) }))!.text,
  ];
  for (const line of lines) {
    assert.match(line, /სავარაუდო/, line);
    assert.doesNotMatch(line, /დადასტურ|დიაგნოზ|სექს|sex/i, line);
  }
  for (const kind of ['thermalShift', 'opkPositive', 'fertileMucus'] as const) {
    const e = ttcSignalExplain(kind);
    const all = [e.title, ...e.body, e.caption].join(' ');
    assert.match(all, /არა კონტრაცეფციის მეთოდი/);
    assert.match(all, /ესაუბრე ექიმს/);
    assert.doesNotMatch(all, /დადასტურ|სექს/);
    assert.deepEqual([...e.sourceIds], ['menstrualCycle']);
  }
  assert.match(ttcSignalExplain('thermalShift').body.join(' '), /0\.2 °C/);
});

test('privacy: only the cycle TTC card, the line/sheet component and the day sheet import the module', () => {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const allowed = new Set([
    'src/components/cycle/CycleTtcCard.tsx',
    'src/components/cycle/CycleTtcSignalLine.tsx',
    'src/components/cycle/CycleDaySheet.tsx',
  ]);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (
        /\.(tsx?|jsx?|mjs|cjs)$/.test(name)
        && !/\.test\./.test(name)
        && /(from|import|require)\s*\(?\s*['"][^'"]*(cycleTtcSignals|CycleTtcSignalLine)['"]/.test(readFileSync(full, 'utf8'))
      ) {
        hits.push(relative(root, full).split(sep).join('/'));
      }
    }
  };
  walk(join(root, 'src'));
  walk(join(root, 'app'));
  for (const file of hits) assert.ok(allowed.has(file), `${file} must not read the TTC signs (AI / partner / analytics / push / Home)`);
  assert.ok(hits.includes('src/components/cycle/CycleTtcCard.tsx'));
  assert.ok(hits.includes('src/components/cycle/CycleDaySheet.tsx'));
});

test('thermal shift: the shared table — the app rule and the server mirror agree case by case', () => {
  for (const c of SHIFT_CASES as readonly { name: string; readings: [number, number][]; expect: null | { startDay: number; days: number; coverline: number; ongoing: boolean } }[]) {
    const mine = findThermalShift(c.readings.map(([d, bbt]) => ({ date: day(d), bbt })));
    const server = serverFindThermalShift(c.readings.map(([d, value]) => ({ date: day(d), value })));
    assert.deepEqual(mine, server, c.name);
    if (!c.expect) {
      assert.equal(mine, null, c.name);
      continue;
    }
    assert.equal(mine?.start, day(c.expect.startDay), c.name);
    assert.equal(mine?.days, c.expect.days, c.name);
    assert.equal(mine?.coverline, c.expect.coverline, c.name);
    assert.equal(mine?.ongoing, c.expect.ongoing, c.name);
  }
});

test('wrist temperature (from Health): its own line when BBT shows no shift — never read as BBT', () => {
  const deltas = [-0.3, -0.25, -0.2, -0.3, -0.15, -0.25, 0.1, 0.15, 0.2];
  const logs: TtcSignalLog[] = deltas.map((delta, i) => ({ date: day(7 + i), observations: { wristTempDelta: delta } }));
  assert.deepEqual(cycleBbtReadings(logs, start, day(15)), []);
  assert.equal(cycleWristReadings(logs, start, day(15)).length, 9);
  const signal = ttcSignal(input({ logs, date: day(15) }));
  assert.equal(signal?.kind, 'thermalShift');
  assert.equal(signal?.basis, 'wrist');
  assert.equal(signal?.text, 'მაჯის ტემპერატურა 3 ღამეა მომატებულია — სავარაუდოდ ოვულაცია უკვე მოხდა');
  // BBT wins when both show a shift.
  const both = [...logs, ...temps(7, [...LOW6, 36.65, 36.7, 36.68])].reduce<TtcSignalLog[]>((acc, l) => {
    const prev = acc.find((x) => x.date === l.date);
    if (prev) Object.assign(prev, l.bbt != null ? { bbt: l.bbt } : {}, l.observations ? { observations: l.observations } : {});
    else acc.push({ ...l });
    return acc;
  }, []);
  assert.equal(ttcSignal(input({ logs: both, date: day(15) }))?.basis, 'bbt');
  // Implausible deviations are skipped.
  assert.deepEqual(cycleWristReadings([{ date: day(8), observations: { wristTempDelta: 4 } }], start, day(15)), []);
});
