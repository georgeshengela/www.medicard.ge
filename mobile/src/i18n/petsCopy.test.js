import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ka } from '../i18n/ka.ts';

describe('pets Georgian copy', () => {
  it('uses Medi-safe naming and no Nightingale', () => {
    const blob = JSON.stringify(ka.pets);
    assert.equal(/Nightingale/i.test(blob), false);
    assert.equal(ka.pets.hubTitle, 'ჩემი ცხოველები');
    assert.equal(ka.pets.seeAll, 'ყველას ნახვა');
    assert.match(ka.pets.swipeHint, /არქივ/);
    assert.equal(ka.pets.manageSection, 'სწრაფი მოქმედებები');
    assert.match(ka.pets.manageSectionHint('მაქსი'), /მაქსი/);
    assert.equal(ka.pets.profileCta, 'გახსნა');
    assert.equal(ka.pets.namePh, 'მაგ. მაქსი');
    assert.equal(ka.pets.allergiesEmpty, 'ალერგიები ჯერ არ არის დამატებული');
    assert.equal(ka.pets.weightTitle, 'წონა');
    assert.equal(ka.pets.conditionsTitle, 'ჯანმრთელობის მდგომარეობები');
    assert.equal(ka.pets.careTitle, 'მოვლა');
    assert.equal(ka.pets.careAdd, 'მოვლის დამატება');
    assert.match(ka.pets.careAddBody, /პროდუქტი/);
    assert.equal(ka.pets.completeMed, 'მივეცი');
    assert.match(ka.pets.plannedDisclaimer, /არა გარანტირებული დაცვა/);
    assert.match(ka.pets.remindersNotEnabled, /გამორთულია/);
    assert.equal(ka.pets.completeMed, 'მივეცი');
    assert.equal(ka.pets.skipOccurrence, 'გამოტოვება');
    assert.match(ka.pets.reminderDeliveryHonesty, /არ ნიშნავს/);
    assert.match(ka.pets.allergiesEmptyBody, /არ ნიშნავს/);
    assert.equal(ka.pets.vetName, 'Medi Vet');
    assert.equal(ka.pets.vetDoctor, 'ექიმის სახელი');
    assert.equal(ka.pets.vetDescription, 'შენი ცხოველის ჯანმრთელობის AI ასისტენტი');
    assert.equal(ka.pets.vetStarterSummary, 'მოვლის ისტორიის შეჯამება');
    assert.equal(ka.pets.vetStarterVisit, 'ვეტერინართან ვიზიტისთვის მომზადება');
    assert.equal(ka.pets.vetStarterCare, 'კითხვა ცხოველის მოვლაზე');
    assert.match(ka.pets.catalogAttribution, /CC BY-SA 4.0/);
    assert.match(JSON.stringify(ka.pets), /OpenRouter/);
    assert.equal(/Nightingale/i.test(JSON.stringify(ka.pets)), false);
  });
});
