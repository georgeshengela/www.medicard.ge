import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  TEMPERATURE_IMPORT_THROTTLE_MS,
  bbtForHealthWrite,
  dailyBbt,
  dailyWristDeltas,
  deltaToCelsius,
  planTemperatureReadings,
  shouldImportTemperature,
  temperatureRowLabel,
  toCelsius,
  type HealthTemperatureRead,
} from './cycleTemperatureImport.ts';
import { OBSERVATION_BAG_KEYS, isBbtFromHealth } from './cycleObservationRegistry.ts';

const require = createRequire(import.meta.url);
const { typedBbtBag, withoutImportKeys } = require('./cycleOfflineCore.js');

const TODAY = '2026-09-20';
/** Local noon / morning instants so the day key never depends on the test machine's time zone. */
const at = (day: string, hour = 7) => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00`);
const empty: HealthTemperatureRead = { bbt: [], wrist: [], wristDeltas: [] };

test('units: °F → °C for readings, deltas without the 32 offset', () => {
  assert.equal(Math.round(toCelsius(97.7, 'degF') * 100) / 100, 36.5);
  assert.equal(toCelsius(36.5), 36.5);
  assert.equal(Math.round(deltaToCelsius(0.9, 'degF') * 100) / 100, 0.5);
});

test('BBT per day: the first reading of the morning, plausible 35–39 °C only', () => {
  const days = dailyBbt([
    { at: at('2026-09-18', 9), value: 36.9 },
    { at: at('2026-09-18', 6), value: 36.45 },
    { at: at('2026-09-17'), value: 97.7, unit: 'degF' },
    { at: at('2026-09-16'), value: 34.2 },
    { at: at('2026-09-15'), value: 39.4 },
    { at: 'not a date', value: 36.5 },
  ]);
  assert.deepEqual([...days.entries()].sort(), [['2026-09-17', 36.5], ['2026-09-18', 36.45]]);
});

test('wrist: Health Connect deltas as they are; iOS absolute nights become deviations from her median', () => {
  const android = dailyWristDeltas({ wrist: [], wristDeltas: [{ at: at('2026-09-18'), delta: 0.2 }, { at: at('2026-09-18', 8), delta: 0.4 }] });
  assert.deepEqual([...android.entries()], [['2026-09-18', 0.3]]);
  const nights = [35.1, 35.2, 35.0, 35.1, 35.4, 35.5].map((value, i) => ({ at: at(`2026-09-1${i + 1}`), value }));
  const ios = dailyWristDeltas({ wrist: nights, wristDeltas: [] });
  assert.equal(ios.size, 6);
  assert.equal(ios.get('2026-09-15'), 0.25); // median 35.15
  assert.equal(ios.get('2026-09-13'), -0.15);
  // Fewer than 5 nights: no baseline, nothing.
  assert.equal(dailyWristDeltas({ wrist: nights.slice(0, 4), wristDeltas: [] }).size, 0);
  // Out of range deviations are dropped.
  assert.equal(dailyWristDeltas({ wrist: [], wristDeltas: [{ at: at('2026-09-18'), delta: 3 }] }).size, 0);
});

test('plan: her typed BBT always wins; imported values refresh only when changed; dedupe by day', () => {
  const read: HealthTemperatureRead = {
    ...empty,
    bbt: [
      { at: at('2026-09-10'), value: 36.4 },
      { at: at('2026-09-11'), value: 36.9 },
      { at: at('2026-09-12'), value: 36.5 },
      { at: at('2026-09-13'), value: 36.62 },
      { at: at('2026-09-13', 9), value: 37.1 },
    ],
  };
  const logs = [
    { date: '2026-09-11', bbt: 36.3, observations: {} },
    { date: '2026-09-12', bbt: 36.5, observations: { bbtSource: 'health' } },
    { date: '2026-09-13', bbt: 36.5, observations: { bbtSource: 'health' } },
  ];
  assert.deepEqual(planTemperatureReadings({ logs, read, today: TODAY }), [
    { date: '2026-09-10', bbt: 36.4 },
    { date: '2026-09-13', bbt: 36.62 },
  ]);
});

test('plan: a wrist deviation is only ever wristTempDelta — never BBT', () => {
  const read: HealthTemperatureRead = { ...empty, wristDeltas: [{ at: at('2026-09-15'), delta: 0.234 }] };
  const plan = planTemperatureReadings({ logs: [], read, today: TODAY });
  assert.deepEqual(plan, [{ date: '2026-09-15', wristTempDelta: 0.23 }]);
  assert.equal('bbt' in plan[0], false);
  // Unchanged → nothing to send.
  assert.deepEqual(planTemperatureReadings({ logs: [{ date: '2026-09-15', observations: { wristTempDelta: 0.23 } }], read, today: TODAY }), []);
});

test('plan: only the last 40 days, never the future', () => {
  const read: HealthTemperatureRead = {
    ...empty,
    bbt: [
      { at: at('2026-08-11'), value: 36.4 },
      { at: at('2026-08-12'), value: 36.4 },
      { at: at('2026-09-21'), value: 36.4 },
    ],
  };
  assert.deepEqual(planTemperatureReadings({ logs: [], read, today: TODAY }).map((r) => r.date), ['2026-08-12']);
});

test('throttle: on + a temperature mode + supported, at most once per 6 h', () => {
  const now = Date.UTC(2026, 8, 20, 12);
  const base = { enabled: true, mode: 'TRY_TO_CONCEIVE', supported: true, now };
  assert.equal(shouldImportTemperature({ ...base, lastAt: null }), true);
  assert.equal(shouldImportTemperature({ ...base, lastAt: 0 }), true);
  assert.equal(shouldImportTemperature({ ...base, lastAt: now - TEMPERATURE_IMPORT_THROTTLE_MS + 1 }), false);
  assert.equal(shouldImportTemperature({ ...base, lastAt: now - TEMPERATURE_IMPORT_THROTTLE_MS }), true);
  assert.equal(shouldImportTemperature({ ...base, lastAt: now + 60_000 }), false, 'a clock set back does not open the gate');
  assert.equal(shouldImportTemperature({ ...base, mode: 'TRACK_PERIOD', lastAt: null }), true);
  for (const mode of ['PREGNANCY', 'POSTPARTUM', 'PERIMENOPAUSE', null]) {
    assert.equal(shouldImportTemperature({ ...base, mode, lastAt: null }), false, String(mode));
  }
  assert.equal(shouldImportTemperature({ ...base, enabled: false, lastAt: null }), false);
  assert.equal(shouldImportTemperature({ ...base, supported: false, lastAt: null }), false);
});

test('a typed BBT clears the „from Health“ flag in the offline overlay too; import keys never ride a log write', () => {
  const prev = { bbt: 36.5 };
  assert.deepEqual(typedBbtBag(prev, { bbt: 36.7 }, { bbtSource: 'health', energy: 'low' }), { energy: 'low' });
  assert.deepEqual(typedBbtBag(prev, { bbt: null }, { bbtSource: 'health' }), {});
  assert.deepEqual(typedBbtBag(prev, { bbt: 36.5 }, { bbtSource: 'health' }), { bbtSource: 'health' });
  assert.deepEqual(typedBbtBag(prev, {}, { bbtSource: 'health' }), { bbtSource: 'health' });
  assert.deepEqual(withoutImportKeys({ bbtSource: 'health', wristTempDelta: 0.2, energy: 'low' }), { energy: 'low' });
});

test('an imported BBT saved unchanged is never written back to Health', () => {
  assert.equal(bbtForHealthWrite(36.5, 36.5), null);
  assert.equal(bbtForHealthWrite(36.55, 36.5), 36.55);
  assert.equal(bbtForHealthWrite(36.5, null), 36.5);
  assert.equal(bbtForHealthWrite(null, 36.5), null);
  assert.equal(isBbtFromHealth({ bbtSource: 'health' }), true);
  assert.equal(isBbtFromHealth({}), false);
});

test('registry mirror: both keys SENSITIVE, never AI / partner / analytics', () => {
  for (const key of ['bbtSource', 'wristTempDelta'] as const) {
    assert.deepEqual(OBSERVATION_BAG_KEYS[key], { sensitivity: 'SENSITIVE', ai: false, partner: false, analytics: false });
  }
});

test('copy names the platform', () => {
  assert.equal(temperatureRowLabel('ios'), 'ტემპერატურა Apple Health-იდან');
  assert.equal(temperatureRowLabel('android'), 'ტემპერატურა Health Connect-იდან');
});

test('OS access is asked only from the settings switch — never from the focus import or an effect', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  const row = read('../components/cycle/settings/CycleTemperatureRow.tsx');
  const sync = read('./cycleTemperatureSync.ts');
  const screen = read('../../app/cycle/index.tsx');
  const facade = read('./healthSync.ts');
  const ios = read('./healthSyncPlatform.ios.ts');
  const android = read('./healthSyncPlatform.android.ts');
  // The row: the request sits in `requestAccess`, reached from the primer's Continue or the switch.
  assert.match(row, /connectHealthTemperature\(\)/);
  assert.match(row, /primerCopy\('temperature'\)/);
  assert.match(row, /onContinue=\{\(\) => void requestAccess\(\)\}/);
  const effects = row.match(/useEffect\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];
  for (const effect of effects) assert.doesNotMatch(effect, /connectHealthTemperature|requestAccess/);
  assert.doesNotMatch(row, /from 'react-native'[^;]*\bModal\b|<Modal/, 'in-window overlay so the Health sheet can present');
  // The focus import and the screen only read.
  for (const text of [sync, screen]) {
    assert.doesNotMatch(text, /connectHealthTemperature|connectTemperatureNative|requestAuthorization|requestPermission/);
  }
  assert.match(sync, /readHealthTemperature/);
  // The readers never ask.
  for (const text of [ios, android]) {
    const fetch = text.slice(text.indexOf('export async function fetchTemperatureNative'));
    assert.doesNotMatch(fetch, /requestAuthorization|requestPermission/);
    assert.match(text, /export async function connectTemperatureNative/);
  }
  const readFn = facade.slice(facade.indexOf('export async function readHealthTemperature'));
  assert.doesNotMatch(readFn, /connectTemperatureNative|requestAuthorization|requestPermission/);
  // The last-run time is written before Health is read (no loop even if the read crashes).
  assert.ok(sync.indexOf('setPreference(lastKey(userId), String(now))') < sync.indexOf('readHealthTemperature(since)'));
});

test('native config: Android skin temperature permission; reanimated sync UI props on Android', () => {
  const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
  const app = JSON.parse(read('../../app.json'));
  assert.ok(app.expo.android.permissions.includes('android.permission.health.READ_SKIN_TEMPERATURE'));
  assert.ok(app.expo.android.permissions.includes('android.permission.health.READ_BASAL_BODY_TEMPERATURE'));
  assert.match(read('../../plugins/withHealthConnect.js'), /READ_SKIN_TEMPERATURE/);
  const pkg = JSON.parse(read('../../package.json'));
  assert.equal(pkg.reanimated.staticFeatureFlags.ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS, true);
  assert.notEqual(pkg.reanimated.staticFeatureFlags.ENABLE_SHARED_ELEMENT_TRANSITIONS, true, 'cannot be on together');
});
