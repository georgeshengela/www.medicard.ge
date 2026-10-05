import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {
  CONTENT_TABLES,
  planAbsorb,
  readConflictToken,
  realEmail,
  signConflictToken,
} from './accountLogins.js';
import { isAuthWriteRequest } from './rateLimitKey.js';
import { DEFAULT_TEMPLATES, DEFAULT_TEMPLATES_EN } from './email/templates.js';

const KEY = 'test-secret-at-least-16-chars';

test('real email: synthetic phone / Apple / merged addresses are not sign-in emails', () => {
  assert.equal(realEmail('Nino@Gmail.com '), 'nino@gmail.com');
  assert.equal(realEmail('995555123456@phone.medicard.ge'), null);
  assert.equal(realEmail('apple.abc@apple.medicard.ge'), null);
  assert.equal(realEmail('merged.x@deleted.medicard.ge'), null);
  assert.equal(realEmail(''), null);
});

test('plan: a phone account folds into an email account (the 2026-10-05 case)', () => {
  const web = { email: '995555123456@phone.medicard.ge', phone: '+995555123456', identities: [] };
  const app = { email: 'nino@gmail.com', phone: null, identities: [] };
  assert.deepEqual(planAbsorb(web, app), { ok: true, phone: '+995555123456', email: null, identities: 0, conflicts: [] });
  // The other way round the email moves to the phone account.
  assert.deepEqual(planAbsorb(app, web), { ok: true, phone: null, email: 'nino@gmail.com', identities: 0, conflicts: [] });
});

test('plan: never overwrite a different phone or a different real email', () => {
  const a = { email: 'a@x.ge', phone: '+995555000001', identities: [{ provider: 'google', subject: '1' }] };
  const b = { email: 'b@x.ge', phone: '+995555000002', identities: [] };
  const plan = planAbsorb(a, b);
  assert.equal(plan.ok, false);
  assert.deepEqual(plan.conflicts, ['phone', 'email']);
  // The same phone / email on both is not a conflict and moves nothing.
  assert.deepEqual(planAbsorb({ ...a, identities: [] }, { ...a, identities: [] }), { ok: true, phone: null, email: null, identities: 0, conflicts: [] });
  // Social identities always fit.
  assert.equal(planAbsorb({ email: 'apple.x@apple.medicard.ge', phone: null, identities: [{ provider: 'apple', subject: 's' }] }, b).identities, 1);
});

test('conflict token: bound to both accounts, 15 minutes, nothing else verifies as one', () => {
  const token = signConflictToken({ kind: 'phone', from: 'u1', to: 'u2' }, KEY);
  assert.deepEqual(readConflictToken(token, KEY), { kind: 'phone', from: 'u1', to: 'u2' });
  assert.equal(readConflictToken(token, 'another-secret-value-123'), null);
  assert.equal(readConflictToken(jwt.sign({ typ: 'social-link', kind: 'phone', from: 'u1', to: 'u2' }, KEY), KEY), null);
  assert.equal(readConflictToken(jwt.sign({ typ: 'account-conflict', kind: 'sms', from: 'u1', to: 'u2' }, KEY), KEY), null);
  assert.equal(readConflictToken(jwt.sign({ typ: 'account-conflict', kind: 'phone', from: 'u1', to: 'u1' }, KEY), KEY), null);
  const expired = jwt.sign({ typ: 'account-conflict', kind: 'email', from: 'u1', to: 'u2', exp: Math.floor(Date.now() / 1000) - 5 }, KEY);
  assert.equal(readConflictToken(expired, KEY), null);
});

test('content tables are the person’s own records, never automatic rows', () => {
  for (const auto of ['HealthProfile', 'StepLog', 'HealthMetricDaily', 'NutritionProgram', 'NutritionPlannedMeal', 'AppActivity', 'UserQuestProfile', 'PushToken']) {
    assert.equal(CONTENT_TABLES.includes(auto), false, auto);
  }
  for (const own of ['MedicationSchedule', 'CycleLog', 'NutritionMeal', 'MedicalRecord', 'Pet']) {
    assert.equal(CONTENT_TABLES.includes(own), true, own);
  }
});

test('new auth writes are IP-limited and the email code has both languages', () => {
  for (const path of ['/api/auth/email/add/start', '/api/auth/email/add/verify', '/api/auth/apple/link', '/api/auth/google/link', '/api/auth/account-conflict/resolve']) {
    assert.equal(isAuthWriteRequest({ method: 'POST', originalUrl: path }), true, path);
  }
  assert.equal(isAuthWriteRequest({ method: 'GET', originalUrl: '/api/auth/methods' }), false);
  assert.ok(DEFAULT_TEMPLATES.email_verify.required.includes('code'));
  assert.match(DEFAULT_TEMPLATES_EN.email_verify.body, /\{\{code\}\}/);
});
