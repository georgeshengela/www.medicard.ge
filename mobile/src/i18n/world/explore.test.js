'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { exploreCopy, exploreCopyTables, EXPLORE_COPY_KEYS } = require('./explore.js');

describe('Explore i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = exploreCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...EXPLORE_COPY_KEYS].sort());
    }
  });

  it('keeps Georgian and English safety copy non-legalistic', () => {
    assert.match(exploreCopy('ka').introTitle, /საჯარო/);
    assert.match(exploreCopy('en').introLead, /does not choose a safe walking route/i);
    assert.equal(exploreCopy('en').introLead.toLowerCase().includes('liable'), false);
    assert.equal(exploreCopy('ka').foundCount.includes('XP'), false);
    assert.equal(exploreCopy('en').successBody.toLowerCase().includes('health score'), true);
    assert.equal(exploreCopy('ka').fixtureBadge.toLowerCase().includes('fixture'), false);
    assert.equal(exploreCopy('en').fixtureBadge.toLowerCase().includes('fixture'), false);
    assert.match(exploreCopy('ka').distanceM, /\{n\}/);
    assert.equal(exploreCopy('ka').denied.includes('შეგიძლია სია ნახო'), false);
    assert.equal(exploreCopy('ka').denied.includes('ვერ განახლდება'), false);
    assert.equal(
      exploreCopy('ka').denied,
      'ადგილმდებარეობაზე წვდომა გამორთულია. რუკაზე ხელით გადაადგილება შეგიძლია. ახლოს აღება მხოლოდ ნებართვის შემდეგ.',
    );
    assert.equal(exploreCopy('ka').timeout, 'მდებარეობა ვერ განისაზღვრა. სცადე ხელახლა.');
    assert.equal(
      exploreCopy('ka').snapshotOnly,
      'ნაჩვენებია ადრე ჩატვირთული ადგილები. მათი მიმდინარე ხელმისაწვდომობის შესამოწმებლად განაახლე სია.',
    );
    assert.equal(exploreCopy('ka').expired, 'ამ ნაპერწკლის შეგროვების დრო ამოიწურა.');
    assert.equal(exploreCopy('ka').SPARK_EXPIRED, exploreCopy('ka').expired);
    assert.equal(exploreCopy('ka').refresh, 'განაახლე სია');
    assert.match(exploreCopy('ka').sparkHydration, /ნაპერწკალი/);
    assert.equal(exploreCopy('en').denied.includes('cannot update now'), false);
    assert.equal(exploreCopy('ka').mapNight, 'ღამე');
    assert.match(exploreCopy('en').browseWithoutLocation, /pan the map/i);
    assert.match(exploreCopy('en').expired, /time to collect this Spark/i);
    assert.equal(exploreCopy('ka').offlineBrowse.includes('უკვე წაიშალა'), false);
  });
});
