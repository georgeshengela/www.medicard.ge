import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { signToken } from '../middleware/auth.js';
import { sealAssistantPlan } from './assistantExecution.js';
import { sessionRenewalDue, sessionRenewalFields } from './sessionRenewal.js';

const DAY = 24 * 60 * 60;
const T0 = Date.UTC(2026, 9, 5) / 1000; // sign-in moment (seconds)
const claims = { sub: 'u1', iat: T0, exp: T0 + 30 * DAY };
const at = (days) => (T0 + days * DAY) * 1000;

describe('sessionRenewalDue', () => {
  it('a young token is left alone', () => {
    assert.equal(sessionRenewalDue(claims, at(0)), false);
    assert.equal(sessionRenewalDue(claims, at(14.9)), false);
  });

  it('renews once half of the token’s own lifetime is used', () => {
    assert.equal(sessionRenewalDue(claims, at(15)), true);
    assert.equal(sessionRenewalDue(claims, at(29.9)), true);
  });

  it('follows whatever lifetime the server signs with', () => {
    const long = { iat: T0, exp: T0 + 180 * DAY };
    assert.equal(sessionRenewalDue(long, at(30)), false);
    assert.equal(sessionRenewalDue(long, at(90)), true);
  });

  it('never renews without both claims, a broken span or an expired token', () => {
    assert.equal(sessionRenewalDue(null, at(20)), false);
    assert.equal(sessionRenewalDue({ iat: T0 }, at(20)), false);
    assert.equal(sessionRenewalDue({ exp: T0 + 30 * DAY }, at(20)), false);
    assert.equal(sessionRenewalDue({ iat: T0, exp: T0 }, at(20)), false);
    assert.equal(sessionRenewalDue(claims, at(31)), false);
  });

  it('never turns a one-purpose token (Medi action seal) into a session', () => {
    const seal = jwt.decode(sealAssistantPlan('u1', { id: 'p1', tool: 'water_log', args: {} }));
    assert.equal(seal.aud, 'medi-assistant-action');
    const halfway = (seal.iat + (seal.exp - seal.iat) * 0.75) * 1000;
    assert.equal(sessionRenewalDue({ iat: seal.iat, exp: seal.exp }, halfway), true);
    assert.equal(sessionRenewalDue({ iat: seal.iat, exp: seal.exp, aud: seal.aud }, halfway), false);
  });
});

describe('sessionRenewalFields (/me)', () => {
  it('adds nothing for a fresh token, so the /me body keeps its old shape', () => {
    let signed = 0;
    const body = { user: {}, usage: {}, ...sessionRenewalFields(claims, () => { signed += 1; return 'x'; }, at(1)) };
    assert.deepEqual(Object.keys(body), ['user', 'usage']);
    assert.equal(signed, 0);
  });

  it('adds a fresh token for the same account when due', () => {
    const user = { id: 'user-1', email: 'nino@example.com' };
    const fields = sessionRenewalFields(claims, () => signToken(user), at(20));
    assert.deepEqual(Object.keys(fields), ['token']);
    const fresh = jwt.verify(fields.token, env.JWT_SECRET);
    assert.equal(fresh.sub, 'user-1');
    assert.ok(fresh.exp > fresh.iat);
  });
});
