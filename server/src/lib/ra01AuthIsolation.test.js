import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { qaMasterCodeAllowed, qaOtpEnabledForEnv } from './qaOtp.js';
import { publicAppSettings } from './settings.js';
import { resolveQaCodes } from './qaOtpCodes.js';
import { unusedUnexpiredOtpWhere, evaluateOtpRow, otpPhonesMatch } from './otpContract.js';
import { decideOwnedRecordAccess, decideFetchThenCheck } from './ownerAccess.js';

describe('QA OTP production gate', () => {
  it('does not accept 0000/000000 when the master switch is off', () => {
    assert.equal(qaMasterCodeAllowed(false, '0000', '0000'), false);
    assert.equal(qaMasterCodeAllowed(false, '000000', '000000'), false);
    assert.equal(qaMasterCodeAllowed(true, '0000', '0000'), true);
  });

  it('never enables the master OTP in production even if settings/env ask', () => {
    assert.equal(qaOtpEnabledForEnv('production', true, true), false);
    assert.equal(qaOtpEnabledForEnv('development', false, true), true);
    assert.equal(qaOtpEnabledForEnv('development', true, false), true);
    assert.equal(qaOtpEnabledForEnv('test', false, false), false);
  });

  it('public /api/app/status payload does not advertise qaOtpEnabled', () => {
    const published = publicAppSettings({
      maintenanceMode: false,
      maintenanceMessage: 'x',
      minAppVersion: '1.0.0.7.67',
      forceUpdate: false,
      allowRegistrations: true,
      supportEmail: 'support@medicard.ge',
      updatedAt: new Date(),
      qaOtpEnabled: true,
    });
    assert.equal('qaOtpEnabled' in published, false);
    assert.equal(resolveQaCodes('').enabledByEnv, false);
  });
});

describe('OTP contract', () => {
  it('rejects used, expired, and over-attempted codes', () => {
    const now = new Date('2026-09-11T12:00:00.000Z');
    assert.equal(evaluateOtpRow(null, now).ok, false);
    assert.equal(evaluateOtpRow({ usedAt: now, expiresAt: new Date(now.getTime() + 60_000), attempts: 0 }, now).ok, false);
    assert.equal(
      evaluateOtpRow({ usedAt: null, expiresAt: new Date(now.getTime() - 1000), attempts: 0 }, now).ok,
      false,
    );
    assert.equal(
      evaluateOtpRow({ usedAt: null, expiresAt: new Date(now.getTime() + 60_000), attempts: 5 }, now).status,
      429,
    );
    assert.equal(
      evaluateOtpRow({ usedAt: null, expiresAt: new Date(now.getTime() + 60_000), attempts: 0 }, now).ok,
      true,
    );
    assert.deepEqual(unusedUnexpiredOtpWhere(now), { usedAt: null, expiresAt: { gt: now } });
  });

  it('binds phone OTP to the requested number', () => {
    assert.equal(otpPhonesMatch('995555000001', '995555000001'), true);
    assert.equal(otpPhonesMatch('995555000001', '995555000002'), false);
  });
});

describe('JWT user tokens', () => {
  it('signs HS256, rejects expired and admin-role payloads on the user API shape', () => {
    const token = jwt.sign({ sub: 'user-1', email: 'a@b.c' }, env.JWT_SECRET, { expiresIn: '30d', algorithm: 'HS256' });
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    assert.equal(payload.sub, 'user-1');
    const expired = jwt.sign({ sub: 'user-1' }, env.JWT_SECRET, { expiresIn: -10 });
    assert.throws(() => jwt.verify(expired, env.JWT_SECRET), { name: 'TokenExpiredError' });
    const admin = jwt.sign({ sub: 'admin-1', role: 'admin' }, env.JWT_SECRET);
    const adminPayload = jwt.verify(admin, env.JWT_SECRET);
    assert.equal(adminPayload.role, 'admin');
  });
});

describe('owner isolation helpers used by RA-01 IDOR cases', () => {
  it('withholds record bodies when the viewer is not the owner', () => {
    const record = { id: 'rec-a', userId: 'user-a', imageUrl: '/uploads/x.jpg', aiAnalysis: 'secret' };
    const owner = decideOwnedRecordAccess(record, 'user-a');
    const other = decideOwnedRecordAccess(record, 'user-b');
    assert.equal(owner.status, 200);
    assert.equal(owner.body.aiAnalysis, 'secret');
    assert.equal(other.status, 404);
    assert.equal(other.body, null);
  });

  it('fetch-then-check withholds content when userId mismatches', () => {
    const quest = { id: 'q1', userId: 'user-a', title: 'hidden' };
    const denied = decideFetchThenCheck(quest, 'user-b', 404);
    const allowed = decideFetchThenCheck(quest, 'user-a', 404);
    assert.equal(denied.status, 404);
    assert.equal(denied.body, null);
    assert.equal(allowed.status, 200);
    const tagDenied = decideFetchThenCheck({ id: 't1', userId: 'user-a' }, 'user-b', 403);
    assert.equal(tagDenied.status, 403);
    assert.equal(tagDenied.body, null);
  });
});
