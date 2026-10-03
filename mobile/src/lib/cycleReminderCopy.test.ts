import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CYCLE_REMINDER_COPY_EN,
  CYCLE_REMINDER_COPY_KA,
  CYCLE_REMINDER_TEMPLATE_KEYS,
  LEGACY_SERVER_CYCLE_COPY,
  isCustomisedCycleTemplate,
  mentionsSensitiveCycleWord,
  periodSoonDaysVar,
  pickCycleReminderCopy,
} from './cycleReminderCopy.ts';
import { CYCLE_TEMPLATE_BY_TYPE } from './cycleNotificationContract.js';
import { CYCLE_DEFAULT_ON_TYPES } from './cycleReminderDefaults.ts';

const allText = (c: { title: string; body: string; bodyCautious?: string }) =>
  `${c.title} ${c.body} ${c.bodyCautious ?? ''}`;

test('every reminder type has Georgian and English copy', () => {
  for (const key of Object.values(CYCLE_TEMPLATE_BY_TYPE)) {
    assert.ok(CYCLE_REMINDER_COPY_KA[key as keyof typeof CYCLE_REMINDER_COPY_KA], `ka ${key}`);
    assert.ok(CYCLE_REMINDER_COPY_EN[key as keyof typeof CYCLE_REMINDER_COPY_EN], `en ${key}`);
  }
  for (const key of CYCLE_REMINDER_TEMPLATE_KEYS) {
    assert.ok(CYCLE_REMINDER_COPY_KA[key].title && CYCLE_REMINDER_COPY_KA[key].body, key);
    assert.ok(CYCLE_REMINDER_COPY_EN[key].title && CYCLE_REMINDER_COPY_EN[key].body, key);
  }
});

test('default-on reminders never say fertile / ovulation / sex / libido / discharge (ka + en, cautious too)', () => {
  for (const type of CYCLE_DEFAULT_ON_TYPES) {
    const key = CYCLE_TEMPLATE_BY_TYPE[type] as keyof typeof CYCLE_REMINDER_COPY_KA;
    assert.equal(mentionsSensitiveCycleWord(allText(CYCLE_REMINDER_COPY_KA[key])), false, `ka ${key}`);
    assert.equal(mentionsSensitiveCycleWord(allText(CYCLE_REMINDER_COPY_EN[key])), false, `en ${key}`);
  }
  // The guard itself catches the words it should.
  assert.equal(mentionsSensitiveCycleWord('სავარაუდო ნაყოფიერი ფანჯარა'), true);
  assert.equal(mentionsSensitiveCycleWord('Estimated ovulation'), true);
  assert.equal(mentionsSensitiveCycleWord('ლიბიდო დღეს'), true);
  assert.equal(mentionsSensitiveCycleWord('გამონადენი'), true);
});

test('period texts follow the brief and stay estimates', () => {
  assert.equal(CYCLE_REMINDER_COPY_KA['cycle-period-soon'].title.startsWith('მენსტრუაცია სავარაუდოდ {days} დღეში'), true);
  assert.equal(CYCLE_REMINDER_COPY_KA['cycle-period-start'].title.startsWith('მენსტრუაცია სავარაუდოდ დღეს'), true);
  assert.equal(CYCLE_REMINDER_COPY_KA['cycle-period-late'].title.startsWith('სავარაუდო თარიღი გავიდა — ყველაფერი რიგზეა?'), true);
  for (const key of ['cycle-period-soon', 'cycle-period-start', 'cycle-period-late'] as const) {
    assert.match(allText(CYCLE_REMINDER_COPY_KA[key]), /სავარაუდო/);
    assert.match(allText(CYCLE_REMINDER_COPY_EN[key]), /estimat/i);
    // Never a date in ISO form, never a diagnosis word.
    assert.doesNotMatch(allText(CYCLE_REMINDER_COPY_KA[key]), /\d{4}-\d{2}-\d{2}|დიაგნოზ|ორსულ/);
    assert.doesNotMatch(allText(CYCLE_REMINDER_COPY_EN[key]), /\d{4}-\d{2}-\d{2}|diagnos|pregnan/i);
  }
});

test('English readers always get the English copy; admin templates are Georgian', () => {
  const en = pickCycleReminderCopy('cycle-period-soon', {
    en: true,
    cached: { title: 'ადმინის ტექსტი', body: 'ადმინის ტექსტი' },
  });
  assert.equal(en.title, CYCLE_REMINDER_COPY_EN['cycle-period-soon'].title);
  assert.equal(periodSoonDaysVar(2, true), '2 days');
  assert.equal(periodSoonDaysVar(1, true), '1 day');
  assert.equal(periodSoonDaysVar(2, false), '2');
});

test('Georgian: an admin template still equal to the old server default is not customised → new app copy', () => {
  const legacy = LEGACY_SERVER_CYCLE_COPY['cycle-period-soon']!;
  assert.equal(isCustomisedCycleTemplate('cycle-period-soon', legacy), false);
  assert.equal(isCustomisedCycleTemplate('cycle-period-soon', { title: legacy.title, body: `${legacy.body}  ` }), false);
  const picked = pickCycleReminderCopy('cycle-period-soon', { en: false, cached: legacy });
  assert.equal(picked.title, CYCLE_REMINDER_COPY_KA['cycle-period-soon'].title);
  assert.equal(pickCycleReminderCopy('cycle-period-soon', { en: false, cached: null }).title, picked.title);
});

test('Georgian: a template the admin actually wrote is honoured', () => {
  const custom = { title: 'ჩვენი ტექსტი 🌸', body: 'ადმინმა შეცვალა {days} დღე' };
  assert.equal(isCustomisedCycleTemplate('cycle-period-soon', custom), true);
  const picked = pickCycleReminderCopy('cycle-period-soon', { en: false, cached: custom });
  assert.deepEqual(picked, custom);
  // A key without a legacy default (the new late reminder) is customised whenever the admin has one.
  assert.equal(isCustomisedCycleTemplate('cycle-period-late', { title: 'x', body: 'y' }), true);
});

test('cautious forecasts pick the cautious body where one exists', () => {
  const cautious = pickCycleReminderCopy('cycle-period-soon', { en: false, cautious: true });
  assert.equal(cautious.body, CYCLE_REMINDER_COPY_KA['cycle-period-soon'].bodyCautious);
  const plain = pickCycleReminderCopy('cycle-period-start', { en: true, cautious: true });
  assert.equal(plain.body, CYCLE_REMINDER_COPY_EN['cycle-period-start'].body);
  // Unknown keys fall back to the masked copy rather than throwing.
  assert.equal(pickCycleReminderCopy('cycle-nope', { en: false }).title, CYCLE_REMINDER_COPY_KA['cycle-masked'].title);
});
