import { test } from 'node:test';
import assert from 'node:assert/strict';
import { POSTPARTUM_OVULATION_NOTE, TTC_PERIOD_START_TITLE, isTtcTone, periodStartTone } from './cycleTone.ts';

test('postpartum note says ovulation can return before the first bleed, in both languages, without a diagnosis', () => {
  assert.match(POSTPARTUM_OVULATION_NOTE.ka, /ოვულაცია შეიძლება პირველ სისხლდენამდე დაბრუნდეს/);
  assert.match(POSTPARTUM_OVULATION_NOTE.ka, /ნაყოფიერების არქონას არ ნიშნავს/);
  assert.match(POSTPARTUM_OVULATION_NOTE.en, /before the first bleed/i);
  assert.doesNotMatch(POSTPARTUM_OVULATION_NOTE.ka, /გამონადენი/);
});

test('trying to conceive: neutral „ახალი ციკლი დაიწყო“ title and a selection haptic, never Success', () => {
  const tone = periodStartTone('TRY_TO_CONCEIVE');
  assert.equal(tone.haptic, 'selection');
  assert.deepEqual(tone.title, TTC_PERIOD_START_TITLE);
  assert.equal(tone.title?.ka, 'ახალი ციკლი დაიწყო');
  assert.ok(tone.title?.en.length);
  // No congratulation, no period word in the neutral title.
  assert.doesNotMatch(tone.title?.ka ?? '', /გილოცავ|მენსტრუაცია/);
  assert.doesNotMatch(tone.title?.en ?? '', /congrat|period/i);
  assert.equal(isTtcTone('TRY_TO_CONCEIVE'), true);
});

test('every other mode keeps the default toast title and the Success haptic', () => {
  for (const mode of ['TRACK_PERIOD', 'PERIMENOPAUSE', 'POSTPARTUM', 'PREGNANCY', null, undefined, '']) {
    const tone = periodStartTone(mode);
    assert.equal(tone.title, null, `mode ${String(mode)}`);
    assert.equal(tone.haptic, 'success', `mode ${String(mode)}`);
    assert.equal(isTtcTone(mode), false);
  }
});
