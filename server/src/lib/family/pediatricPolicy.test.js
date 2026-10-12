import test from 'node:test';
import assert from 'node:assert/strict';
import { levelTagStripper, mentionsDoseNumbers, ruleTriage, splitLevelTag, strongerLevel, temperatureFromText } from './pediatricPolicy.js';

test('fever in a baby under three months is always an emergency', () => {
  assert.equal(ruleTriage({ text: 'სიცხე აქვს 38.2', ageDays: 40 }).level, 'EMERGENCY_NOW');
  assert.equal(ruleTriage({ text: 'temperature 38', ageDays: 80 }).level, 'EMERGENCY_NOW');
  // Logged in the diary, not mentioned in the message — still counts.
  assert.equal(ruleTriage({ text: 'რა ვქნა?', ageDays: 50, loggedTemps: [{ c: 38.4 }] }).level, 'EMERGENCY_NOW');
  assert.equal(ruleTriage({ text: 'ცხელი მეჩვენება, სიცხე აქვს?', ageDays: 50 }).level, 'SEE_DOCTOR_TODAY');
});

test('age bands of the NICE traffic light', () => {
  assert.equal(ruleTriage({ text: 'სიცხე 39,1', ageDays: 120 }).level, 'SEE_DOCTOR_TODAY');
  assert.equal(ruleTriage({ text: 'სიცხე 39,1', ageDays: 400 }).level, 'HOME_CARE');
  assert.equal(ruleTriage({ text: 'სიცხე 40.2 აქვს', ageDays: 2000 }).level, 'SEE_DOCTOR_TODAY');
  assert.equal(ruleTriage({ text: 'სიცხე აქვს უკვე მეხუთე დღეა, 38.3', ageDays: 2000 }).level, 'SEE_DOCTOR_TODAY');
  assert.equal(ruleTriage({ text: 'fever for 3 days, 38.5', ageDays: 1200 }).level, 'SEE_DOCTOR_24H');
  assert.equal(ruleTriage({ text: 'სიცხე 38.5 ორი დღეა', ageDays: 300 }).level, 'SEE_DOCTOR_24H');
});

test('danger signs win at any age, with or without fever', () => {
  for (const text of [
    'სუნთქვა უჭირს და ნეკნები ეწევა', 'ტუჩები გაულურჯდა', 'არ იღვიძებს', 'კრუნჩხვა დაეწყო',
    'გამონაყარი აქვს და ჭიქით არ ქრება', 'კისერი გაუშეშდა', 'მწვანე ღებინება აქვს', 'აბები გადაყლაპა',
    'my son is not breathing', 'he had a seizure', 'ტუჩები გაუსივდა არაქისის მერე',
  ]) assert.equal(ruleTriage({ text, ageDays: 900 }).level, 'EMERGENCY_NOW', text);
  assert.equal(ruleTriage({ text: 'დილიდან არ უშარდავს, საფენი მშრალია', ageDays: 300 }).level, 'SEE_DOCTOR_TODAY');
  assert.equal(ruleTriage({ text: 'რამდენი ხანი უნდა ეძინოს?', ageDays: 300 }).level, 'INFO');
});

test('numbers that are not temperatures are ignored', () => {
  assert.equal(temperatureFromText('სიცხე 36 საათია აქვს'), null);
  assert.equal(temperatureFromText('ტემპერატურა 40 წუთის წინ 37.8 იყო'), 37.8);
  assert.equal(temperatureFromText('წონა 38 კგ'), null);
  assert.equal(temperatureFromText('38.5 გრადუსი'), 38.5);
});

test('the model may raise the level but never lower it', () => {
  assert.equal(strongerLevel('EMERGENCY_NOW', 'HOME_CARE'), 'EMERGENCY_NOW');
  assert.equal(strongerLevel('HOME_CARE', 'SEE_DOCTOR_24H'), 'SEE_DOCTOR_24H');
  assert.deepEqual(splitLevelTag('[[LEVEL: SEE_DOCTOR_24H]]\nტექსტი'), { level: 'SEE_DOCTOR_24H', body: 'ტექსტი' });
  assert.deepEqual(splitLevelTag('უბრალოდ ტექსტი'), { level: null, body: 'უბრალოდ ტექსტი' });
});

test('the stream never shows the level tag', () => {
  const s = levelTagStripper();
  let out = '';
  for (const chunk of ['[[LE', 'VEL: HOME_C', 'ARE]]\nდამშვიდ', 'დი.']) out += s.push(chunk);
  out += s.flush();
  assert.equal(out, 'დამშვიდდი.');
  assert.equal(s.level(), 'HOME_CARE');
  const plain = levelTagStripper();
  assert.equal(plain.push('გამარჯობა'), 'გამარჯობა');
});

test('dose numbers next to a medicine are caught', () => {
  assert.equal(mentionsDoseNumbers('მიეცი პარაცეტამოლი 15 მგ/კგ'), true);
  assert.equal(mentionsDoseNumbers('Ibuprofen 5 ml every 6 hours'), true);
  assert.equal(mentionsDoseNumbers('დალიოს 150 მლ წყალი'), false);
  assert.equal(mentionsDoseNumbers('პარაცეტამოლი შეფუთვის ცხრილით'), false);
});
