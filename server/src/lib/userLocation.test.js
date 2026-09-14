import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  didMoveFar,
  geocodeAppliesToRow,
  isHomePlaceWrite,
  isImplausibleJump,
  isLiveLocationPing,
  isStaleLocationFixAt,
  MAX_LOCATION_FIX_AGE_MS,
  resolveStoredPlace,
  snapshotFromRow,
} from './userLocationPlace.js';

const TBILISI = { lat: 41.7151, lng: 44.8271 };
const LIEGE = { lat: 50.6326, lng: 5.5797 };

describe('user location place writes', () => {
  it('treats an old GPS timestamp as stale and a live stamp as fresh', () => {
    const now = Date.parse('2026-09-14T12:00:00.000Z');
    assert.equal(isStaleLocationFixAt(undefined, now), true);
    assert.equal(isStaleLocationFixAt(now - 5_000, now), false);
    assert.equal(isStaleLocationFixAt(now - MAX_LOCATION_FIX_AGE_MS - 1, now), true);
  });

  it('detects Tbilisi → Liège as a far move and refuses a late Tbilisi geocode', () => {
    const now = Date.parse('2026-09-14T12:00:00.000Z');
    assert.equal(didMoveFar(TBILISI, LIEGE.lat, LIEGE.lng), true);
    assert.equal(geocodeAppliesToRow({ lat: LIEGE.lat, lng: LIEGE.lng }, TBILISI.lat, TBILISI.lng), false);
    assert.equal(geocodeAppliesToRow({ lat: LIEGE.lat, lng: LIEGE.lng }, LIEGE.lat, LIEGE.lng), true);
    const justWroteLiege = { ...LIEGE, updatedAt: new Date(now) };
    assert.equal(isImplausibleJump(justWroteLiege, TBILISI.lat, TBILISI.lng, now + 8_000), true);
    assert.equal(
      isImplausibleJump({ ...LIEGE, updatedAt: new Date(now - 16 * 60 * 1000) }, TBILISI.lat, TBILISI.lng, now),
      false,
    );
  });

  it('clears Tbilisi instead of keeping it on Belgian coordinates', () => {
    const current = {
      countryCode: 'GE',
      countryKa: 'საქართველო',
      cityKa: 'თბილისი',
    };
    assert.deepEqual(resolveStoredPlace({ current, geocoded: null, movedFar: true }), {
      countryCode: null,
      countryKa: null,
      cityKa: null,
    });
    assert.deepEqual(
      resolveStoredPlace({
        current,
        geocoded: { countryCode: 'BE', countryKa: 'ბელგია', cityKa: 'ლიეჟი' },
        movedFar: true,
      }),
      { countryCode: 'BE', countryKa: 'ბელგია', cityKa: 'ლიეჟი' },
    );
  });

  it('does not resurrect extraAnswers Tbilisi after UserLocation city is cleared', () => {
    const snap = snapshotFromRow(
      { ...LIEGE, countryCode: null, countryKa: null, cityKa: null, enabled: true, updatedAt: new Date() },
      {
        location: {
          countryCode: 'GE',
          countryKa: 'საქართველო',
          cityKa: 'თბილისი',
          lat: TBILISI.lat,
          lng: TBILISI.lng,
        },
      },
    );
    assert.equal(snap.cityKa, null);
    assert.equal(snap.countryCode, null);
    assert.equal(snap.lat, LIEGE.lat);
  });

  it('writes home city only on grant, never on heartbeat/watch', () => {
    assert.equal(isHomePlaceWrite('grant'), true);
    assert.equal(isHomePlaceWrite('heartbeat'), false);
    assert.equal(isHomePlaceWrite('watch'), false);
    assert.equal(isLiveLocationPing('heartbeat'), true);
    assert.equal(isLiveLocationPing('watch'), true);
    assert.equal(isLiveLocationPing(null), true);
    assert.equal(isLiveLocationPing('grant'), false);
    assert.equal(isLiveLocationPing('skip'), false);
    assert.equal(isLiveLocationPing('revoke'), false);
  });
});
