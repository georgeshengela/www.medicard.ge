import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAIM_WINDOW_DAYS, CODE_LENGTH, INVITER_MONTHLY_CAP, REWARD_WINDOW_DAYS,
  claimDecision, deviceHashOf, generateCode, inviteLink, normalizeCode, rewardDecision, tbilisiMonthStart,
} from './referral.js';

const now = new Date('2026-09-27T10:00:00Z');
const daysAgo = (d) => new Date(now.getTime() - d * 86400000);
const phone = '+995555123456';

describe('referral codes', () => {
  it('generates unambiguous codes and normalizes input', () => {
    const code = generateCode();
    assert.equal(code.length, CODE_LENGTH);
    assert.ok(!/[01IOL]/.test(code));
    assert.equal(normalizeCode(' ab-c 234 '), 'ABC234');
    assert.equal(normalizeCode('ABC23'), null);
    assert.equal(normalizeCode('ABC10O'), null);
    assert.equal(inviteLink('ABC234'), 'https://medicard.ge/i/ABC234');
  });

  it('hashes install ids and ignores junk', () => {
    assert.equal(deviceHashOf('short'), null);
    assert.equal(deviceHashOf('install-123456'), deviceHashOf('install-123456'));
    assert.match(deviceHashOf('install-123456'), /^[a-f0-9]{64}$/);
  });

  it('computes the Tbilisi month start', () => {
    assert.equal(tbilisiMonthStart(new Date('2026-10-01T01:00:00Z')).toISOString(), '2026-09-30T20:00:00.000Z');
    assert.equal(tbilisiMonthStart(new Date('2026-09-30T19:59:00Z')).toISOString(), '2026-08-31T20:00:00.000Z');
  });
});

describe('claim decision', () => {
  const invitee = { id: 'b', createdAt: daysAgo(1) };
  const inviter = { id: 'a', status: 'ACTIVE' };
  it('accepts a fresh account with a valid code', () => {
    assert.equal(claimDecision({ invitee, inviter, now }), null);
  });
  it('rejects abuse cases', () => {
    assert.equal(claimDecision({ invitee, inviter: null, now }), 'CODE_NOT_FOUND');
    assert.equal(claimDecision({ invitee, inviter: { id: 'b', status: 'ACTIVE' }, now }), 'OWN_CODE');
    assert.equal(claimDecision({ invitee, inviter, now, alreadyReferred: true }), 'ALREADY_CLAIMED');
    assert.equal(claimDecision({ invitee: { id: 'b', createdAt: daysAgo(CLAIM_WINDOW_DAYS + 1) }, inviter, now }), 'TOO_LATE');
    assert.equal(claimDecision({ invitee, inviter, now, inviterReferredByInvitee: true }), 'CYCLE');
    assert.equal(claimDecision({ invitee, inviter, now, deviceUsed: true }), 'DEVICE_USED');
    assert.equal(claimDecision({ invitee, inviter: { id: 'a', status: 'SUSPENDED' }, now }), 'INVITER_INACTIVE');
  });
});

describe('reward decision', () => {
  const referral = { createdAt: daysAgo(2) };
  const invitee = { status: 'ACTIVE', phone };
  const inviter = { status: 'ACTIVE', phone };
  it('pays both sides after a health action with verified phones', () => {
    assert.deepEqual(rewardDecision({ referral, invitee, inviter, hasHealthAction: true, inviterRewardedThisMonth: 0, now }), { action: 'REWARD', inviter: true });
  });
  it('waits for phone and first action', () => {
    assert.equal(rewardDecision({ referral, invitee: { status: 'ACTIVE', phone: null }, inviter, hasHealthAction: true, inviterRewardedThisMonth: 0, now }).action, 'WAIT');
    assert.equal(rewardDecision({ referral, invitee, inviter, hasHealthAction: false, inviterRewardedThisMonth: 0, now }).action, 'WAIT');
  });
  it('caps the inviter monthly and without a phone, invitee still paid', () => {
    assert.deepEqual(rewardDecision({ referral, invitee, inviter, hasHealthAction: true, inviterRewardedThisMonth: INVITER_MONTHLY_CAP, now }), { action: 'REWARD', inviter: false });
    assert.deepEqual(rewardDecision({ referral, invitee, inviter: { status: 'ACTIVE', phone: '' }, hasHealthAction: true, inviterRewardedThisMonth: 0, now }), { action: 'REWARD', inviter: false });
  });
  it('expires old pending referrals', () => {
    assert.equal(rewardDecision({ referral: { createdAt: daysAgo(REWARD_WINDOW_DAYS + 1) }, invitee, inviter, hasHealthAction: true, inviterRewardedThisMonth: 0, now }).action, 'EXPIRE');
  });
});
