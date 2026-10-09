import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CLAIM_WINDOW_DAYS, CODE_LENGTH, MONTHLY_INVITES, NETWORK_CLAIMS_PER_INVITER, REFERRAL_COINS,
  claimDecision, deviceHashOf, networkHashOf, generateCode, inviteLink, inviteeLabel, normalizeCode, tbilisiMonthStart,
} from './referral.js';

const now = new Date('2026-09-27T10:00:00Z');
const daysAgo = (d) => new Date(now.getTime() - d * 86400000);

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
    assert.equal(claimDecision({ invitee, inviter, now, networkClaims: NETWORK_CLAIMS_PER_INVITER }), 'NETWORK_USED');
    assert.equal(claimDecision({ invitee, inviter, now, networkClaims: NETWORK_CLAIMS_PER_INVITER - 1 }), null);
  });

  it('allows three claims per inviter per network (carrier CGNAT shares one IP)', () => {
    const invitee = { id: 'b', createdAt: daysAgo(1) };
    const inviter = { id: 'a', status: 'ACTIVE' };
    assert.equal(NETWORK_CLAIMS_PER_INVITER, 3);
    assert.equal(claimDecision({ invitee, inviter, now, networkClaims: 2 }), null);
    assert.equal(claimDecision({ invitee, inviter, now, networkClaims: 3 }), 'NETWORK_USED');
  });
  it('hashes the server-observed network, never stores it raw', () => {
    assert.equal(networkHashOf(''), null);
    assert.equal(networkHashOf('unknown'), null);
    assert.equal(networkHashOf('::ffff:1.2.3.4'), networkHashOf('1.2.3.4'));
    assert.equal(networkHashOf('1.2.3.4').includes('1.2.3.4'), false);
  });
});

describe('simple referral rules (owner 2026-10-05)', () => {
  const now2 = new Date('2026-10-05T10:00:00Z');
  const invitee = { id: 'b', createdAt: now2 };
  const inviter = { id: 'a', status: 'ACTIVE' };
  it('pays 25 coins per side and allows five invites a month', () => {
    assert.equal(REFERRAL_COINS, 25);
    assert.equal(MONTHLY_INVITES, 5);
    assert.equal(claimDecision({ invitee, inviter, now: now2, inviterInvites: 4 }), null);
    assert.equal(claimDecision({ invitee, inviter, now: now2, inviterInvites: 5 }), 'LIMIT_REACHED');
  });
  it('shows invitees as first name + initial, never an email', () => {
    assert.equal(inviteeLabel('Nino Beridze'), 'Nino B.');
    assert.equal(inviteeLabel('ნინო ბერიძე'), 'ნინო ბ.');
    assert.equal(inviteeLabel('Giorgi'), 'Giorgi');
    assert.equal(inviteeLabel(''), 'მეგობარი');
    assert.equal(inviteeLabel('a@b.ge', 'Friend'), 'Friend');
  });
  it('a phone / Apple account without a typed name is „a friend“, never „Medicard მ.“', () => {
    assert.equal(inviteeLabel('Medicard მომხმარებელი'), 'მეგობარი');
    assert.equal(inviteeLabel('  Medicard   მომხმარებელი ', 'Friend'), 'Friend');
    assert.equal(inviteeLabel('Medicard Nino'), 'Medicard N.');
  });
});

describe('referral errors in English', () => {
  it('has an English message for every error code', async () => {
    const { REFERRAL_ERRORS, REFERRAL_ERRORS_EN } = await import('./referral.js');
    assert.deepEqual(Object.keys(REFERRAL_ERRORS_EN).sort(), Object.keys(REFERRAL_ERRORS).sort());
    for (const text of Object.values(REFERRAL_ERRORS_EN)) assert.equal(/[ა-ჿ]/.test(text), false);
  });
});
