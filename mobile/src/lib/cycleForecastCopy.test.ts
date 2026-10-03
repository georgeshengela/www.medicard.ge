import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  learningBadgeText,
  ovulationBandLine,
  ovulationMarkLabel,
  ovulationSourceLabel,
  shortDateRange,
  statsLearningChip,
  wideWindowLabel,
} from './cycleForecastCopy.ts';
import { isOvulationMarked, OBSERVATION_BAG_KEYS, ovulationMarkPatch } from './cycleObservationRegistry.ts';
import { OBSERVATION_REGISTRY, STORAGE } from '../../../server/src/lib/cycleObservationRegistry.js';

test('learning badge: „ვსწავლობთ შენს რიტმს · N/3 ციკლი“, clamped', () => {
  assert.equal(learningBadgeText(2), 'ვსწავლობთ შენს რიტმს · 2/3 ციკლი');
  assert.equal(learningBadgeText(0), 'ვსწავლობთ შენს რიტმს · 0/3 ციკლი');
  assert.equal(learningBadgeText(7), 'ვსწავლობთ შენს რიტმს · 3/3 ციკლი');
  assert.equal(statsLearningChip(2), 'ვსწავლობთ · 2/3');
  assert.equal(wideWindowLabel(), 'ფართო დიაპაზონი, სანამ 3 ციკლს დავითვლით');
});

test('ovulation is always a band with its source', () => {
  assert.equal(shortDateRange('2026-10-13', '2026-10-15', false), '13–15 ოქტ');
  assert.equal(shortDateRange('2026-09-30', '2026-10-02', true), '30 Sep – 2 Oct');
  assert.equal(ovulationBandLine({ start: '2026-10-13', end: '2026-10-15' }), 'სავარაუდო ოვულაცია · 13–15 ოქტ');
  assert.equal(ovulationBandLine({ start: '2026-10-13', end: '2026-10-15' }, 'opk'), 'სავარაუდო ოვულაცია · 13–15 ოქტ · OPK-ის მიხედვით');
  assert.equal(ovulationSourceLabel('manual'), 'შენი აღნიშვნით');
  assert.equal(ovulationSourceLabel('calendar'), null);
  assert.equal(ovulationMarkLabel(), 'ოვულაცია ამ დღეს იყო');
});

test('ovulationMarked: the mobile bag keys mirror the server registry (same sensitivity, never AI / partner / analytics)', () => {
  const serverBag = Object.values(OBSERVATION_REGISTRY).filter((def) => def.storage === STORAGE.OBSERVATIONS && def.enabled);
  assert.deepEqual(serverBag.map((def) => def.key).sort(), Object.keys(OBSERVATION_BAG_KEYS).sort());
  for (const def of serverBag) {
    const mine = OBSERVATION_BAG_KEYS[def.key as keyof typeof OBSERVATION_BAG_KEYS];
    assert.equal(mine.sensitivity, def.sensitivity, def.key);
    assert.equal(mine.ai, def.aiDefaultAllowed, def.key);
    assert.equal(mine.partner, def.partnerDefaultAllowed, def.key);
    assert.equal(mine.analytics, def.analyticsAllowed, def.key);
  }
  assert.equal(OBSERVATION_BAG_KEYS.ovulationMarked.sensitivity, 'SENSITIVE');
});

test('ovulationMarked: a save sends true / null, never touches a mark it did not change', () => {
  assert.deepEqual(ovulationMarkPatch(true), { ovulationMarked: true });
  assert.deepEqual(ovulationMarkPatch(false), { ovulationMarked: null });
  assert.deepEqual(ovulationMarkPatch(null), {});
  assert.deepEqual(ovulationMarkPatch(undefined), {});
  assert.equal(isOvulationMarked({ ovulationMarked: true }), true);
  assert.equal(isOvulationMarked({ ovulationMarked: null }), false);
  assert.equal(isOvulationMarked(null), false);
});
