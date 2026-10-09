import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSchema, medicationValidationError } from './medications.routes.js';

// The app's frequency sheet used to offer 1–12 doses a day; the server takes 1–8. Picking 9 let her fill
// in the whole form and then fail with the generic „შევსებული მონაცემები არასწორია.“ (the reason sat
// only in `fields`, which app builds up to 1.0.0.21.20 never show). The top-line error now says why.
function fakeRes() {
  return {
    headersSent: false,
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

const nineTimes = Array.from({ length: 9 }, (_, i) => `${String(8 + i).padStart(2, '0')}:00`).join(', ');

function rejected(body) {
  const parsed = createSchema.safeParse(body);
  assert.equal(parsed.success, false);
  return parsed.error;
}

test('nine doses a day: the error says the limit, in the request language, with the same shape', () => {
  const error = rejected({ medName: 'ასპირინი', dosage: '1 ტაბლეტი', frequency: nineTimes });
  const ka = fakeRes();
  medicationValidationError(error, {}, ka, () => assert.fail('a validation error is answered here'));
  assert.equal(ka.statusCode, 400);
  assert.equal(ka.body.error, 'დღეში დასაშვებია 1-დან 8 მიღებამდე');
  assert.deepEqual(ka.body.fields, [{ field: 'frequency', message: 'დღეში დასაშვებია 1-დან 8 მიღებამდე' }]);

  const en = fakeRes();
  medicationValidationError(error, { lang: 'en' }, en, () => assert.fail('a validation error is answered here'));
  assert.equal(en.statusCode, 400);
  assert.equal(en.body.error, 'You can add 1 to 8 doses a day');
  assert.deepEqual(en.body.fields, [{ field: 'frequency', message: 'You can add 1 to 8 doses a day' }]);
});

test('eight doses a day are still accepted', () => {
  const eight = nineTimes.split(', ').slice(0, 8).join(', ');
  const parsed = createSchema.safeParse({ medName: 'ასპირინი', dosage: '1 ტაბლეტი', frequency: eight });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.frequency.split(', ').length, 8);
});

test('the first field explains when several are wrong; anything that is not validation goes on', () => {
  const error = rejected({ medName: 'a', dosage: '', frequency: '25:00' });
  const res = fakeRes();
  medicationValidationError(error, {}, res, () => assert.fail('a validation error is answered here'));
  assert.equal(res.body.error, res.body.fields[0].message);
  assert.ok(res.body.fields.length >= 3);

  const other = new Error('boom');
  let passed = null;
  medicationValidationError(other, {}, fakeRes(), (err) => {
    passed = err;
  });
  assert.equal(passed, other);
});

test('the validator’s own English text never becomes the top line; our reason wins when there is one', () => {
  // 121 characters: only zod's default („Too big: …“) describes it, so the generic line stays.
  const longName = rejected({ medName: 'ა'.repeat(121), dosage: '1 ტაბლეტი', frequency: '08:00' });
  const ka = fakeRes();
  medicationValidationError(longName, {}, ka, () => assert.fail('a validation error is answered here'));
  assert.equal(ka.statusCode, 400);
  assert.equal(ka.body.error, 'შევსებული მონაცემები არასწორია.');
  assert.equal(ka.body.fields[0].field, 'medName');
  const en = fakeRes();
  medicationValidationError(longName, { lang: 'en' }, en, () => assert.fail('a validation error is answered here'));
  assert.equal(en.body.error, 'Some of the details you entered are not valid.');

  // A long name and nine doses: the dose limit we wrote is the reason she sees.
  const both = rejected({ medName: 'ა'.repeat(121), dosage: '1 ტაბლეტი', frequency: nineTimes });
  const res = fakeRes();
  medicationValidationError(both, {}, res, () => assert.fail('a validation error is answered here'));
  assert.equal(res.body.error, 'დღეში დასაშვებია 1-დან 8 მიღებამდე');
  assert.equal(res.body.fields.length, 2);
});
