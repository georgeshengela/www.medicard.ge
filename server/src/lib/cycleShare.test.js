import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHARE_AUTH_ERROR,
  SHARE_DENY_ERROR,
  SHARE_TOKEN_BYTES,
  assertShareOwner,
  buildPartnerPayload,
  canAcceptShare,
  decidePartnerPeek,
  decideShareAccept,
  decideShareManage,
  denyShare,
  denyShareAuth,
  evaluateShareAccess,
  partnerPayloadHasLeak,
  generateShareToken,
  hashShareToken,
  isShareTokenFormat,
  mergeSharePermissions,
  normalizeSharePermissions,
  ownerShareView,
  privateCacheHeaders,
  shareExpiresAt,
} from './cycleShare.js';

function mockRes() {
  const headers = {};
  const res = {
    statusCode: 200,
    body: null,
    headers,
    setHeader(k, v) {
      headers[k] = v;
      return res;
    },
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

describe('share token security', () => {
  it('generates a 64-char hex token from 32 CSPRNG bytes', () => {
    const token = generateShareToken();
    assert.equal(token.length, SHARE_TOKEN_BYTES * 2);
    assert.equal(isShareTokenFormat(token), true);
    assert.notEqual(token, generateShareToken());
  });

  it('rejects legacy 12-hex and malformed codes', () => {
    assert.equal(isShareTokenFormat('a1b2c3d4e5f6'), false);
    assert.equal(isShareTokenFormat(''), false);
    assert.equal(isShareTokenFormat('zzzz'), false);
    assert.equal(isShareTokenFormat('1'), false);
    assert.equal(isShareTokenFormat(null), false);
  });

  it('hashes tokens so the database does not store the invite secret as the lookup key plaintext', () => {
    const token = generateShareToken();
    const hash = hashShareToken(token);
    assert.equal(hash.length, 64);
    assert.notEqual(hash, token);
    assert.equal(hashShareToken(token), hash);
    assert.notEqual(hashShareToken(`${token}x`), hash);
  });
});

describe('share access', () => {
  const owner = 'owner-1';
  const partner = 'partner-1';
  const other = 'other-1';

  function share(over = {}) {
    return {
      ownerUserId: owner,
      partnerUserId: partner,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      ...over,
    };
  }

  it('allows only the bound authenticated partner', () => {
    assert.equal(evaluateShareAccess(share(), partner).ok, true);
    assert.equal(evaluateShareAccess(share(), other).ok, false);
    assert.equal(evaluateShareAccess(share(), owner).ok, false);
    assert.equal(evaluateShareAccess(share({ partnerUserId: null }), partner).ok, false);
  });

  it('rejects expired and revoked shares', () => {
    assert.equal(evaluateShareAccess(share({ expiresAt: new Date(Date.now() - 1) }), partner).ok, false);
    assert.equal(evaluateShareAccess(share({ revokedAt: new Date() }), partner).ok, false);
    assert.equal(evaluateShareAccess(null, partner).ok, false);
  });

  it('accept binds the first partner and rejects everyone else with the same generic path', () => {
    const open = share({ partnerUserId: null });
    assert.equal(canAcceptShare(open, partner).ok, true);
    assert.equal(canAcceptShare(open, owner).ok, false);
    assert.equal(canAcceptShare(share(), other).ok, false);
    assert.equal(canAcceptShare(share(), partner).alreadyBound, true);
  });

  it('only the owner can manage a live share', () => {
    assert.equal(assertShareOwner(share(), owner), true);
    assert.equal(assertShareOwner(share(), partner), false);
    assert.equal(assertShareOwner(share({ revokedAt: new Date() }), owner), false);
    assert.equal(assertShareOwner(share({ expiresAt: new Date(Date.now() - 1) }), owner), false);
    assert.equal(decideShareManage({ share: share(), viewerUserId: partner }).ok, false);
    assert.equal(decideShareManage({ share: share(), viewerUserId: owner }).ok, true);
  });
});

describe('partner peek authorization matrix', () => {
  const owner = 'owner-1';
  const partner = 'partner-1';
  const other = 'other-1';
  const live = {
    ownerUserId: owner,
    partnerUserId: partner,
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
  };
  const ownerRow = { id: owner, status: 'ACTIVE' };

  function denyReasons() {
    return [
      decidePartnerPeek({ viewerUserId: partner, share: null, owner: ownerRow }),
      decidePartnerPeek({
        viewerUserId: partner,
        share: { ...live, expiresAt: new Date(Date.now() - 1) },
        owner: ownerRow,
      }),
      decidePartnerPeek({
        viewerUserId: partner,
        share: { ...live, revokedAt: new Date() },
        owner: ownerRow,
      }),
      decidePartnerPeek({ viewerUserId: other, share: live, owner: ownerRow }),
      decidePartnerPeek({ viewerUserId: owner, share: live, owner: ownerRow }),
      decidePartnerPeek({ viewerUserId: partner, share: live, owner: null }),
      decidePartnerPeek({
        viewerUserId: partner,
        share: live,
        owner: { id: owner, status: 'BLOCKED' },
      }),
    ];
  }

  it('requires an authenticated bound partner and a live owner', () => {
    const ok = decidePartnerPeek({ viewerUserId: partner, share: live, owner: ownerRow });
    assert.equal(ok.ok, true);
  });

  it('unauthenticated peek is 401 and never a share payload', () => {
    const denied = decidePartnerPeek({ viewerUserId: null, share: live, owner: ownerRow });
    assert.equal(denied.ok, false);
    assert.equal(denied.http, 401);
    assert.equal(denied.error, SHARE_AUTH_ERROR);
    assert.equal(denied.period, undefined);
  });

  it('does not reveal why a code failed — same 404 body for every post-auth denial', () => {
    for (const denied of denyReasons()) {
      assert.equal(denied.ok, false);
      assert.equal(denied.http, 404);
      assert.equal(denied.error, SHARE_DENY_ERROR);
    }
  });

  it('accept is first-writer and never owner-writable', () => {
    assert.equal(decideShareAccept({ share: { ...live, partnerUserId: null }, viewerUserId: partner }).ok, true);
    assert.equal(decideShareAccept({ share: live, viewerUserId: other }).ok, false);
    assert.equal(decideShareAccept({ share: live, viewerUserId: owner }).ok, false);
    assert.equal(decideShareAccept({ share: { ...live, partnerUserId: null }, viewerUserId: owner }).ok, false);
  });
});

describe('permissions and partner payload', () => {
  const profile = {
    avgCycleLength: 28,
    avgPeriodLength: 5,
    lastPeriodStart: '2026-08-01',
    isIrregular: false,
  };
  const logs = [
    { date: '2026-08-01', flow: 'medium', symptoms: ['cramps'], notes: 'private' },
  ];

  it('defaults to period + phase only', () => {
    const perms = mergeSharePermissions(undefined);
    assert.deepEqual(perms, {
      period: true,
      cyclePhase: true,
      fertileWindow: false,
      symptoms: false,
    });
  });

  it('omits period when that permission is off', () => {
    const payload = buildPartnerPayload({
      profile,
      logs,
      permissions: normalizeSharePermissions({ period: false, cyclePhase: true }),
      today: '2026-08-01',
    });
    assert.equal(payload.period, undefined);
    assert.ok(payload.phase);
    assert.equal(payload.fertileWindow, undefined);
    assert.equal(payload.symptoms, undefined);
  });

  it('omits fertile window and symptoms unless explicitly enabled', () => {
    const off = buildPartnerPayload({
      profile,
      logs,
      permissions: { period: true, cyclePhase: true, fertileWindow: false, symptoms: false },
      today: '2026-08-01',
    });
    assert.equal(off.fertileWindow, undefined);
    assert.equal(off.symptoms, undefined);

    const on = buildPartnerPayload({
      profile,
      logs,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      today: '2026-08-01',
    });
    assert.equal(on.fertileWindow.estimated, true);
    assert.deepEqual(on.symptoms.keys, ['cramps']);
  });

  it('never includes notes, pregnancy, conditions, ids, or AI fields', () => {
    const payload = buildPartnerPayload({
      profile: { ...profile, conditions: ['pcos'], dueDate: '2026-12-01' },
      logs,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: true },
      today: '2026-08-01',
    });
    const keys = Object.keys(payload);
    assert.ok(!keys.includes('notes'));
    assert.ok(!keys.includes('pregnancy'));
    assert.ok(!keys.includes('conditions'));
    assert.ok(!keys.includes('userId'));
    assert.ok(!keys.includes('aiInsights'));
    assert.ok(!keys.includes('partnerShareCode'));
    assert.ok(!keys.includes('email'));
    assert.ok(!JSON.stringify(payload).includes('private'));
    assert.equal(partnerPayloadHasLeak(payload), false);
    assert.equal(payload.estimated, true);
  });

  it('strips each permission independently', () => {
    const base = { profile, logs, today: '2026-08-01' };
    const periodOff = buildPartnerPayload({
      ...base,
      permissions: { period: false, cyclePhase: true, fertileWindow: true, symptoms: true },
    });
    assert.equal(periodOff.period, undefined);
    assert.ok(periodOff.phase);
    assert.ok(periodOff.fertileWindow);
    assert.ok(periodOff.symptoms);

    const phaseOff = buildPartnerPayload({
      ...base,
      permissions: { period: true, cyclePhase: false, fertileWindow: true, symptoms: true },
    });
    assert.equal(phaseOff.phase, undefined);
    assert.ok(phaseOff.period);

    const fertileOff = buildPartnerPayload({
      ...base,
      permissions: { period: true, cyclePhase: true, fertileWindow: false, symptoms: true },
    });
    assert.equal(fertileOff.fertileWindow, undefined);
    assert.ok(fertileOff.symptoms);

    const symptomsOff = buildPartnerPayload({
      ...base,
      permissions: { period: true, cyclePhase: true, fertileWindow: true, symptoms: false },
    });
    assert.equal(symptomsOff.symptoms, undefined);
    assert.ok(symptomsOff.fertileWindow);
  });
});

describe('generic errors and cache', () => {
  it('uses the same deny body for missing and unauthorized-after-auth cases', () => {
    const a = mockRes();
    const b = mockRes();
    denyShare(a);
    denyShare(b);
    assert.equal(a.statusCode, 404);
    assert.deepEqual(a.body, b.body);
    assert.equal(a.body.error, SHARE_DENY_ERROR);
    assert.match(a.headers['Cache-Control'], /no-store/);
  });

  it('unauthenticated closed handler never returns cycle fields', () => {
    const res = mockRes();
    denyShareAuth(res);
    assert.equal(res.statusCode, 401);
    assert.equal(res.body.error, SHARE_AUTH_ERROR);
    assert.equal(res.body.nextPeriodStart, undefined);
    assert.equal(res.body.fertileWindow, undefined);
    assert.equal(res.body.pregnancy, undefined);
    assert.match(res.headers['Cache-Control'], /no-store/);
  });

  it('marks share responses private no-store', () => {
    const headers = privateCacheHeaders();
    assert.match(headers['Cache-Control'], /private/);
    assert.match(headers['Cache-Control'], /no-store/);
    assert.equal(headers['Surrogate-Control'], 'no-store');
  });
});

describe('owner view', () => {
  it('hides the code when the share is inactive', () => {
    const view = ownerShareView(null, 'abc');
    assert.equal(view.active, false);
    assert.equal(view.code, null);
  });

  it('returns expiry for a live share', () => {
    const expires = shareExpiresAt(new Date('2026-08-01T00:00:00.000Z'));
    const view = ownerShareView(
      {
        ownerUserId: 'o',
        partnerUserId: 'p',
        expiresAt: expires,
        revokedAt: null,
        permissions: { period: true, cyclePhase: false, fertileWindow: false, symptoms: false },
      },
      'aa'.repeat(32),
    );
    assert.equal(view.active, true);
    assert.equal(view.partnerBound, true);
    assert.equal(view.permissions.period, true);
    assert.equal(view.permissions.cyclePhase, false);
    assert.ok(view.expiresAt);
  });
});
