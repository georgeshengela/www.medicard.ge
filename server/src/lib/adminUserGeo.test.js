import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryCentroid,
  phoneCountry,
  sanitizeMapboxPublicToken,
  shapeGeoCountries,
  timezoneCountry,
  userCountry,
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

describe('userCountry', () => {
  it('trusts shared location, then the phone code, then the time zone', () => {
    assert.deepEqual(userCountry({ locationCode: 'be', phone: '+995555000000', timezone: 'Asia/Tbilisi' }), { code: 'BE', source: 'location' });
    assert.deepEqual(userCountry({ phone: '+995 555 12 34 56', timezone: 'Europe/Brussels' }), { code: 'GE', source: 'phone' });
    assert.deepEqual(userCountry({ email: '995599001122@phone.medicard.ge' }), { code: 'GE', source: 'phone' });
    assert.deepEqual(userCountry({ email: 'a@b.ge', timezone: 'Europe/Brussels' }), { code: 'BE', source: 'timezone' });
    assert.equal(userCountry({ email: 'a@b.ge', timezone: 'Etc/UTC' }), null);
  });

  it('picks the longest calling code and ignores short numbers', () => {
    assert.equal(phoneCountry('+380501112233'), 'UA');
    assert.equal(phoneCountry('+79161234567'), 'RU');
    assert.equal(phoneCountry('12345'), null);
    assert.equal(timezoneCountry('Europe/Kyiv'), 'UA');
  });
});
