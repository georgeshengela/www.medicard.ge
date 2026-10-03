import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withoutCycleDayOpener } from './cycleTipCopy.ts';

test('drops the server phase card opener in Georgian and English', () => {
  assert.equal(
    withoutCycleDayOpener('დღეს ციკლის 14-ე დღეა. სავარაუდო ფაზა: ნაყოფიერი. ეს კალენდარული შეფასებაა, არა ჰორმონის გაზომვა.'),
    'სავარაუდო ფაზა: ნაყოფიერი. ეს კალენდარული შეფასებაა, არა ჰორმონის გაზომვა.',
  );
  assert.equal(
    withoutCycleDayOpener('Today is day 14 of your cycle. Likely phase: fertile. This is a calendar estimate.'),
    'Likely phase: fertile. This is a calendar estimate.',
  );
});

test('drops the older local „ციკლის N-ე დღე ·“ / "Cycle day N ·" openers (cached AI text)', () => {
  assert.equal(withoutCycleDayOpener('ციკლის 3-ე დღე · მენსტრუაცია. სითბო ეხმარება.'), 'მენსტრუაცია. სითბო ეხმარება.');
  assert.equal(withoutCycleDayOpener('ციკლის 1-ლი დღე. დაისვენე.'), 'დაისვენე.');
  assert.equal(withoutCycleDayOpener('შენი ციკლის მე-20 დღეა — ენერგია შეიძლება დაიკლოს.'), 'ენერგია შეიძლება დაიკლოს.');
  assert.equal(withoutCycleDayOpener('Cycle day 3 · Period. Warmth helps.'), 'Period. Warmth helps.');
  assert.equal(withoutCycleDayOpener('Day 21, energy may dip.'), 'Energy may dip.');
});

test('keeps the advice when the day sits inside a sentence or the text is only the day', () => {
  const mid = 'ზოგს ციკლის 20-ე დღიდან შებერილობა აქვს — ნაკლები მარილი ეხმარება.';
  assert.equal(withoutCycleDayOpener(mid), mid);
  assert.equal(withoutCycleDayOpener('Many people feel bloated from day 20 onwards.'), 'Many people feel bloated from day 20 onwards.');
  assert.equal(withoutCycleDayOpener('ციკლის 14-ე დღე'), 'ციკლის 14-ე დღე');
  assert.equal(withoutCycleDayOpener(''), '');
});

test('tip copy never carries the cycle day at its start', () => {
  for (const body of [
    'მენსტრუაციის დღეებში სითბო, ჰიდრატაცია და მსუბუქი მოძრაობა ხშირად ეხმარება. ძლიერი ტკივილისას მიმართე ექიმს.',
    'ფაზა სავარაუდოა. ზოგიერთ ადამიანს ამ დღეებში ენერგია უფრო მაღალი აქვს. ეს ზოგადი ინფორმაციაა.',
  ]) {
    assert.equal(withoutCycleDayOpener(body), body);
    assert.equal(/ციკლის \d+-ე დღე/.test(body), false);
  }
});
