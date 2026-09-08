import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryCentroid,
  sanitizeMapboxPublicToken,
  shapeGeoCountries,
} from './adminUserGeoShape.js';

describe('sanitizeMapboxPublicToken', () => {
  it('keeps only public pk tokens', () => {
    assert.equal(sanitizeMapboxPublicToken('pk.abc'), 'pk.abc');
    assert.equal(sanitizeMapboxPublicToken('  pk.live  '), 'pk.live');
    assert.equal(sanitizeMapboxPublicToken('sk.secret'), '');
    assert.equal(sanitizeMapboxPublicToken(''), '');
  });
});

describe('countryCentroid', () => {
  it('returns lng/lat for Georgia and ignores case', () => {
    assert.deepEqual(countryCentroid('ge'), { lng: 43.5, lat: 42.0 });
    assert.equal(countryCentroid('zz'), null);
  });
});

describe('shapeGeoCountries', () => {
  it('aggregates ISO codes, uses Georgian names, and never invents GPS', () => {
    const rows = shapeGeoCountries([
      { countryCode: 'ge', countryKa: 'საქართველო', users: 3 },
      { countryCode: 'GE', users: 2 },
      { countryCode: 'DE', countryKa: 'გერმანია', users: 1 },
      { countryCode: 'nope', users: 9 },
      { countryCode: 'US', users: 0 },
    ]);
    assert.equal(rows.length, 2);
    assert.deepEqual(
      rows.map((r) => r.code),
      ['GE', 'DE'],
    );
    assert.equal(rows[0].users, 5);
    assert.equal(rows[0].nameKa, 'საქართველო');
    assert.equal(rows[0].lng, 43.5);
    assert.equal(rows[1].nameKa, 'გერმანია');
  });
});
