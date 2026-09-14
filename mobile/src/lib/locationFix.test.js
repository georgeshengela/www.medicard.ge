import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coordsAgreeWithDeviceTimezone,
  isCachedCaucasusFix,
  isFreshLocationTimestamp,
  isInGeorgiaBox,
  MAX_LOCATION_FIX_AGE_MS,
  pickLiveLocationFix,
} from './locationFix.ts';

const TBILISI = { lat: 41.7151, lng: 44.8271, accuracy: 18, fixAt: 0 };
const LIEGE = { lat: 50.6326, lng: 5.5797, accuracy: 22, fixAt: 0 };

describe('isFreshLocationTimestamp', () => {
  it('keeps a live GPS stamp and rejects a Tbilisi-age last-known cache', () => {
    const now = Date.parse('2026-09-14T12:00:00.000Z');
    assert.equal(isFreshLocationTimestamp(now - 8_000, now), true);
    assert.equal(isFreshLocationTimestamp(now - MAX_LOCATION_FIX_AGE_MS - 1, now), false);
    assert.equal(isFreshLocationTimestamp(undefined, now), false);
  });
});

describe('pickLiveLocationFix', () => {
  it('prefers live Liège over a Tbilisi last-known even if the clock is still Tbilisi', () => {
    const now = Date.parse('2026-09-14T19:00:00.000Z');
    const picked = pickLiveLocationFix(
      [
        { ...TBILISI, fixAt: now - 4_000 },
        { ...LIEGE, fixAt: now - 1_000 },
      ],
      'Asia/Tbilisi',
      now,
    );
    assert.equal(picked?.lat, LIEGE.lat);
    assert.equal(picked?.lng, LIEGE.lng);
  });

  it('drops a lone Tbilisi sample when the phone is already on Brussels time', () => {
    const now = Date.parse('2026-09-14T19:00:00.000Z');
    assert.equal(isInGeorgiaBox(TBILISI.lat, TBILISI.lng), true);
    assert.equal(isCachedCaucasusFix(TBILISI.lat, TBILISI.lng, 'Europe/Brussels'), true);
    assert.equal(coordsAgreeWithDeviceTimezone(LIEGE.lat, LIEGE.lng, 'Europe/Brussels'), true);
    assert.equal(
      pickLiveLocationFix([{ ...TBILISI, fixAt: now - 2_000 }], 'Europe/Brussels', now),
      null,
    );
  });

  it('keeps Tbilisi when the traveler is actually still on Asia/Tbilisi time', () => {
    const now = Date.parse('2026-09-14T19:00:00.000Z');
    const picked = pickLiveLocationFix(
      [{ ...TBILISI, fixAt: now - 2_000 }],
      'Asia/Tbilisi',
      now,
    );
    assert.equal(picked?.lat, TBILISI.lat);
  });
});
