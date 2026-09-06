import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cityNameKa,
  countryNameKa,
  flagEmoji,
  formatPlaceLine,
  metersBetween,
  resolvePlace,
} from './geoPlace.ts';

const KA = {
  georgia: 'საქართველო',
  azerbaijan: 'აზერბაიჯანი',
  tbilisi: 'თბილისი',
  batumi: 'ბათუმი',
  kutaisi: 'ქუთაისი',
  ozurgeti: 'ოზურგეთი',
};

describe('geoPlace', () => {
  it('maps ISO codes to Georgian country names and flags', () => {
    assert.equal(countryNameKa('ge'), KA.georgia);
    assert.equal(countryNameKa('AZ'), KA.azerbaijan);
    assert.equal(flagEmoji('GE'), '🇬🇪');
  });

  it('translates common Georgian cities from Latin or Mkhedruli', () => {
    assert.equal(cityNameKa('Tbilisi'), KA.tbilisi);
    assert.equal(cityNameKa('batumi'), KA.batumi);
    assert.equal(cityNameKa(KA.kutaisi), KA.kutaisi);
    assert.equal(cityNameKa('Ozurgeti'), KA.ozurgeti);
  });

  it('resolves a live GPS place into a profile line', () => {
    const place = resolvePlace({
      countryCode: 'ge',
      countryName: 'Georgia',
      city: 'Tbilisi',
    });
    assert.deepEqual(place, {
      countryCode: 'GE',
      countryKa: KA.georgia,
      cityKa: KA.tbilisi,
    });
    assert.equal(formatPlaceLine(place), `🇬🇪 ${KA.tbilisi}, ${KA.georgia}`);
  });

  it('measures a 2 km move so reverse-geocode can stay cheap', () => {
    const rustaveli = { lat: 41.6938, lng: 44.8015 };
    const nearby = { lat: 41.6942, lng: 44.802 };
    const vake = { lat: 41.709, lng: 44.753 };
    assert.ok(metersBetween(rustaveli, nearby) < 200);
    assert.ok(metersBetween(rustaveli, vake) > 2000);
  });
});
