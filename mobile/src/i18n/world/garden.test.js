'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { gardenCopy, gardenCopyTables, GARDEN_COPY_KEYS, gardenReactionText } = require('./garden.js');

describe('Medi World garden i18n parity', () => {
  it('keeps the same keys in ka, en, fr, and ru', () => {
    const tables = gardenCopyTables();
    for (const locale of ['ka', 'en', 'fr', 'ru']) {
      assert.deepEqual(Object.keys(tables[locale]).sort(), [...GARDEN_COPY_KEYS].sort());
    }
  });

  it('uses warm return language and never punishes inactivity', () => {
    assert.match(gardenCopy('ka').returned_after_inactivity, /პროგრესი შეინარჩუნა/);
    assert.match(gardenCopy('en').returned_after_inactivity, /kept your progress/);
    assert.equal(gardenCopy('ka').empty.includes('unhealthy'), false);
    assert.equal(gardenCopy('en').empty.toLowerCase().includes('missed'), false);
    assert.equal(gardenReactionText('en', 'returned_after_inactivity').toLowerCase().includes('dying'), false);
    assert.equal(gardenReactionText('ka', 'insufficient_energy').includes('hungry'), false);
    assert.equal(gardenCopy('ka').plantFail, 'დარგვა ვერ მოხერხდა. სცადე ხელახლა.');
    assert.equal(gardenCopy('en').plantFail.includes('Try again'), true);
  });

  it('explains locked plots with the actual World level', () => {
    const { gardenLockedPlotBody } = require('./garden.js');
    assert.equal(gardenLockedPlotBody('ka', 5), 'ეს ადგილი მე-5 დონეზე გაიხსნება.');
    assert.equal(gardenLockedPlotBody('ka', 10), 'ეს ადგილი მე-10 დონეზე გაიხსნება.');
    assert.equal(gardenLockedPlotBody('ka', 20), 'ეს ადგილი მე-20 დონეზე გაიხსნება.');
    assert.equal(gardenLockedPlotBody('ka', 1), 'ეს ადგილი 1 დონეზე გაიხსნება.');
    assert.equal(gardenCopy('ka').plantConfirmBody, 'დარგვისას შესაბამისი ზრუნვის ენერგია ჩამოგეჭრება.');
    assert.equal(gardenCopy('ka').storeConfirmBody, 'ადგილი გათავისუფლდება. მცენარე და მისი ზრდის ეტაპი შენარჩუნდება. თავისუფალ ადგილზე მის დაბრუნებას ენერგია არ სჭირდება.');
    assert.match(gardenCopy('en').storeConfirmBody, /costs no energy/);
    assert.match(gardenCopy('en').storeConfirmBody, /growth stage/);
    assert.equal(gardenCopy('ka').growthKept, 'მცენარის ზრდის მიღწეული ეტაპი შენარჩუნდება.');
    assert.match(gardenLockedPlotBody('en', 20), /level 20/);
  });
});
