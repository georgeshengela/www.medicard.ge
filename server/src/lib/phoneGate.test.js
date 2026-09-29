import test from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedPhone, requireVerifiedPhone, PHONE_REQUIRED_CODE } from './phoneGate.js';

test('only a stored mobile number counts as verified', () => {
  assert.equal(hasVerifiedPhone({ phone: '+995555123456' }), true);
  assert.equal(hasVerifiedPhone({ phone: '555 12 34 56' }), true);
  assert.equal(hasVerifiedPhone({ phone: null }), false);
  assert.equal(hasVerifiedPhone({ phone: '' }), false);
  assert.equal(hasVerifiedPhone({ phone: '1234' }), false);
  assert.equal(hasVerifiedPhone(null), false);
});

test('the middleware answers 403 with a machine-readable code, or passes through', () => {
  const res = { statusCode: 0, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  let passed = false;
  requireVerifiedPhone({ user: { phone: null } }, res, () => { passed = true; });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, PHONE_REQUIRED_CODE);
  requireVerifiedPhone({ user: { phone: '+995555000000' } }, res, () => { passed = true; });
  assert.equal(passed, true);
});

test('English requests get the English phone-verification message', () => {
  let body;
  requireVerifiedPhone({ user: { phone: null }, lang: 'en' }, { status() { return this; }, json(b) { body = b; return this; } }, () => {});
  assert.equal(body.code, PHONE_REQUIRED_CODE);
  assert.equal(body.error, 'Please verify your phone number to use this feature.');
});
