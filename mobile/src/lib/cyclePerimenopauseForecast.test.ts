import { test } from 'node:test';
import assert from 'node:assert/strict';
import { periForecastView } from './cyclePerimenopauseForecast.ts';

const range = { from: '2026-10-10', to: '2026-10-30' };
const base = (today: string, over: Record<string, unknown> = {}) => ({
  today,
  forecast: { status: 'range', range: { basedOn: 5 }, daysSinceBleeding: 20, ...over },
  predictions: { nextPeriodStart: '2026-10-18', nextPeriodRange: range },
});

test('a window ahead: „სავარაუდოდ“ + the range, the days until it, its basis — never one date', () => {
  const v = periForecastView(base('2026-10-05'));
  assert.equal(v.kind, 'range');
  assert.equal(v.state, 'before');
  assert.equal(v.title, 'სავარაუდოდ 10–30 ოქტ');
  assert.equal(v.detail, '5–25 დღეში');
  assert.equal(v.basis, 'შენი ბოლო 5 ციკლის მიხედვით · ერთ თარიღს არ ვამბობთ');
  assert.doesNotMatch(`${v.title} ${v.detail}`, /18 ოქტ/);
});

test('an open window: today or the next N days', () => {
  const v = periForecastView(base('2026-10-20'));
  assert.equal(v.state, 'open');
  assert.equal(v.title, 'სავარაუდოდ 10–30 ოქტ');
  assert.equal(v.detail, 'შეიძლება დაიწყოს დღეს ან მომდევნო 10 დღეში');
  assert.equal(periForecastView(base('2026-10-30')).detail, 'შეიძლება დაიწყოს დღეს — ფანჯრის ბოლო დღეა');
});

test('a passed window is calm — no „late“, no alarm', () => {
  const v = periForecastView(base('2026-11-03', { daysSinceBleeding: 45 }));
  assert.equal(v.state, 'late');
  assert.equal(v.title, 'სავარაუდო ფანჯარა გავიდა');
  assert.match(String(v.detail), /როცა დაიწყება, უბრალოდ აღნიშნე/);
  assert.doesNotMatch(`${v.title} ${v.detail}`, /გვიან|დაგვიან|late/i);
});

test('fewer than 2 cycles (or an older server): the honest „no date“ line', () => {
  const v = periForecastView({ today: '2026-10-05', forecast: { status: 'learning', range: null }, predictions: { nextPeriodStart: null, nextPeriodRange: null } });
  assert.equal(v.kind, 'learning');
  assert.equal(v.detail, 'სანამ რამდენიმე ციკლს არ დავითვლით, თარიღს არ ვამბობთ.');
  const old = periForecastView({ today: '2026-10-05', forecast: { status: undefined }, predictions: { nextPeriodStart: '2026-10-18', nextPeriodRange: null } });
  assert.equal(old.kind, 'learning');
});

test('a gap over 60 days: calm, „ესაუბრე ექიმს, თუ გაწუხებს“', () => {
  const v = periForecastView(base('2026-12-20', { status: 'long_gap', daysSinceBleeding: 75 }));
  assert.equal(v.kind, 'longGap');
  assert.equal(v.title, 'დიდი ხანია მენსტრუაცია არ ყოფილა');
  assert.equal(v.detail, 'ბოლო სისხლდენიდან 75 დღე გავიდა. ესაუბრე ექიმს, თუ გაწუხებს.');
});

test('12 months without bleeding: a doctor can confirm — never a diagnosis', () => {
  const v = periForecastView(base('2027-10-20', { status: 'no_bleeding_12m', daysSinceBleeding: 380 }));
  assert.equal(v.kind, 'noBleeding12m');
  assert.match(String(v.detail), /ექიმს შეუძლია დაადასტუროს/);
  assert.doesNotMatch(`${v.title} ${v.detail}`, /მენოპაუზაში ხარ|მენოპაუზა დადგა/);
});
